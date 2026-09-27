use anchor_lang::prelude::*;

use crate::errors::VelocityError;
use crate::events::OracleRemoved;
use crate::state::OracleConfig;

#[derive(Accounts)]
pub struct RemoveOracle<'info> {
    #[account(
        mut,
        seeds = [OracleConfig::SEED],
        bump = oracle_config.bump,
        has_one = authority @ VelocityError::Unauthorized,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    pub authority: Signer<'info>,
}

pub fn remove_oracle_handler(ctx: Context<RemoveOracle>, oracle: Pubkey) -> Result<()> {
    let cfg = &mut ctx.accounts.oracle_config;
    let pos = cfg
        .authorized_oracles
        .iter()
        .position(|k| *k == oracle)
        .ok_or(VelocityError::OracleNotFound)?;

    let remaining = cfg.authorized_oracles.len() - 1;
    require!(
        remaining >= cfg.quorum as usize,
        VelocityError::OracleRemovalBreaksQuorum
    );

    cfg.authorized_oracles.remove(pos);

    emit!(OracleRemoved {
        authority: ctx.accounts.authority.key(),
        oracle,
        oracle_count: cfg.authorized_oracles.len() as u8,
    });

    Ok(())
}
