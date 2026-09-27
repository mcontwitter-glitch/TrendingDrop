import { AnchorProvider, Program, type Idl } from '@coral-xyz/anchor'
import { PublicKey, type Connection } from '@solana/web3.js'
import type { AnchorWallet } from '@solana/wallet-adapter-react'
import idlJson from '../../idl/velocity_curve.json'
import type { VelocityCurve } from '../../idl/velocity_curve'
import { COMMITMENT, VELOCITY_CURVE_PROGRAM_ID } from './constants'
import { mapVelocityTokenToCurve, type OnChainVelocityToken } from './velocityMappers'
import type { CurveToken } from '../../types'

function idlWithAddress(): VelocityCurve {
  const idl = structuredClone(idlJson) as VelocityCurve
  ;(idl as { address: string }).address = VELOCITY_CURVE_PROGRAM_ID.toBase58()
  return idl
}

export function getVelocityProvider(
  connection: Connection,
  wallet: AnchorWallet,
): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  })
}

export function getVelocityProgram(provider: AnchorProvider): Program<VelocityCurve> {
  return new Program(idlWithAddress() as Idl as VelocityCurve, provider)
}

/** Read-only program (no signing) for account fetches. */
export function getReadonlyVelocityProgram(
  connection: Connection,
): Program<VelocityCurve> {
  const dummyWallet = {
    publicKey: VELOCITY_CURVE_PROGRAM_ID,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  }
  const provider = new AnchorProvider(connection, dummyWallet as AnchorWallet, {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  })
  return getVelocityProgram(provider)
}

export async function fetchVelocityTokens(
  program: Program<VelocityCurve>,
): Promise<CurveToken[]> {
  const accounts = await program.account.velocityToken.all()
  return accounts.map((a) =>
    mapVelocityTokenToCurve(a.publicKey.toBase58(), a.account as unknown as OnChainVelocityToken),
  )
}

export async function fetchVelocityToken(
  program: Program<VelocityCurve>,
  curvePubkey: PublicKey,
): Promise<CurveToken | null> {
  try {
    const account = await program.account.velocityToken.fetch(curvePubkey)
    return mapVelocityTokenToCurve(
      curvePubkey.toBase58(),
      account as unknown as OnChainVelocityToken,
    )
  } catch {
    return null
  }
}
