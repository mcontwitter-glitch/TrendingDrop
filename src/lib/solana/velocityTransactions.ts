import { BN, type Program } from '@coral-xyz/anchor'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { PublicKey, SystemProgram, SYSVAR_INSTRUCTIONS_PUBKEY } from '@solana/web3.js'
import type { VelocityCurve } from '../../idl/velocity_curve'
import { LAMPORTS_PER_SOL } from './constants'
import { findCurveVaultPda, findHolderPda, findOracleConfigPda } from './velocityPdas'
import { estimateBuy, estimateSell } from './velocityMath'
import { formatTxError, SolanaClientError } from './transactions'
import { fetchConfig, getReadonlyProgram } from './program'
import type { Connection } from '@solana/web3.js'

const DEFAULT_SLIPPAGE_BPS = 500 // 5%

async function resolveTreasury(
  connection: Connection,
  fallback: PublicKey,
): Promise<PublicKey> {
  try {
    const narrative = getReadonlyProgram(connection)
    const config = await fetchConfig(narrative)
    if (config?.treasury) return config.treasury as PublicKey
  } catch {
    /* ignore — use fallback */
  }
  return fallback
}

export interface BuyParams {
  curvePubkey: PublicKey
  /** Gross SOL amount (fee taken on-chain). */
  solAmount: number
  buyer: PublicKey
  /** Slippage tolerance in bps (default 5%). */
  slippageBps?: number
  /** Curve state for quote / min_out (optional — fetched if omitted). */
  supply?: number
  basePrice?: number
  curveK?: number
  attention?: number
  priceVelocity?: number
  creatorPubkey?: PublicKey
}

