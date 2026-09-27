use anchor_lang::prelude::*;

use crate::errors::LoreError;
use crate::events::MergeConfigInitialized;
use crate::state::{
    MergeConfig, DEFAULT_QUORUM_BPS, DEFAULT_VOTING_DURATION_SECS, MERGE_FEE_BPS,
    MERGE_MIN_AGE_SECS, PROPOSER_MIN_BPS,
};

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + MergeConfig::INIT_SPACE,
        seeds = [MergeConfig::SEED],
        bump
    )]
    pub config: Account<'info, MergeConfig>,

    /// CHECK: Protocol fee destination.
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: VelocityCurve program id stored for owner checks.
    pub velocity_curve_program: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_config_handler(
    ctx: Context<InitializeConfig>,
    fee_bps: Option<u16>,
    proposer_min_bps: Option<u16>,
    quorum_bps: Option<u16>,
    voting_duration_secs: Option<i64>,
) -> Result<()> {
    let fee = fee_bps.unwrap_or(MERGE_FEE_BPS);
    require!(fee <= 2_000, LoreError::Unauthorized); // sanity cap 20%

    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.treasury = ctx.accounts.treasury.key();
    config.velocity_curve_program = ctx.accounts.velocity_curve_program.key();
    config.fee_bps = fee;
    config.proposer_min_bps = proposer_min_bps.unwrap_or(PROPOSER_MIN_BPS);
    config.quorum_bps = quorum_bps.unwrap_or(DEFAULT_QUORUM_BPS);
    config.voting_duration_secs = voting_duration_secs.unwrap_or(DEFAULT_VOTING_DURATION_SECS);
    config.merge_min_age_secs = MERGE_MIN_AGE_SECS;
    config.bump = ctx.bumps.config;

    emit!(MergeConfigInitialized {
        authority: config.authority,
        treasury: config.treasury,
        velocity_curve_program: config.velocity_curve_program,
        fee_bps: config.fee_bps,
    });

    Ok(())
}
