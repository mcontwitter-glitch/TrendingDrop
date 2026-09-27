import { type Program } from '@coral-xyz/anchor'
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import type { ReputationNft } from '../../idl/reputation_nft'
import {
  findMetadataPda,
  findProfilePda,
  TOKEN_METADATA_PROGRAM_ID,
} from './reputationPdas'
import { formatTxError, SolanaClientError } from './transactions'

export async function initializeProfile(
  program: Program<ReputationNft>,
  owner: PublicKey,
): Promise<{ signature: string; profilePda: PublicKey }> {
  const [profilePda] = findProfilePda(owner, program.programId)
  try {
    const signature = await program.methods
      .initializeProfile()
      .accountsStrict({
        profile: profilePda,
        owner,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    return { signature, profilePda }
  } catch (err) {
    throw new SolanaClientError(formatTxError(err))
  }
}

export async function mintReputationNft(
  program: Program<ReputationNft>,
  owner: PublicKey,
): Promise<{ signature: string; mint: PublicKey; metadata: PublicKey }> {
  const [profilePda] = findProfilePda(owner, program.programId)
  const mintKp = Keypair.generate()
  const [metadataPda] = findMetadataPda(mintKp.publicKey)
  const tokenAccount = getAssociatedTokenAddressSync(mintKp.publicKey, owner)

  try {
    const signature = await program.methods
      .mintReputationNft()
      .accountsStrict({
        profile: profilePda,
        mint: mintKp.publicKey,
        tokenAccount,
        metadata: metadataPda,
        owner,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .signers([mintKp])
      .rpc()
    return { signature, mint: mintKp.publicKey, metadata: metadataPda }
  } catch (err) {
    throw new SolanaClientError(formatTxError(err))
  }
}