export async function buyOnCurve(
  program: Program<VelocityCurve>,
  params: BuyParams,
): Promise<{ signature: string; estimatedTokens: bigint }> {
  const {
    curvePubkey,
    solAmount,
    buyer,
    slippageBps = DEFAULT_SLIPPAGE_BPS,
  } = params

  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL)
  if (lamports <= 0) throw new SolanaClientError('Buy amount must be positive')

  let virtualSol = params.basePrice ?? 30_000_000_000
  let virtualToken = params.curveK ?? 1_073_000_000
  let attention = params.attention ?? 0
  let priceVelocity = params.priceVelocity ?? 0
  let creator = params.creatorPubkey
  let mint: PublicKey

  try {
    const curve = await program.account.velocityToken.fetch(curvePubkey)
    virtualSol = Number(curve.virtualSol)
    virtualToken = Number(curve.virtualToken)
    attention = Number(curve.attentionScore)
    priceVelocity = Number(curve.priceVelocity)
    creator = curve.creator
    mint = curve.mint
  } catch {
    throw new SolanaClientError('Curve account not found on this cluster')
  }

  const quote = estimateBuy(lamports, virtualSol, virtualToken, attention, priceVelocity)
  const minOut =
    (quote.tokensOut * BigInt(10_000 - slippageBps)) / 10_000n

  const [vaultPda] = findCurveVaultPda(curvePubkey, program.programId)
  const [holderPda] = findHolderPda(curvePubkey, buyer, program.programId)
  const buyerAta = getAssociatedTokenAddressSync(mint, buyer, false, TOKEN_PROGRAM_ID)
  const treasury = await resolveTreasury(
    program.provider.connection,
    creator ?? buyer,
  )

  try {
    const signature = await program.methods
      .buy(new BN(lamports), new BN(minOut.toString()))
      .accountsStrict({
        curve: curvePubkey,
        vault: vaultPda,
        mint,
        buyerAta,
        holder: holderPda,
        treasury,
        buyer,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc()
    return { signature, estimatedTokens: quote.tokensOut }
  } catch (err) {
    throw new SolanaClientError(formatTxError(err))
  }
}

export interface SellParams {
  curvePubkey: PublicKey
  /** Token amount in whole tokens (curve ledger; SPL burn uses ×10^decimals). */
  tokenAmount: number
  seller: PublicKey
  slippageBps?: number
}

export async function sellOnCurve(
  program: Program<VelocityCurve>,
  params: SellParams,
): Promise<{ signature: string; estimatedSolLamports: bigint }> {
  const { curvePubkey, tokenAmount, seller, slippageBps = DEFAULT_SLIPPAGE_BPS } = params
  const amount = Math.floor(tokenAmount)
  if (amount <= 0) throw new SolanaClientError('Sell amount must be positive')

  let virtualSol = 30_000_000_000
  let virtualToken = 1_073_000_000
  let attention = 0
  let priceVelocity = 0
  let creator: PublicKey = seller
  let mint: PublicKey

  try {
    const curve = await program.account.velocityToken.fetch(curvePubkey)
    virtualSol = Number(curve.virtualSol)
    virtualToken = Number(curve.virtualToken)
    attention = Number(curve.attentionScore)
    priceVelocity = Number(curve.priceVelocity)
    creator = curve.creator
    mint = curve.mint
  } catch {
    throw new SolanaClientError('Curve account not found on this cluster')
  }

  const quote = estimateSell(amount, virtualSol, virtualToken, attention, priceVelocity)
  const minOut =
    (quote.solNetLamports * BigInt(10_000 - slippageBps)) / 10_000n

  const [vaultPda] = findCurveVaultPda(curvePubkey, program.programId)
  const [holderPda] = findHolderPda(curvePubkey, seller, program.programId)
  const sellerAta = getAssociatedTokenAddressSync(mint, seller, false, TOKEN_PROGRAM_ID)
  const treasury = await resolveTreasury(program.provider.connection, creator)

  try {
    const signature = await program.methods
      .sell(new BN(amount), new BN(minOut.toString()))
      .accountsStrict({
        curve: curvePubkey,
        vault: vaultPda,
        mint,
        sellerAta,
        holder: holderPda,
        treasury,
        seller,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc()
    return { signature, estimatedSolLamports: quote.solNetLamports }
  } catch (err) {
    throw new SolanaClientError(formatTxError(err))
  }
}

export async function claimHolderRewards(
  program: Program<VelocityCurve>,
  curvePubkey: PublicKey,
  owner: PublicKey,
): Promise<{ signature: string }> {
  const [vaultPda] = findCurveVaultPda(curvePubkey, program.programId)
  const [holderPda] = findHolderPda(curvePubkey, owner, program.programId)

  try {
    await program.account.holderPosition.fetch(holderPda)
  } catch {
    throw new SolanaClientError('No holder position — buy tokens first')
  }

  try {
    const signature = await program.methods
      .claimHolderRewards()
      .accountsStrict({
        curve: curvePubkey,
        vault: vaultPda,
        holder: holderPda,
        owner,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    return { signature }
  } catch (err) {
    throw new SolanaClientError(formatTxError(err))
  }
}

export interface UpdateAttentionParams {
  curvePubkey: PublicKey
  twitterDelta: number
  telegramDelta: number
  newHolders: number
  /** Fee-paying cranker (counted toward quorum if authorized). */
  cranker: PublicKey
  /**
   * Additional authorized oracle pubkeys that co-sign this tx (signer mode).
   * Together with `cranker` (if authorized), must reach OracleConfig.quorum.
   */
  oracleSigners?: PublicKey[]
  /**
   * Ed25519 mode: non-empty proof = i64 LE timestamp (+ ignored bytes).
   * Prior Ed25519Program ixs in the same tx must sign the canonical message
   * (curve || twitter || telegram || holders || timestamp). Pass empty for
   * multi-sig crank (tx-signer) mode.
   */
  proof?: number[] | Buffer | Uint8Array
}

/**
 * Oracle crank — two modes:
 * - proof empty: ≥ quorum distinct authorized **tx signers**
 * - proof non-empty: ≥ quorum distinct authorized **ed25519** attestations
 */
export async function updateAttention(
  program: Program<VelocityCurve>,
  params: UpdateAttentionParams,
): Promise<{ signature: string }> {
  const {
    curvePubkey,
    twitterDelta,
    telegramDelta,
    newHolders,
    cranker,
    oracleSigners = [],
    proof = [],
  } = params

  const [oracleConfig] = findOracleConfigPda(program.programId)

  const remaining = oracleSigners
    .filter((k) => !k.equals(cranker))
    .map((pubkey) => ({
      pubkey,
      isWritable: false,
      isSigner: true,
    }))

  try {
    const signature = await program.methods
      .updateAttention(
        new BN(twitterDelta),
        new BN(telegramDelta),
        new BN(newHolders),
        Buffer.from(proof),
      )
      .accountsStrict({
        curve: curvePubkey,
        oracleConfig,
        cranker,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .remainingAccounts(remaining)
      .rpc()
    return { signature }
  } catch (err) {
    throw new SolanaClientError(formatTxError(err))
  }
}

/**
 * Canonical oracle message bytes (must match on-chain `oracle_proof::canonical_message`):
 * curve(32) || twitter_u64_le || telegram_u64_le || holders_u64_le || timestamp_i64_le
 */
export function encodeOracleCanonicalMessage(
  curve: PublicKey,
  twitterDelta: number | bigint,
  telegramDelta: number | bigint,
  newHolders: number | bigint,
  timestamp: number | bigint,
): Buffer {
  const buf = Buffer.alloc(64)
  curve.toBuffer().copy(buf, 0)
  buf.writeBigUInt64LE(BigInt(twitterDelta), 32)
  buf.writeBigUInt64LE(BigInt(telegramDelta), 40)
  buf.writeBigUInt64LE(BigInt(newHolders), 48)
  buf.writeBigInt64LE(BigInt(timestamp), 56)
  return buf
}

/** Encode `proof` arg for ed25519 mode (timestamp i64 LE). */
export function encodeOracleProofTimestamp(timestamp: number | bigint): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeBigInt64LE(BigInt(timestamp), 0)
  return buf
}
