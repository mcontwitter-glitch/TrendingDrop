import { AnchorProvider, Program, type Idl } from '@coral-xyz/anchor'
import { PublicKey, type Connection } from '@solana/web3.js'
import type { AnchorWallet } from '@solana/wallet-adapter-react'
import idlJson from '../../idl/reputation_nft.json'
import type { ReputationNft } from '../../idl/reputation_nft'
import { COMMITMENT, REPUTATION_NFT_PROGRAM_ID } from './constants'
import { mapTraderProfile, type OnChainTraderProfile } from './reputationMappers'
import type { TraderProfileView } from '../../types'
import { findProfilePda } from './reputationPdas'

function idlWithAddress(): ReputationNft {
  const idl = structuredClone(idlJson) as ReputationNft
  ;(idl as { address: string }).address = REPUTATION_NFT_PROGRAM_ID.toBase58()
  return idl
}

export function getReputationProvider(
  connection: Connection,
  wallet: AnchorWallet,
): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  })
}

export function getReputationProgram(
  provider: AnchorProvider,
): Program<ReputationNft> {
  return new Program(idlWithAddress() as Idl as ReputationNft, provider)
}

export function getReadonlyReputationProgram(
  connection: Connection,
): Program<ReputationNft> {
  const dummyWallet = {
    publicKey: REPUTATION_NFT_PROGRAM_ID,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  }
  const provider = new AnchorProvider(connection, dummyWallet as AnchorWallet, {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  })
  return getReputationProgram(provider)
}

export async function fetchTraderProfile(
  program: Program<ReputationNft>,
  owner: PublicKey,
): Promise<TraderProfileView | null> {
  const [pda] = findProfilePda(owner, program.programId)
  try {
    const account = await program.account.traderProfile.fetch(pda)
    return mapTraderProfile(pda.toBase58(), account as unknown as OnChainTraderProfile)
  } catch {
    return null
  }
}
