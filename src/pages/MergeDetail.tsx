import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PublicKey } from '@solana/web3.js'
import { ArrowLeft, AlertCircle, Check, GitMerge, ThumbsDown, ThumbsUp, Zap } from 'lucide-react'
import { useMergeDetail } from '../hooks/useMerges'
import { useMergeProgram } from '../hooks/useMergeProgram'
import { executeMerge, voteMerge } from '../lib/solana/mergeTransactions'
import { useToast } from '../components/Toast'
import {
  formatCountdown,
  formatLamportsAsSol,
  formatTokenAmount,
  shortAddress,
} from '../lib/format'
import { useNow } from '../hooks/useNow'

export function MergeDetail() {
  const { proposalId } = useParams<{ proposalId: string }>()
  const { proposal, loading, error, source, refresh } = useMergeDetail(proposalId)
  const { program, publicKey, connected } = useMergeProgram()
  const toast = useToast()
  const now = useNow()
  const [voteAmount, setVoteAmount] = useState('10000')
  const [submitting, setSubmitting] = useState(false)

  if (loading && !proposal) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="font-medium text-bcc-text">Loading proposal…</p>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-xl font-bold">Proposal not found</h1>
        <p className="mt-2 text-sm text-bcc-muted">{error ?? 'Unknown proposal id'}</p>
        <Link to="/merge" className="mt-6 inline-block text-sm font-semibold text-purple-400">
          ← Back to merge
        </Link>
      </div>
    )
  }

  const canOnChain = Boolean(connected && program && publicKey && proposal.onChain)
  const votingOpen = proposal.status === 'active'
  const canExecute =
    proposal.status === 'passed' ||
    (proposal.status === 'active' && now >= proposal.votingEnds)

  // Capture for async handlers (TS narrow doesn't persist across awaits).
  const current = proposal

  async function handleVote(support: boolean) {
    setSubmitting(true)
    try {
      if (canOnChain && program && publicKey) {
        const { signature } = await voteMerge(program, {
          proposal: new PublicKey(current.pubkey),
          absorber: new PublicKey(current.absorber),
          amount: Math.floor(parseFloat(voteAmount) || 0),
          support,
          voter: publicKey,
        })
        toast.success(support ? 'Voted yes' : 'Voted no', `${signature.slice(0, 16)}…`)
        await refresh()
      } else {
        toast.info(
          `Mock ${support ? 'yes' : 'no'} vote`,
          !connected
            ? 'Connect wallet for real txs'
            : !current.onChain
              ? 'Proposal not on-chain / program not deployed'
              : 'Wallet / RPC unavailable',
        )
      }
    } catch (err) {
      toast.error('Vote failed', err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleExecute() {
    setSubmitting(true)
    try {
      if (canOnChain && program && publicKey) {
        const { signature } = await executeMerge(program, {
          proposal: new PublicKey(current.pubkey),
          absorber: new PublicKey(current.absorber),
          target: new PublicKey(current.target),
          executor: publicKey,
        })
        toast.success('Merge executed', `${signature.slice(0, 16)}…`)
        await refresh()
      } else {
        toast.info(
          'Mock execute',
          !connected
            ? 'Connect wallet for real txs'
            : 'Proposal/program not on this cluster',
        )
      }
    } catch (err) {
      toast.error('Execute failed', err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const yesPct =
    proposal.yesVotes + proposal.noVotes > 0
      ? (proposal.yesVotes / (proposal.yesVotes + proposal.noVotes)) * 100
      : 50

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        to="/merge"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-bcc-muted transition hover:text-bcc-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to merge
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px]">
        <span
          className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wider ${
            source === 'chain'
              ? 'border-bcc-green/30 bg-bcc-green/10 text-bcc-green'
              : 'border-bcc-border bg-bcc-elevated text-bcc-muted'
          }`}
        >
          {source === 'chain' ? 'On-chain' : 'Mock fallback'}
        </span>
        {error && <span className="text-bcc-muted">{error}</span>}
      </div>

      <div className="rounded-2xl border border-bcc-border bg-bcc-surface p-6">
        <div className="mb-4 flex items-center gap-3 text-3xl">
          <span>{proposal.absorberEmoji}</span>
          <GitMerge className="h-5 w-5 text-purple-400" />
          <span>{proposal.targetEmoji}</span>
        </div>
        <h1 className="font-display text-2xl font-bold">
          ${proposal.absorberTicker} absorbs ${proposal.targetTicker}
        </h1>
        <p className="mt-2 text-sm text-bcc-muted">
          {proposal.absorberTitle} ← {proposal.targetTitle} · ratio{' '}
          {(proposal.absorptionRatio / 100).toFixed(2)}x · proposer{' '}
          {shortAddress(proposal.proposer)}
        </p>

        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-xs text-bcc-muted">
            <span>Yes {formatTokenAmount(proposal.yesVotes)}</span>
            <span>No {formatTokenAmount(proposal.noVotes)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-bcc-bg">
            <div
              className="h-full rounded-full bg-purple-500 transition-all"
              style={{ width: `${yesPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-bcc-muted">
            <span>Quorum {formatTokenAmount(proposal.quorumRequired)}</span>
            <span>
              {votingOpen
                ? `Ends ${formatCountdown(proposal.votingEnds, now)}`
                : proposal.executed
                  ? proposal.settlementPending
                    ? 'Executed · settlement pending'
                    : 'Executed'
                  : 'Voting closed'}
            </span>
          </div>
        </div>

        {(proposal.feeLamports > 0 || proposal.liquidityLamports > 0) && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-bcc-border/60 bg-bcc-bg px-3 py-2">
              <div className="text-bcc-muted">5% fee</div>
              <div className="font-display font-bold">
                {formatLamportsAsSol(proposal.feeLamports)} SOL
              </div>
            </div>
            <div className="rounded-xl border border-bcc-border/60 bg-bcc-bg px-3 py-2">
              <div className="text-bcc-muted">90% liquidity</div>
              <div className="font-display font-bold">
                {formatLamportsAsSol(proposal.liquidityLamports)} SOL
              </div>
            </div>
          </div>
        )}

        {votingOpen && (
          <div className="mt-6 rounded-xl border border-purple-500/25 bg-purple-500/5 p-4">
            <label className="mb-1.5 block text-xs font-medium text-bcc-muted">
              Vote weight (holder balance units)
            </label>
            <input
              type="number"
              min={1}
              value={voteAmount}
              onChange={(e) => setVoteAmount(e.target.value)}
              className="mb-3 w-full rounded-xl border border-bcc-border bg-bcc-bg px-3 py-2.5 text-sm text-bcc-text outline-none focus:border-purple-500/50"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleVote(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 py-2.5 text-sm font-bold text-white transition hover:bg-purple-500 disabled:opacity-40"
              >
                <ThumbsUp className="h-4 w-4" />
                {submitting ? '…' : 'Vote yes'}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleVote(false)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-bcc-border bg-bcc-elevated py-2.5 text-sm font-bold text-bcc-text transition hover:border-zinc-500 disabled:opacity-40"
              >
                <ThumbsDown className="h-4 w-4" />
                Vote no
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-bcc-muted">
              {canOnChain
                ? 'On-chain vote_merge'
                : 'Mock · connect wallet + deployed LoreMerge for live votes'}
            </p>
          </div>
        )}

        {!proposal.executed && (canExecute || proposal.status === 'passed') && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleExecute()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-bcc-green py-3 text-sm font-bold text-white transition hover:bg-bcc-green-dim disabled:opacity-40"
          >
            <Zap className="h-4 w-4" />
            {submitting ? 'Confirm in wallet…' : 'Execute merge'}
          </button>
        )}

        {proposal.executed && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            <Check className="h-4 w-4" />
            Merge executed
            {proposal.settlementPending ? ' — vault settlement deferred' : ''}
          </div>
        )}

        {!connected && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-bcc-border bg-bcc-bg px-3 py-2 text-xs text-bcc-muted">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Connect wallet to vote / execute on-chain. Mock flows work offline.
          </div>
        )}
      </div>
    </div>
  )
}
