import { PublicKey } from '@solana/web3.js'
import { REPUTATION_NFT_PROGRAM_ID } from './constants'

/**
 * PDA seeds (must match programs/reputation-nft/src/state.rs + metaplex.rs):
 * - TraderProfile: [b"profile", owner]
 * - Metaplex metadata: [b"metadata", TOKEN_METADATA_PROGRAM_ID, mint]
 */

export const PROFILE_SEED = Buffer.from('profile')

/** Metaplex Token Metadata program id (mainnet/devnet). */
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
)

export function findProfilePda(
  owner: PublicKey,
  programId: PublicKey = REPUTATION_NFT_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PROFILE_SEED, owner.toBuffer()], programId)
}

export function findMetadataPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID,
  )
}

/** Deterministic placeholder URI (matches on-chain `reputation_uri`). */
export function reputationUri(tier: string, owner: PublicKey): string {
  return `https://bcc.local/reputation/${tier.toLowerCase()}/${owner.toBase58()}.json`
}
