/**
 * Client-side dual-curve math mirroring programs/velocity-curve/src/math.rs.
 * Quotes are estimates — label as such in the UI.
 */

import {
  CURVE_FEE_BPS,
  FLATTEN_TAX_BPS,
  STEEPEN_TAX_BPS,
} from './constants'

export const BPS = 10_000n
export const PRICE_SCALE = 1_000_000_000n
export const REWARD_SCALE = 1_000_000_000_000n
export const MAX_K_ADJUST_BPS = 2_500n
export const EMA_ALPHA_BPS = 3_000n

function toBig(n: number | bigint): bigint {
  return typeof n === 'bigint' ? n : BigInt(Math.max(0, Math.floor(n)))
}

export function curveFee(solAmount: number | bigint, feeBps: number = CURVE_FEE_BPS): {
  fee: bigint
  net: bigint
} {
  const sol = toBig(solAmount)
  const fee = (sol * BigInt(feeBps)) / BPS
  return { fee, net: sol - fee }
}

export function velocityParams(
  curveK: number | bigint,
  attention: number | bigint,
  priceVelocity: number | bigint,
): { effectiveK: bigint; sellTaxBps: number } {
  const k = toBig(curveK)
  const a = toBig(attention)
  const p = toBig(priceVelocity)

  if (a > p) {
    const diff = a - p
    const addBps = minBig(diff * 100n, MAX_K_ADJUST_BPS)
    const eff = (k * (BPS + addBps)) / BPS
    return { effectiveK: maxBig(eff, 1n), sellTaxBps: STEEPEN_TAX_BPS }
  }
  const diff = p - a
  const subBps = minBig(diff * 50n, MAX_K_ADJUST_BPS)
  const factor = maxBig(BPS - subBps, 1n)
  const eff = (k * factor) / BPS
  return { effectiveK: maxBig(eff, 1n), sellTaxBps: FLATTEN_TAX_BPS }
}

export function spotPrice(
  basePrice: number | bigint,
  effectiveK: number | bigint,
  supply: number | bigint,
): bigint {
  const extra = (toBig(effectiveK) * toBig(supply)) / PRICE_SCALE
  return toBig(basePrice) + extra
}

function isqrt(n: bigint): bigint {
  if (n === 0n) return 0n
  let x = n
  let y = (x + 1n) / 2n
  while (y < x) {
    x = y
    y = (x + n / x) / 2n
  }
  return x
}

/** Tokens out for net SOL (post fee) along the integral curve. */
export function tokensOutForSol(
  solNet: number | bigint,
  supply: number | bigint,
  basePrice: number | bigint,
  effectiveK: number | bigint,
): bigint {
  const sol = toBig(solNet)
  const base = toBig(basePrice)
  const k = toBig(effectiveK)
  const s = toBig(supply)
  if (sol <= 0n || base <= 0n) return 0n
  if (k === 0n) return sol / base

  const b = base + (k * s) / PRICE_SCALE
  const twoScale = PRICE_SCALE * 2n
  const bTerm = b * twoScale
  const cTerm = sol * twoScale
  const disc = bTerm * bTerm + k * 4n * cTerm
  const root = isqrt(disc)
  const numer = root > bTerm ? root - bTerm : 0n
  const denom = k * 2n
  if (denom === 0n) return sol / base
  return numer / denom
}

/** Gross SOL out (pre-tax, pre-fee) for burning tokens. */
export function solOutForTokens(
  tokenAmount: number | bigint,
  supply: number | bigint,
  basePrice: number | bigint,
  effectiveK: number | bigint,
): bigint {
  const d = toBig(tokenAmount)
  const s = toBig(supply)
  const base = toBig(basePrice)
  const k = toBig(effectiveK)
  if (d <= 0n || d > s || base <= 0n) return 0n
  const linear = d * base
  const inner = s * 2n * d - d * d
  const quad = (k * inner) / (PRICE_SCALE * 2n)
  return linear + quad
}

export function applyBps(amount: number | bigint, bps: number): bigint {
  return (toBig(amount) * BigInt(bps)) / BPS
}

export function settleHolderRewards(
  balance: number | bigint,
  rewardDebt: bigint,
  rewardIndex: bigint,
  claimable: number | bigint,
): { claimable: bigint; rewardDebt: bigint } {
  const bal = toBig(balance)
  const claim = toBig(claimable)
  if (bal === 0n || rewardIndex <= rewardDebt) {
    return { claimable: claim, rewardDebt }
  }
  const pending = (bal * (rewardIndex - rewardDebt)) / REWARD_SCALE
  return { claimable: claim + pending, rewardDebt: rewardIndex }
}

export type QuoteMode = 'steepen' | 'flatten' | 'neutral'

export function modeFromScores(attention: number, priceVelocity: number): QuoteMode {
  if (attention > priceVelocity) return 'steepen'
  if (priceVelocity > attention) return 'flatten'
  return 'neutral'
}

export interface BuyQuote {
  feeLamports: bigint
  solNetLamports: bigint
  tokensOut: bigint
  effectiveK: bigint
  sellTaxBps: number
  mode: QuoteMode
  /** Spot after buy (estimate). */
  estimatedPrice: bigint
}

export interface SellQuote {
  solGrossLamports: bigint
  taxLamports: bigint
  feeLamports: bigint
  solNetLamports: bigint
  effectiveK: bigint
  sellTaxBps: number
  mode: QuoteMode
  estimatedPrice: bigint
}

export function estimateBuy(
  solLamports: number | bigint,
  supply: number | bigint,
  basePrice: number | bigint,
  curveK: number | bigint,
  attention: number | bigint,
  priceVelocity: number | bigint,
): BuyQuote {
  const { effectiveK, sellTaxBps } = velocityParams(curveK, attention, priceVelocity)
  const { fee, net } = curveFee(solLamports)
  const tokensOut = tokensOutForSol(net, supply, basePrice, effectiveK)
  const newSupply = toBig(supply) + tokensOut
  return {
    feeLamports: fee,
    solNetLamports: net,
    tokensOut,
    effectiveK,
    sellTaxBps,
    mode: modeFromScores(Number(attention), Number(priceVelocity)),
    estimatedPrice: spotPrice(basePrice, effectiveK, newSupply),
  }
}

export function estimateSell(
  tokenAmount: number | bigint,
  supply: number | bigint,
  basePrice: number | bigint,
  curveK: number | bigint,
  attention: number | bigint,
  priceVelocity: number | bigint,
): SellQuote {
  const { effectiveK, sellTaxBps } = velocityParams(curveK, attention, priceVelocity)
  const solGross = solOutForTokens(tokenAmount, supply, basePrice, effectiveK)
  const tax = applyBps(solGross, sellTaxBps)
  const afterTax = solGross - tax
  const { fee, net } = curveFee(afterTax)
  const newSupply = toBig(supply) - toBig(tokenAmount)
  return {
    solGrossLamports: solGross,
    taxLamports: tax,
    feeLamports: fee,
    solNetLamports: net,
    effectiveK,
    sellTaxBps,
    mode: modeFromScores(Number(attention), Number(priceVelocity)),
    estimatedPrice: spotPrice(basePrice, effectiveK, newSupply < 0n ? 0n : newSupply),
  }
}

function minBig(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}
function maxBig(a: bigint, b: bigint): bigint {
  return a > b ? a : b
}
