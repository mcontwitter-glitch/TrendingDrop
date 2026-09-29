use anchor_lang::prelude::*;

use crate::errors::LoreError;
use crate::events::LoreAssetInitialized;
use crate::state::{LoreAsset, MergeConfig, BASE_LORE_POWER_BPS};
use crate::velocity_read::read_velocity_token;

#[derive(Accounts)]
pub struct InitializeLoreAsset<'info> {
    #[account(
        seeds = [MergeConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, MergeConfig>,

    /// CHECK: VelocityToken curve PDA — owner must be velocity_curve_program.
    pub curve: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + LoreAsset::INIT_SPACE,
        seeds = [LoreAsset::SEED, curve.key().as_ref()],
        bump
    )]
    pub lore_asset: Account<'info, LoreAsset>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Register a LoreAsset for a graduated VelocityToken (permissionless).
/// Typically called after graduation or before the first merge involving the curve.
pub fn initialize_lore_asset_handler(
    ctx: Context<InitializeLoreAsset>,
    content_hash: [u8; 32],
) -> Result<()> {
    let curve = read_velocity_token(
        &ctx.accounts.curve.to_account_info(),
        &ctx.accounts.config.velocity_curve_program,
    )?;
    require!(!curve.is_merged, LoreError::CurveMerged);

    let clock = Clock::get()?;
    let lore_value = curve.real_sol.max(curve.seed_liquidity);

    let lore = &mut ctx.accounts.lore_asset;
    lore.origin_story = curve.story_id;
    lore.origin_curve = ctx.accounts.curve.key();
    lore.current_holder = ctx.accounts.curve.key();
    lore.content_hash = content_hash;
    lore.absorption_history = vec![];
    lore.lore_value = lore_value;
    lore.lore_power = BASE_LORE_POWER_BPS;
    lore.registered_at = clock.unix_timestamp;
    lore.is_absorbed = false;
    lore.bump = ctx.bumps.lore_asset;

    emit!(LoreAssetInitialized {
        lore: lore.key(),
        origin_curve: lore.origin_curve,
        origin_story: lore.origin_story,
        lore_value: lore.lore_value,
        lore_power: lore.lore_power,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
