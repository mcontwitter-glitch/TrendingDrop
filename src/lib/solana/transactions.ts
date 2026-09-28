import { BN, type Program } from '@coral-xyz/anchor'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js'
import type { NarrativeAuction } from '../../idl/narrative_auction'
import { CURVE_PROGRAM_ID, LAMPORTS_PER_SOL } from './constants'
import {
  findConfigPda,
  findRankingBoardPda,
  findStakePda,
  findStoryPda,
  findUserStakeIndexPda,
  findVaultPda,
} from './pdas'
import { findCurvePda, findCurveVaultPda } from './velocityPdas'
import { fetchConfig } from './program'
import { hashNarrativeContent } from './contentHash'
import { bytesToHex, saveNarrativeMetadata, type NarrativeMetadata } from './metadata'
import { grindMintKeypair, MINT_VANITY_SUFFIX } from './vanityMint'

export class SolanaClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SolanaClientError'
  }
}

function formatTxError(err: unknown): string {
  if (err instanceof SolanaClientError) return err.message
  if (err instanceof Error) {
    const msg = err.message
    if (/fetch|ECONNREFUSED|Failed to fetch|network/i.test(msg)) {
      return 'RPC unavailable — is localnet running? Connect wallet / start validator, or use mock mode.'
    }
    if (/User rejected|rejected the request/i.test(msg)) {
      return 'Transaction rejected in wallet'
    }
    if (/Account does not exist|could not find account/i.test(msg)) {
      return 'Program or account not found — deploy programs and initialize config first'
    }
    if (/Attempt to load a program that does not exist|Program is not deployed|Invalid program id/i.test(msg)) {
      return 'Program not deployed on this cluster — txs stay mock until you deploy'
    }
    // Anchor custom error: "Error Code: Foo. Error Number: 600x. Error Message: …"
    const anchor = msg.match(/Error Code:\s*(\w+)[\s\S]*?Error Message:\s*([^\n.]+)/i)
    if (anchor) {
      return `${anchor[1]}: ${anchor[2].trim()}`
    }
    const sim = msg.match(/custom program error:\s*(0x[0-9a-f]+)/i)
    if (sim) {
      return `On-chain error ${sim[1]} — check Anchor logs / program not initialized`
    }
    // Truncate huge stack dumps for toast readability
    if (msg.length > 280) {
      const first = msg.split('\n').find((l) => l.trim().length > 0) ?? msg
      return first.slice(0, 240) + (first.length > 240 ? '…' : '')
    }
    return msg
  }
  return String(err)
}

