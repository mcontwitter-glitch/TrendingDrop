use anchor_lang::prelude::*;

use crate::errors::VelocityError;
use crate::math::{spot_price, velocity_params};
use crate::state::VelocityToken;

/// One-shot repair for curves corrupted by the TokenParams stack-pointer bug
/// (Devnet: u64 fields written as SBPF stack addresses, clobbering story_id[24..32]).
/// Only the curve creator (or original payer recorded as creator) may repair.
#[derive(Accounts)]
pub struct RepairCurve<'info> {
    #[account(
        mut,
        seeds = [VelocityToken::SEED, story_id.key().as_ref()],
        bump = curve.bump,
    )]
    pub curve: Box<Account<'info, VelocityToken>>,

    /// CHECK: Canonical story PDA used for curve seeds — must match intended story.
    pub story_id: UncheckedAccount<'info>,

    pub authority: Signer<'info>,
}

pub fn repair_curve_handler(
    ctx: Context<RepairCurve>,
    base_price: u64,
    curve_k: u64,
) -> Result<()> {
    require!(base_price > 0, VelocityError::InvalidParams);
    require!(curve_k > 0, VelocityError::InvalidParams);

    let curve = &mut ctx.accounts.curve;
    require!(
        curve.creator == ctx.accounts.authority.key(),
        VelocityError::Unauthorized
    );

    let (eff_k, _) = velocity_params(curve_k, curve.attention_score, curve.price_velocity)?;
    let price = spot_price(base_price, eff_k, curve.current_supply)?;

    curve.story_id = ctx.accounts.story_id.key();
    curve.base_price = base_price;
    curve.curve_k = curve_k;
    curve.current_price = price;
    curve.last_price = price;

    msg!(
        "Repaired curve story={} base={} k={}",
        curve.story_id,
        base_price,
        curve_k
    );
    Ok(())
}
