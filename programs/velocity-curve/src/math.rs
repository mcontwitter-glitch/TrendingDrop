//! Pump.fun–style constant-product AMM (integer / u128).
//!
//! ## Invariant
//! ```text
//! k = virtual_sol * virtual_token
//! spot (lamports / whole token) = virtual_sol / virtual_token
//! ```
//!
//! ## Buy Δx SOL (net of fee)
//! ```text
//! Δy = y - k / (x + Δx)
//! ```
//!
//! ## Sell Δy tokens
//! ```text
//! Δx = x - k / (y + Δy)
//! ```
//!
//! Attention score still drives **sell tax** (steepen 15% / flatten 5%), but does
//! not alter the constant-product invariant (no linear base+k*s pricing).

use crate::errors::VelocityError;
use crate::state::{FLATTEN_TAX_BPS, MAX_K_ADJUST_BPS, STEEPEN_TAX_BPS};
use anchor_lang::prelude::*;

pub const BPS: u128 = 10_000;
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

/// Sell-tax bps from attention vs price velocity (pricing itself is CPMM).
/// Returns `(unused_eff_k_placeholder, sell_tax_bps)` — first value kept for
/// event / oracle compatibility (echoes curve virtual_token).
pub fn velocity_params(virtual_token: u64, attention: u64, price_velocity: u64) -> Result<(u64, u16)> {
    if attention > price_velocity {
        let diff = (attention - price_velocity) as u128;
        let _add_bps = diff.saturating_mul(100).min(MAX_K_ADJUST_BPS as u128);
        Ok((virtual_token.max(1), STEEPEN_TAX_BPS))
    } else {
        let diff = (price_velocity - attention) as u128;
        let _sub_bps = diff.saturating_mul(50).min(MAX_K_ADJUST_BPS as u128);
        Ok((virtual_token.max(1), FLATTEN_TAX_BPS))
    }
}

/// Spot price in lamports per whole token: x / y.
pub fn spot_price(virtual_sol: u64, virtual_token: u64) -> Result<u64> {
    require!(virtual_token > 0, VelocityError::InvalidParams);
    Ok(virtual_sol
        .checked_div(virtual_token)
        .ok_or(VelocityError::MathOverflow)?
        .max(1))
}

/// Invariant k = x * y (u128).
pub fn invariant_k(virtual_sol: u64, virtual_token: u64) -> Result<u128> {
    (virtual_sol as u128)
        .checked_mul(virtual_token as u128)
        .ok_or(VelocityError::MathOverflow.into())
}

/// Tokens out (whole) for `sol_net` lamports.
/// UniV2 form: Δy = y·Δx / (x+Δx)  (= y − k/(x+Δx) with floor).
pub fn tokens_out_for_sol(
    sol_net: u64,
    virtual_sol: u64,
    virtual_token: u64,
) -> Result<u64> {
    require!(sol_net > 0, VelocityError::ZeroAmount);
    require!(virtual_sol > 0 && virtual_token > 0, VelocityError::InvalidParams);

    let x = virtual_sol as u128;
    let y = virtual_token as u128;
    let dx = sol_net as u128;
    let denom = x.checked_add(dx).ok_or(VelocityError::MathOverflow)?;
    let dy = y
        .checked_mul(dx)
        .ok_or(VelocityError::MathOverflow)?
        .checked_div(denom)
        .ok_or(VelocityError::MathOverflow)?;
    require!(dy > 0, VelocityError::ZeroAmount);
    require!(dy < y, VelocityError::InsufficientBalance);
    Ok(dy as u64)
}

/// SOL out (lamports, pre-tax, pre-fee) for selling `token_amount` whole tokens.
/// UniV2 form: Δx = x·Δy / (y+Δy)  (= x − k/(y+Δy) with floor).
pub fn sol_out_for_tokens(
    token_amount: u64,
    virtual_sol: u64,
    virtual_token: u64,
) -> Result<u64> {
    require!(token_amount > 0, VelocityError::ZeroAmount);
    require!(virtual_sol > 0 && virtual_token > 0, VelocityError::InvalidParams);

    let x = virtual_sol as u128;
    let y = virtual_token as u128;
    let dy = token_amount as u128;
    let denom = y.checked_add(dy).ok_or(VelocityError::MathOverflow)?;
    let dx = x
        .checked_mul(dy)
        .ok_or(VelocityError::MathOverflow)?
        .checked_div(denom)
        .ok_or(VelocityError::MathOverflow)?;
    require!(dx > 0, VelocityError::ZeroAmount);
    require!(dx < x, VelocityError::InsufficientVault);
    Ok(dx as u64)
}

