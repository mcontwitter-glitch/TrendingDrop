import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import type { Story, StoryStatus } from '../../types'
import { findCurvePda } from './velocityPdas'
import {
  getMetadataByHash,
  getMetadataByPubkey,
  bytesToHex,
  printableAsciiPrefixFromHash,
  tickerFromAsciiPrefix,
  metaCoverUrl,
  type NarrativeMetadata,
} from './metadata'
import { coverForTicker, hashCover } from '../tokenCovers'

const EMOJIS = ['🎰', '🤖', '🐈‍⬛', '🌴', '💀', '🧠', '🚀', '🐸', '👻', '🔥', '⚡', '🐋']
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
    // On-chain phase stays active until graduate/fail ix; treat expired as failed
    // so cards leave the Active tab (Failed tab) and don't show ACTIVE + Ended.
    if (endsAtMs <= now) return 'failed'
    if (totalStakedSol >= thresholdSol * 0.75) return 'graduating'
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

const MISSING_META_BLURB =
  "Metadata not shared yet — only this browser's Create Story cache has the name."

function fallbackMeta(pubkey: string, contentHashHex: string): NarrativeMetadata {
  const ascii = printableAsciiPrefixFromHash(contentHashHex)
  if (ascii) {
    const title = ascii.length > 48 ? `${ascii.slice(0, 45)}…` : ascii
    return {
      title,
      ticker: tickerFromAsciiPrefix(ascii),
      blurb: MISSING_META_BLURB,
      description: MISSING_META_BLURB,
    }
  }
  return {
    title: `Story ${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`,
    ticker: pubkey.slice(0, 4).toUpperCase(),
    blurb: MISSING_META_BLURB,
    description: MISSING_META_BLURB,
  }
}

function resolveMeta(pubkey: string, contentHashHex: string): NarrativeMetadata {
  return (
    getMetadataByPubkey(pubkey) ??
    getMetadataByHash(contentHashHex) ??
    fallbackMeta(pubkey, contentHashHex)
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
    imageUrl: metaCoverUrl(meta) ?? (meta.ticker ? coverForTicker(meta.ticker) : hashCover(seed)),
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
