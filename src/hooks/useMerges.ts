import { useCallback, useEffect, useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { mockLoreAssets, mockMergeProposals } from '../data/mockMerges'
import type { LoreAssetView, MergeProposalView } from '../types'
import {
  fetchLoreAssets,
  fetchMergeProposal,
  fetchMergeProposals,
  getReadonlyMergeProgram,
} from '../lib/solana/mergeProgram'

export type MergeSource = 'chain' | 'mock'

export function useMerges() {
  const { connection } = useConnection()
  const [proposals, setProposals] = useState<MergeProposalView[]>(mockMergeProposals)
  const [loreAssets, setLoreAssets] = useState<LoreAssetView[]>(mockLoreAssets)
  const [source, setSource] = useState<MergeSource>('mock')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const program = getReadonlyMergeProgram(connection)
      const [onChainProposals, onChainLore] = await Promise.all([
        fetchMergeProposals(program),
        fetchLoreAssets(program),
      ])
      if (onChainProposals.length > 0 || onChainLore.length > 0) {
        setProposals(onChainProposals.length > 0 ? onChainProposals : mockMergeProposals)
        setLoreAssets(onChainLore.length > 0 ? onChainLore : mockLoreAssets)
        setSource('chain')
        setError(null)
      } else {
        setProposals(mockMergeProposals)
        setLoreAssets(mockLoreAssets)
        setSource('mock')
        setError(null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setProposals(mockMergeProposals)
      setLoreAssets(mockLoreAssets)
      setSource('mock')
      setError(
        /fetch|ECONNREFUSED|Failed to fetch|network/i.test(msg)
          ? 'RPC offline — showing mock merges'
          : `Chain fetch failed — mock merges (${msg.slice(0, 120)})`,
      )
    } finally {
      setLoading(false)
    }
  }, [connection])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const getById = useCallback(
    (id: string) => proposals.find((p) => p.id === id || p.pubkey === id),
    [proposals],
  )

  return { proposals, loreAssets, source, loading, error, refresh, getById }
}

function findMockProposal(id: string) {
  return mockMergeProposals.find((p) => p.id === id || p.pubkey === id)
}

export function useMergeDetail(proposalId: string | undefined) {
  const { connection } = useConnection()
  const [proposal, setProposal] = useState<MergeProposalView | undefined>(() =>
    proposalId ? findMockProposal(proposalId) : undefined,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<MergeSource>('mock')

  const refresh = useCallback(async () => {
    if (!proposalId) {
      setProposal(undefined)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const pk = new PublicKey(proposalId)
      const program = getReadonlyMergeProgram(connection)
      const onChain = await fetchMergeProposal(program, pk)
      if (onChain) {
        setProposal(onChain)
        setSource('chain')
        setError(null)
      } else {
        setProposal(findMockProposal(proposalId))
        setSource('mock')
        setError(null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/Invalid public key/i.test(msg)) {
        setError('Invalid proposal id')
        setProposal(undefined)
        setSource('mock')
      } else {
        setProposal(findMockProposal(proposalId))
        setSource('mock')
        setError(
          /fetch|ECONNREFUSED|Failed to fetch|network/i.test(msg)
            ? 'RPC offline — mock mode'
            : `Fetch failed — mock mode (${msg.slice(0, 100)})`,
        )
      }
    } finally {
      setLoading(false)
    }
  }, [connection, proposalId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { proposal, loading, error, source, refresh }
}
