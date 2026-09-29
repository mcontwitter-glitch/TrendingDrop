/**
 * Client-side Pump.fun–style constant-product AMM math
 * mirroring programs/velocity-curve/src/math.rs.
 * Quotes are estimates — label as such in the UI.
 *
 * k = virtualSol * virtualToken
 * spot (lamports / whole token) = virtualSol / virtualToken
 * Buy  Δx: Δy = y·Δx / (x+Δx)
 * Sell Δy: Δx = x·Δy / (y+Δy)
 */

import {
  CURVE_FEE_BPS,
  FLATTEN_TAX_BPS,
  STEEPEN_TAX_BPS,
} from './constants'

export const BPS = 10_000n
export const REWARD_SCALE = 1_000_000_000_000n
export const MAX_K_ADJUST_BPS = 2_500n
export const EMA_ALPHA_BPS = 3_000n

/** Pump defaults (lamports / whole tokens). */
export const INITIAL_VIRTUAL_SOL = 30_000_000_000n
export const INITIAL_VIRTUAL_TOKEN = 1_073_000_000n
export const GRADUATE_REAL_SOL = 85_000_000_000n
export const CURVE_REAL_TOKEN = 800_000_000n

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

/** Sell-tax only — attention does not alter the CPMM invariant. */
export function velocityParams(
  _virtualToken: number | bigint,
  attention: number | bigint,
  priceVelocity: number | bigint,
): { effectiveK: bigint; sellTaxBps: number } {
  const a = toBig(attention)
  const p = toBig(priceVelocity)
  const vt = toBig(_virtualToken)
  if (a > p) {
    return { effectiveK: maxBig(vt, 1n), sellTaxBps: STEEPEN_TAX_BPS }
  }
  return { effectiveK: maxBig(vt, 1n), sellTaxBps: FLATTEN_TAX_BPS }
}

/** Spot in lamports per whole token: x / y. */
export function spotPrice(
  virtualSol: number | bigint,
  virtualToken: number | bigint,
): bigint {
  const y = toBig(virtualToken)
  if (y <= 0n) return 1n
  const p = toBig(virtualSol) / y
  return p > 0n ? p : 1n
}

/** Tokens out for net SOL (post fee). */
export function tokensOutForSol(
  solNet: number | bigint,
  virtualSol: number | bigint,
  virtualToken: number | bigint,
): bigint {
  const dx = toBig(solNet)
  const x = toBig(virtualSol)
  const y = toBig(virtualToken)
  if (dx <= 0n || x <= 0n || y <= 0n) return 0n
  return (y * dx) / (x + dx)
}

