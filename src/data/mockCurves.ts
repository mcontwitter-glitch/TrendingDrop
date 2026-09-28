import type { CurveToken } from '../types'
import { FLATTEN_TAX_BPS, STEEPEN_TAX_BPS } from '../lib/solana/constants'

/** Deterministic mock curve pubkeys (valid base58) for offline UI. */
export const MOCK_CURVE_IDS = {
  ddog: '3xE6mWJQQXyUKBtqeYUw24HS3Hn4Q1Ej4UhfkMrX3ZLC',
  laser: 'C2GcfSG2VCDWgs2dmTMs9sje96SxUzVyWm6y8yhVHwHS',
  kota: 'BhPU99CwoLUNp3V198v63BeoRUDrt9p8PQGxY9TrQmTR',
} as const

const MOCK_STORY_IDS = {
  ddog: 'graduated-degen-dog',
  laser: 'graduated-laser-eyes',
  kota: 'kot-ai-agents',
} as const

const MOCK_MINTS = {
  ddog: '25oU8eEuSBTg1bLeec88KGMsUFiBffpUvQNCEKigxxcf',
  laser: 'CFo5RSV7BZyAuBQ47jvinz4avog79NvuoZ6PNvxWQHsb',
  kota: '5GW8VPgFmbU4U6beUJ5tRyUzaC8PikBtbS5Xx5yaAEKc',
} as const

const MOCK_CREATORS = {
  ddog: '5YdEwquBBSt5XKcxjqfSZ7DLqgUjvjs3RcJLMnJin1eS',
  laser: 'EUKkydt1QA1gGs3j5Qv7boP5s1MW9WQc2nUirfcnVsqX',
  kota: '9MxuoXBtGn5jwxrCxF4eSftEFxBecapnF9ebaBFpq9R5',
} as const

function spark(seed: number, n: number, base: number, amp: number): number[] {
  const out: number[] = []
  let v = base
  for (let i = 0; i < n; i++) {
    const wobble = Math.sin((seed + i) * 0.7) * amp + ((seed * i) % 7) - 3
    v = Math.max(1, v + wobble)
    out.push(Math.round(v))
  }
  return out
}

/** Synthetic live-looking price samples ending at `endPrice` (for offline demos). */
function priceWalk(
  seed: number,
  endPrice: number,
  supply: number,
  n = 36,
  intervalMs = 10_000,
): { t: number; priceLamports: number; supply: number; mcapSol: number }[] {
  const now = Date.now()
  const prices: number[] = new Array(n)
  prices[n - 1] = endPrice
  let v = endPrice
  for (let i = n - 2; i >= 0; i--) {
    const wobble =
      Math.sin((seed + i) * 0.55) * (endPrice * 0.018) +
      (((seed * (i + 3)) % 11) - 5) * (endPrice * 0.002)
    v = Math.max(Math.floor(endPrice * 0.55), Math.round(v - wobble))
    prices[i] = v
  }
  // Drift forward so the path trends toward endPrice naturally
  const start = prices[0]!
  for (let i = 0; i < n; i++) {
    const blend = i / (n - 1)
    const drifted = Math.round(start + (endPrice - start) * blend)
    const noise = Math.round(Math.sin((seed + i) * 1.1) * endPrice * 0.012)
    prices[i] = Math.max(1, drifted + noise)
  }
  prices[n - 1] = endPrice
  return prices.map((priceLamports, i) => {
    const t = now - (n - 1 - i) * intervalMs
    const mcapSol = (priceLamports * supply) / 1e9
    return { t, priceLamports, supply, mcapSol }
  })
}

