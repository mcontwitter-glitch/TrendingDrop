import { AnchorProvider, Program, type Idl } from '@coral-xyz/anchor'
import { PublicKey, type Connection } from '@solana/web3.js'
import type { AnchorWallet } from '@solana/wallet-adapter-react'
import idlJson from '../../idl/lore_merge.json'
import type { LoreMerge } from '../../idl/lore_merge'
import { COMMITMENT, LORE_MERGE_PROGRAM_ID } from './constants'
import {
  mapLoreAsset,
  mapMergeProposal,
  type OnChainLoreAsset,
  type OnChainMergeProposal,
} from './mergeMappers'
import type { LoreAssetView, MergeProposalView } from '../../types'
import { findMergeConfigPda } from './mergePdas'

function idlWithAddress(): LoreMerge {
  const idl = structuredClone(idlJson) as LoreMerge
  ;(idl as { address: string }).address = LORE_MERGE_PROGRAM_ID.toBase58()
  return idl
}

export function getMergeProvider(
  connection: Connection,
  wallet: AnchorWallet,
): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  })
}

export function getMergeProgram(provider: AnchorProvider): Program<LoreMerge> {
  return new Program(idlWithAddress() as Idl as LoreMerge, provider)
}

export function getReadonlyMergeProgram(connection: Connection): Program<LoreMerge> {
  const dummyWallet = {
    publicKey: LORE_MERGE_PROGRAM_ID,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  }
  const provider = new AnchorProvider(connection, dummyWallet as AnchorWallet, {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  })
  return getMergeProgram(provider)
}

export async function fetchMergeConfig(program: Program<LoreMerge>) {
  const [configPda] = findMergeConfigPda(program.programId)
  try {
    return await program.account.mergeConfig.fetch(configPda)
  } catch {
    return null
  }
}

export async function fetchMergeProposals(
  program: Program<LoreMerge>,
): Promise<MergeProposalView[]> {
  const accounts = await program.account.mergeProposal.all()
  return accounts.map((a) =>
    mapMergeProposal(a.publicKey.toBase58(), a.account as unknown as OnChainMergeProposal),
  )
}

export async function fetchMergeProposal(
  program: Program<LoreMerge>,
  proposalPubkey: PublicKey,
): Promise<MergeProposalView | null> {
  try {
    const account = await program.account.mergeProposal.fetch(proposalPubkey)
    return mapMergeProposal(
      proposalPubkey.toBase58(),
      account as unknown as OnChainMergeProposal,
    )
  } catch {
    return null
  }
}

export async function fetchLoreAssets(
  program: Program<LoreMerge>,
): Promise<LoreAssetView[]> {
  const accounts = await program.account.loreAsset.all()
  return accounts.map((a) =>
    mapLoreAsset(a.publicKey.toBase58(), a.account as unknown as OnChainLoreAsset),
  )
}

export async function fetchLoreAsset(
  program: Program<LoreMerge>,
  lorePubkey: PublicKey,
): Promise<LoreAssetView | null> {
  try {
    const account = await program.account.loreAsset.fetch(lorePubkey)
    return mapLoreAsset(lorePubkey.toBase58(), account as unknown as OnChainLoreAsset)
  } catch {
    return null
  }
}
