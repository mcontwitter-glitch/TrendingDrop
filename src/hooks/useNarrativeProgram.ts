import { useMemo } from 'react'
import { useConnection, useAnchorWallet, useWallet } from '@solana/wallet-adapter-react'
import { getProgram, getProvider, getReadonlyProgram } from '../lib/solana/program'
import { PROGRAM_ID, RPC_URL, clusterLabel } from '../lib/solana/constants'
import type { Program } from '@coral-xyz/anchor'
import type { NarrativeAuction } from '../idl/narrative_auction'

export function useNarrativeProgram() {
  const { connection } = useConnection()
  const anchorWallet = useAnchorWallet()
  const wallet = useWallet()

  const readonlyProgram = useMemo(
    () => getReadonlyProgram(connection),
    [connection],
  )

  const program: Program<NarrativeAuction> | null = useMemo(() => {
    if (!anchorWallet) return null
    const provider = getProvider(connection, anchorWallet)
    return getProgram(provider)
  }, [connection, anchorWallet])

  return {
    connection,
    wallet,
    anchorWallet,
    program,
    readonlyProgram,
    programId: PROGRAM_ID,
    rpcUrl: RPC_URL,
    cluster: clusterLabel(RPC_URL),
    connected: wallet.connected,
    publicKey: wallet.publicKey,
  }
}
