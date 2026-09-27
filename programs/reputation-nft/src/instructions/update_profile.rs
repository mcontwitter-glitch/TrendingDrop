use anchor_lang::prelude::*;

use crate::errors::ReputationError;
use crate::events::{ProfileUpdated, ReputationNftMetadataUpdated};
use crate::math::{compute_accuracy_score, tier_from_score};
use crate::metaplex::{
    find_metadata_account, reputation_name, reputation_uri, update_metadata_accounts_v2,
    REPUTATION_SYMBOL, TOKEN_METADATA_PROGRAM_ID,
};
use crate::state::{Trait, TraderProfile, ReputationTier, MAX_TRAITS};

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

    /// CHECK: Metaplex metadata PDA for `profile.nft_mint`.
    /// When no NFT is minted, pass any writable account (e.g. profile) — ignored.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Token Metadata program. Address-checked only when NFT is minted.
    pub token_metadata_program: UncheckedAccount<'info>,
}

fn tier_label(tier: ReputationTier) -> &'static str {
    match tier {
        ReputationTier::Bronze => "Bronze",
        ReputationTier::Silver => "Silver",
        ReputationTier::Gold => "Gold",
        ReputationTier::Diamond => "Diamond",
        ReputationTier::Mythic => "Mythic",
    }
}

/// Record a prediction outcome and recompute accuracy / tier.
///
/// Accuracy = (Correct / Total) * Weighted_Volume_Factor (bps, capped 10_000).
///
/// When `profile.nft_mint` is set, syncs Metaplex on-chain name + URI to the new
/// tier via UpdateMetadataAccountV2 (update authority = profile PDA). URI remains
/// the deterministic placeholder `https://bcc.local/reputation/{tier}/{owner}.json`.
pub fn update_profile_handler(
    ctx: Context<UpdateProfile>,
    was_correct: bool,
    volume: u64,
    new_trait: Option<Trait>,
) -> Result<()> {
    let _authority = ctx.accounts.authority.key();

    let old_tier = ctx.accounts.profile.tier;

    {
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
    }

    // Sync Metaplex metadata when an NFT exists.
    let nft_mint = ctx.accounts.profile.nft_mint;
    if nft_mint != Pubkey::default() {
        require!(
            ctx.accounts.token_metadata_program.key() == TOKEN_METADATA_PROGRAM_ID,
            ReputationError::InvalidMetadataProgram
        );
        let (expected_metadata, _) = find_metadata_account(&nft_mint);
        require!(
            ctx.accounts.metadata.key() == expected_metadata,
            ReputationError::InvalidMetadataPda
        );

        let owner = ctx.accounts.profile.owner;
        let tier = ctx.accounts.profile.tier;
        let bump = ctx.accounts.profile.bump;
        let profile_key = ctx.accounts.profile.key();
        let label = tier_label(tier);
        let name = reputation_name(label);
        let uri = reputation_uri(label, &owner);
        let seeds: &[&[u8]] = &[TraderProfile::SEED, owner.as_ref(), &[bump]];

        update_metadata_accounts_v2(
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.profile.to_account_info(),
            &name,
            REPUTATION_SYMBOL,
            &uri,
            &[seeds],
        )?;

        if old_tier != tier {
            let clock = Clock::get()?;
            emit!(ReputationNftMetadataUpdated {
                profile: profile_key,
                owner,
                mint: nft_mint,
                tier,
                uri,
                timestamp: clock.unix_timestamp,
            });
        }
    }

    Ok(())
}
