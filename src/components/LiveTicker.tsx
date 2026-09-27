import { Link } from 'react-router-dom'
import { useIndexerFeed } from '../hooks/useIndexerFeed'
import type { ActivityType } from '../types'

const iconFor: Record<ActivityType, string> = {
  stake: '💰',
  new_story: '✨',
  graduation: '🎓',
  near_threshold: '🔥',
}

export function LiveTicker() {
  const { activity, source } = useIndexerFeed()
  const feed = activity.length > 0 ? activity : []
  const doubled = [...feed, ...feed]

  return (
    <div className="relative overflow-hidden border-y border-bcc-border bg-bcc-surface">
      <div className="pointer-events-none absolute left-0 top-0 z-10 flex h-full items-center bg-gradient-to-r from-bcc-surface via-bcc-surface to-transparent px-3">
        <span className="flex items-center gap-1.5 rounded-full border border-bcc-border bg-bcc-elevated px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-bcc-green">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bcc-green" />
          Live
          {source === 'indexer' && (
            <span className="ml-1 font-medium text-bcc-muted normal-case tracking-normal">
              · indexer
            </span>
          )}
        </span>
      </div>
      <div className="ticker-track flex w-max gap-8 py-2.5 pl-24">
        {doubled.map((ev, i) => (
          <Link
            key={`${ev.id}-${i}`}
            to={ev.storyId ? `/story/${ev.storyId}` : '/'}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-bcc-muted transition hover:text-bcc-text"
          >
            <span>{iconFor[ev.type] ?? '•'}</span>
            <span>{ev.message}</span>
            {ev.amount != null && (
              <span className="font-semibold text-bcc-green">+{ev.amount} SOL</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
