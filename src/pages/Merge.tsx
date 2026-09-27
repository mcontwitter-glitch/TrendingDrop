import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { GitMerge, Plus, RefreshCw, Scroll } from 'lucide-react'
import { useMerges } from '../hooks/useMerges'
import { formatCountdown, formatLamportsAsSol, formatTokenAmount, shortAddress } from '../lib/format'
import { useNow } from '../hooks/useNow'
import type { MergeProposalView } from '../types'

const statusStyle: Record<MergeProposalView['status'], string> = {
  active: 'border-bcc-gold/40 bg-bcc-gold/15 text-bcc-gold',
  passed: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
  rejected: 'border-red-400/30 bg-red-500/15 text-red-200',
  executed: 'border-cyan-400/30 bg-cyan-500/15 text-cyan-200',
  pending_settlement: 'border-bcc-gold/35 bg-bcc-gold/10 text-bcc-gold',
}

export function Merge() {
  const { proposals, loreAssets, source, loading, error, refresh } = useMerges()
  const now = useNow()

  const sorted = useMemo(
    () =>
      [...proposals].sort((a, b) => {
        const rank = (s: MergeProposalView['status']) =>
          s === 'active' ? 0 : s === 'passed' ? 1 : s === 'pending_settlement' ? 2 : 3
        return rank(a.status) - rank(b.status) || b.proposedAt - a.proposedAt
      }),
    [proposals],
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Lore Merge
          </h1>
          <p className="mt-1 max-w-xl text-sm text-bcc-muted">
            Strong VelocityTokens absorb failed narratives. Vote with holder balance + lore power —
            5% merge fee on execute.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wider ${
                source === 'chain'
                  ? 'border-bcc-green/30 bg-bcc-green/10 text-bcc-green'
                  : 'border-bcc-border bg-bcc-elevated text-bcc-muted'
              }`}
            >
              {loading ? 'Loading…' : source === 'chain' ? 'On-chain' : 'Mock fallback'}
            </span>
            {error && <span className="text-bcc-muted">{error}</span>}
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-1 rounded-full border border-bcc-border px-2 py-0.5 text-bcc-muted transition hover:border-bcc-cyan/40 hover:text-bcc-text"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-bcc-cyan/30 bg-bcc-cyan/10 px-3 py-2 text-xs font-semibold text-bcc-cyan">
            <GitMerge className="h-4 w-4" />
            Phase 3 · LoreMerge
          </div>
          <Link
            to="/merge/propose"
            className="bcc-glow-btn inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold"
          >
            <Plus className="h-3.5 w-3.5" />
            Propose merge
          </Link>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-lg font-bold">Active proposals</h2>
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-bcc-border bg-bcc-surface/50 px-6 py-12 text-center">
            <p className="font-medium text-bcc-text">No merge proposals yet</p>
            <p className="mt-1 text-sm text-bcc-muted">
              Register lore assets then propose an absorption.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {sorted.map((p) => (
              <Link
                key={p.id}
                to={`/merge/${p.pubkey}`}
                className="fade-up bcc-card group rounded-2xl p-5 transition"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {p.absorberImageUrl ? (
                      <img
                        src={p.absorberImageUrl}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover ring-1 ring-white/10"
                      />
                    ) : (
                      <span className="text-2xl">{p.absorberEmoji}</span>
                    )}
                    <GitMerge className="h-4 w-4 text-bcc-cyan" />
                    {p.targetImageUrl ? (
                      <img
                        src={p.targetImageUrl}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover ring-1 ring-white/10"
                      />
                    ) : (
                      <span className="text-2xl">{p.targetEmoji}</span>
                    )}
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusStyle[p.status]}`}
                  >
                    {p.status.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="font-display text-base font-bold !text-bcc-gold group-hover:brightness-110">
                  ${p.absorberTicker} absorbs ${p.targetTicker}
                </h3>
                <p className="mt-1 text-xs text-bcc-muted">
                  Ratio {(p.absorptionRatio / 100).toFixed(2)}x · quorum{' '}
                  {formatTokenAmount(p.quorumRequired)} · by {shortAddress(p.proposer)}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Yes" value={formatTokenAmount(p.yesVotes)} tone="good" />
                  <Stat label="No" value={formatTokenAmount(p.noVotes)} />
                  <Stat
                    label="Ends"
                    value={
                      p.status === 'active'
                        ? formatCountdown(p.votingEnds, now)
                        : p.executed
                          ? 'Done'
                          : 'Closed'
                    }
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Scroll className="h-4 w-4 text-bcc-cyan" />
          <h2 className="font-display text-lg font-bold">Lore assets</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {loreAssets.map((l) => (
            <div
              key={l.pubkey}
              className="bcc-card rounded-2xl p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                {l.imageUrl ? (
                  <img
                    src={l.imageUrl}
                    alt=""
                    className="h-10 w-10 rounded-lg object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <span className="text-2xl">{l.emoji}</span>
                )}
                {l.isAbsorbed ? (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-200">
                    Absorbed
                  </span>
                ) : (
                  <span className="rounded-full border border-bcc-gold/40 bg-bcc-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase text-bcc-gold">
                    Active
                  </span>
                )}
              </div>
              <div className="font-stat text-sm">
                {l.title} · ${l.ticker}
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-bcc-muted">
                <div>Lore power {(l.lorePowerBps / 10_000).toFixed(2)}x</div>
                <div>Value {formatLamportsAsSol(l.loreValueLamports)} SOL</div>
                <div>History {l.absorptionHistory.length}/10</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good'
}) {
  return (
    <div className="rounded-xl border border-bcc-border/60 bg-bcc-bg px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-bcc-muted">{label}</div>
      <div
        className={`mt-0.5 font-stat text-sm ${
          tone === 'good' ? 'text-bcc-gold' : 'text-bcc-text'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
