use anchor_lang::prelude::*;

use crate::errors::NarrativeError;
use crate::events::ConfigInitialized;
use crate::state::NarrativeConfig;

/// Default protocol fee: 2% (200 bps).
pub const DEFAULT_FEE_BPS: u16 = 200;
/// Default min stake: 0.01 SOL.
pub const DEFAULT_MIN_STAKE: u64 = 10_000_000;
/// Default max distinct stories a user can stake on (enforced via UserStakeIndex PDA).
pub const DEFAULT_MAX_STAKES_PER_USER: u8 = 20;
/// Default auction window: 48 hours.
pub const DEFAULT_GRADUATION_WINDOW: i64 = 48 * 60 * 60;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + NarrativeConfig::INIT_SPACE,
        seeds = [NarrativeConfig::SEED],
        bump
    )]
    pub config: Account<'info, NarrativeConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Treasury receives protocol fees; validated as a system account by caller.
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: VelocityCurve program id stored for future CPI; not invoked here.
    pub curve_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_config_handler(
    ctx: Context<InitializeConfig>,
    fee_bps: Option<u16>,
    min_stake: Option<u64>,
) -> Result<()> {
    let fee = fee_bps.unwrap_or(DEFAULT_FEE_BPS);
    require!(fee <= 1000, NarrativeError::InvalidFeeBps);

    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.fee_bps = fee;
    config.min_stake = min_stake.unwrap_or(DEFAULT_MIN_STAKE);
    config.max_stakes_per_user = DEFAULT_MAX_STAKES_PER_USER;
    config.graduation_window = DEFAULT_GRADUATION_WINDOW;
    config.treasury = ctx.accounts.treasury.key();
    config.curve_program = ctx.accounts.curve_program.key();
    config.bump = ctx.bumps.config;

    emit!(ConfigInitialized {
        authority: config.authority,
        fee_bps: config.fee_bps,
        treasury: config.treasury,
    });

    Ok(())
}
