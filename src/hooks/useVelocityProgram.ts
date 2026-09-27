import { useMemo } from 'react'
import { useConnection, useAnchorWallet, useWallet } from '@solana/wallet-adapter-react'
import {
  getVelocityProgram,
  getVelocityProvider,
  getReadonlyVelocityProgram,
} from '../lib/solana/velocityProgram'
import {
  VELOCITY_CURVE_PROGRAM_ID,
  RPC_URL,
  clusterLabel,
} from '../lib/solana/constants'
import type { Program } from '@coral-xyz/anchor'
import type { VelocityCurve } from '../idl/velocity_curve'

export function useVelocityProgram() {
  const { connection } = useConnection()
  const anchorWallet = useAnchorWallet()
  const wallet = useWallet()

  const readonlyProgram = useMemo(
    () => getReadonlyVelocityProgram(connection),
    [connection],
  )

  const program: Program<VelocityCurve> | null = useMemo(() => {
    if (!anchorWallet) return null
    const provider = getVelocityProvider(connection, anchorWallet)
    return getVelocityProgram(provider)
  }, [connection, anchorWallet])

  return {
    connection,
    wallet,
    anchorWallet,
    program,
    readonlyProgram,
    programId: VELOCITY_CURVE_PROGRAM_ID,
    rpcUrl: RPC_URL,
    cluster: clusterLabel(RPC_URL),
    connected: wallet.connected,
    publicKey: wallet.publicKey,
  }
}
