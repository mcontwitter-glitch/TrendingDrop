import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import type { CurveToken, HolderPositionView, VelocityMode } from '../../types'
import { getMetadataByPubkey } from './metadata'
import { modeFromScores, settleHolderRewards, velocityParams } from './velocityMath'
import { coverForTicker, hashCover } from '../tokenCovers'

const EMOJIS = ['🎰', '🤖', '🐈‍⬛', '🌴', '💀', '🧠', '🚀', '🐸', '👻', '🔥', '⚡', '🐋', '🐕', '👀']
const GRADIENTS = [
  'from-cyan-500/40 via-teal-400/20 to-blue-900/40',
  'from-sky-500/40 via-cyan-400/20 to-indigo-900/40',
  'from-amber-400/40 via-orange-500/25 to-yellow-300/20',
  'from-emerald-500/35 via-teal-500/20 to-cyan-600/30',
  'from-blue-500/40 via-cyan-500/25 to-teal-700/30',
  'from-teal-500/35 via-cyan-500/20 to-slate-800/40',
]

function hashPick(seed: string, list: string[]): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return list[h % list.length]
}

function bnToNumber(v: { toNumber(): number } | number | bigint): number {
  if (typeof v === 'number') return v
  if (typeof v === 'bigint') return Number(v)
  try {
    return v.toNumber()
  } catch {
    return Number(String(v))
  }
}

function bnToBigInt(v: { toString(): string } | number | bigint): bigint {
  if (typeof v === 'bigint') return v
  if (typeof v === 'number') return BigInt(Math.floor(v))
  return BigInt(v.toString())
}

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

/** On-chain VelocityToken account (Anchor decoded). */
export interface OnChainVelocityToken {
  mint: { toBase58(): string }
  storyId: { toBase58(): string }
  creator: { toBase58(): string }
  basePrice: { toNumber(): number } | number
  currentSupply: { toNumber(): number } | number
  currentPrice: { toNumber(): number } | number
  attentionScore: { toNumber(): number } | number
  priceVelocity: { toNumber(): number } | number
  curveK: { toNumber(): number } | number
  sellTaxBps: number
  lastOracleUpdate: { toNumber(): number } | number
  mergeCount: number
  isMerged: boolean
  solReserve: { toNumber(): number } | number
  protocolFees: { toNumber(): number } | number
  holderRewardsPool: { toNumber(): number } | number
  rewardIndex: { toString(): string } | number | bigint
  lastPrice: { toNumber(): number } | number
  seedLiquidity: { toNumber(): number } | number
  bump: number
  vaultBump: number
}

export interface OnChainHolderPosition {
  owner: { toBase58(): string }
  token: { toBase58(): string }
  balance: { toNumber(): number } | number
  entryPrice: { toNumber(): number } | number
  lastAttentionClaim: { toNumber(): number } | number
  lorePower: number
  rewardDebt: { toString(): string } | number | bigint
  claimableRewards: { toNumber(): number } | number
  bump: number
}

export function mapVelocityTokenToCurve(
  pubkey: string,
  account: OnChainVelocityToken,
): CurveToken {
  const storyId = account.storyId.toBase58()
  const meta = getMetadataByPubkey(storyId) ?? getMetadataByPubkey(pubkey)
  const attention = bnToNumber(account.attentionScore)
  const priceVel = bnToNumber(account.priceVelocity)
  const { sellTaxBps } = velocityParams(bnToNumber(account.curveK), attention, priceVel)
  const mode = modeFromScores(attention, priceVel) as VelocityMode
  const seed = meta?.title || meta?.ticker || pubkey
  const supply = bnToNumber(account.currentSupply)
  const priceLamports = bnToNumber(account.currentPrice)
  const reserveLamports = bnToNumber(account.solReserve)

  return {
    id: pubkey,
    pubkey,
    storyId,
    mint: account.mint.toBase58(),
    title: meta?.title ?? `Story ${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`,
    ticker: meta?.ticker ?? pubkey.slice(0, 4).toUpperCase(),
    blurb:
      meta?.blurb ??
      meta?.description?.slice(0, 120) ??
      "Metadata not shared yet — only this browser's Create Story cache has the name.",
    emoji: hashPick(seed, EMOJIS),
    imageUrl: meta?.ticker ? coverForTicker(meta.ticker) : hashCover(seed),
    gradient: hashPick(seed + 'g', GRADIENTS),
    creator: truncateAddress(account.creator.toBase58()),
    creatorPubkey: account.creator.toBase58(),
    basePriceLamports: bnToNumber(account.basePrice),
    currentPriceLamports: priceLamports,
    currentSupply: supply,
    attentionScore: attention,
    priceVelocity: priceVel,
    curveK: bnToNumber(account.curveK),
    sellTaxBps: account.sellTaxBps || sellTaxBps,
    mode,
    solReserveSol: reserveLamports / LAMPORTS_PER_SOL,
    solReserveLamports: reserveLamports,
    holderRewardsPoolLamports: bnToNumber(account.holderRewardsPool),
    rewardIndex: bnToBigInt(account.rewardIndex),
    mergeCount: account.mergeCount,
    isMerged: account.isMerged,
    lastOracleUpdate: bnToNumber(account.lastOracleUpdate) * 1000,
    onChain: true,
  }
}

export function mapHolderPosition(
  account: OnChainHolderPosition,
  rewardIndex: bigint,
): HolderPositionView {
  const balance = bnToNumber(account.balance)
  const debt = bnToBigInt(account.rewardDebt)
  const storedClaimable = bnToNumber(account.claimableRewards)
  const settled = settleHolderRewards(balance, debt, rewardIndex, storedClaimable)
  return {
    owner: account.owner.toBase58(),
    curve: account.token.toBase58(),
    balance,
    entryPriceLamports: bnToNumber(account.entryPrice),
    claimableRewardsLamports: Number(settled.claimable),
    lorePower: account.lorePower,
    lastClaimAt: bnToNumber(account.lastAttentionClaim) * 1000,
  }
}
