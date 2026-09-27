import { useMemo } from 'react'
import { useConnection, useAnchorWallet, useWallet } from '@solana/wallet-adapter-react'
import {
  getMergeProgram,
  getMergeProvider,
  getReadonlyMergeProgram,
} from '../lib/solana/mergeProgram'
import {
  LORE_MERGE_PROGRAM_ID,
  RPC_URL,
  clusterLabel,
} from '../lib/solana/constants'
import type { Program } from '@coral-xyz/anchor'
import type { LoreMerge } from '../idl/lore_merge'

export function useMergeProgram() {
  const { connection } = useConnection()
  const anchorWallet = useAnchorWallet()
  const wallet = useWallet()

  const readonlyProgram = useMemo(
    () => getReadonlyMergeProgram(connection),
    [connection],
  )

  const program: Program<LoreMerge> | null = useMemo(() => {
    if (!anchorWallet) return null
    const provider = getMergeProvider(connection, anchorWallet)
    return getMergeProgram(provider)
  }, [connection, anchorWallet])

  return {
    connection,
    wallet,
    anchorWallet,
    program,
    readonlyProgram,
    programId: LORE_MERGE_PROGRAM_ID,
    rpcUrl: RPC_URL,
    cluster: clusterLabel(RPC_URL),
    connected: wallet.connected,
    publicKey: wallet.publicKey,
  }
}
