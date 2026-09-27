import { PublicKey } from '@solana/web3.js'
import { LORE_MERGE_PROGRAM_ID } from './constants'

/**
 * PDA seeds (must match programs/lore-merge/src/state.rs):
 * - MergeConfig:   [b"merge-config"]
 * - MergeProposal: [b"merge", absorber, target]
 * - LoreAsset:     [b"lore", origin_curve]
 * - VoteRecord:    [b"vote", proposal, voter]
 */

export const MERGE_CONFIG_SEED = Buffer.from('merge-config')
export const MERGE_SEED = Buffer.from('merge')
export const LORE_SEED = Buffer.from('lore')
export const VOTE_SEED = Buffer.from('vote')

export function findMergeConfigPda(
  programId: PublicKey = LORE_MERGE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([MERGE_CONFIG_SEED], programId)
}

export function findMergeProposalPda(
  absorber: PublicKey,
  target: PublicKey,
  programId: PublicKey = LORE_MERGE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MERGE_SEED, absorber.toBuffer(), target.toBuffer()],
    programId,
  )
}

export function findLoreAssetPda(
  originCurve: PublicKey,
  programId: PublicKey = LORE_MERGE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([LORE_SEED, originCurve.toBuffer()], programId)
}

export function findVoteRecordPda(
  proposal: PublicKey,
  voter: PublicKey,
  programId: PublicKey = LORE_MERGE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VOTE_SEED, proposal.toBuffer(), voter.toBuffer()],
    programId,
  )
}
