import { BN, type Program } from '@coral-xyz/anchor'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import type { LoreMerge } from '../../idl/lore_merge'
import { VELOCITY_CURVE_PROGRAM_ID } from './constants'
import {
  findLoreAssetPda,
  findMergeConfigPda,
  findMergeProposalPda,
  findVoteRecordPda,
} from './mergePdas'
import { findCurveVaultPda, findHolderPda } from './velocityPdas'
import { fetchMergeConfig } from './mergeProgram'
import { formatTxError, SolanaClientError } from './transactions'

export async function ensureMergeConfig(
  program: Program<LoreMerge>,
  authority: PublicKey,
  treasury?: PublicKey,
): Promise<{ configPda: PublicKey; created: boolean }> {
  const [configPda] = findMergeConfigPda(program.programId)
  const existing = await fetchMergeConfig(program)
  if (existing) return { configPda, created: false }

  try {
    await program.methods
      .initializeConfig(null, null, null, null)
      .accountsStrict({
        config: configPda,
        treasury: treasury ?? authority,
        velocityCurveProgram: VELOCITY_CURVE_PROGRAM_ID,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    return { configPda, created: true }
  } catch (err) {
    throw new SolanaClientError(
      `initialize_config (merge) failed: ${formatTxError(err)}. Deploy LoreMerge and init config first.`,
    )
  }
}

export async function initializeLoreAsset(
  program: Program<LoreMerge>,
  curve: PublicKey,
  payer: PublicKey,
  contentHash: number[] | Uint8Array,
): Promise<{ signature: string; lorePda: PublicKey }> {
  const { configPda } = await ensureMergeConfig(program, payer)
  const [lorePda] = findLoreAssetPda(curve, program.programId)
  const hash = Array.from(contentHash)
  if (hash.length !== 32) throw new SolanaClientError('content_hash must be 32 bytes')

  try {
    const signature = await program.methods
      .initializeLoreAsset(hash)
      .accountsStrict({
        config: configPda,
        curve,
        loreAsset: lorePda,
        payer,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    return { signature, lorePda }
  } catch (err) {
    throw new SolanaClientError(formatTxError(err))
  }
}

export async function proposeMerge(
  program: Program<LoreMerge>,
  params: {
    absorber: PublicKey
    target: PublicKey
    absorptionRatio: number
    proposer: PublicKey
  },
): Promise<{ signature: string; proposalPda: PublicKey }> {
  const { absorber, target, absorptionRatio, proposer } = params
  if (absorptionRatio <= 0) throw new SolanaClientError('absorption_ratio must be > 0')

  const { configPda } = await ensureMergeConfig(program, proposer)
  const [proposalPda] = findMergeProposalPda(absorber, target, program.programId)
  const [absorberLore] = findLoreAssetPda(absorber, program.programId)
  const [targetLore] = findLoreAssetPda(target, program.programId)
  const [proposerHolder] = findHolderPda(absorber, proposer)

  try {
    await program.account.loreAsset.fetch(absorberLore)
    await program.account.loreAsset.fetch(targetLore)
  } catch {
    throw new SolanaClientError(
      'Lore assets missing — initialize lore for absorber and target curves first',
    )
  }

  try {
    const signature = await program.methods
      .proposeMerge(target, absorptionRatio)
      .accountsStrict({
        config: configPda,
        proposal: proposalPda,
        absorber,
        target,
        absorberLore,
        targetLore,
        proposerHolder,
        proposer,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    return { signature, proposalPda }
  } catch (err) {
    throw new SolanaClientError(formatTxError(err))
  }
}

export async function voteMerge(
  program: Program<LoreMerge>,
  params: {
    proposal: PublicKey
    absorber: PublicKey
    amount: number
    support: boolean
    voter: PublicKey
  },
): Promise<{ signature: string }> {
  const { proposal, absorber, amount, support, voter } = params
  if (amount <= 0) throw new SolanaClientError('Vote amount must be positive')

  const [configPda] = findMergeConfigPda(program.programId)
  const config = await fetchMergeConfig(program)
  if (!config) {
    throw new SolanaClientError('MergeConfig missing — initialize merge config first')
  }

  const [voteRecord] = findVoteRecordPda(proposal, voter, program.programId)
  const [voterHolder] = findHolderPda(absorber, voter)

  try {
    const signature = await program.methods
      .voteMerge(new BN(amount), support)
      .accountsStrict({
        config: configPda,
        proposal,
        voteRecord,
        voterHolder,
        voter,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    return { signature }
  } catch (err) {
    throw new SolanaClientError(formatTxError(err))
  }
}

export async function executeMerge(
  program: Program<LoreMerge>,
  params: {
    proposal: PublicKey
    absorber: PublicKey
    target: PublicKey
    executor: PublicKey
  },
): Promise<{ signature: string }> {
  const { proposal, absorber, target, executor } = params
  const [configPda] = findMergeConfigPda(program.programId)
  const config = await fetchMergeConfig(program)
  if (!config) {
    throw new SolanaClientError('MergeConfig missing — initialize merge config first')
  }

  const [absorberLore] = findLoreAssetPda(absorber, program.programId)
  const [targetLore] = findLoreAssetPda(target, program.programId)
  const [targetVault] = findCurveVaultPda(target)
  const [absorberVault] = findCurveVaultPda(absorber)
  const treasury = config.treasury as PublicKey
  const velocityProgram =
    (config.velocityCurveProgram as PublicKey | undefined) ?? VELOCITY_CURVE_PROGRAM_ID

  try {
    const signature = await program.methods
      .executeMerge()
      .accountsStrict({
        config: configPda,
        proposal,
        absorberLore,
        targetLore,
        absorberCurve: absorber,
        targetCurve: target,
        targetVault,
        absorberVault,
        velocityProgram,
        treasury,
        executor,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    return { signature }
  } catch (err) {
    throw new SolanaClientError(formatTxError(err))
  }
}
