import { BN, type Program } from '@coral-xyz/anchor'
import { PublicKey, SystemProgram } from '@solana/web3.js'
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

  let supply = params.supply ?? 0
  let basePrice = params.basePrice ?? 1
  let curveK = params.curveK ?? 1
  let attention = params.attention ?? 0
  let priceVelocity = params.priceVelocity ?? 0
  let creator = params.creatorPubkey

  try {
    const curve = await program.account.velocityToken.fetch(curvePubkey)
    supply = Number(curve.currentSupply)
    basePrice = Number(curve.basePrice)
    curveK = Number(curve.curveK)
    attention = Number(curve.attentionScore)
    priceVelocity = Number(curve.priceVelocity)
    creator = curve.creator
  } catch {
    throw new SolanaClientError('Curve account not found on this cluster')
  }

  const quote = estimateBuy(lamports, supply, basePrice, curveK, attention, priceVelocity)
  const minOut =
    (quote.tokensOut * BigInt(10_000 - slippageBps)) / 10_000n

  const [vaultPda] = findCurveVaultPda(curvePubkey, program.programId)
  const [holderPda] = findHolderPda(curvePubkey, buyer, program.programId)
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
        holder: holderPda,
        treasury,
        buyer,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    return { signature, estimatedTokens: quote.tokensOut }
  } catch (err) {
    throw new SolanaClientError(formatTxError(err))
  }
}

export interface SellParams {
  curvePubkey: PublicKey
  /** Token amount (internal ledger units). */
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

  let supply = 0
  let basePrice = 1
  let curveK = 1
  let attention = 0
  let priceVelocity = 0
  let creator: PublicKey = seller

  try {
    const curve = await program.account.velocityToken.fetch(curvePubkey)
    supply = Number(curve.currentSupply)
    basePrice = Number(curve.basePrice)
    curveK = Number(curve.curveK)
    attention = Number(curve.attentionScore)
    priceVelocity = Number(curve.priceVelocity)
    creator = curve.creator
  } catch {
    throw new SolanaClientError('Curve account not found on this cluster')
  }

  const quote = estimateSell(amount, supply, basePrice, curveK, attention, priceVelocity)
  const minOut =
    (quote.solNetLamports * BigInt(10_000 - slippageBps)) / 10_000n

  const [vaultPda] = findCurveVaultPda(curvePubkey, program.programId)
  const [holderPda] = findHolderPda(curvePubkey, seller, program.programId)
  const treasury = await resolveTreasury(program.provider.connection, creator)

  try {
    const signature = await program.methods
      .sell(new BN(amount), new BN(minOut.toString()))
      .accountsStrict({
        curve: curvePubkey,
        vault: vaultPda,
        holder: holderPda,
        treasury,
        seller,
        systemProgram: SystemProgram.programId,
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
   * Additional authorized oracle pubkeys that co-sign this tx.
   * Together with `cranker` (if authorized), must reach OracleConfig.quorum.
   */
  oracleSigners?: PublicKey[]
  /** Reserved for future ed25519 sysvar verification (pass empty for multi-sig crank). */
  proof?: number[] | Buffer | Uint8Array
}

/**
 * Multi-sig oracle crank: metrics once + ≥ quorum distinct authorized signers
 * (cranker if authorized + remainingAccounts).
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
      })
      .remainingAccounts(remaining)
      .rpc()
    return { signature }
  } catch (err) {
    throw new SolanaClientError(formatTxError(err))
  }
}
