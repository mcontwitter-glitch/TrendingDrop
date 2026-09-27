use anchor_lang::prelude::*;

use crate::errors::VelocityError;
use crate::events::OracleQuorumUpdated;
use crate::state::OracleConfig;

#[derive(Accounts)]
pub struct SetOracleQuorum<'info> {
    #[account(
        mut,
        seeds = [OracleConfig::SEED],
        bump = oracle_config.bump,
        has_one = authority @ VelocityError::Unauthorized,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    pub authority: Signer<'info>,
}

pub fn set_oracle_quorum_handler(ctx: Context<SetOracleQuorum>, new_quorum: u8) -> Result<()> {
    let cfg = &mut ctx.accounts.oracle_config;
    require!(new_quorum >= 1, VelocityError::InvalidQuorum);
    require!(
        (new_quorum as usize) <= cfg.authorized_oracles.len(),
        VelocityError::InvalidQuorum
    );

    let old = cfg.quorum;
    cfg.quorum = new_quorum;

    emit!(OracleQuorumUpdated {
        authority: ctx.accounts.authority.key(),
        old_quorum: old,
        new_quorum,
    });

    Ok(())
}
