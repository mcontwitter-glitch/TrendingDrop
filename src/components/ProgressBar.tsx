import { fundedPct, formatPct } from '../lib/format'

interface ProgressBarProps {
  staked: number
  threshold: number
  showLabel?: boolean
  size?: 'sm' | 'md'
  /** accent = platform red (King of the Hill); green = card graduation bars */
  tone?: 'accent' | 'green'
}

export function ProgressBar({
  staked,
  threshold,
  showLabel = true,
  size = 'sm',
  tone = 'accent',
}: ProgressBarProps) {
  const pct = fundedPct(staked, threshold)
  const h = size === 'md' ? 'h-2.5' : 'h-1.5'
  const fillClass = tone === 'green' ? 'bg-emerald-500' : 'progress-fill'
  const labelClass = tone === 'green' ? 'text-emerald-400' : 'text-bcc-green'

  return (
    <div className="w-full">
      {showLabel && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-bcc-muted">Graduation</span>
          <span className={`font-semibold ${labelClass}`}>{formatPct(pct)} funded</span>
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-full bg-bcc-border/60 ${h}`}>
        <div
          className={`${h} rounded-full ${fillClass} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
