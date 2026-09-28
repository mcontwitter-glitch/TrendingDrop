import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { stories as mockStories } from '../data/mockStories'
import type { Story } from '../types'
import { fetchStoryMarkets, getReadonlyProgram } from '../lib/solana/program'
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

export function useStories(): UseStoriesResult {
  const { connection } = useConnection()
  const [stories, setStories] = useState<Story[]>(mockStories)
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
        setStories(onChain)
        setSource('chain')
        setError(null)
      } else {
        setStories(mockStories)
        setSource('mock')
        setError(null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setStories(mockStories)
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
