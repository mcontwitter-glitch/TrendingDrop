import { useCallback, useEffect, useState } from 'react'
import type { ActivityEvent, CurveToken, Story } from '../types'
import { activityFeed as mockActivity } from '../data/mockActivity'

const INDEXER_URL = (import.meta.env.VITE_INDEXER_URL as string | undefined)?.replace(/\/$/, '')

export type IndexerSource = 'indexer' | 'mock' | 'unavailable'

type IndexerActivity = {
  id: string
  type: string
  message: string
  storyId?: string
  amount?: number
  timestamp: number
}

type StoriesResponse = { source: string; stories: Partial<Story>[] }
type ActivityResponse = { source: string; activity: IndexerActivity[] }
type CurvesResponse = { source: string; curves: Partial<CurveToken>[] }

async function fetchJson<T>(path: string): Promise<T | null> {
  if (!INDEXER_URL) return null
  try {
    const res = await fetch(`${INDEXER_URL}${path}`, {
      signal: AbortSignal.timeout(4_000),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function mapActivity(rows: IndexerActivity[]): ActivityEvent[] {
  const allowed = new Set(['stake', 'new_story', 'graduation', 'near_threshold'])
  return rows
    .filter((r) => allowed.has(r.type))
    .map((r) => ({
      id: r.id,
      type: r.type as ActivityEvent['type'],
      message: r.message,
      storyId: r.storyId,
      amount: r.amount,
      timestamp: r.timestamp,
    }))
}

/**
 * Prefer `VITE_INDEXER_URL` HTTP API; fall back to mock activity (and null stories/curves).
 * Callers that already use chain hooks should treat null stories/curves as "use existing source".
 */
export function useIndexerFeed(pollMs = 20_000) {
  const [activity, setActivity] = useState<ActivityEvent[]>(mockActivity)
  const [stories, setStories] = useState<Partial<Story>[] | null>(null)
  const [curves, setCurves] = useState<Partial<CurveToken>[] | null>(null)
  const [source, setSource] = useState<IndexerSource>(INDEXER_URL ? 'unavailable' : 'mock')
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!INDEXER_URL) {
      setActivity(mockActivity)
      setStories(null)
      setCurves(null)
      setSource('mock')
      return
    }

    const [act, st, cu] = await Promise.all([
      fetchJson<ActivityResponse>('/api/activity?limit=50'),
      fetchJson<StoriesResponse>('/api/stories'),
      fetchJson<CurvesResponse>('/api/curves'),
    ])

    if (!act && !st && !cu) {
      setActivity(mockActivity)
      setStories(null)
      setCurves(null)
      setSource('unavailable')
      setError('Indexer unreachable — using mock activity')
      return
    }

    setError(null)
    setSource('indexer')
    if (act?.activity?.length) {
      setActivity(mapActivity(act.activity))
    }
    if (st?.stories) setStories(st.stories)
    if (cu?.curves) setCurves(cu.curves)
  }, [])

  useEffect(() => {
    void refresh()
    if (!INDEXER_URL) return
    const id = setInterval(() => void refresh(), pollMs)
    return () => clearInterval(id)
  }, [refresh, pollMs])

  return { activity, stories, curves, source, error, refresh, indexerUrl: INDEXER_URL ?? null }
}
