/**
 * Minimal account decoders (Anchor discriminator + Borsh field layouts).
 * Layouts mirror programs/<name>/src/state.rs - keep in sync when accounts change.
 */
import { PublicKey } from '@solana/web3.js'

const DISC = 8

function readU64LE(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset)
}

function readI64LE(buf: Buffer, offset: number): bigint {
  return buf.readBigInt64LE(offset)
}

function readU16LE(buf: Buffer, offset: number): number {
  return buf.readUInt16LE(offset)
}

function readU32LE(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset)
}

function readPubkey(buf: Buffer, offset: number): PublicKey {
  return new PublicKey(buf.subarray(offset, offset + 32))
}

function toHex(buf: Buffer): string {
  return Buffer.from(buf).toString('hex')
}

/** StoryMarket after 8-byte Anchor discriminator. */
export type DecodedStory = {
  creator: string
  contentHash: string
  phase: number
  totalStaked: number
  uniqueStakers: number
  endsAt: number
  graduationThreshold: number
}

export function decodeStoryMarket(data: Buffer): DecodedStory | null {
  // creator(32) + content_hash(32) + phase(1) + total_staked(8) + unique_stakers(4)
  // + created_at(8) + ends_at(8) + graduation_threshold(8) + ...
  if (data.length < DISC + 32 + 32 + 1 + 8 + 4 + 8 + 8 + 8) return null
  let o = DISC
  const creator = readPubkey(data, o).toBase58()
  o += 32
  const contentHash = toHex(data.subarray(o, o + 32))
  o += 32
  const phase = data[o]!
  o += 1
  const totalStaked = Number(readU64LE(data, o))
  o += 8
  const uniqueStakers = readU32LE(data, o)
  o += 4
  o += 8 // created_at
  const endsAt = Number(readI64LE(data, o))
  o += 8
  const graduationThreshold = Number(readU64LE(data, o))
  return {
    creator,
    contentHash,
    phase,
    totalStaked,
    uniqueStakers,
    endsAt,
    graduationThreshold,
  }
}

export type DecodedCurve = {
  mint: string
  storyId: string
  currentSupply: number
  currentPrice: number
  attentionScore: number
  priceVelocity: number
  sellTaxBps: number
  lastOracleUpdate: number
  solReserve: number
}

export function decodeVelocityToken(data: Buffer): DecodedCurve | null {
  // mint(32) + story_id(32) + creator(32) + base_price(8) + current_supply(8)
  // + current_price(8) + attention_score(8) + price_velocity(8) + curve_k(8)
  // + sell_tax_bps(2) + last_oracle_update(8) + merge_count(1) + is_merged(1)
  // + sol_reserve(8) + ...
  const need = DISC + 32 * 3 + 8 * 5 + 2 + 8 + 1 + 1 + 8
  if (data.length < need) return null
  let o = DISC
  const mint = readPubkey(data, o).toBase58()
  o += 32
  const storyId = readPubkey(data, o).toBase58()
  o += 32
  o += 32 // creator
  o += 8 // base_price
  const currentSupply = Number(readU64LE(data, o))
  o += 8
  const currentPrice = Number(readU64LE(data, o))
  o += 8
  const attentionScore = Number(readU64LE(data, o))
  o += 8
  const priceVelocity = Number(readU64LE(data, o))
  o += 8
  o += 8 // curve_k
  const sellTaxBps = readU16LE(data, o)
  o += 2
  const lastOracleUpdate = Number(readI64LE(data, o))
  o += 8
  o += 1 // merge_count
  o += 1 // is_merged
  const solReserve = Number(readU64LE(data, o))
  return {
    mint,
    storyId,
    currentSupply,
    currentPrice,
    attentionScore,
    priceVelocity,
    sellTaxBps,
    lastOracleUpdate,
    solReserve,
  }
}

export const PHASE_LABEL: Record<number, string> = {
  0: 'Draft',
  1: 'Active',
  2: 'Graduated',
  3: 'Failed',
  4: 'Forfeited',
}
