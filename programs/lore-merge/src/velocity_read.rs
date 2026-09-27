//! Read-only mirrors of VelocityCurve accounts.
//!
//! Avoids a hard crate dependency: we verify `owner == velocity_curve_program`,
//! skip the 8-byte Anchor discriminator, and Borsh-deserialize field layouts
//! that must stay wire-compatible with `programs/velocity-curve/src/state.rs`.

use anchor_lang::prelude::*;
use anchor_lang::AnchorDeserialize;

use crate::errors::LoreError;

/// Wire layout matching `velocity_curve::state::VelocityToken` (field order).
#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct VelocityTokenData {
    pub mint: Pubkey,
    pub story_id: Pubkey,
    pub creator: Pubkey,
    pub base_price: u64,
    pub current_supply: u64,
    pub current_price: u64,
    pub attention_score: u64,
    pub price_velocity: u64,
    pub curve_k: u64,
    pub sell_tax_bps: u16,
    pub last_oracle_update: i64,
    pub merge_count: u8,
    pub is_merged: bool,
    pub sol_reserve: u64,
    pub protocol_fees: u64,
    pub holder_rewards_pool: u64,
    pub reward_index: u128,
    pub last_price: u64,
    pub seed_liquidity: u64,
    pub bump: u8,
    pub vault_bump: u8,
}

/// Wire layout matching `velocity_curve::state::HolderPosition`.
#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct HolderPositionData {
    pub owner: Pubkey,
    pub token: Pubkey,
    pub balance: u64,
    pub entry_price: u64,
    pub last_attention_claim: i64,
    pub lore_power: u32,
    pub reward_debt: u128,
    pub claimable_rewards: u64,
    pub bump: u8,
}

fn deserialize_body<T: AnchorDeserialize>(data: &[u8]) -> Result<T> {
    require!(data.len() >= 8, LoreError::InvalidCurveData);
    let mut body: &[u8] = &data[8..];
    T::deserialize(&mut body).map_err(|_| LoreError::InvalidCurveData.into())
}

pub fn read_velocity_token(
    info: &AccountInfo,
    expected_owner: &Pubkey,
) -> Result<VelocityTokenData> {
    require_keys_eq!(*info.owner, *expected_owner, LoreError::InvalidCurveOwner);
    let data = info.try_borrow_data()?;
    deserialize_body(&data)
}

pub fn read_holder_position(
    info: &AccountInfo,
    expected_owner: &Pubkey,
) -> Result<HolderPositionData> {
    require_keys_eq!(*info.owner, *expected_owner, LoreError::InvalidCurveOwner);
    let data = info.try_borrow_data()?;
    deserialize_body(&data)
}

/// Verify holder fields match voter + curve.
pub fn verify_holder(
    holder: &HolderPositionData,
    expected_owner: &Pubkey,
    expected_curve: &Pubkey,
) -> Result<()> {
    require_keys_eq!(holder.owner, *expected_owner, LoreError::InvalidHolder);
    require_keys_eq!(holder.token, *expected_curve, LoreError::InvalidHolder);
    Ok(())
}

/// Voting power = balance with soft lore_power bonus (capped +50%).
/// Quorum is still measured in supply units; bonus rewards long-term holders.
pub fn voting_power(holder: &HolderPositionData) -> Result<u64> {
    let bonus_bps = 10_000u64.saturating_add((holder.lore_power as u64).min(5_000));
    Ok((holder.balance as u128)
        .checked_mul(bonus_bps as u128)
        .ok_or(LoreError::MathOverflow)?
        .checked_div(10_000u128)
        .ok_or(LoreError::MathOverflow)? as u64)
}
