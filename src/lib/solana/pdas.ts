import { PublicKey } from '@solana/web3.js'
import { PROGRAM_ID } from './constants'

/**
 * PDA seeds (must match programs/narrative-auction/src/state.rs):
 * - NarrativeConfig:  [b"narrative-config"]
 * - StoryMarket:      [b"story", creator, content_hash]
 * - Story vault:      [b"story-vault", story_pubkey]
 * - StakePosition:    [b"stake", story_pubkey, staker]
 * - RankingBoard:     [b"ranking-board"]
 * - UserStakeIndex:   [b"user-stakes", user]
 * - StakeAirdrop:     [b"stake-airdrop", story]
 * - AirdropClaim:     [b"airdrop-claim", story, staker]
 */

export const CONFIG_SEED = Buffer.from('narrative-config')
export const STORY_SEED = Buffer.from('story')
export const VAULT_SEED = Buffer.from('story-vault')
export const STAKE_SEED = Buffer.from('stake')
export const RANKING_BOARD_SEED = Buffer.from('ranking-board')
export const USER_STAKES_SEED = Buffer.from('user-stakes')
export const STAKE_AIRDROP_SEED = Buffer.from('stake-airdrop')
export const AIRDROP_CLAIM_SEED = Buffer.from('airdrop-claim')

export function findConfigPda(programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], programId)
}

export function findStoryPda(
  creator: PublicKey,
  contentHash: Uint8Array | number[] | Buffer,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [STORY_SEED, creator.toBuffer(), Buffer.from(contentHash)],
    programId,
  )
}

export function findVaultPda(
  story: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_SEED, story.toBuffer()], programId)
}

export function findStakePda(
  story: PublicKey,
  staker: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [STAKE_SEED, story.toBuffer(), staker.toBuffer()],
    programId,
  )
}

export function findRankingBoardPda(
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([RANKING_BOARD_SEED], programId)
}

export function findUserStakeIndexPda(
  user: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([USER_STAKES_SEED, user.toBuffer()], programId)
}

export function findStakeAirdropPda(
  story: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([STAKE_AIRDROP_SEED, story.toBuffer()], programId)
}

export function findAirdropClaimPda(
  story: PublicKey,
  staker: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [AIRDROP_CLAIM_SEED, story.toBuffer(), staker.toBuffer()],
    programId,
  )
}
