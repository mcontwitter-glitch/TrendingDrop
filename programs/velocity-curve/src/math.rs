//! Dual-curve math (integer / u128).
//!
//! ## Spot price (linearized exponential)
//! Architecture: `Price = Base_Price * e^(k * Supply)`.
//! On-chain we use the first-order expansion `e^x ≈ 1 + x` with scale:
//! ```text
//! P(s) = base_price + (effective_k * s) / PRICE_SCALE
//! ```
//! with `PRICE_SCALE = 1_000_000_000`. This is constant-product–adjacent in spirit
//! (integral cost grows quadratically in supply) while matching the PDF's `k`.
//!
//! ## Attention score
//! ```text
//! Attention = twitter*w_t/10000 + telegram*w_g/10000 + holders*w_h/10000
//! ```
//! Default weights: 4000 / 3000 / 3000.
//!
//! ## Effective k
//! ```text
//! if Attention > Price_Velocity:
//!   Effective_k = k * (1 + (A - P)/100)   // steepen, sell tax 15%
//! else:
//!   Effective_k = k * (1 - (P - A)/200)   // flatten, sell tax 5%
//! ```
//! Modifiers clamped to ±25% (`MAX_K_ADJUST_BPS`) so Effective_k never 0 / overflow.
//!
//! ## Buy / sell integrals
//! Cost to mint Δ from supply S:
//! `cost = Δ*base + effective_k*(2*S*Δ + Δ²)/(2*PRICE_SCALE)`
//! Refund to burn Δ from supply S:
//! `refund = Δ*base + effective_k*(2*S*Δ - Δ²)/(2*PRICE_SCALE)`

use crate::errors::VelocityError;
use crate::state::{
    FLATTEN_TAX_BPS, MAX_K_ADJUST_BPS, STEEPEN_TAX_BPS,
};
use anchor_lang::prelude::*;

pub const BPS: u128 = 10_000;
pub const PRICE_SCALE: u128 = 1_000_000_000;
/// Reward index scale for pro-rata holder claims.
pub const REWARD_SCALE: u128 = 1_000_000_000_000;

