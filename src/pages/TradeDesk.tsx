import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, Droplets, Percent, Zap } from 'lucide-react'
import { useCurveDetail, useHolderPosition } from '../hooks/useCurves'
import { useVelocityProgram } from '../hooks/useVelocityProgram'
import { VelocityChart } from '../components/VelocityChart'
import { TradePanel } from '../components/TradePanel'
import { HolderPanel } from '../components/HolderPanel'
import {
  formatLamportsAsSol,
  formatPriceLamports,
  formatSol,
  formatTokenAmount,
  shortAddress,
  timeAgo,
} from '../lib/format'
import { useNow } from '../hooks/useNow'
import { TierBadge } from '../components/TierBadge'
import { mockCreatorTiers } from '../data/mockProfiles'

export function TradeDesk() {
  const { curveId } = useParams<{ curveId: string }>()
  const { curve, loading, error, source, refresh } = useCurveDetail(curveId)
  const { publicKey } = useVelocityProgram()
  const { holder, refresh: refreshHolder } = useHolderPosition(curve, publicKey)
  const now = useNow()

  if (loading && !curve) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="font-medium text-bcc-text">Loading curve…</p>
      </div>
    )
  }

  if (!curve) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <div className="mb-3 text-4xl">🕳️</div>
        <h1 className="font-display text-xl font-bold">Curve not found</h1>
        <p className="mt-2 text-sm text-bcc-muted">
          {error ?? "This VelocityToken isn't on-chain (or in mock data) for this cluster."}
        </p>
        <Link
          to="/trade"
          className="mt-6 inline-block text-sm font-semibold text-purple-400 hover:underline"
        >
          ← Back to trade
        </Link>
      </div>
    )
  }

  const creatorTier = mockCreatorTiers[curve.creator]
  const taxLabel =
    curve.sellTaxBps >= 1500 ? '15% steepen' : curve.sellTaxBps <= 500 ? '5% flatten' : `${curve.sellTaxBps / 100}%`

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        to="/trade"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-bcc-muted transition hover:text-bcc-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to trade
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-[11px]">
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
        {curve.isMerged && (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-amber-200">
            Merged · trading paused
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <div className="overflow-hidden rounded-2xl border border-bcc-border bg-bcc-surface">
            <div
              className={`relative flex h-40 items-center justify-center bg-gradient-to-br ${curve.gradient} sm:h-48`}
            >
              <span className="text-7xl drop-shadow-xl sm:text-8xl">{curve.emoji}</span>
              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-bcc-green/25 bg-bcc-green/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bcc-green backdrop-blur">
                  Live
                </span>
                <span className="rounded-full border border-white/10 bg-black/50 px-2.5 py-0.5 text-xs font-bold text-bcc-green backdrop-blur">
                  ${curve.ticker}
                </span>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <h1 className="font-display text-2xl font-bold sm:text-3xl">{curve.title}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-bcc-muted">
                <span>
                  Creator <span className="font-mono text-bcc-text">{curve.creator}</span>
                  {' · '}
                  <span className="font-mono">{shortAddress(curve.pubkey)}</span>
                </span>
                {creatorTier && <TierBadge tier={creatorTier} size="sm" />}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-bcc-text/90">{curve.blurb}</p>
              {curve.storyId && (
                <Link
                  to={`/story/${curve.storyId}`}
                  className="mt-3 inline-block text-xs font-semibold text-purple-400 hover:underline"
                >
                  View origin story →
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric
              icon={<Zap className="h-4 w-4 text-bcc-green" />}
              label="Spot price"
              value={formatPriceLamports(curve.currentPriceLamports)}
            />
            <Metric
              icon={<Droplets className="h-4 w-4 text-purple-400" />}
              label="SOL reserve"
              value={`${formatSol(curve.solReserveSol)} SOL`}
            />
            <Metric
              icon={<span className="text-bcc-green">Σ</span>}
              label="Supply"
              value={formatTokenAmount(curve.currentSupply)}
            />
            <Metric
              icon={<Percent className="h-4 w-4 text-amber-300" />}
              label="Sell tax"
              value={taxLabel}
            />
          </div>

          <VelocityChart curve={curve} />

          <div className="rounded-2xl border border-bcc-border bg-bcc-surface p-5 text-sm">
            <h2 className="mb-3 font-display text-lg font-bold">Curve stats</h2>
            <dl className="grid gap-2 sm:grid-cols-2">
              <Row label="Base price" value={`${curve.basePriceLamports} lamports`} />
              <Row label="Curve k" value={String(curve.curveK)} />
              <Row label="Attention" value={String(curve.attentionScore)} />
              <Row label="Price velocity" value={String(curve.priceVelocity)} />
              <Row label="Protocol fee" value="1.5%" />
              <Row
                label="Holder rewards pool"
                value={`${formatLamportsAsSol(curve.holderRewardsPoolLamports)} SOL`}
              />
              <Row label="Merges" value={String(curve.mergeCount)} />
              <Row
                label="Oracle update"
                value={
                  curve.lastOracleUpdate
                    ? timeAgo(curve.lastOracleUpdate, now)
                    : '—'
                }
              />
            </dl>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-bcc-muted">
              <Clock className="h-3 w-3" />
              Quotes are client estimates of on-chain integral math — verify in wallet.
            </p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-24 space-y-4">
            <TradePanel
              curve={curve}
              holderBalance={holder?.balance ?? 0}
              onTraded={() => {
                void refresh()
                void refreshHolder()
              }}
            />
            <HolderPanel
              curve={curve}
              holder={holder}
              onClaimed={() => {
                void refresh()
                void refreshHolder()
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-bcc-border bg-bcc-surface p-4">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-bcc-muted">
        {icon}
        {label}
      </div>
      <div className="truncate font-display text-base font-bold text-bcc-text sm:text-lg">
        {value}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-bcc-bg/60 px-3 py-2">
      <dt className="text-bcc-muted">{label}</dt>
      <dd className="font-mono text-xs font-semibold text-bcc-text">{value}</dd>
    </div>
  )
}
