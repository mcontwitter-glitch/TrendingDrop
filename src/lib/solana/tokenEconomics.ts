/**
 * Launchpad FDV display layer for VelocityCurve tokens.
 *
 * On-chain `current_price` / `base_price` are u64 lamports fields used by the
 * bonding curve. For market-cap UI we treat that price as **lamports per whole
 * token** × TOTAL_SUPPLY_WHOLE (1B), matching launchpad FDV expectations —
 * not price × circulating raw supply (which showed 0 mcap / "0.0000" supply).
 */

export const TOKEN_DECIMALS = 6
export const TOTAL_SUPPLY_WHOLE = 1_000_000_000 // 1B whole tokens for FDV / supply label
const LAMPORTS_PER_SOL = 1_000_000_000

/** Raw mint units → whole tokens. */
export function rawToWhole(raw: number | bigint, decimals = TOKEN_DECIMALS): number {
  const n = typeof raw === 'bigint' ? Number(raw) : raw
  if (!Number.isFinite(n) || n === 0) return 0
  return n / 10 ** decimals
}

/**
 * True when base/current price looks like seed/reserve liquidity written into
 * the price field (TokenParams stack bug). Threshold: within ~1% of seed or
 * reserve and magnitude > 1e8 lamports.
 */
export function isCorruptCurvePrice(params: {
  basePriceLamports: number
  currentPriceLamports: number
  seedLiquidityLamports?: number
  solReserveLamports?: number
}): boolean {
  const prices = [params.basePriceLamports, params.currentPriceLamports].filter(
    (p) => Number.isFinite(p) && p > 1e8,
  )
  if (prices.length === 0) return false

  const refs = [params.seedLiquidityLamports, params.solReserveLamports].filter(
    (r): r is number => typeof r === 'number' && Number.isFinite(r) && r > 1e8,
  )
  if (refs.length === 0) return false

  return prices.some((p) =>
    refs.some((r) => {
      const diff = Math.abs(p - r)
      return diff / r <= 0.01
    }),
  )
}

/** Mirrors graduate `total_staked/1000` when repairing corrupt base_price for display. */
export function repairedDisplayPriceLamports(seedOrReserveLamports: number): number {
  return Math.max(1, Math.floor(seedOrReserveLamports / 1000))
}

export interface LaunchpadDisplayMetrics {
  /** Effective spot used for UI (corruption-guarded). */
  effectivePriceLamports: number
  /** True when on-chain price matched seed/reserve (display repair applied). */
  priceCorrupt: boolean
  /** FDV in SOL: effectivePrice × 1B / 1e9. */
  fdvSol: number
  /** Circulating supply in whole tokens (raw / 10^decimals). */
  circulatingWhole: number
  /** Fixed total supply for launchpad label. */
  totalSupplyWhole: number
}

/**
 * Compute launchpad spot / FDV / supply display metrics.
 * UI FDV treats curve price as lamports/whole token × 1B supply.
 */
export function launchpadDisplayMetrics(curve: {
  currentPriceLamports: number
  basePriceLamports: number
  currentSupply: number
  solReserveLamports?: number
  seedLiquidityLamports?: number
}): LaunchpadDisplayMetrics {
  const seedOrReserve =
    curve.seedLiquidityLamports && curve.seedLiquidityLamports > 0
      ? curve.seedLiquidityLamports
      : curve.solReserveLamports ?? 0

  const priceCorrupt = isCorruptCurvePrice({
    basePriceLamports: curve.basePriceLamports,
    currentPriceLamports: curve.currentPriceLamports,
    seedLiquidityLamports: curve.seedLiquidityLamports,
    solReserveLamports: curve.solReserveLamports,
  })

  const effectivePriceLamports = priceCorrupt
    ? repairedDisplayPriceLamports(seedOrReserve)
    : Math.max(0, Math.floor(curve.currentPriceLamports))

  return {
    effectivePriceLamports,
    priceCorrupt,
    fdvSol: fdvMarketCapSol(effectivePriceLamports),
    circulatingWhole: rawToWhole(curve.currentSupply),
    totalSupplyWhole: TOTAL_SUPPLY_WHOLE,
  }
}

/**
 * Launchpad FDV in SOL from (effective) price treated as lamports per whole token:
 * (priceLamports * TOTAL_SUPPLY_WHOLE) / LAMPORTS_PER_SOL
 */
export function fdvMarketCapSol(priceLamports: number | bigint): number {
  const p =
    typeof priceLamports === 'bigint'
      ? priceLamports
      : BigInt(Math.max(0, Math.floor(priceLamports)))
  const scaled = (p * BigInt(TOTAL_SUPPLY_WHOLE) * 1_000_000n) / BigInt(LAMPORTS_PER_SOL)
  return Number(scaled) / 1_000_000
}

/** Compact circulating label, e.g. `0.000251`, `1.25`. */
export function formatCirculatingWhole(whole: number): string {
  if (!Number.isFinite(whole) || whole === 0) return '0'
  if (whole < 0.000001) return whole.toExponential(2)
  if (whole < 0.001) return whole.toFixed(6)
  if (whole < 1) return whole.toFixed(4)
  if (whole < 1000) return whole.toFixed(2)
  if (whole >= 1_000_000_000) return `${(whole / 1_000_000_000).toFixed(2)}B`
  if (whole >= 1_000_000) return `${(whole / 1_000_000).toFixed(2)}M`
  if (whole >= 10_000) return `${(whole / 1_000).toFixed(1)}k`
  return whole.toFixed(0)
}

/** Primary supply label: always "1B" total. */
export function formatTotalSupplyLabel(): string {
  return '1B'
}

/** Combined supply metric: `1B · circ 0.000251` or `1B · circ 0`. */
export function formatSupplyMetric(circulatingWhole: number): string {
  return `1B · circ ${formatCirculatingWhole(circulatingWhole)}`
}

/** Circ-only value of tokens in circulation (price × circulating whole). */
export function circulatingValueSol(
  priceLamports: number | bigint,
  circulatingWhole: number,
): number {
  const p =
    typeof priceLamports === 'bigint'
      ? priceLamports
      : BigInt(Math.max(0, Math.floor(priceLamports)))
  const s = BigInt(Math.max(0, Math.floor(circulatingWhole * 1e6))) // micro-whole
  const scaled = (p * s) / BigInt(LAMPORTS_PER_SOL)
  return Number(scaled) / 1e6
}
