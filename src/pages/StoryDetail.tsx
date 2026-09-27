import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, Users, Zap, ExternalLink } from 'lucide-react'
import { getStakersForStory } from '../data/mockStories'
import { useStories } from '../hooks/useStories'
import { activityFeed } from '../data/mockActivity'
import { StakePanel } from '../components/StakePanel'
import { ProgressBar } from '../components/ProgressBar'
import { formatCountdown, formatSol, timeAgo, fundedPct, formatPct } from '../lib/format'
import { useNow } from '../hooks/useNow'
import { PublicKey } from '@solana/web3.js'
import { findCurvePda } from '../lib/solana/velocityPdas'
import { MOCK_CURVE_IDS } from '../data/mockCurves'

export function StoryDetail() {
  const { id } = useParams<{ id: string }>()
  const { getById, loading, refresh } = useStories()
  const story = id ? getById(id) : undefined
  const now = useNow()

  if (loading && !story) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="font-medium text-bcc-text">Loading story…</p>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <div className="mb-3 text-4xl">🕳️</div>
        <h1 className="font-display text-xl font-bold">Story not found</h1>
        <p className="mt-2 text-sm text-bcc-muted">
          This narrative isn&apos;t on-chain (or in the mock board) for this cluster.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-bcc-green hover:underline">
          ← Back to board
        </Link>
      </div>
    )
  }

  const stakers = getStakersForStory(story.id)
  const recent = activityFeed.filter((a) => a.storyId === story.id).slice(0, 6)
  const pct = fundedPct(story.solStaked, story.graduationThreshold)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-bcc-muted transition hover:text-bcc-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to board
      </Link>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <div className="overflow-hidden rounded-2xl border border-bcc-border bg-bcc-surface">
            <div
              className={`relative flex h-48 items-center justify-center bg-gradient-to-br ${story.gradient} sm:h-56`}
            >
              <span className="text-7xl drop-shadow-xl sm:text-8xl">{story.emoji}</span>
              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                <StatusPill status={story.status} />
                <span className="rounded-full border border-white/10 bg-black/50 px-2.5 py-0.5 text-xs font-bold text-bcc-green backdrop-blur">
                  ${story.ticker}
                </span>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <h1 className="font-display text-2xl font-bold sm:text-3xl">{story.title}</h1>
              <p className="mt-1 text-sm text-bcc-muted">
                Created by <span className="font-mono text-bcc-text">{story.creator}</span>
              </p>
              <p className="mt-4 text-sm leading-relaxed text-bcc-text/90">{story.description}</p>

              {story.socials && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {story.socials.twitter && (
                    <SocialChip href={story.socials.twitter} label="Twitter" />
                  )}
                  {story.socials.telegram && (
                    <SocialChip href={story.socials.telegram} label="Telegram" />
                  )}
                  {story.socials.website && (
                    <SocialChip href={story.socials.website} label="Website" />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric
              icon={<Zap className="h-4 w-4 text-bcc-green" />}
              label="Total staked"
              value={`${formatSol(story.solStaked)} SOL`}
            />
            <Metric
              icon={<Users className="h-4 w-4 text-bcc-green" />}
              label="Unique stakers"
              value={String(story.stakerCount)}
            />
            <Metric
              icon={<Clock className="h-4 w-4 text-bcc-green" />}
              label="Time left"
              value={formatCountdown(story.endsAt, now)}
            />
            <Metric
              icon={<span className="text-bcc-green">%</span>}
              label="Funded"
              value={formatPct(pct)}
            />
          </div>

          <div className="rounded-2xl border border-bcc-border bg-bcc-surface p-5">
            <h2 className="mb-3 font-display text-lg font-bold">Graduation progress</h2>
            <ProgressBar
              staked={story.solStaked}
              threshold={story.graduationThreshold}
              size="md"
            />
            <p className="mt-3 text-xs text-bcc-muted">
              Threshold: {story.graduationThreshold} SOL ·{' '}
              {Math.max(0, story.graduationThreshold - story.solStaked).toFixed(1)} SOL remaining
            </p>
          </div>

          <div className="rounded-2xl border border-bcc-border bg-bcc-surface p-5">
            <h2 className="mb-4 font-display text-lg font-bold">Top stakers</h2>
            <ul className="divide-y divide-bcc-border">
              {stakers.map((s, i) => (
                <li key={`${s.address}-${i}`} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bcc-elevated text-xs font-bold text-bcc-muted">
                      {i + 1}
                    </span>
                    <span className="font-mono text-bcc-text">{s.address}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-bcc-green">{formatSol(s.amount)} SOL</div>
                    <div className="text-[10px] text-bcc-muted">{timeAgo(s.timestamp, now)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-bcc-border bg-bcc-surface p-5">
            <h2 className="mb-4 font-display text-lg font-bold">Recent activity</h2>
            {recent.length === 0 ? (
              <p className="text-sm text-bcc-muted">No recent events for this story in the mock feed.</p>
            ) : (
              <ul className="space-y-3">
                {recent.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-bcc-border/60 bg-bcc-bg px-3 py-2.5 text-sm"
                  >
                    <span className="text-bcc-text/90">{ev.message}</span>
                    <span className="shrink-0 text-[10px] text-bcc-muted">{timeAgo(ev.timestamp, now)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-24 space-y-4">
            {(story.status === 'active' || story.status === 'graduating') && (
              <StakePanel
                storyTitle={story.title}
                storyPubkey={story.pubkey}
                onChain={story.onChain}
                onStaked={() => void refresh()}
              />
            )}
            {story.status === 'graduated' && (
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-5 text-sm">
                <div className="mb-1 font-display text-lg font-bold text-cyan-300">Graduated</div>
                <p className="mb-4 text-bcc-muted">
                  This narrative cleared the auction and launched a VelocityCurve token.
                </p>
                {(() => {
                  let tradeId = story.curveId
                  if (!tradeId && story.pubkey) {
                    try {
                      const [pda] = findCurvePda(new PublicKey(story.pubkey))
                      tradeId = pda.toBase58()
                    } catch {
                      /* ignore */
                    }
                  }
                  if (!tradeId && story.id === 'graduated-degen-dog') tradeId = MOCK_CURVE_IDS.ddog
                  if (!tradeId && story.id === 'graduated-laser-eyes') tradeId = MOCK_CURVE_IDS.laser
                  return tradeId ? (
                    <Link
                      to={`/trade/${tradeId}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 font-display text-sm font-bold text-white transition hover:bg-purple-500"
                    >
                      Trade on curve
                    </Link>
                  ) : (
                    <Link
                      to="/trade"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/10 py-3 text-sm font-bold text-purple-200 transition hover:bg-purple-500/20"
                    >
                      Browse trade desk
                    </Link>
                  )
                })()}
              </div>
            )}
            {story.status === 'failed' && (
              <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-5 text-sm">
                <div className="mb-1 font-display text-lg font-bold text-red-300">Auction failed</div>
                <p className="text-bcc-muted">
                  Did not reach the graduation threshold before the clock expired.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-bcc-green/15 text-bcc-green border-bcc-green/25',
    graduating: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
    graduated: 'bg-cyan-400/15 text-cyan-300 border-cyan-400/30',
    failed: 'bg-red-400/10 text-red-300 border-red-400/25',
  }
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur ${map[status] ?? ''}`}
    >
      {status}
    </span>
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
      <div className="font-display text-base font-bold text-bcc-text sm:text-lg">{value}</div>
    </div>
  )
}

function SocialChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-lg border border-bcc-border bg-bcc-bg px-2.5 py-1 text-xs text-bcc-muted transition hover:border-bcc-green/40 hover:text-bcc-text"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  )
}
