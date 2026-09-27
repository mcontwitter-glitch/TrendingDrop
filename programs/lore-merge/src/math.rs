use anchor_lang::prelude::*;

use crate::errors::LoreError;
use crate::state::{
    LORE_POWER_BUMP_BASE, LORE_POWER_BUMP_VALUE_CAP, LORE_VALUE_UNIT_LAMPORTS, MERGE_FEE_BPS,
    LIQUIDITY_TRANSFER_BPS,
};

/// `amount * bps / 10_000` with overflow checks.
pub fn bps_of(amount: u64, bps: u16) -> Result<u64> {
    Ok((amount as u128)
        .checked_mul(bps as u128)
        .ok_or(LoreError::MathOverflow)?
        .checked_div(10_000u128)
        .ok_or(LoreError::MathOverflow)? as u64)
}

/// Split target liquidity into fee (5%) and absorber transfer (90%).
/// Remainder (~5%) stays as ghost liquidity on the target vault until settle.
pub fn merge_split(target_sol_reserve: u64) -> Result<(u64, u64)> {
    let fee = bps_of(target_sol_reserve, MERGE_FEE_BPS)?;
    let liquidity = bps_of(target_sol_reserve, LIQUIDITY_TRANSFER_BPS)?;
    Ok((fee, liquidity))
}

/// Lore power bump when absorber takes target lore.
/// `bump = BASE (500) + min(lore_value / 1 SOL, CAP)`.
pub fn lore_power_bump(target_lore_value: u64) -> u32 {
    let value_extra = (target_lore_value / LORE_VALUE_UNIT_LAMPORTS) as u32;
    LORE_POWER_BUMP_BASE.saturating_add(value_extra.min(LORE_POWER_BUMP_VALUE_CAP))
}

/// Apply bump to absorber lore_power (bps multiplier).
pub fn apply_lore_power(current: u32, target_lore_value: u64) -> Result<u32> {
    Ok(current.saturating_add(lore_power_bump(target_lore_value)))
}

/// Required proposer balance: floor(supply * proposer_min_bps / 10000) + 1
/// so strictly > proposer_min_bps of supply when supply > 0.
pub fn min_proposer_balance(supply: u64, proposer_min_bps: u16) -> Result<u64> {
    if supply == 0 {
        return err!(LoreError::InsufficientHoldings);
    }
    let threshold = bps_of(supply, proposer_min_bps)?;
    Ok(threshold.saturating_add(1))
}

/// Quorum absolute votes from supply × quorum_bps.
pub fn quorum_from_supply(supply: u64, quorum_bps: u16) -> Result<u64> {
    let q = bps_of(supply, quorum_bps)?;
    Ok(q.max(1))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_100_sol() {
        let (fee, liq) = merge_split(100_000_000_000).unwrap();
        assert_eq!(fee, 5_000_000_000);
        assert_eq!(liq, 90_000_000_000);
    }

    #[test]
    fn lore_bump_scales() {
        assert_eq!(lore_power_bump(0), 500);
        assert_eq!(lore_power_bump(3_000_000_000), 503);
        assert_eq!(lore_power_bump(5_000_000_000_000), 500 + 2_000);
    }
}
