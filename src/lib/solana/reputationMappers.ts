import { PublicKey } from '@solana/web3.js'
import type { ReputationTierName, TraitName, TraderProfileView } from '../../types'

const TIER_KEYS = ['bronze', 'silver', 'gold', 'diamond', 'mythic'] as const
const TRAIT_KEYS = [
  'earlyAdopter',
  'oracleWhisperer',
  'mergeMaster',
  'diamondHands',
  'narrativeCreator',
] as const

const TIER_LABEL: Record<(typeof TIER_KEYS)[number], ReputationTierName> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  diamond: 'Diamond',
  mythic: 'Mythic',
}

const TRAIT_LABEL: Record<(typeof TRAIT_KEYS)[number], TraitName> = {
  earlyAdopter: 'EarlyAdopter',
  oracleWhisperer: 'OracleWhisperer',
  mergeMaster: 'MergeMaster',
  diamondHands: 'DiamondHands',
  narrativeCreator: 'NarrativeCreator',
}

export interface OnChainTraderProfile {
  owner: PublicKey
  totalPredictions: number
  correctPredictions: number
  totalVolume: { toNumber(): number } | number | bigint
  accuracyScore: number
  tier: Record<string, unknown> | ReputationTierName
  lastUpdated: { toNumber(): number } | number
  specialTraits: Array<Record<string, unknown> | TraitName>
  nftMint: PublicKey
  bump: number
}

function num(v: { toNumber(): number } | number | bigint | undefined): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'bigint') return Number(v)
  return v.toNumber()
}

function enumKey(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') {
    const keys = Object.keys(v as object)
    return keys[0] ?? ''
  }
  return String(v)
}

export function mapTier(raw: unknown): ReputationTierName {
  const k = enumKey(raw).replace(/^./, (c) => c.toLowerCase())
  const camel = k.charAt(0).toLowerCase() + k.slice(1)
  if ((TIER_KEYS as readonly string[]).includes(camel)) {
    return TIER_LABEL[camel as (typeof TIER_KEYS)[number]]
  }
  // PascalCase fallback
  const pascal = enumKey(raw)
  if (['Bronze', 'Silver', 'Gold', 'Diamond', 'Mythic'].includes(pascal)) {
    return pascal as ReputationTierName
  }
  return 'Bronze'
}

export function mapTrait(raw: unknown): TraitName {
  const k = enumKey(raw)
  const camel = k.charAt(0).toLowerCase() + k.slice(1)
  if ((TRAIT_KEYS as readonly string[]).includes(camel)) {
    return TRAIT_LABEL[camel as (typeof TRAIT_KEYS)[number]]
  }
  if (
    [
      'EarlyAdopter',
      'OracleWhisperer',
      'MergeMaster',
      'DiamondHands',
      'NarrativeCreator',
    ].includes(k)
  ) {
    return k as TraitName
  }
  return 'EarlyAdopter'
}

export function mapTraderProfile(
  pubkey: string,
  a: OnChainTraderProfile,
): TraderProfileView {
  const mint = a.nftMint?.toBase58?.() ?? ''
  return {
    pubkey,
    owner: a.owner.toBase58(),
    totalPredictions: a.totalPredictions,
    correctPredictions: a.correctPredictions,
    totalVolumeLamports: num(a.totalVolume),
    accuracyScoreBps: a.accuracyScore,
    tier: mapTier(a.tier),
    lastUpdated: num(a.lastUpdated) * 1000,
    traits: (a.specialTraits ?? []).map(mapTrait),
    nftMint: mint && mint !== PublicKey.default.toBase58() ? mint : null,
    onChain: true,
    bump: a.bump,
  }
}

export const TIER_COLORS: Record<ReputationTierName, string> = {
  Bronze: 'border-amber-700/50 bg-amber-900/40 text-amber-200',
  Silver: 'border-zinc-400/40 bg-zinc-500/20 text-zinc-200',
  Gold: 'border-yellow-400/40 bg-yellow-500/15 text-yellow-200',
  Diamond: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200',
  Mythic: 'border-bcc-cyan/50 bg-bcc-cyan/20 text-bcc-cyan',
}

export function accuracyPct(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`
}