/** Gross SOL out (pre-tax, pre-fee) for selling whole tokens. */
export function solOutForTokens(
  tokenAmount: number | bigint,
  virtualSol: number | bigint,
  virtualToken: number | bigint,
): bigint {
  const dy = toBig(tokenAmount)
  const x = toBig(virtualSol)
  const y = toBig(virtualToken)
  if (dy <= 0n || x <= 0n || y <= 0n) return 0n
  return (x * dy) / (y + dy)
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

/**
 * Estimate a buy. Pass virtual SOL/token reserves (not legacy base/k/supply).
 * Back-compat: if callers still pass (sol, supply, basePrice, curveK, ...),
 * treat basePrice as virtualSol and curveK as virtualToken when supply is unused.
 */
export function estimateBuy(
  solLamports: number | bigint,
  virtualSolOrSupply: number | bigint,
  virtualTokenOrBase: number | bigint,
  _curveKOrVirtualToken?: number | bigint,
  attention: number | bigint = 0,
  priceVelocity: number | bigint = 0,
): BuyQuote {
  // New signature: estimateBuy(sol, virtualSol, virtualToken, attention?, priceVelocity?)
  // Old signature: estimateBuy(sol, supply, basePrice, curveK, attention, priceVelocity)
  // Heuristic: if 6 args or virtualTokenOrBase is small (< 1e6) treat as legacy base price.
  let virtualSol: bigint
  let virtualToken: bigint
  let att = attention
  let pvel = priceVelocity

  const a = toBig(virtualSolOrSupply)
  const b = toBig(virtualTokenOrBase)
  const c = _curveKOrVirtualToken !== undefined ? toBig(_curveKOrVirtualToken) : null

  if (c !== null && b < 1_000_000n && c > 1_000_000n) {
    // Legacy: (sol, supply, basePrice≈27, curveK, att, pvel) — use Pump defaults + supply offset
    virtualSol = INITIAL_VIRTUAL_SOL
    virtualToken = INITIAL_VIRTUAL_TOKEN > a ? INITIAL_VIRTUAL_TOKEN - a : INITIAL_VIRTUAL_TOKEN / 2n
  } else if (c !== null && a > 1_000_000_000n) {
    // New-ish: (sol, virtualSol, virtualToken, ignoredK, att, pvel) OR (sol, vs, vt, att, pvel) misaligned
    virtualSol = a
    virtualToken = b > 0n ? b : c
  } else {
    // Preferred: (sol, virtualSol, virtualToken, attention?, priceVelocity?)
    virtualSol = a > 0n ? a : INITIAL_VIRTUAL_SOL
    virtualToken = b > 0n ? b : INITIAL_VIRTUAL_TOKEN
    if (_curveKOrVirtualToken !== undefined && attention === 0 && priceVelocity === 0) {
      // 4th arg may be attention when using (sol, vs, vt, att, pvel)
      att = _curveKOrVirtualToken
    }
  }

  const { effectiveK, sellTaxBps } = velocityParams(virtualToken, att, pvel)
  const { fee, net } = curveFee(solLamports)
  const tokensOut = tokensOutForSol(net, virtualSol, virtualToken)
  const newVs = virtualSol + net
  const newVt = virtualToken > tokensOut ? virtualToken - tokensOut : 1n
  return {
    feeLamports: fee,
    solNetLamports: net,
    tokensOut,
    effectiveK,
    sellTaxBps,
    mode: modeFromScores(Number(att), Number(pvel)),
    estimatedPrice: spotPrice(newVs, newVt),
  }
}

export function estimateSell(
  tokenAmount: number | bigint,
  virtualSolOrSupply: number | bigint,
  virtualTokenOrBase: number | bigint,
  _curveKOrVirtualToken?: number | bigint,
  attention: number | bigint = 0,
  priceVelocity: number | bigint = 0,
): SellQuote {
  let virtualSol: bigint
  let virtualToken: bigint
  let att = attention
  let pvel = priceVelocity

  const a = toBig(virtualSolOrSupply)
  const b = toBig(virtualTokenOrBase)
  const c = _curveKOrVirtualToken !== undefined ? toBig(_curveKOrVirtualToken) : null

  if (c !== null && b < 1_000_000n && c > 1_000_000n) {
    virtualSol = INITIAL_VIRTUAL_SOL
    virtualToken = INITIAL_VIRTUAL_TOKEN > a ? INITIAL_VIRTUAL_TOKEN - a : INITIAL_VIRTUAL_TOKEN / 2n
  } else if (c !== null && a > 1_000_000_000n) {
    virtualSol = a
    virtualToken = b > 0n ? b : c
  } else {
    virtualSol = a > 0n ? a : INITIAL_VIRTUAL_SOL
    virtualToken = b > 0n ? b : INITIAL_VIRTUAL_TOKEN
    if (_curveKOrVirtualToken !== undefined && attention === 0 && priceVelocity === 0) {
      att = _curveKOrVirtualToken
    }
  }

  const { effectiveK, sellTaxBps } = velocityParams(virtualToken, att, pvel)
  const solGross = solOutForTokens(tokenAmount, virtualSol, virtualToken)
  const tax = applyBps(solGross, sellTaxBps)
  const afterTax = solGross - tax
  const { fee, net } = curveFee(afterTax)
  const newVs = virtualSol > solGross ? virtualSol - solGross : 1n
  const newVt = virtualToken + toBig(tokenAmount)
  return {
    solGrossLamports: solGross,
    taxLamports: tax,
    feeLamports: fee,
    solNetLamports: net,
    effectiveK,
    sellTaxBps,
    mode: modeFromScores(Number(att), Number(pvel)),
    estimatedPrice: spotPrice(newVs, newVt),
  }
}

function maxBig(a: bigint, b: bigint): bigint {
  return a > b ? a : b
}