export async function ensureConfig(
  program: Program<NarrativeAuction>,
  authority: PublicKey,
  treasury?: PublicKey,
): Promise<{ configPda: PublicKey; created: boolean }> {
  const [configPda] = findConfigPda(program.programId)
  const existing = await fetchConfig(program)
  if (existing) return { configPda, created: false }

  try {
    await program.methods
      .initializeConfig(null, null)
      .accountsStrict({
        config: configPda,
        authority,
        treasury: treasury ?? authority,
        curveProgram: CURVE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    return { configPda, created: true }
  } catch (err) {
    throw new SolanaClientError(
      `initialize_config failed: ${formatTxError(err)}. Config must exist before creating stories.`,
    )
  }
}

export interface InitializeStoryParams {
  meta: NarrativeMetadata
  /** Auction duration in seconds (3600 .. graduation_window). */
  durationSeconds: number
  /** Optional graduation threshold in SOL. Omit for on-chain default (10 SOL). */
  graduationThresholdSol?: number
  creator: PublicKey
}

export async function initializeStory(
  program: Program<NarrativeAuction>,
  params: InitializeStoryParams,
): Promise<{ storyPda: PublicKey; contentHashHex: string; signature: string }> {
  const { meta, durationSeconds, graduationThresholdSol, creator } = params

  const { configPda } = await ensureConfig(program, creator)

  const contentHash = await hashNarrativeContent(meta)
  const contentHashArr = Array.from(contentHash) as number[]
  const [storyPda] = findStoryPda(creator, contentHash, program.programId)

  const threshold =
    graduationThresholdSol != null
      ? new BN(Math.round(graduationThresholdSol * LAMPORTS_PER_SOL))
      : null

  try {
    const signature = await program.methods
      .initializeStory(contentHashArr, new BN(durationSeconds), threshold)
      .accountsStrict({
        config: configPda,
        story: storyPda,
        creator,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    const contentHashHex = bytesToHex(contentHash)
    saveNarrativeMetadata(contentHashHex, meta, storyPda.toBase58())

    return { storyPda, contentHashHex, signature }
  } catch (err) {
    throw new SolanaClientError(formatTxError(err))
  }
}

export interface StakeParams {
  storyPubkey: PublicKey
  /** Gross stake in SOL (fee taken on-chain). */
  amountSol: number
  staker: PublicKey
}

export async function stakeOnNarrative(
  program: Program<NarrativeAuction>,
  params: StakeParams,
): Promise<{ signature: string }> {
  const { storyPubkey, amountSol, staker } = params
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL)
  if (lamports <= 0) throw new SolanaClientError('Stake amount must be positive')

  const [configPda] = findConfigPda(program.programId)
  const config = await fetchConfig(program)
  if (!config) {
    throw new SolanaClientError(
      'NarrativeConfig missing — run initialize_config (or Create Story once as authority) first',
    )
  }

  try {
    await program.account.storyMarket.fetch(storyPubkey)
  } catch {
    throw new SolanaClientError('Story market account not found on this cluster')
  }

  const [vaultPda] = findVaultPda(storyPubkey, program.programId)
  const [stakePda] = findStakePda(storyPubkey, staker, program.programId)
  const [userStakeIndexPda] = findUserStakeIndexPda(staker, program.programId)

  try {
    const signature = await program.methods
      .stakeOnNarrative(new BN(lamports))
      .accountsStrict({
        config: configPda,
        story: storyPubkey,
        vault: vaultPda,
        stakePosition: stakePda,
        userStakeIndex: userStakeIndexPda,
        treasury: config.treasury,
        staker,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    return { signature }
  } catch (err) {
    throw new SolanaClientError(formatTxError(err))
  }
}


export interface GraduateNarrativeParams {
  storyPubkey: PublicKey
  /** Wallet that pays rent / signs as payer. */
  payer: PublicKey
  /** King-of-the-Hill rank slot 1–5 (default 1). */
  rank?: number
  signal?: AbortSignal
  /** Progress while grinding a mint ending in `drop`. */
  onGrindProgress?: (attempts: number) => void
}

/**
 * Graduate an ended story market: grind a vanity SPL mint (…drop), then call
 * `graduate_narrative`. Can take a few seconds while grinding.
 */
export async function graduateNarrative(
  program: Program<NarrativeAuction>,
  params: GraduateNarrativeParams,
): Promise<{ signature: string; mint: PublicKey; curvePda: PublicKey }> {
  const { storyPubkey, payer, rank = 1, signal, onGrindProgress } = params

  const [configPda] = findConfigPda(program.programId)
  const config = await fetchConfig(program)
  if (!config) {
    throw new SolanaClientError(
      'NarrativeConfig missing — run initialize_config (or Create Story once as authority) first',
    )
  }

  try {
    await program.account.storyMarket.fetch(storyPubkey)
  } catch {
    throw new SolanaClientError('Story market account not found on this cluster')
  }

  const [rankingBoard] = findRankingBoardPda(program.programId)
  const [vaultPda] = findVaultPda(storyPubkey, program.programId)
  const [curvePda] = findCurvePda(storyPubkey, CURVE_PROGRAM_ID)
  const [curveVaultPda] = findCurveVaultPda(curvePda, CURVE_PROGRAM_ID)

  // Vanity grind — expected a few seconds for 4-char suffix `drop`
  let mint: Keypair
  try {
    mint = await grindMintKeypair({
      suffix: MINT_VANITY_SUFFIX,
      signal,
      onProgress: onGrindProgress,
    })
  } catch (err) {
    throw new SolanaClientError(
      err instanceof Error ? err.message : `Mint vanity grind failed: ${String(err)}`,
    )
  }

  const tokenVault = getAssociatedTokenAddressSync(
    mint.publicKey,
    curvePda,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )

  try {
    const signature = await program.methods
      .graduateNarrative(rank)
      .accountsStrict({
        config: configPda,
        story: storyPubkey,
        rankingBoard,
        vault: vaultPda,
        curveProgram: CURVE_PROGRAM_ID,
        tokenMint: mint.publicKey,
        curveState: curvePda,
        curveVault: curveVaultPda,
        tokenVault,
        payer,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .signers([mint])
      .rpc()

    return { signature, mint: mint.publicKey, curvePda }
  } catch (err) {
    throw new SolanaClientError(formatTxError(err))
  }
}

export { formatTxError }
