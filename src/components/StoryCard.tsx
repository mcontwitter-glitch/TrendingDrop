import { Link } from 'react-router-dom'
import { Clock, Users } from 'lucide-react'
import type { Story } from '../types'
import { formatCountdown, formatSol, fundedPct } from '../lib/format'
import { ProgressBar } from './ProgressBar'
import { useNow } from '../hooks/useNow'
import { TierBadge } from './TierBadge'
import { mockCreatorTiers } from '../data/mockProfiles'

interface StoryCardProps {
  story: Story
  index?: number
}

const statusBadge: Record<Story['status'], { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  graduating: { label: 'Graduating', className: 'bg-amber-400/15 text-amber-300 border-amber-400/25' },
  graduated: { label: 'Graduated', className: 'bg-cyan-400/15 text-cyan-300 border-cyan-400/25' },
  failed: { label: 'Failed', className: 'bg-red-400/10 text-red-300 border-red-400/20' },
}

export function StoryCard({ story, index = 0 }: StoryCardProps) {
  const now = useNow()
  const badge = statusBadge[story.status]
  const pct = fundedPct(story.solStaked, story.graduationThreshold)
  const creatorTier = mockCreatorTiers[story.creator]

  return (
    <Link
      to={`/story/${story.id}`}
      className="fade-up group flex flex-col overflow-hidden rounded-2xl border border-bcc-border bg-bcc-surface transition duration-300 hover:-translate-y-0.5 hover:border-zinc-500 hover:shadow-lg hover:shadow-black/40"
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
    >
      <div className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${story.gradient}`}>
        <div className="absolute inset-0 bg-black/20" />
        <span className="relative text-6xl drop-shadow-lg transition duration-300 group-hover:scale-105">
          {story.emoji}
        </span>
        <span
          className={`absolute left-3 top-3 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
        >
          {badge.label}
        </span>
        <span className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] font-bold text-zinc-200 backdrop-blur">
          ${story.ticker}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-base font-bold !text-white transition group-hover:brightness-110">
            {story.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-bcc-muted">{story.blurb}</p>
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div>
              <div className="text-bcc-muted">Staked</div>
              <div className="font-display text-sm font-bold !text-yellow-400">
                {formatSol(story.solStaked)} SOL
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-bcc-muted">
                <Users className="h-3 w-3" />
                Stakers
              </div>
              <div className="font-display text-sm font-semibold !text-white">{story.stakerCount}</div>
            </div>
          </div>

          <ProgressBar
            staked={story.solStaked}
            threshold={story.graduationThreshold}
            showLabel={false}
            tone="green"
          />

          <div className="flex items-center justify-between text-[11px] text-bcc-muted">
            <span className="inline-flex items-center gap-1.5 font-medium text-bcc-text/80">
              {Math.round(pct)}% to graduate
              {creatorTier && <TierBadge tier={creatorTier} size="sm" />}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatCountdown(story.endsAt, now)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
