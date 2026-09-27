import { PublicKey } from '@solana/web3.js'
import { REPUTATION_NFT_PROGRAM_ID } from './constants'

/**
 * PDA seeds (must match programs/reputation-nft/src/state.rs):
 * - TraderProfile: [b"profile", owner]
 */

export const PROFILE_SEED = Buffer.from('profile')

export function findProfilePda(
  owner: PublicKey,
  programId: PublicKey = REPUTATION_NFT_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PROFILE_SEED, owner.toBuffer()], programId)
}