export const mockCurves: CurveToken[] = [
  {
    id: MOCK_CURVE_IDS.ddog,
    pubkey: MOCK_CURVE_IDS.ddog,
    storyId: MOCK_STORY_IDS.ddog,
    mint: MOCK_MINTS.ddog,
    title: 'Degen Dog',
    ticker: 'DDOG',
    blurb: 'The goodest boy who only fetches green candles — now trading on the dual curve.',
    emoji: '🐕',
    imageUrl: '/tokens/ddog.png',
    gradient: 'from-cyan-400/40 via-sky-500/25 to-blue-900/30',
    creator: '0aSd…9fGh',
    creatorPubkey: MOCK_CREATORS.ddog,
    basePriceLamports: 1_000,
    currentPriceLamports: 42_500,
    currentSupply: 1_250_000,
    attentionScore: 820,
    priceVelocity: 540,
    curveK: 1_000,
    sellTaxBps: STEEPEN_TAX_BPS,
    mode: 'steepen',
    solReserveSol: 18.4,
    solReserveLamports: 18_400_000_000,
    holderRewardsPoolLamports: 420_000_000,
    rewardIndex: 0n,
    mergeCount: 0,
    isMerged: false,
    lastOracleUpdate: Date.now() - 4 * 60_000,
    onChain: false,
    attentionHistory: spark(3, 24, 600, 40),
    velocityHistory: spark(7, 24, 400, 35),
    priceHistory: priceWalk(3, 42_500, 1_250_000),
  },
  {
    id: MOCK_CURVE_IDS.laser,
    pubkey: MOCK_CURVE_IDS.laser,
    storyId: MOCK_STORY_IDS.laser,
    mint: MOCK_MINTS.laser,
    title: 'Laser Eyes Forever',
    ticker: 'LASER',
    blurb: 'Everyone got laser eyes. Price velocity is running hot — flatten tax in effect.',
    emoji: '👀',
    imageUrl: '/tokens/laser.png',
    gradient: 'from-amber-400/40 via-yellow-500/30 to-cyan-600/20',
    creator: '9zXc…2vBn',
    creatorPubkey: MOCK_CREATORS.laser,
    basePriceLamports: 1_000,
    currentPriceLamports: 88_200,
    currentSupply: 2_100_000,
    attentionScore: 410,
    priceVelocity: 760,
    curveK: 1_200,
    sellTaxBps: FLATTEN_TAX_BPS,
    mode: 'flatten',
    solReserveSol: 31.2,
    solReserveLamports: 31_200_000_000,
    holderRewardsPoolLamports: 180_000_000,
    rewardIndex: 0n,
    mergeCount: 1,
    isMerged: false,
    lastOracleUpdate: Date.now() - 2 * 60_000,
    onChain: false,
    attentionHistory: spark(11, 24, 350, 30),
    velocityHistory: spark(5, 24, 550, 45),
    priceHistory: priceWalk(11, 88_200, 2_100_000),
  },
  {
    id: MOCK_CURVE_IDS.kota,
    pubkey: MOCK_CURVE_IDS.kota,
    storyId: MOCK_STORY_IDS.kota,
    mint: MOCK_MINTS.kota,
    title: 'King of the Agents',
    ticker: 'KOTA',
    blurb: 'Agent lore graduated early — attention and price in lockstep for now.',
    emoji: '🤖',
    imageUrl: '/tokens/kota.png',
    gradient: 'from-cyan-500/40 via-teal-400/20 to-blue-900/40',
    creator: '7xKq…9mF2',
    creatorPubkey: MOCK_CREATORS.kota,
    basePriceLamports: 500,
    currentPriceLamports: 15_800,
    currentSupply: 640_000,
    attentionScore: 500,
    priceVelocity: 495,
    curveK: 800,
    sellTaxBps: STEEPEN_TAX_BPS,
    mode: 'neutral',
    solReserveSol: 9.7,
    solReserveLamports: 9_700_000_000,
    holderRewardsPoolLamports: 95_000_000,
    rewardIndex: 0n,
    mergeCount: 0,
    isMerged: false,
    lastOracleUpdate: Date.now() - 8 * 60_000,
    onChain: false,
    attentionHistory: spark(2, 24, 480, 25),
    velocityHistory: spark(9, 24, 470, 28),
    priceHistory: priceWalk(2, 15_800, 640_000),
  },
]
