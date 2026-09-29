/**
 * Launchpad FDV display layer for VelocityCurve tokens (Pump.fun CPMM).
 *
 * On-chain `current_price` is **lamports per whole token** = virtual_sol / virtual_token.
 * FDV_SOL = price × TOTAL_SUPPLY_WHOLE / 1e9 (numerically ≈ price).
 *
 * Product economics (virtual_sol=30 SOL, virtual_token=1.073B):
 *   empty curve → ~$4.2k FDV @ $150/SOL
 *   graduate at ~85 real SOL → ~$62–69k mcap; ~200M tokens remain
 * `current_supply` is whole tokens sold (SPL raw = whole × 10^6).
 *
 * Legacy linear curves (base+k*s / corrupt stack prices) still fall back to
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
 * the price field (TokenParams stack bug).
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

/** Liquidity-backed spot fallback for legacy/corrupt curves only. */
export function repairedDisplayPriceLamports(seedOrReserveLamports: number): number {
  return Math.max(1, Math.floor(seedOrReserveLamports / TOTAL_SUPPLY_WHOLE))
}

export interface LaunchpadDisplayMetrics {
  effectivePriceLamports: number
  priceCorrupt: boolean
  fdvSol: number
  circulatingWhole: number
  totalSupplyWhole: number
}

/**
 * Prefer CPMM spot = virtualSol / virtualToken when virtual reserves look sane
 * (≥ 1 SOL virtual and ≥ 1M virtual tokens). UI shows USD via formatPriceUsd.
 */
export function launchpadDisplayMetrics(curve: {
  currentPriceLamports: number
  basePriceLamports: number
  currentSupply: number
  solReserveLamports?: number
  seedLiquidityLamports?: number
  virtualSolLamports?: number
  virtualToken?: number
}): LaunchpadDisplayMetrics {
  const seedOrReserve =
    curve.seedLiquidityLamports && curve.seedLiquidityLamports > 0
      ? curve.seedLiquidityLamports
      : curve.solReserveLamports ?? 0

  const reserveSol = seedOrReserve / LAMPORTS_PER_SOL

  const vs = curve.virtualSolLamports ?? 0
  const vt = curve.virtualToken ?? 0
  const cpmmSpot =
    vs >= 1_000_000_000 && vt >= 1_000_000 ? Math.max(1, Math.floor(vs / vt)) : 0

  const chainPrice = Math.max(0, Math.floor(curve.currentPriceLamports))
  const preferred = cpmmSpot > 0 ? cpmmSpot : chainPrice
  const preferredFdv = fdvMarketCapSol(preferred)

  const priceCorrupt = isCorruptCurvePrice({
    basePriceLamports: curve.basePriceLamports,
    currentPriceLamports: curve.currentPriceLamports,
    seedLiquidityLamports: curve.seedLiquidityLamports,
    solReserveLamports: curve.solReserveLamports,
  })

  const legacyScale =
    reserveSol > 0 &&
    Number.isFinite(preferredFdv) &&
    preferredFdv > reserveSol * LEGACY_FDV_RESERVE_RATIO

  const useLiquidityBacked = (priceCorrupt || legacyScale) && cpmmSpot === 0
  const effectivePriceLamports = useLiquidityBacked
    ? repairedDisplayPriceLamports(seedOrReserve)
    : preferred

  const fdvSol = useLiquidityBacked
    ? reserveSol > 0
      ? reserveSol
      : fdvMarketCapSol(effectivePriceLamports)
    : fdvMarketCapSol(effectivePriceLamports)

  return {
    effectivePriceLamports,
    priceCorrupt: useLiquidityBacked,
    fdvSol,
    circulatingWhole: Math.max(0, curve.currentSupply),
    totalSupplyWhole: TOTAL_SUPPLY_WHOLE,
  }
}

export function fdvMarketCapSol(priceLamports: number | bigint): number {
  const p =
    typeof priceLamports === 'bigint'
      ? priceLamports
      : BigInt(Math.max(0, Math.floor(priceLamports)))
  const scaled = (p * BigInt(TOTAL_SUPPLY_WHOLE) * 1_000_000n) / BigInt(LAMPORTS_PER_SOL)
  return Number(scaled) / 1_000_000
}

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

export function formatTotalSupplyLabel(): string {
  return '1B'
}

export function formatSupplyMetric(circulatingWhole: number): string {
  return `1B · circ ${formatCirculatingWhole(circulatingWhole)}`
}

export function circulatingValueSol(
  priceLamports: number | bigint,
  circulatingWhole: number,
): number {
  const p =
    typeof priceLamports === 'bigint'
      ? priceLamports
      : BigInt(Math.max(0, Math.floor(priceLamports)))
  const s = BigInt(Math.max(0, Math.floor(circulatingWhole * 1e6)))
  const scaled = (p * s) / BigInt(LAMPORTS_PER_SOL)
  return Number(scaled) / 1e6
}