/// Apply a buy to virtual/real reserves. Returns new spot.
pub fn apply_buy(
    virtual_sol: u64,
    virtual_token: u64,
    real_sol: u64,
    real_token: u64,
    current_supply: u64,
    sol_net: u64,
    tokens_out: u64,
) -> Result<(u64, u64, u64, u64, u64, u64)> {
    require!(real_token >= tokens_out, VelocityError::InsufficientBalance);
    let new_virtual_sol = virtual_sol
        .checked_add(sol_net)
        .ok_or(VelocityError::MathOverflow)?;
    let new_virtual_token = virtual_token
        .checked_sub(tokens_out)
        .ok_or(VelocityError::MathOverflow)?;
    require!(new_virtual_token > 0, VelocityError::InvalidParams);
    let new_real_sol = real_sol
        .checked_add(sol_net)
        .ok_or(VelocityError::MathOverflow)?;
    let new_real_token = real_token
        .checked_sub(tokens_out)
        .ok_or(VelocityError::MathOverflow)?;
    let new_supply = current_supply
        .checked_add(tokens_out)
        .ok_or(VelocityError::MathOverflow)?;
    let price = spot_price(new_virtual_sol, new_virtual_token)?;
    Ok((
        new_virtual_sol,
        new_virtual_token,
        new_real_sol,
        new_real_token,
        new_supply,
        price,
    ))
}

/// Apply a sell to virtual/real reserves. Returns new spot.
pub fn apply_sell(
    virtual_sol: u64,
    virtual_token: u64,
    real_sol: u64,
    real_token: u64,
    current_supply: u64,
    sol_gross: u64,
    tokens_in: u64,
) -> Result<(u64, u64, u64, u64, u64, u64)> {
    require!(current_supply >= tokens_in, VelocityError::InsufficientBalance);
    let new_virtual_sol = virtual_sol
        .checked_sub(sol_gross)
        .ok_or(VelocityError::MathOverflow)?;
    let new_virtual_token = virtual_token
        .checked_add(tokens_in)
        .ok_or(VelocityError::MathOverflow)?;
    require!(new_virtual_sol > 0, VelocityError::InsufficientVault);
    let new_real_sol = real_sol
        .checked_sub(sol_gross)
        .ok_or(VelocityError::MathOverflow)?;
    let new_real_token = real_token
        .checked_add(tokens_in)
        .ok_or(VelocityError::MathOverflow)?;
    let new_supply = current_supply
        .checked_sub(tokens_in)
        .ok_or(VelocityError::MathOverflow)?;
    let price = spot_price(new_virtual_sol, new_virtual_token)?;
    Ok((
        new_virtual_sol,
        new_virtual_token,
        new_real_sol,
        new_real_token,
        new_supply,
        price,
    ))
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{INITIAL_VIRTUAL_SOL, INITIAL_VIRTUAL_TOKEN};

    #[test]
    fn launch_spot_near_28() {
        let p = spot_price(INITIAL_VIRTUAL_SOL, INITIAL_VIRTUAL_TOKEN).unwrap();
        // 30e9 / 1.073e9 ≈ 27
        assert!(p >= 27 && p <= 28, "spot={p}");
    }

    #[test]
    fn buy_sell_roundtrip_smoke() {
        let x = INITIAL_VIRTUAL_SOL;
        let y = INITIAL_VIRTUAL_TOKEN;
        let sol_in = 1_000_000_000u64; // 1 SOL
        let tokens = tokens_out_for_sol(sol_in, x, y).unwrap();
        assert!(tokens > 0);
        let (nx, ny, _, _, _, _) =
            apply_buy(x, y, 0, 800_000_000, 0, sol_in, tokens).unwrap();
        let sol_back = sol_out_for_tokens(tokens, nx, ny).unwrap();
        assert!(sol_back > 0, "sol_back={sol_back}");
        assert!(sol_back <= sol_in, "sol_back={sol_back} sol_in={sol_in}");
        assert!(sol_back * 1000 >= sol_in * 999, "too much slippage sol_back={sol_back}");
    }

    #[test]
    fn graduate_real_sol_leaves_about_200m_virtual() {
        // After +85 SOL real: x=115 SOL, y = k/x ≈ 280M virtual; sold ≈ 793M.
        let x0 = INITIAL_VIRTUAL_SOL as u128;
        let y0 = INITIAL_VIRTUAL_TOKEN as u128;
        let k = x0 * y0;
        let x1 = x0 + 85_000_000_000u128;
        let y1 = k / x1;
        let sold = y0 - y1;
        assert!(sold > 700_000_000 && sold < 850_000_000, "sold={sold}");
        assert!(y1 > 200_000_000 && y1 < 350_000_000, "y1={y1}");
    }
}
