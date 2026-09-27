import { AnchorProvider, Program, type Idl } from '@coral-xyz/anchor'
import { PublicKey, type Connection } from '@solana/web3.js'
import type { AnchorWallet } from '@solana/wallet-adapter-react'
import idlJson from '../../idl/narrative_auction.json'
import type { NarrativeAuction } from '../../idl/narrative_auction'
import { COMMITMENT, PROGRAM_ID } from './constants'
import { findConfigPda } from './pdas'
import { mapStoryMarketToStory } from './mappers'
import type { Story } from '../../types'

/** Ensure IDL address matches env override. */
function idlWithAddress(): NarrativeAuction {
  const idl = structuredClone(idlJson) as NarrativeAuction
  ;(idl as { address: string }).address = PROGRAM_ID.toBase58()
  return idl
}

export function getProvider(
  connection: Connection,
  wallet: AnchorWallet,
): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  })
}

export function getProgram(provider: AnchorProvider): Program<NarrativeAuction> {
  return new Program(idlWithAddress() as Idl as NarrativeAuction, provider)
}

/** Read-only program (no signing) for account fetches. */
export function getReadonlyProgram(connection: Connection): Program<NarrativeAuction> {
  const dummyWallet = {
    publicKey: PROGRAM_ID,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  }
  const provider = new AnchorProvider(connection, dummyWallet as AnchorWallet, {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  })
  return getProgram(provider)
}

export async function fetchStoryMarkets(
  program: Program<NarrativeAuction>,
): Promise<Story[]> {
  const accounts = await program.account.storyMarket.all()
  return accounts.map((a) => mapStoryMarketToStory(a.publicKey.toBase58(), a.account))
}

export async function fetchConfig(program: Program<NarrativeAuction>) {
  const [configPda] = findConfigPda(new PublicKey(program.programId.toBase58()))
  try {
    return await program.account.narrativeConfig.fetch(configPda)
  } catch {
    return null
  }
}