pub fn curve_fee(sol_amount: u64, fee_bps: u16) -> Result<(u64, u64)> {
    let fee = (sol_amount as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(VelocityError::MathOverflow)?
        .checked_div(BPS)
        .ok_or(VelocityError::MathOverflow)? as u64;
    let net = sol_amount
        .checked_sub(fee)
        .ok_or(VelocityError::MathOverflow)?;
    Ok((fee, net))
}

pub fn weighted_attention(
    twitter: u64,
    telegram: u64,
    new_holders: u64,
    twitter_w: u16,
    telegram_w: u16,
    onchain_w: u16,
) -> Result<u64> {
    let t = (twitter as u128)
        .checked_mul(twitter_w as u128)
        .ok_or(VelocityError::MathOverflow)?;
    let g = (telegram as u128)
        .checked_mul(telegram_w as u128)
        .ok_or(VelocityError::MathOverflow)?;
    let h = (new_holders as u128)
        .checked_mul(onchain_w as u128)
        .ok_or(VelocityError::MathOverflow)?;
    let sum = t
        .checked_add(g)
        .ok_or(VelocityError::MathOverflow)?
        .checked_add(h)
        .ok_or(VelocityError::MathOverflow)?;
    Ok((sum / BPS) as u64)
}

pub fn ema_update(prev: u64, raw: u64, alpha_bps: u64) -> Result<u64> {
    // new = α*raw + (1-α)*prev
    let a = alpha_bps.min(10_000) as u128;
    let inv = BPS.checked_sub(a).ok_or(VelocityError::MathOverflow)?;
    let v = (raw as u128)
        .checked_mul(a)
        .ok_or(VelocityError::MathOverflow)?
        .checked_add(
            (prev as u128)
                .checked_mul(inv)
                .ok_or(VelocityError::MathOverflow)?,
        )
        .ok_or(VelocityError::MathOverflow)?
        .checked_div(BPS)
        .ok_or(VelocityError::MathOverflow)?;
    Ok(v as u64)
}

/// Effective k + sell-tax bps from attention vs price velocity.
pub fn velocity_params(curve_k: u64, attention: u64, price_velocity: u64) -> Result<(u64, u16)> {
    let k = curve_k as u128;
    if attention > price_velocity {
        let diff = (attention - price_velocity) as u128;
        // (diff/100) → add_bps = diff * 100, capped at MAX_K_ADJUST_BPS
        let add_bps = diff.saturating_mul(100).min(MAX_K_ADJUST_BPS as u128);
        let eff = k
            .checked_mul(BPS.checked_add(add_bps).ok_or(VelocityError::MathOverflow)?)
            .ok_or(VelocityError::MathOverflow)?
            .checked_div(BPS)
            .ok_or(VelocityError::MathOverflow)?;
        Ok((eff.max(1) as u64, STEEPEN_TAX_BPS))
    } else {
        let diff = (price_velocity - attention) as u128;
        // (diff/200) → sub_bps = diff * 50
        let sub_bps = diff.saturating_mul(50).min(MAX_K_ADJUST_BPS as u128);
        let factor = BPS.saturating_sub(sub_bps).max(1);
        let eff = k
            .checked_mul(factor)
            .ok_or(VelocityError::MathOverflow)?
            .checked_div(BPS)
            .ok_or(VelocityError::MathOverflow)?;
        Ok((eff.max(1) as u64, FLATTEN_TAX_BPS))
    }
}

pub fn spot_price(base_price: u64, effective_k: u64, supply: u64) -> Result<u64> {
    let extra = (effective_k as u128)
        .checked_mul(supply as u128)
        .ok_or(VelocityError::MathOverflow)?
        .checked_div(PRICE_SCALE)
        .ok_or(VelocityError::MathOverflow)?;
    Ok((base_price as u128)
        .checked_add(extra)
        .ok_or(VelocityError::MathOverflow)? as u64)
}

/// Tokens out for `sol_net` lamports along the integral curve.
pub fn tokens_out_for_sol(
    sol_net: u64,
    supply: u64,
    base_price: u64,
    effective_k: u64,
) -> Result<u64> {
    require!(sol_net > 0, VelocityError::ZeroAmount);
    require!(base_price > 0, VelocityError::InvalidParams);

    if effective_k == 0 {
        return Ok(sol_net
            .checked_div(base_price)
            .ok_or(VelocityError::MathOverflow)?
            .max(0));
    }

    // a = k/(2*SCALE), b = base + k*S/SCALE, solve aΔ² + bΔ - sol = 0
    // Δ = (-b + sqrt(b² + 4*a*sol)) / (2a)
    let k = effective_k as u128;
    let s = supply as u128;
    let base = base_price as u128;
    let sol = sol_net as u128;

    let b = base
        .checked_add(
            k.checked_mul(s)
                .ok_or(VelocityError::MathOverflow)?
                .checked_div(PRICE_SCALE)
                .ok_or(VelocityError::MathOverflow)?,
        )
        .ok_or(VelocityError::MathOverflow)?;

    // Work in (2*SCALE) units:  (k) Δ² + (2*SCALE*b) Δ - 2*SCALE*sol = 0
    // Δ = (-B + sqrt(B² + 4*k*C)) / (2k) where B = 2*SCALE*b, C = 2*SCALE*sol
    let two_scale = PRICE_SCALE.checked_mul(2).ok_or(VelocityError::MathOverflow)?;
    let b_term = b
        .checked_mul(two_scale)
        .ok_or(VelocityError::MathOverflow)?;
    let c_term = sol
        .checked_mul(two_scale)
        .ok_or(VelocityError::MathOverflow)?;

    let disc = b_term
        .checked_mul(b_term)
        .ok_or(VelocityError::MathOverflow)?
        .checked_add(
            (k.checked_mul(4).ok_or(VelocityError::MathOverflow)?)
                .checked_mul(c_term)
                .ok_or(VelocityError::MathOverflow)?,
        )
        .ok_or(VelocityError::MathOverflow)?;

    let root = isqrt(disc);
    let numer = root.saturating_sub(b_term);
    let denom = k.checked_mul(2).ok_or(VelocityError::MathOverflow)?;
    if denom == 0 {
        return Ok((sol / base) as u64);
    }
    let delta = numer.checked_div(denom).ok_or(VelocityError::MathOverflow)?;
    require!(delta > 0, VelocityError::ZeroAmount);
    Ok(delta as u64)
}

/// SOL out (pre-tax, pre-fee) for burning `token_amount` from supply.
pub fn sol_out_for_tokens(
    token_amount: u64,
    supply: u64,
    base_price: u64,
    effective_k: u64,
) -> Result<u64> {
    require!(token_amount > 0, VelocityError::ZeroAmount);
    require!(token_amount <= supply, VelocityError::InsufficientBalance);
    require!(base_price > 0, VelocityError::InvalidParams);

    let d = token_amount as u128;
    let s = supply as u128;
    let base = base_price as u128;
    let k = effective_k as u128;

    // refund = Δ*base + k*(2*S*Δ - Δ²)/(2*SCALE)
    let linear = d.checked_mul(base).ok_or(VelocityError::MathOverflow)?;
    let quad_num = k
        .checked_mul(
            s.checked_mul(2)
                .ok_or(VelocityError::MathOverflow)?
                .checked_mul(d)
                .ok_or(VelocityError::MathOverflow)?
                .checked_sub(d.checked_mul(d).ok_or(VelocityError::MathOverflow)?)
                .ok_or(VelocityError::MathOverflow)?,
        )
        .ok_or(VelocityError::MathOverflow)?;
    let quad = quad_num
        .checked_div(
            PRICE_SCALE
                .checked_mul(2)
                .ok_or(VelocityError::MathOverflow)?,
        )
        .ok_or(VelocityError::MathOverflow)?;

    Ok(linear.checked_add(quad).ok_or(VelocityError::MathOverflow)? as u64)
}

pub fn apply_bps(amount: u64, bps: u16) -> Result<u64> {
    Ok((amount as u128)
        .checked_mul(bps as u128)
        .ok_or(VelocityError::MathOverflow)?
        .checked_div(BPS)
        .ok_or(VelocityError::MathOverflow)? as u64)
}

/// Accrue pending rewards for a holder against the global index.
pub fn settle_holder_rewards(
    balance: u64,
    reward_debt: u128,
    reward_index: u128,
    claimable: u64,
) -> Result<(u64, u128)> {
    if balance == 0 || reward_index <= reward_debt {
        return Ok((claimable, reward_debt));
    }
    let pending = (balance as u128)
        .checked_mul(reward_index.saturating_sub(reward_debt))
        .ok_or(VelocityError::MathOverflow)?
        .checked_div(REWARD_SCALE)
        .ok_or(VelocityError::MathOverflow)? as u64;
    let new_claimable = claimable
        .checked_add(pending)
        .ok_or(VelocityError::MathOverflow)?;
    Ok((new_claimable, reward_index))
}

/// Distribute `amount` lamports pro-rata via reward_index.
pub fn accrue_holder_rewards(
    reward_index: u128,
    supply: u64,
    amount: u64,
) -> Result<u128> {
    if supply == 0 || amount == 0 {
        return Ok(reward_index);
    }
    let delta = (amount as u128)
        .checked_mul(REWARD_SCALE)
        .ok_or(VelocityError::MathOverflow)?
        .checked_div(supply as u128)
        .ok_or(VelocityError::MathOverflow)?;
    Ok(reward_index
        .checked_add(delta)
        .ok_or(VelocityError::MathOverflow)?)
}

/// Integer square root (Newton).
fn isqrt(n: u128) -> u128 {
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn effective_k_steepen() {
        let (eff, tax) = velocity_params(1_000, 120, 100).unwrap();
        assert!(eff > 1_000);
        assert_eq!(tax, STEEPEN_TAX_BPS);
    }

    #[test]
    fn effective_k_flatten() {
        let (eff, tax) = velocity_params(1_000, 100, 120).unwrap();
        assert!(eff < 1_000);
        assert_eq!(tax, FLATTEN_TAX_BPS);
    }

    #[test]
    fn buy_sell_roundtrip_smoke() {
        let base = 1_000;
        let k = 1_000;
        let (eff, _) = velocity_params(k, 50, 50).unwrap();
        let tokens = tokens_out_for_sol(1_000_000, 0, base, eff).unwrap();
        assert!(tokens > 0);
        let sol = sol_out_for_tokens(tokens, tokens, base, eff).unwrap();
        assert!(sol > 0 && sol <= 1_000_000);
    }
}
