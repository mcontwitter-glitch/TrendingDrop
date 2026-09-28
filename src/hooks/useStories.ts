import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { stories as mockStories } from '../data/mockStories'
import { mockCurves } from '../data/mockCurves'
import type { CurveToken, Story } from '../types'
import { fetchStoryMarkets, getReadonlyProgram } from '../lib/solana/program'
import {
  fetchVelocityTokens,
  getReadonlyVelocityProgram,
} from '../lib/solana/velocityProgram'
import { loadSharedMetadata } from '../lib/solana/metadata'

export type StoriesSource = 'chain' | 'mock'

export interface UseStoriesResult {
  stories: Story[]
  source: StoriesSource
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  getById: (id: string) => Story | undefined
  king: Story | undefined
}

/** Attach SPL mint from velocity curves when story has graduated. */
function attachMints(stories: Story[], curves: CurveToken[]): Story[] {
  const mintByStory = new Map<string, string>()
  const mintByCurve = new Map<string, string>()
  for (const c of curves) {
    if (c.mint) {
      if (c.storyId) mintByStory.set(c.storyId, c.mint)
      mintByCurve.set(c.pubkey, c.mint)
      mintByCurve.set(c.id, c.mint)
    }
  }
  return stories.map((s) => {
    if (s.mint) return s
    const fromCurve =
      (s.pubkey ? mintByStory.get(s.pubkey) : undefined) ??
      mintByStory.get(s.id) ??
      (s.curveId ? mintByCurve.get(s.curveId) : undefined)
    return fromCurve ? { ...s, mint: fromCurve } : s
  })
}

function withMockMints(stories: Story[]): Story[] {
  return attachMints(stories, mockCurves)
}

export function useStories(): UseStoriesResult {
  const { connection } = useConnection()
  const [stories, setStories] = useState<Story[]>(() => withMockMints(mockStories))
  const [source, setSource] = useState<StoriesSource>('mock')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      // Shared registry first so remap uses titles/tickers from public/meta/stories.json
      await loadSharedMetadata()
      const program = getReadonlyProgram(connection)
      const onChain = await fetchStoryMarkets(program)
      if (onChain.length > 0) {
        let curves: CurveToken[] = []
        try {
          const vProg = getReadonlyVelocityProgram(connection)
          curves = await fetchVelocityTokens(vProg)
        } catch {
          curves = []
        }
        setStories(attachMints(onChain, curves.length > 0 ? curves : mockCurves))
        setSource('chain')
        setError(null)
      } else {
        setStories(withMockMints(mockStories))
        setSource('mock')
        setError(null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setStories(withMockMints(mockStories))
      setSource('mock')
      setError(
        /fetch|ECONNREFUSED|Failed to fetch|network/i.test(msg)
          ? 'RPC offline — showing mock board'
          : `Chain fetch failed — showing mock board (${msg.slice(0, 120)})`,
      )
    } finally {
      setLoading(false)
    }
  }, [connection])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const getById = useCallback(
    (id: string) => stories.find((s) => s.id === id || s.pubkey === id),
    [stories],
  )

  const king = useMemo(
    () =>
      [...stories]
        .filter((s) => s.status === 'active' || s.status === 'graduating')
        .sort((a, b) => b.solStaked - a.solStaked)[0],
    [stories],
  )

  return { stories, source, loading, error, refresh, getById, king }
}
