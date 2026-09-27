use anchor_lang::prelude::*;

use crate::errors::VelocityError;
use crate::events::OracleConfigInitialized;
use crate::state::{OracleConfig, MAX_ORACLES};

#[derive(Accounts)]
pub struct InitializeOracleConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + OracleConfig::INIT_SPACE,
        seeds = [OracleConfig::SEED],
        bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Bootstrap oracle config. Default quorum = 3 (mainnet 3/5).
/// Pass `quorum: Some(1)` for single-oracle local/dev.
pub fn initialize_oracle_config_handler(
    ctx: Context<InitializeOracleConfig>,
    update_interval: Option<i64>,
    authorized_oracles: Option<Vec<Pubkey>>,
    quorum: Option<u8>,
) -> Result<()> {
    let cfg = &mut ctx.accounts.oracle_config;
    cfg.authority = ctx.accounts.authority.key();
    cfg.update_interval = update_interval.unwrap_or(OracleConfig::DEFAULT_UPDATE_INTERVAL);
    cfg.twitter_weight = OracleConfig::DEFAULT_TWITTER_WEIGHT;
    cfg.telegram_weight = OracleConfig::DEFAULT_TELEGRAM_WEIGHT;
    cfg.onchain_weight = OracleConfig::DEFAULT_ONCHAIN_WEIGHT;

    let oracles = authorized_oracles.unwrap_or_else(|| vec![ctx.accounts.authority.key()]);
    require!(oracles.len() <= MAX_ORACLES, VelocityError::TooManyOracles);
    require!(!oracles.is_empty(), VelocityError::InvalidOracleProof);

    // Reject duplicates in the initial set.
    let mut unique = std::collections::BTreeSet::new();
    for k in &oracles {
        require!(unique.insert(*k), VelocityError::DuplicateOracle);
    }

    let q = quorum.unwrap_or(OracleConfig::DEFAULT_QUORUM);
    require!(q >= 1, VelocityError::InvalidQuorum);
    require!((q as usize) <= oracles.len(), VelocityError::InvalidQuorum);

    cfg.authorized_oracles = oracles;
    cfg.quorum = q;
    cfg.bump = ctx.bumps.oracle_config;

    emit!(OracleConfigInitialized {
        authority: cfg.authority,
        update_interval: cfg.update_interval,
        quorum: cfg.quorum,
        oracle_count: cfg.authorized_oracles.len() as u8,
    });

    Ok(())
}
