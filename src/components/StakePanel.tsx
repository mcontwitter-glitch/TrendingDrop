import { useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { Zap, AlertCircle } from 'lucide-react'
import { formatSol } from '../lib/format'
import { useNarrativeProgram } from '../hooks/useNarrativeProgram'
import { estimateAirdropWholeTokens, stakeOnNarrative } from '../lib/solana/transactions'
import { DEFAULT_STAKER_AIRDROP_BPS, LAMPORTS_PER_SOL } from '../lib/solana/constants'
import { useToast } from './Toast'

const QUICK = [0.1, 0.5, 1, 5]

interface StakePanelProps {
  storyTitle: string
  storyPubkey?: string
  onChain?: boolean
  minStake?: number
  /** Current story total stake in SOL (for est. airdrop share). */
  totalStakedSol?: number
  /** Config staker airdrop bps (default 2000 = 20%). */
  stakerAirdropBps?: number
  onStaked?: () => void
}

export function StakePanel({
  storyTitle,
  storyPubkey,
  onChain,
  minStake = 0.01,
  totalStakedSol = 0,
  stakerAirdropBps = DEFAULT_STAKER_AIRDROP_BPS,
  onStaked,
}: StakePanelProps) {
  const { program, publicKey, connected } = useNarrativeProgram()
  const toast = useToast()
  const [amount, setAmount] = useState('1')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const num = parseFloat(amount) || 0
  const valid = num >= minStake
  const canOnChain = Boolean(connected && program && publicKey && onChain && storyPubkey)
  const projectedTotal = totalStakedSol + (valid ? num * 0.98 : 0) // approx after 2% fee
  const estAirdropWhole = estimateAirdropWholeTokens(
    Math.round((valid ? num * 0.98 : 0) * LAMPORTS_PER_SOL),
    Math.round(Math.max(projectedTotal, 1e-9) * LAMPORTS_PER_SOL),
    stakerAirdropBps,
  )
  const estAirdropLabel =
    estAirdropWhole >= 1_000_000
      ? `${(estAirdropWhole / 1_000_000).toFixed(2)}M`
      : estAirdropWhole >= 1_000
        ? `${(estAirdropWhole / 1_000).toFixed(1)}k`
        : estAirdropWhole.toFixed(0)

  async function handleStake() {
    if (!valid) return
    setError(null)
    setMessage(null)

    if (canOnChain && program && publicKey && storyPubkey) {
      setSubmitting(true)
      try {
        const { signature } = await stakeOnNarrative(program, {
          storyPubkey: new PublicKey(storyPubkey),
          amountSol: num,
          staker: publicKey,
        })
        setSubmitted(true)
        setMessage(`Stake confirmed · ${signature.slice(0, 12)}…`)
        toast.success('Stake confirmed', `${signature.slice(0, 16)}…`)
        onStaked?.()
        window.setTimeout(() => setSubmitted(false), 4000)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        toast.error('Stake failed', msg)
      } finally {
        setSubmitting(false)
      }
      return
    }

    setSubmitted(true)
    const mockMsg =
      connected && !onChain
        ? 'Story not on-chain / program not deployed — mock stake'
        : !connected
          ? 'Connect wallet for real txs — mock stake'
          : 'Wallet / RPC unavailable — mock stake'
    setMessage(mockMsg)
    toast.info('Mock stake', mockMsg)
    window.setTimeout(() => {
      setSubmitted(false)
      setMessage(null)
    }, 2800)
  }

  return (
    <div className="bcc-card rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Stake on this story</h3>
        <span className="text-[10px] uppercase tracking-wider text-bcc-muted">
          {canOnChain ? 'On-chain' : 'Mock · fallback'}
        </span>
      </div>
      <p className="mb-4 text-sm text-bcc-muted">
        Back <span className="text-bcc-text">{storyTitle}</span> with SOL. Top narratives graduate to
        tokenization — stakers share {(stakerAirdropBps / 100).toFixed(0)}% of supply as a token
        airdrop.
      </p>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      {message && !error && (
        <div className="mb-3 rounded-lg border border-bcc-border bg-bcc-bg px-3 py-2 text-xs text-bcc-muted">
          {message}
        </div>
      )}

      <label className="mb-1.5 block text-xs font-medium text-bcc-muted">Amount (SOL)</label>
      <div className="relative mb-3">
        <input
          type="number"
          min={minStake}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-xl border border-bcc-border bg-bcc-bg amount-input px-4 py-3 pr-14 text-lg font-semibold text-bcc-text outline-none transition focus:border-bcc-green/60 focus:ring-1 focus:ring-bcc-green/25"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-bcc-muted">
          SOL
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setAmount(String(q))}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              num === q
                ? 'border-bcc-green/50 bg-bcc-green/10 text-bcc-green'
                : 'border-bcc-border bg-bcc-elevated text-bcc-muted hover:border-bcc-cyan/40 hover:text-bcc-text'
            }`}
          >
            {q} SOL
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!valid || submitting}
        onClick={() => void handleStake()}
        className="bcc-glow-btn flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Zap className="h-4 w-4" />
        {submitting
          ? 'Confirm in wallet…'
          : submitted
            ? canOnChain
              ? 'Stake submitted ✓'
              : 'Simulated stake submitted ✓'
            : `Stake ${formatSol(num)} SOL`}
      </button>

      {valid && (
        <p className="mt-3 rounded-lg border border-bcc-cyan/25 bg-bcc-cyan/5 px-3 py-2 text-center text-[11px] text-bcc-cyan">
          Est. airdrop share if this story graduates:{' '}
          <span className="font-semibold text-bcc-text">~{estAirdropLabel} tokens</span>
          <span className="text-bcc-muted"> · {(stakerAirdropBps / 100).toFixed(0)}% of 1B pro-rata</span>
        </p>
      )}
      <p className="mt-3 text-center text-[11px] text-bcc-muted">
        Min stake {minStake} SOL
        {canOnChain ? ' · Real stake_on_narrative tx' : ' · Connect wallet + on-chain story for live stake'}
      </p>
    </div>
  )
}
