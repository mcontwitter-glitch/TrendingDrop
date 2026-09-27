use anchor_lang::prelude::*;

use crate::errors::ReputationError;
use crate::events::TraitAdded;
use crate::state::{Trait, TraderProfile, MAX_TRAITS};

#[derive(Accounts)]
pub struct AddTrait<'info> {
    #[account(
        mut,
        seeds = [TraderProfile::SEED, profile.owner.as_ref()],
        bump = profile.bump,
        has_one = owner @ ReputationError::Unauthorized,
    )]
    pub profile: Account<'info, TraderProfile>,

    pub owner: Signer<'info>,
}

/// Append a special trait to the owner's profile (optional Phase-4 helper).
pub fn add_trait_handler(ctx: Context<AddTrait>, new_trait: Trait) -> Result<()> {
    let profile = &mut ctx.accounts.profile;
    require!(
        profile.special_traits.len() < MAX_TRAITS,
        ReputationError::TraitCapacity
    );
    require!(
        !profile.special_traits.iter().any(|x| x == &new_trait),
        ReputationError::TraitDuplicate
    );
    profile.special_traits.push(new_trait.clone());
    let clock = Clock::get()?;
    profile.last_updated = clock.unix_timestamp;

    emit!(TraitAdded {
        profile: profile.key(),
        owner: profile.owner,
        trait_kind: new_trait,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
