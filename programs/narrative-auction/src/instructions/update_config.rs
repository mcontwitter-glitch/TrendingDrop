use anchor_lang::prelude::*;

use crate::errors::NarrativeError;
use crate::events::ConfigUpdated;
use crate::state::NarrativeConfig;

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [NarrativeConfig::SEED],
        bump = config.bump,
        has_one = authority @ NarrativeError::Unauthorized,
    )]
    pub config: Account<'info, NarrativeConfig>,

    pub authority: Signer<'info>,
}

/// Authority-only: update fee, min stake, treasury, and/or curve program.
pub fn update_config_handler(
    ctx: Context<UpdateConfig>,
    fee_bps: Option<u16>,
    min_stake: Option<u64>,
    treasury: Option<Pubkey>,
    curve_program: Option<Pubkey>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    if let Some(fee) = fee_bps {
        require!(fee <= 1000, NarrativeError::InvalidFeeBps);
        config.fee_bps = fee;
    }
    if let Some(min) = min_stake {
        config.min_stake = min;
    }
    if let Some(t) = treasury {
        config.treasury = t;
    }
    if let Some(c) = curve_program {
        config.curve_program = c;
    }

    emit!(ConfigUpdated {
        authority: config.authority,
        fee_bps: config.fee_bps,
        min_stake: config.min_stake,
        treasury: config.treasury,
        curve_program: config.curve_program,
    });

    Ok(())
}
