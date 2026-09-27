use anchor_lang::prelude::*;

use crate::errors::VelocityError;
use crate::events::OracleAdded;
use crate::state::{OracleConfig, MAX_ORACLES};

#[derive(Accounts)]
pub struct AddOracle<'info> {
    #[account(
        mut,
        seeds = [OracleConfig::SEED],
        bump = oracle_config.bump,
        has_one = authority @ VelocityError::Unauthorized,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    pub authority: Signer<'info>,
}

pub fn add_oracle_handler(ctx: Context<AddOracle>, oracle: Pubkey) -> Result<()> {
    let cfg = &mut ctx.accounts.oracle_config;
    require!(
        cfg.authorized_oracles.len() < MAX_ORACLES,
        VelocityError::TooManyOracles
    );
    require!(
        !cfg.authorized_oracles.iter().any(|k| *k == oracle),
        VelocityError::OracleAlreadyAuthorized
    );

    cfg.authorized_oracles.push(oracle);

    emit!(OracleAdded {
        authority: ctx.accounts.authority.key(),
        oracle,
        oracle_count: cfg.authorized_oracles.len() as u8,
    });

    Ok(())
}
