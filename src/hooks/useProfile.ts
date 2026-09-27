import { useCallback, useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { mockTraderProfile } from '../data/mockProfiles'
import type { TraderProfileView } from '../types'
import {
  fetchTraderProfile,
  getReadonlyReputationProgram,
} from '../lib/solana/reputationProgram'

export type ProfileSource = 'chain' | 'mock' | 'none'

export function useProfile() {
  const { connection } = useConnection()
  const { publicKey, connected } = useWallet()
  const [profile, setProfile] = useState<TraderProfileView | null>(null)
  const [source, setSource] = useState<ProfileSource>('none')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existsOnChain, setExistsOnChain] = useState(false)

  const refresh = useCallback(async () => {
    if (!connected || !publicKey) {
      setProfile(null)
      setSource('none')
      setExistsOnChain(false)
      setError(null)
      return
    }
    setLoading(true)
    try {
      const program = getReadonlyReputationProgram(connection)
      const onChain = await fetchTraderProfile(program, publicKey)
      if (onChain) {
        setProfile(onChain)
        setSource('chain')
        setExistsOnChain(true)
        setError(null)
      } else {
        // Mock fallback so UI shows a badge when RPC empty / not initialized
        setProfile({
          ...mockTraderProfile,
          owner: publicKey.toBase58(),
          pubkey: publicKey.toBase58(),
        })
        setSource('mock')
        setExistsOnChain(false)
        setError(null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setProfile({
        ...mockTraderProfile,
        owner: publicKey.toBase58(),
        pubkey: publicKey.toBase58(),
      })
      setSource('mock')
      setExistsOnChain(false)
      setError(
        /fetch|ECONNREFUSED|Failed to fetch|network/i.test(msg)
          ? 'RPC offline — mock profile'
          : `Profile fetch failed — mock (${msg.slice(0, 100)})`,
      )
    } finally {
      setLoading(false)
    }
  }, [connection, connected, publicKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { profile, source, loading, error, existsOnChain, refresh, connected, publicKey }
}
