import { useMemo } from 'react'
import { useConnection, useAnchorWallet, useWallet } from '@solana/wallet-adapter-react'
import {
  getReputationProgram,
  getReputationProvider,
  getReadonlyReputationProgram,
} from '../lib/solana/reputationProgram'
import {
  REPUTATION_NFT_PROGRAM_ID,
  RPC_URL,
  clusterLabel,
} from '../lib/solana/constants'
import type { Program } from '@coral-xyz/anchor'
import type { ReputationNft } from '../idl/reputation_nft'

export function useReputationProgram() {
  const { connection } = useConnection()
  const anchorWallet = useAnchorWallet()
  const wallet = useWallet()

  const readonlyProgram = useMemo(
    () => getReadonlyReputationProgram(connection),
    [connection],
  )

  const program: Program<ReputationNft> | null = useMemo(() => {
    if (!anchorWallet) return null
    const provider = getReputationProvider(connection, anchorWallet)
    return getReputationProgram(provider)
  }, [connection, anchorWallet])

  return {
    connection,
    wallet,
    anchorWallet,
    program,
    readonlyProgram,
    programId: REPUTATION_NFT_PROGRAM_ID,
    rpcUrl: RPC_URL,
    cluster: clusterLabel(RPC_URL),
    connected: wallet.connected,
    publicKey: wallet.publicKey,
  }
}
