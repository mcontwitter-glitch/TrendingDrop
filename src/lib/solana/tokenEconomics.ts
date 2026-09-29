/**
 * Launchpad FDV display layer for VelocityCurve tokens.
 *
 * On-chain `current_price` / `base_price` are **lamports per whole token**.
 * FDV_SOL = price × TOTAL_SUPPLY_WHOLE / 1e9 (numerically ≈ price).
 *
 * Product economics (PRICE_SCALE=1e9, base=27, k=365):
 *   empty curve → ~$4k FDV; ~12 SOL seed buy of ~20% supply → ~$15k FDV.
 * `current_supply` is whole tokens (SPL raw = whole × 10^6).
 *
 * Legacy curves (seed/1000 or corrupt stack prices) still fall back to
 * liquidity-backed spot when FDV ≫ reserve.
 */

export const TOKEN_DECIMALS = 6
export const TOTAL_SUPPLY_WHOLE = 1_000_000_000 // 1B whole tokens for FDV / supply label
const LAMPORTS_PER_SOL = 1_000_000_000
/** If chain FDV / reserve exceeds this, treat price as legacy seed/1000 scale. */
const LEGACY_FDV_RESERVE_RATIO = 10_000

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

/**
 * Liquidity-backed spot (lamports / whole token): seed_or_reserve / 1B.
 * Fallback for legacy/corrupt curves only — new graduates use LAUNCH_BASE_PRICE.
 */
export function repairedDisplayPriceLamports(seedOrReserveLamports: number): number {
  return Math.max(1, Math.floor(seedOrReserveLamports / TOTAL_SUPPLY_WHOLE))
}

export interface LaunchpadDisplayMetrics {
  /** Effective spot used for UI (corruption / legacy-scale guarded). */
  effectivePriceLamports: number
  /** True when display used liquidity-backed spot instead of raw chain price. */
  priceCorrupt: boolean
  /** FDV in SOL: effectivePrice × 1B / 1e9 (≈ reserve when liquidity-backed). */
  fdvSol: number
  /** Circulating supply in whole tokens (raw / 10^decimals). */
  circulatingWhole: number
  /** Fixed total supply for launchpad label. */
  totalSupplyWhole: number
}

/**
 * Compute launchpad spot / FDV / supply display metrics.
 * UI FDV treats curve price as lamports/whole token × 1B supply.
 * Falls back to liquidity-backed spot when chain price is corrupt or legacy-scaled.
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

  const reserveSol = seedOrReserve / LAMPORTS_PER_SOL
  const chainPrice = Math.max(0, Math.floor(curve.currentPriceLamports))
  const chainFdv = fdvMarketCapSol(chainPrice)

  const priceCorrupt = isCorruptCurvePrice({
    basePriceLamports: curve.basePriceLamports,
    currentPriceLamports: curve.currentPriceLamports,
    seedLiquidityLamports: curve.seedLiquidityLamports,
    solReserveLamports: curve.solReserveLamports,
  })

  // Legacy graduate used seed/1000 → FDV ≈ seed_SOL × 1e6. Prefer liquidity.
  const legacyScale =
    reserveSol > 0 && Number.isFinite(chainFdv) && chainFdv > reserveSol * LEGACY_FDV_RESERVE_RATIO

  const useLiquidityBacked = priceCorrupt || legacyScale
  const effectivePriceLamports = useLiquidityBacked
    ? repairedDisplayPriceLamports(seedOrReserve)
    : chainPrice

  const fdvSol = useLiquidityBacked
    ? reserveSol > 0
      ? reserveSol
      : fdvMarketCapSol(effectivePriceLamports)
    : chainFdv

  return {
    effectivePriceLamports,
    priceCorrupt: useLiquidityBacked,
    fdvSol,
    // On-chain current_supply is whole tokens (not SPL raw).
    circulatingWhole: Math.max(0, curve.currentSupply),
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
