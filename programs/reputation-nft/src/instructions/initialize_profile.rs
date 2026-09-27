use anchor_lang::prelude::*;

use crate::events::ProfileInitialized;
use crate::state::{ReputationTier, TraderProfile};

#[derive(Accounts)]
pub struct InitializeProfile<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + TraderProfile::INIT_SPACE,
        seeds = [TraderProfile::SEED, owner.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, TraderProfile>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Initialize an empty TraderProfile for `owner`.
pub fn initialize_profile_handler(ctx: Context<InitializeProfile>) -> Result<()> {
    let clock = Clock::get()?;
    let profile = &mut ctx.accounts.profile;
    profile.owner = ctx.accounts.owner.key();
    profile.total_predictions = 0;
    profile.correct_predictions = 0;
    profile.total_volume = 0;
    profile.accuracy_score = 0;
    profile.tier = ReputationTier::Bronze;
    profile.last_updated = clock.unix_timestamp;
    profile.special_traits = vec![];
    profile.nft_mint = Pubkey::default();
    profile.bump = ctx.bumps.profile;

    emit!(ProfileInitialized {
        profile: profile.key(),
        owner: profile.owner,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
