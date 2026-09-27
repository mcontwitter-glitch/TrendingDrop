import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import type { Story, StoryStatus } from '../../types'
import { findCurvePda } from './velocityPdas'
import {
  getMetadataByHash,
  getMetadataByPubkey,
  bytesToHex,
  type NarrativeMetadata,
} from './metadata'

const EMOJIS = ['🎰', '🤖', '🐈‍⬛', '🌴', '💀', '🧠', '🚀', '🐸', '👻', '🔥', '⚡', '🐋']
const GRADIENTS = [
  'from-red-500/40 via-rose-400/20 to-orange-500/30',
  'from-violet-600/40 via-fuchsia-500/20 to-purple-900/40',
  'from-amber-400/40 via-orange-500/25 to-yellow-300/20',
  'from-emerald-500/35 via-teal-500/20 to-cyan-600/30',
  'from-blue-500/40 via-indigo-500/25 to-violet-600/30',
  'from-pink-500/35 via-rose-500/20 to-red-600/30',
]

function hashPick(seed: string, list: string[]): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return list[h % list.length]
}

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

type MarketPhaseLike =
  | { active?: unknown }
  | { graduated?: unknown }
  | { failed?: unknown }
  | { forfeited?: unknown }
  | { draft?: unknown }
  | string

function phaseToStatus(
  phase: MarketPhaseLike,
  totalStakedSol: number,
  thresholdSol: number,
  endsAtMs: number,
): StoryStatus {
  const name =
    typeof phase === 'string'
      ? phase.toLowerCase()
      : 'active' in (phase as object)
        ? 'active'
        : 'graduated' in (phase as object)
          ? 'graduated'
          : 'failed' in (phase as object)
            ? 'failed'
            : 'forfeited' in (phase as object)
              ? 'forfeited'
              : 'draft'

  if (name === 'graduated') return 'graduated'
  // Forfeited = lost ranking (stakes feed winners); surface as failed in UI.
  if (name === 'failed' || name === 'forfeited') return 'failed'
  if (name === 'active' || name === 'draft') {
    const now = Date.now()
    if (endsAtMs > now && totalStakedSol >= thresholdSol * 0.75) return 'graduating'
    return 'active'
  }
  return 'active'
}

/** On-chain StoryMarket account fields (Anchor decoded). */
export interface OnChainStoryMarket {
  creator: { toBase58(): string }
  contentHash: number[] | Uint8Array
  phase: MarketPhaseLike
  totalStaked: { toNumber(): number } | number
  uniqueStakers: number
  createdAt: { toNumber(): number } | number
  endsAt: { toNumber(): number } | number
  graduationThreshold: { toNumber(): number } | number
}

function bnToNumber(v: { toNumber(): number } | number): number {
  return typeof v === 'number' ? v : v.toNumber()
}

function resolveMeta(
  pubkey: string,
  contentHashHex: string,
): NarrativeMetadata {
  return (
    getMetadataByPubkey(pubkey) ??
    getMetadataByHash(contentHashHex) ?? {
      title: `Narrative ${contentHashHex.slice(0, 8)}`,
      ticker: contentHashHex.slice(0, 4).toUpperCase(),
      blurb: 'On-chain story market (metadata not cached in this browser).',
      description:
        'This StoryMarket was fetched from chain. Title/ticker were not stored on-chain — only content_hash. Open Create Story from this browser to cache metadata locally.',
    }
  )
}

export function mapStoryMarketToStory(
  pubkey: string,
  account: OnChainStoryMarket,
): Story {
  const contentHashHex = bytesToHex(account.contentHash)
  const meta = resolveMeta(pubkey, contentHashHex)
  const seed = meta.title || contentHashHex
  const totalLamports = bnToNumber(account.totalStaked)
  const thresholdLamports = bnToNumber(account.graduationThreshold)
  const totalSol = totalLamports / LAMPORTS_PER_SOL
  const thresholdSol = thresholdLamports / LAMPORTS_PER_SOL
  const endsAtMs = bnToNumber(account.endsAt) * 1000
  const createdAtMs = bnToNumber(account.createdAt) * 1000

  const status = phaseToStatus(account.phase, totalSol, thresholdSol, endsAtMs)
  let curveId: string | undefined
  if (status === 'graduated') {
    try {
      const [pda] = findCurvePda(new PublicKey(pubkey))
      curveId = pda.toBase58()
    } catch {
      /* ignore */
    }
  }

  return {
    id: pubkey,
    title: meta.title,
    ticker: meta.ticker,
    blurb: meta.blurb || meta.description.slice(0, 120),
    description: meta.description,
    emoji: hashPick(seed, EMOJIS),
    gradient: hashPick(seed + 'g', GRADIENTS),
    solStaked: totalSol,
    stakerCount: account.uniqueStakers,
    graduationThreshold: thresholdSol,
    endsAt: endsAtMs,
    status,
    creator: truncateAddress(account.creator.toBase58()),
    socials: meta.socials,
    createdAt: createdAtMs,
    pubkey,
    contentHash: contentHashHex,
    onChain: true,
    curveId,
  }
}
