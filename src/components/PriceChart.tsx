import { useMemo } from 'react'
import type { CurveToken } from '../types'
import type { PriceSample } from '../lib/priceHistory'
import {
  formatMarketCapSol,
  formatPriceLamports,
} from '../lib/format'
import { launchpadDisplayMetrics } from '../lib/solana/tokenEconomics'
import { spotPrice, velocityParams } from '../lib/solana/velocityMath'

interface PriceChartProps {
  curve: CurveToken
  samples: PriceSample[]
}

const W = 480
const H = 160
const PAD = { top: 12, right: 8, bottom: 20, left: 8 }

function buildPath(
  points: { x: number; y: number }[],
  closeArea: boolean,
): { line: string; area: string } {
  if (points.length === 0) return { line: '', area: '' }
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ')
  if (!closeArea) return { line, area: '' }
  const first = points[0]!
  const last = points[points.length - 1]!
  const area = `${line} L${last.x.toFixed(2)},${H - PAD.bottom} L${first.x.toFixed(2)},${H - PAD.bottom} Z`
  return { line, area }
}

function mapPoints(
  values: number[],
  xs?: number[],
): { x: number; y: number }[] {
  const n = values.length
  if (n === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1)
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  return values.map((v, i) => {
    const xFrac = xs
      ? (xs[i]! - xs[0]!) / Math.max(xs[xs.length - 1]! - xs[0]!, 1)
      : i / Math.max(n - 1, 1)
    const x = PAD.left + xFrac * innerW
    const y = PAD.top + (1 - (v - min) / range) * innerH
    return { x, y }
  })
}

function bondingShape(curve: CurveToken, basePrice: number): number[] {
  const { effectiveK } = velocityParams(
    curve.curveK,
    curve.attentionScore,
    curve.priceVelocity,
  )
  const supply = Math.max(curve.currentSupply, 1)
  const lo = Math.max(0, Math.floor(supply * 0.15))
  const hi = Math.floor(supply * 1.85)
  const steps = 48
  const prices: number[] = []
  for (let i = 0; i <= steps; i++) {
    const s = lo + ((hi - lo) * i) / steps
    prices.push(Number(spotPrice(basePrice, effectiveK, Math.floor(s))))
  }
  return prices
}

export function PriceChart({ curve, samples }: PriceChartProps) {
  const metrics = useMemo(() => launchpadDisplayMetrics(curve), [curve])

  const liveSamples = useMemo(() => {
    if (samples.length >= 2) return samples
    if (curve.priceHistory && curve.priceHistory.length >= 2) {
      return curve.priceHistory
    }
    return samples
  }, [samples, curve.priceHistory])

  const isLive = liveSamples.length >= 2

  const spot = metrics.effectivePriceLamports
  const mcap = metrics.fdvSol

  const pctChange = useMemo(() => {
    if (!isLive) return null
    const first = liveSamples[0]!.priceLamports
    if (!first) return null
    return ((spot - first) / first) * 100
  }, [isLive, liveSamples, spot])

  const chart = useMemo(() => {
    if (isLive) {
      const prices = liveSamples.map((s) => s.priceLamports)
      const times = liveSamples.map((s) => s.t)
      const pts = mapPoints(prices, times)
      const up = prices[prices.length - 1]! >= prices[0]!
      return {
        ...buildPath(pts, true),
        stroke: up ? '#22d3ee' : '#f87171',
        last: pts[pts.length - 1],
        mode: 'live' as const,
      }
    }
    const baseForShape = metrics.priceCorrupt
      ? metrics.effectivePriceLamports
      : curve.basePriceLamports
    const prices = bondingShape(curve, baseForShape)
    const pts = mapPoints(prices)
    // Current supply sits at midpoint of [0.15s, 1.85s] preview range.
    const mid = pts[Math.floor(pts.length / 2)]
    return {
      ...buildPath(pts, true),
      stroke: '#22d3ee',
      last: mid,
      mode: 'shape' as const,
    }
  }, [isLive, liveSamples, curve, metrics])

  const pctLabel =
    pctChange === null
      ? null
      : `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%`
  const pctClass =
    pctChange === null ? '' : pctChange >= 0 ? 'text-bcc-green' : 'text-red-400'

  return (
    <div className="bcc-card rounded-2xl p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-bcc-text">
            {isLive ? 'Live price' : 'Price'}
          </h2>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-bcc-muted">
            {isLive ? 'On-chain spot samples' : 'Bonding curve shape'}
          </p>
        </div>
        <div className="text-right">
          <div className="font-stat text-xl font-bold text-bcc-green sm:text-2xl">
            {formatPriceLamports(spot)}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center justify-end gap-2 text-xs">
            <span className="font-mono text-bcc-text">
              Mcap {formatMarketCapSol(mcap)}
            </span>
            {pctLabel && (
              <span className={`font-semibold ${pctClass}`}>{pctLabel}</span>
            )}
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-40 w-full overflow-visible sm:h-44"
        preserveAspectRatio="none"
        role="img"
        aria-label={isLive ? 'Live price chart' : 'Bonding curve shape preview'}
      >
        <defs>
          <linearGradient id={`priceArea-${curve.pubkey.slice(0, 8)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chart.stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={chart.stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => {
          const y = PAD.top + f * (H - PAD.top - PAD.bottom)
          return (
            <line
              key={f}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y}
              y2={y}
              stroke="rgba(26,58,85,0.7)"
              strokeWidth="1"
            />
          )
        })}
        {chart.area && (
          <path
            d={chart.area}
            fill={`url(#priceArea-${curve.pubkey.slice(0, 8)})`}
            stroke="none"
          />
        )}
        {chart.line && (
          <path
            d={chart.line}
            fill="none"
            stroke={chart.stroke}
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {chart.last && (
          <circle
            cx={chart.last.x}
            cy={chart.last.y}
            r="4"
            fill={chart.stroke}
            stroke="#030a16"
            strokeWidth="1.5"
          />
        )}
      </svg>

      {!isLive && (
        <p className="mt-2 text-[11px] leading-relaxed text-bcc-muted">
          Bonding curve shape · live history builds as price updates
        </p>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-bcc-muted">
        Live samples from on-chain spot while you watch this page (stored in this browser).
        {metrics.priceCorrupt
          ? ' Display uses repaired spot (on-chain base_price still corrupted).'
          : ''}
      </p>
    </div>
  )
}
