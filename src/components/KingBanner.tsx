import { Link } from 'react-router-dom'
import { Crown, Users, Clock, Zap } from 'lucide-react'
import type { Story } from '../types'
import { formatCountdown, formatSol, fundedPct, formatPct } from '../lib/format'
import { ProgressBar } from './ProgressBar'
import { useNow } from '../hooks/useNow'
import { TickerCaChip } from './TickerCaChip'

interface KingBannerProps {
  story: Story
}

export function KingBanner({ story }: KingBannerProps) {
  const now = useNow()
  const pct = fundedPct(story.solStaked, story.graduationThreshold)

  return (
    <Link
      to={`/story/${story.id}`}
      className="king-highlight bcc-card group relative mb-6 block overflow-hidden rounded-2xl transition hover:border-bcc-cyan/50"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${story.gradient} opacity-50`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(34,211,238,0.12),transparent_55%)]" />

      <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-start gap-4 sm:items-center">
          <div className="relative aspect-square h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-bcc-cyan/30 bg-black/40 text-4xl backdrop-blur sm:h-20 sm:w-20 sm:text-5xl">
            {story.imageUrl ? (
              <img
                src={story.imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center">{story.emoji}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-bcc-green px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider !text-white">
                <Crown className="h-3 w-3" />
                King of the Hill
              </span>
              <TickerCaChip
                ticker={story.ticker}
                address={story.mint ?? story.pubkey}
                size="sm"
                tone="green"
              />
            </div>
            <h2 className="font-display text-xl font-bold sm:text-2xl">{story.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-white/70">{story.blurb}</p>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 sm:ml-auto sm:w-auto sm:min-w-[280px] sm:grid-cols-2">
          <Stat
            icon={<Zap className="h-3.5 w-3.5 !text-white" />}
            label="Staked"
            value={`${formatSol(story.solStaked)} SOL`}
            valueClassName="!text-white"
          />
          <Stat
            icon={<Users className="h-3.5 w-3.5 text-yellow-400" />}
            label="Stakers"
            value={String(story.stakerCount)}
            valueClassName="!text-yellow-400"
          />
          <Stat
            icon={<Clock className="h-3.5 w-3.5 text-orange-400" />}
            label="Time left"
            value={formatCountdown(story.endsAt, now)}
            valueClassName="!text-orange-400"
          />
          <Stat
            icon={<Crown className="h-3.5 w-3.5 text-emerald-400" />}
            label="Funded"
            value={formatPct(pct)}
            valueClassName="!text-emerald-400"
          />
        </div>
      </div>

      <div className="relative border-t border-white/10 bg-black/30 px-4 py-3 sm:px-6">
        <ProgressBar staked={story.solStaked} threshold={story.graduationThreshold} size="md" />
      </div>
    </Link>
  )
}

function Stat({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueClassName: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 backdrop-blur">
      <div className="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/50">
        {icon}
        {label}
      </div>
      <div className={`font-stat text-sm ${valueClassName}`}>{value}</div>
    </div>
  )
}
