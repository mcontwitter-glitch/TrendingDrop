import { type Program } from '@coral-xyz/anchor'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import type { ReputationNft } from '../../idl/reputation_nft'
import { findProfilePda } from './reputationPdas'
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
