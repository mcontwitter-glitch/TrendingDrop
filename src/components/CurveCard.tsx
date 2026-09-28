import { Link } from 'react-router-dom'
import type { CurveToken } from '../types'
import {
  formatMarketCapUsd,
  formatPriceLamports,
  formatSol,
} from '../lib/format'
import { useSolUsdPrice } from '../hooks/useSolUsdPrice'
import {
  formatSupplyMetric,
  launchpadDisplayMetrics,
} from '../lib/solana/tokenEconomics'
import { TickerCaChip } from './TickerCaChip'

interface CurveCardProps {
  curve: CurveToken
  index?: number
}

export function CurveCard({ curve, index = 0 }: CurveCardProps) {
  const modeBadge =
    curve.mode === 'steepen'
      ? 'bg-bcc-cyan/15 text-bcc-cyan border-bcc-cyan/30'
      : curve.mode === 'flatten'
        ? 'bg-amber-400/15 text-amber-200 border-amber-400/30'
        : 'bg-bcc-elevated text-bcc-muted border-bcc-border'

  const metrics = launchpadDisplayMetrics(curve)
  const { solUsd } = useSolUsdPrice()

  return (
    <Link
      to={`/trade/${curve.pubkey}`}
      className="fade-up bcc-card group flex flex-col overflow-hidden rounded-2xl transition"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div
        className={`relative flex h-28 items-center justify-center overflow-hidden bg-gradient-to-br ${curve.gradient}`}
      >
        {curve.imageUrl ? (
          <img
            src={curve.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="relative text-5xl drop-shadow-lg">{curve.emoji}</span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/10" />
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-bcc-green/25 bg-bcc-green/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bcc-green backdrop-blur">
            Live
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur ${modeBadge}`}
          >
            {curve.mode}
          </span>
          {metrics.priceCorrupt && (
            <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200 backdrop-blur">
              Price fix
            </span>
          )}
        </div>
        <div className="absolute right-3 top-3 z-10 max-w-[70%]">
          <TickerCaChip
            ticker={curve.ticker}
            address={curve.mint}
            size="sm"
            tone="green"
            className="justify-end"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-bold leading-tight group-hover:brightness-110">
          {curve.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs text-bcc-muted">{curve.blurb}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <Stat label="Spot" value={formatPriceLamports(metrics.effectivePriceLamports)} />
          <Stat label="Reserve" value={`${formatSol(curve.solReserveSol)} SOL`} />
          <Stat label="Supply" value={formatSupplyMetric(metrics.circulatingWhole)} />
          <Stat label="Mcap" value={formatMarketCapUsd(metrics.fdvSol, solUsd)} />
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-bcc-border/60 pt-3 text-[10px] text-bcc-muted">
          <span>
            A {curve.attentionScore} · V {curve.priceVelocity}
          </span>
          <span className="font-semibold text-bcc-cyan group-hover:underline">Trade →</span>
        </div>
      </div>
    </Link>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bcc-bg/80 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-bcc-muted">{label}</div>
      <div className="truncate font-semibold text-bcc-text">{value}</div>
    </div>
  )
}
