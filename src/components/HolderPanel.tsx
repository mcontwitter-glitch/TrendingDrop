import { useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { AlertCircle, Gift } from 'lucide-react'
import type { CurveToken, HolderPositionView } from '../types'
import { useVelocityProgram } from '../hooks/useVelocityProgram'
import { claimHolderRewards } from '../lib/solana/velocityTransactions'
import { formatLamportsAsSol, formatTokenAmount } from '../lib/format'
import { useToast } from './Toast'

interface HolderPanelProps {
  curve: CurveToken
  holder: HolderPositionView | null
  onClaimed?: () => void
}

export function HolderPanel({ curve, holder, onClaimed }: HolderPanelProps) {
  const { program, publicKey, connected } = useVelocityProgram()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const balance = holder?.balance ?? 0
  const claimable = holder?.claimableRewardsLamports ?? 0
  const canClaim = Boolean(
    connected && program && publicKey && curve.onChain && claimable > 0,
  )

  async function handleClaim() {
    setError(null)
    setMessage(null)
    if (!canClaim || !program || !publicKey) {
      const mockMsg = !curve.onChain
        ? 'Mock mode — claim unavailable offline / not deployed'
        : !connected
          ? 'Connect wallet to claim'
          : claimable <= 0
            ? 'Nothing to claim'
            : 'Unable to claim'
      setMessage(mockMsg)
      toast.info('Claim', mockMsg)
      return
    }
    setSubmitting(true)
    try {
      const { signature } = await claimHolderRewards(
        program,
        new PublicKey(curve.pubkey),
        publicKey,
      )
      setMessage(`Claimed · ${signature.slice(0, 12)}…`)
      toast.success('Rewards claimed', `${signature.slice(0, 16)}…`)
      onClaimed?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toast.error('Claim failed', msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-bcc-border bg-bcc-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Holder rewards</h3>
        <Gift className="h-4 w-4 text-purple-400" />
      </div>
      <p className="mb-4 text-xs text-bcc-muted">
        50% of sell tax accrues to holders pro-rata. Claim anytime.
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

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-bcc-border/60 bg-bcc-bg px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-bcc-muted">Balance</div>
          <div className="mt-0.5 font-display text-base font-bold text-bcc-text">
            {formatTokenAmount(balance)}
          </div>
          <div className="text-[10px] text-bcc-muted">${curve.ticker}</div>
        </div>
        <div className="rounded-xl border border-purple-500/25 bg-purple-500/10 px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-purple-300/80">Claimable</div>
          <div className="mt-0.5 font-display text-base font-bold text-purple-200">
            {formatLamportsAsSol(claimable)} SOL
          </div>
          <div className="text-[10px] text-purple-300/70">
            Pool {formatLamportsAsSol(curve.holderRewardsPoolLamports)}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={submitting || (curve.onChain && claimable <= 0)}
        onClick={() => void handleClaim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 font-display text-sm font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? 'Confirm in wallet…' : 'Claim rewards'}
      </button>
    </div>
  )
}
