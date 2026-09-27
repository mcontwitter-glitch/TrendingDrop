use anchor_lang::prelude::*;

use crate::errors::ReputationError;
use crate::events::ProfileUpdated;
use crate::math::{compute_accuracy_score, tier_from_score};
use crate::state::{Trait, TraderProfile, MAX_TRAITS};

#[derive(Accounts)]
pub struct UpdateProfile<'info> {
    #[account(
        mut,
        seeds = [TraderProfile::SEED, profile.owner.as_ref()],
        bump = profile.bump,
    )]
    pub profile: Account<'info, TraderProfile>,

    /// Crank / NarrativeAuction CPI signer (or profile owner). Phase 4 trusts
    /// the caller; gate via protocol config in a later revision if needed.
    pub authority: Signer<'info>,
}

/// Record a prediction outcome and recompute accuracy / tier.
///
/// Accuracy = (Correct / Total) * Weighted_Volume_Factor (bps, capped 10_000).
///
/// TODO: sync on-chain Metaplex / Bubblegum metadata URI for the NFT mint
/// once `nft_mint` is set (deferred — on-chain profile state is enough for Phase 4).
pub fn update_profile_handler(
    ctx: Context<UpdateProfile>,
    was_correct: bool,
    volume: u64,
    new_trait: Option<Trait>,
) -> Result<()> {
    let _authority = ctx.accounts.authority.key();
    let profile = &mut ctx.accounts.profile;

    profile.total_predictions = profile
        .total_predictions
        .checked_add(1)
        .ok_or(ReputationError::MathOverflow)?;
    if was_correct {
        profile.correct_predictions = profile
            .correct_predictions
            .checked_add(1)
            .ok_or(ReputationError::MathOverflow)?;
    }
    profile.total_volume = profile
        .total_volume
        .checked_add(volume)
        .ok_or(ReputationError::MathOverflow)?;

    profile.accuracy_score = compute_accuracy_score(
        profile.correct_predictions,
        profile.total_predictions,
        profile.total_volume,
    );
    profile.tier = tier_from_score(profile.accuracy_score);

    let clock = Clock::get()?;
    profile.last_updated = clock.unix_timestamp;

    if let Some(t) = new_trait {
        if profile.special_traits.len() >= MAX_TRAITS {
            return err!(ReputationError::TraitCapacity);
        }
        require!(
            !profile.special_traits.iter().any(|x| x == &t),
            ReputationError::TraitDuplicate
        );
        profile.special_traits.push(t);
    }

    // TODO(metaplex): when profile.nft_mint != default, update metadata URI /
    // attributes to reflect tier + traits (mpl-token-metadata CPI deferred).

    emit!(ProfileUpdated {
        profile: profile.key(),
        owner: profile.owner,
        was_correct,
        volume,
        accuracy_score: profile.accuracy_score,
        tier: profile.tier,
        total_predictions: profile.total_predictions,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
