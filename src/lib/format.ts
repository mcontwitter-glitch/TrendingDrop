import {
  TOTAL_SUPPLY_WHOLE,
  fdvMarketCapSol as fdvFromEconomics,
} from './solana/tokenEconomics'

export function formatSol(n: number): string {
  if (n >= 100) return n.toFixed(1)
  if (n >= 10) return n.toFixed(2)
  return n.toFixed(2)
}

export function formatPct(n: number): string {
  return `${Math.min(100, Math.round(n))}%`
}

export function fundedPct(staked: number, threshold: number): number {
  return Math.min(100, (staked / threshold) * 100)
}

export function formatCountdown(endsAt: number, now = Date.now()): string {
  const diff = endsAt - now
  if (diff <= 0) return 'Ended'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1000)
  if (h > 48) {
    const d = Math.floor(h / 24)
    return `${d}d ${h % 24}h`
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function timeAgo(ts: number, now = Date.now()): string {
  const sec = Math.floor((now - ts) / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export function shortAddress(addr: string): string {
  if (addr.includes('…') || addr.includes('...')) return addr
  if (addr.length < 10) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

export function formatLamportsAsSol(lamports: number | bigint, digits = 4): string {
  const n = typeof lamports === 'bigint' ? Number(lamports) : lamports
  const sol = n / 1_000_000_000
  if (sol === 0) return '0'
  if (sol < 0.0001) return sol.toExponential(2)
  if (sol < 1) return sol.toFixed(digits)
  return formatSol(sol)
}

export function formatTokenAmount(n: number | bigint): string {
  const v = typeof n === 'bigint' ? Number(n) : n
  if (!Number.isFinite(v)) return '0'
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (v >= 10_000) return `${(v / 1_000).toFixed(1)}k`
  if (v >= 100) return v.toFixed(0)
  if (v >= 1) return v.toFixed(2)
  return v.toFixed(4)
}

/** @deprecated Prefer formatPriceUsd for trade/UI spot — kept for debug/raw views. */
export function formatPriceLamports(lamports: number): string {
  const sol = lamports / 1_000_000_000
  if (sol === 0) return '0'
  if (sol < 0.000001) return `${lamports} lamports`
  if (sol < 0.001) return sol.toFixed(6)
  return sol.toFixed(4)
}

/**
 * Spot price in USD from lamports-per-whole-token × SOL/USD.
 * Live price chart / trade desk must use this (not a "SOL" label).
 */
export function formatPriceUsd(priceLamports: number, solUsd: number): string {
  const rate = Number.isFinite(solUsd) && solUsd > 0 ? solUsd : 0
  const usd = (priceLamports / 1_000_000_000) * rate
  if (!Number.isFinite(usd) || usd <= 0) return '$0'
  if (usd >= 1000) return formatUsdCompact(usd)
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd >= 0.01) return `$${usd.toFixed(4)}`
  if (usd >= 0.0001) return `$${usd.toFixed(6)}`
  if (usd >= 1e-8) return `$${usd.toFixed(10).replace(/0+$/, '').replace(/\.$/, '')}`
  return `$${usd.toExponential(2)}`
}

/**
 * Circulating market value in SOL: (priceLamports * supply) / 1e9.
 * Prefer `fdvMarketCapSol` for the Trade Desk "Market cap" metric (launchpad FDV).
 */
export function marketCapSol(priceLamports: number | bigint, supply: number | bigint): number {
  const p = typeof priceLamports === 'bigint' ? priceLamports : BigInt(Math.max(0, Math.floor(priceLamports)))
  const s = typeof supply === 'bigint' ? supply : BigInt(Math.max(0, Math.floor(supply)))
  // Keep 6 decimal places of SOL precision via integer division.
  const scaled = (p * s * 1_000_000n) / 1_000_000_000n
  return Number(scaled) / 1_000_000
}

/**
 * Launchpad FDV in SOL. UI treats curve price as lamports/whole token × 1B supply:
 * (priceLamports * TOTAL_SUPPLY_WHOLE) / 1e9.
 */
export function fdvMarketCapSol(priceLamports: number | bigint): number {
  return fdvFromEconomics(priceLamports)
}

/** @deprecated Prefer fdvMarketCapSol — kept for callers that still pass supply. */
export function marketCapSolCompat(
  priceLamports: number | bigint,
  _supply?: number | bigint,
): number {
  void _supply
  return fdvMarketCapSol(priceLamports)
}

export { TOTAL_SUPPLY_WHOLE }

/** Compact market-cap label, e.g. `12.4 SOL`, `1.2k SOL`, `3.4M SOL`. */
export function formatMarketCapSol(sol: number): string {
  if (!Number.isFinite(sol) || sol <= 0) return '0 SOL'
  if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(1)}M SOL`
  if (sol >= 10_000) return `${(sol / 1_000).toFixed(1)}k SOL`
  if (sol >= 1_000) return `${(sol / 1_000).toFixed(2)}k SOL`
  if (sol >= 100) return `${sol.toFixed(1)} SOL`
  if (sol >= 10) return `${sol.toFixed(2)} SOL`
  if (sol >= 1) return `${sol.toFixed(2)} SOL`
  if (sol >= 0.01) return `${sol.toFixed(3)} SOL`
  return `${sol.toFixed(4)} SOL`
}

/** Compact USD label using the same magnitude thresholds as SOL market cap. */
export function formatUsdCompact(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '$0'
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
  if (usd >= 10_000) return `$${(usd / 1_000).toFixed(1)}k`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(2)}k`
  if (usd >= 100) return `$${usd.toFixed(1)}`
  if (usd >= 10) return `$${usd.toFixed(1)}`
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd >= 0.01) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(4)}`
}

/** Launchpad FDV in SOL converted to a compact USD market-cap label. */
export function formatMarketCapUsd(solFdv: number, solUsd: number): string {
  return formatUsdCompact(solFdv * solUsd)
}
