import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, RefreshCw } from 'lucide-react'
import { KingBanner } from '../components/KingBanner'
import { LiveTicker } from '../components/LiveTicker'
import { StoryCard } from '../components/StoryCard'
import { TabBar, statusMatchesTab, type BoardTab } from '../components/TabBar'
import { useStories } from '../hooks/useStories'

export function Board() {
  const [tab, setTab] = useState<BoardTab>('active')
  const [query, setQuery] = useState('')
  const { stories, source, loading, error, refresh, king } = useStories()

  const counts = useMemo(
    () => ({
      active: stories.filter((s) => s.status === 'active').length,
      graduating: stories.filter((s) => s.status === 'graduating').length,
      graduated: stories.filter((s) => s.status === 'graduated').length,
      failed: stories.filter((s) => s.status === 'failed').length,
    }),
    [stories],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return stories
      .filter((s) => statusMatchesTab(s.status, tab))
      .filter(
        (s) =>
          !q ||
          s.title.toLowerCase().includes(q) ||
          s.ticker.toLowerCase().includes(q) ||
          s.blurb.toLowerCase().includes(q),
      )
      .sort((a, b) => b.solStaked - a.solStaked)
  }, [stories, tab, query])

  return (
    <div>
      <LiveTicker />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Story Markets
            </h1>
            <p className="mt-1 max-w-xl text-sm text-bcc-muted">
              Stake SOL on meme narratives. Winning stories graduate to bonding-curve launches.
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
          <Link
            to="/create"
            className="bcc-glow-btn inline-flex items-center justify-center gap-2 self-start rounded-xl px-4 py-2.5 text-sm font-bold"
          >
            <Plus className="h-4 w-4" />
            Launch a story
          </Link>
        </div>

        {king && <KingBanner story={king} />}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabBar active={tab} onChange={setTab} counts={counts} />
          <div className="relative w-full sm:mb-5 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bcc-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stories…"
              className="w-full rounded-xl border border-bcc-border bg-bcc-surface py-2.5 pl-9 pr-3 text-sm text-bcc-text outline-none transition placeholder:text-bcc-muted focus:border-bcc-green/50"
            />
          </div>
        </div>

        {loading && stories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-bcc-border bg-bcc-surface/50 px-6 py-16 text-center">
            <p className="font-medium text-bcc-text">Fetching story markets…</p>
            <p className="mt-1 text-sm text-bcc-muted">Will fall back to mock if RPC is offline.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-bcc-border bg-bcc-surface/50 px-6 py-16 text-center">
            <div className="mb-2 text-3xl">📭</div>
            <p className="font-medium text-bcc-text">No stories in this tab</p>
            <p className="mt-1 text-sm text-bcc-muted">Try another filter or create a new narrative.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((story, i) => (
              <StoryCard key={story.id} story={story} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
