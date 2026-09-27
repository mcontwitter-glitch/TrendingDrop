import type { CurveToken } from '../types'

interface VelocityChartProps {
  curve: CurveToken
}

function Sparkline({
  values,
  color,
  label,
}: {
  values: number[]
  color: string
  label: string
}) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)
  const w = 240
  const h = 56
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w
      const y = h - ((v - min) / range) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="flex-1 min-w-0">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider" style={{ color }}>
        <span>{label}</span>
        <span className="font-mono opacity-90">{values[values.length - 1] ?? 0}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full overflow-visible" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pts}
        />
      </svg>
    </div>
  )
}

function DualBars({ attention, velocity }: { attention: number; velocity: number }) {
  const max = Math.max(attention, velocity, 1)
  const aPct = Math.round((attention / max) * 100)
  const vPct = Math.round((velocity / max) * 100)
  return (
    <div className="space-y-3">
      <BarRow
        label="Attention"
        value={attention}
        pct={aPct}
        barClass="bg-bcc-cyan"
        labelClass="text-bcc-cyan"
        valueClass="text-cyan-100"
      />
      <BarRow
        label="Price velocity"
        value={velocity}
        pct={vPct}
        barClass="bg-bcc-gold"
        labelClass="text-bcc-gold"
        valueClass="text-amber-100"
      />
    </div>
  )
}

function BarRow({
  label,
  value,
  pct,
  barClass,
  labelClass,
  valueClass,
}: {
  label: string
  value: number
  pct: number
  barClass: string
  labelClass: string
  valueClass: string
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className={labelClass}>{label}</span>
        <span className={`font-mono font-semibold ${valueClass}`}>{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-bcc-bg">
        <div className={`h-full rounded-full ${barClass} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function VelocityChart({ curve }: VelocityChartProps) {
  const attentionHist =
    curve.attentionHistory ??
    Array.from({ length: 16 }, (_, i) =>
      Math.max(1, Math.round(curve.attentionScore * (0.7 + (i / 15) * 0.3))),
    )
  const velocityHist =
    curve.velocityHistory ??
    Array.from({ length: 16 }, (_, i) =>
      Math.max(1, Math.round(curve.priceVelocity * (0.65 + (i / 15) * 0.35))),
    )

  const modeLabel =
    curve.mode === 'steepen'
      ? 'Steepen · sell tax 15%'
      : curve.mode === 'flatten'
        ? 'Flatten · sell tax 5%'
        : 'Neutral · attention ≈ velocity'

  const modeClass =
    curve.mode === 'steepen'
      ? 'border-bcc-cyan/40 bg-bcc-cyan/10 text-bcc-cyan'
      : curve.mode === 'flatten'
        ? 'border-amber-400/35 bg-amber-400/10 text-amber-200'
        : 'border-bcc-border bg-bcc-elevated text-bcc-muted'

  return (
    <div className="bcc-card rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          <span style={{ color: '#22d3ee' }}>Attention</span>
          <span style={{ color: '#7a9bb0' }}> vs </span>
          <span style={{ color: '#fbbf24' }}>velocity</span>
        </h2>
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${modeClass}`}>
          {modeLabel}
        </span>
      </div>

      <div className="mb-5 flex flex-col gap-4 sm:flex-row">
        <Sparkline values={attentionHist} color="#22d3ee" label="Attention score" />
        <Sparkline values={velocityHist} color="#fbbf24" label="Price velocity" />
      </div>

      <DualBars attention={curve.attentionScore} velocity={curve.priceVelocity} />

      <p className="mt-4 text-[11px] leading-relaxed text-bcc-muted">
        When attention &gt; price velocity the curve steepens (15% sell tax). When price outruns
        attention it flattens (5% sell tax). Effective k is clamped ±25%.
      </p>
    </div>
  )
}
