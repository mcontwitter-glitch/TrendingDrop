import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PublicKey } from '@solana/web3.js'
import { ArrowLeft, AlertCircle, GitMerge } from 'lucide-react'
import { useCurves } from '../hooks/useCurves'
import { useMerges } from '../hooks/useMerges'
import { useMergeProgram } from '../hooks/useMergeProgram'
import {
  ensureMergeConfig,
  initializeLoreAsset,
  proposeMerge,
} from '../lib/solana/mergeTransactions'
import { useToast } from '../components/Toast'
import { findLoreAssetPda } from '../lib/solana/mergePdas'

export function MergePropose() {
  const navigate = useNavigate()
  const { curves } = useCurves()
  const { loreAssets, refresh: refreshMerges } = useMerges()
  const { program, publicKey, connected, cluster } = useMergeProgram()
  const toast = useToast()
  const [absorber, setAbsorber] = useState(curves[0]?.pubkey ?? '')
  const [target, setTarget] = useState(curves[1]?.pubkey ?? '')
  const [ratio, setRatio] = useState('500')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!absorber || !target || absorber === target) {
      setError('Pick two different curves')
      return
    }
    const absorptionRatio = Math.floor(parseFloat(ratio) || 0)
    if (absorptionRatio <= 0) {
      setError('absorption_ratio must be > 0 (e.g. 500 = 5.00x)')
      return
    }

    setSubmitting(true)
    try {
      if (connected && program && publicKey) {
        await ensureMergeConfig(program, publicKey)

        // Ensure lore assets exist (permissionless init)
        for (const curvePk of [absorber, target]) {
          const curve = new PublicKey(curvePk)
          const [lorePda] = findLoreAssetPda(curve, program.programId)
          try {
            await program.account.loreAsset.fetch(lorePda)
          } catch {
            const hash = new Uint8Array(32)
            crypto.getRandomValues(hash)
            await initializeLoreAsset(program, curve, publicKey, hash)
            toast.info('Initialized lore asset', short(curvePk))
          }
        }

        const { signature, proposalPda } = await proposeMerge(program, {
          absorber: new PublicKey(absorber),
          target: new PublicKey(target),
          absorptionRatio,
          proposer: publicKey,
        })
        toast.success('Merge proposed', `${signature.slice(0, 16)}…`)
        await refreshMerges()
        navigate(`/merge/${proposalPda.toBase58()}`)
      } else {
        toast.info(
          'Mock propose',
          connected
            ? 'LoreMerge not deployed / wallet program unavailable'
            : 'Connect wallet on a deployed cluster for a real tx',
        )
        window.setTimeout(() => navigate('/merge'), 1200)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toast.error('Propose failed', msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <Link
        to="/merge"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-bcc-muted transition hover:text-bcc-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to merge
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Propose merge</h1>
        <p className="mt-2 text-sm text-bcc-muted">
          Absorber must hold lore ≥7 days old; proposer needs &gt;1% of absorber supply. Registered
          lore: {loreAssets.length}. Cluster: {cluster}.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-4 bcc-card rounded-2xl p-5 sm:p-6"
      >
        <Field label="Absorber (strong)">
          <select
            value={absorber}
            onChange={(e) => setAbsorber(e.target.value)}
            className="field"
          >
            {curves.map((c) => (
              <option key={c.pubkey} value={c.pubkey}>
                {c.emoji} ${c.ticker} — {c.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Target (absorb)">
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="field">
            {curves.map((c) => (
              <option key={c.pubkey} value={c.pubkey}>
                {c.emoji} ${c.ticker} — {c.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Absorption ratio (×100)" hint="500 = 1:5 target→absorber">
          <input
            type="number"
            min={1}
            value={ratio}
            onChange={(e) => setRatio(e.target.value)}
            className="field"
          />
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="bcc-glow-btn flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold disabled:opacity-40"
        >
          <GitMerge className="h-4 w-4" />
          {submitting
            ? 'Confirm in wallet…'
            : connected
              ? 'Propose on-chain'
              : 'Propose (mock)'}
        </button>
      </form>

      <style>{`
        .field {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #3f3f46;
          background: #09090b;
          padding: 0.75rem 1rem;
          color: #fafafa;
          font-size: 0.875rem;
          outline: none;
        }
        .field:focus { border-color: #a855f799; }
      `}</style>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide text-bcc-muted">
          {label}
        </label>
        {hint && <span className="text-[10px] text-bcc-muted">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function short(pk: string) {
  return `${pk.slice(0, 4)}…${pk.slice(-4)}`
}
