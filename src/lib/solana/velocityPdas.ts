import { PublicKey } from '@solana/web3.js'
import { VELOCITY_CURVE_PROGRAM_ID } from './constants'

/**
 * PDA seeds (must match programs/velocity-curve/src/state.rs):
 * - VelocityToken:  [b"curve", story_id]
 * - Curve vault:    [b"curve-vault", curve]
 * - HolderPosition: [b"holder", curve, owner]
 * - OracleConfig:   [b"oracle-config"]
 *
 * SPL mint pubkey lives on VelocityToken.mint; buyer/seller ATAs via
 * getAssociatedTokenAddressSync(mint, owner). Curve ATA authority = curve PDA.
 */

export const CURVE_SEED = Buffer.from('curve')
export const CURVE_VAULT_SEED = Buffer.from('curve-vault')
export const HOLDER_SEED = Buffer.from('holder')
export const ORACLE_CONFIG_SEED = Buffer.from('oracle-config')

export function findCurvePda(
  storyId: PublicKey,
  programId: PublicKey = VELOCITY_CURVE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CURVE_SEED, storyId.toBuffer()], programId)
}

export function findCurveVaultPda(
  curve: PublicKey,
  programId: PublicKey = VELOCITY_CURVE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CURVE_VAULT_SEED, curve.toBuffer()], programId)
}

export function findHolderPda(
  curve: PublicKey,
  owner: PublicKey,
  programId: PublicKey = VELOCITY_CURVE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [HOLDER_SEED, curve.toBuffer(), owner.toBuffer()],
    programId,
  )
}

export function findOracleConfigPda(
  programId: PublicKey = VELOCITY_CURVE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ORACLE_CONFIG_SEED], programId)
}
