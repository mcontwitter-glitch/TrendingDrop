import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Shield, Sparkles } from 'lucide-react'
import { useProfile } from '../hooks/useProfile'
import { useReputationProgram } from '../hooks/useReputationProgram'
import { initializeProfile, mintReputationNft } from '../lib/solana/reputationTransactions'
import { TierBadge } from '../components/TierBadge'
import { useToast } from '../components/Toast'
import { accuracyPct } from '../lib/solana/reputationMappers'
import { formatLamportsAsSol, shortAddress, timeAgo } from '../lib/format'
import { useNow } from '../hooks/useNow'
import type { TraitName } from '../types'

const TRAIT_LABELS: Record<TraitName, string> = {
  EarlyAdopter: 'Early Adopter',
  OracleWhisperer: 'Oracle Whisperer',
  MergeMaster: 'Merge Master',
  DiamondHands: 'Diamond Hands',
  NarrativeCreator: 'Narrative Creator',
}

export function Profile() {
  const { profile, source, loading, error, existsOnChain, refresh, connected, publicKey } =
    useProfile()
  const { program } = useReputationProgram()
  const toast = useToast()
  const now = useNow()
  const [submitting, setSubmitting] = useState(false)

  async function handleInit() {
    if (!program || !publicKey) {
      toast.info('Connect wallet', 'Initialize requires a connected wallet on a deployed cluster')
      return
    }
    setSubmitting(true)
    try {
      const { signature } = await initializeProfile(program, publicKey)
      toast.success('Profile initialized', `${signature.slice(0, 16)}…`)
      await refresh()
    } catch (err) {
      toast.error('Initialize failed', err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMintNft() {
    if (!program || !publicKey) {
      toast.info('Connect wallet', 'Mint requires a connected wallet on a deployed cluster')
      return
    }
    setSubmitting(true)
    try {
      const { signature, mint } = await mintReputationNft(program, publicKey)
      toast.success('Reputation NFT minted', `${mint.toBase58().slice(0, 8)}… · ${signature.slice(0, 12)}…`)
      await refresh()
    } catch (err) {
      toast.error('Mint failed', err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-bcc-muted transition hover:text-bcc-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to board
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Trader profile</h1>
          <p className="mt-2 text-sm text-bcc-muted">
            ReputationNFT accuracy tiers — collateral for future launch allocations.
          </p>
        </div>
        <Shield className="h-8 w-8 shrink-0 text-bcc-cyan" />
      </div>

      {!connected && (
        <div className="rounded-2xl border border-dashed border-bcc-border bg-bcc-surface/50 px-6 py-12 text-center">
          <p className="font-medium text-bcc-text">Connect a wallet to view your profile</p>
          <p className="mt-1 text-sm text-bcc-muted">
            Badge appears in the header once connected (mock fallback if RPC empty).
          </p>
        </div>
      )}

      {connected && loading && !profile && (
        <p className="text-sm text-bcc-muted">Loading profile…</p>
      )}

      {connected && profile && (
        <>
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
            {!existsOnChain && (
              <span className="text-bcc-muted">Not initialized on this cluster</span>
            )}
          </div>

          <div className="bcc-card rounded-2xl p-6">
            <div className="flex flex-wrap items-center gap-3">
              <TierBadge tier={profile.tier} accuracyBps={profile.accuracyScoreBps} size="md" />
              <span className="font-mono text-xs text-bcc-muted">
                {shortAddress(profile.owner)}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Accuracy" value={accuracyPct(profile.accuracyScoreBps)} />
              <Stat
                label="Predictions"
                value={`${profile.correctPredictions}/${profile.totalPredictions}`}
              />
              <Stat
                label="Volume"
                value={`${formatLamportsAsSol(profile.totalVolumeLamports)} SOL`}
              />
              <Stat label="Updated" value={timeAgo(profile.lastUpdated, now)} />
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-bcc-muted">
                <Sparkles className="h-3.5 w-3.5 text-bcc-cyan" />
                Traits
              </div>
              {profile.traits.length === 0 ? (
                <p className="text-sm text-bcc-muted">No traits yet — earn them via stakes & merges.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profile.traits.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-bcc-cyan/30 bg-bcc-cyan/10 px-2.5 py-1 text-xs font-semibold text-bcc-cyan"
                    >
                      {TRAIT_LABELS[t] ?? t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {!existsOnChain && (
              <button
                type="button"
                disabled={submitting || !program}
                onClick={() => void handleInit()}
                className="bcc-glow-btn mt-6 w-full rounded-xl py-3 text-sm font-bold disabled:opacity-40"
              >
                {submitting
                  ? 'Confirm in wallet…'
                  : program
                    ? 'Initialize on-chain profile'
                    : 'Wallet / program unavailable'}
              </button>
            )}

            {existsOnChain && !profile.nftMint && (
              <button
                type="button"
                disabled={submitting || !program}
                onClick={() => void handleMintNft()}
                className="mt-4 w-full rounded-xl border border-bcc-cyan/40 bg-bcc-cyan/10 py-3 text-sm font-bold text-cyan-50 transition hover:bg-bcc-cyan/20 disabled:opacity-40"
              >
                {submitting ? 'Confirm in wallet…' : 'Mint Metaplex reputation NFT'}
              </button>
            )}

            {profile.nftMint && (
              <p className="mt-4 break-all font-mono text-[11px] text-bcc-muted">
                NFT mint: {profile.nftMint}
              </p>
            )}

            <ul className="mt-5 space-y-1 text-[11px] text-bcc-muted">
              <li>· Bronze 0–20% · Silver 20–40% · Gold 40–60% · Diamond 60–80% · Mythic 80%+</li>
              <li>· Accuracy includes Weighted_Volume_Factor (cap 1.5x)</li>
              <li>· Metaplex URI: https://bcc.local/reputation/[tier]/[owner].json (replaceable host)</li>
            </ul>
          </div>
        </>
      )}

      {connected && error && !profile && (
        <div className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-bcc-border/60 bg-bcc-bg px-3 py-3">
      <div className="text-[10px] uppercase tracking-wide text-bcc-muted">{label}</div>
      <div className="mt-0.5 font-stat text-sm text-bcc-text">{value}</div>
    </div>
  )
}
