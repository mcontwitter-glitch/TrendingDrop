use anchor_lang::prelude::*;

use crate::errors::NarrativeError;
use crate::events::AuctionEndClamped;
use crate::instructions::initialize_config::DEFAULT_POST_THRESHOLD_SECS;
use crate::state::{MarketPhase, NarrativeConfig, StoryMarket};

#[derive(Accounts)]
pub struct ClampPostThreshold<'info> {
    #[account(
        seeds = [NarrativeConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, NarrativeConfig>,

    #[account(
        mut,
        seeds = [StoryMarket::SEED, story.creator.as_ref(), story.content_hash.as_ref()],
        bump = story.bump,
        constraint = story.phase == MarketPhase::Active @ NarrativeError::NotActive,
    )]
    pub story: Account<'info, StoryMarket>,

    pub clock: Sysvar<'info, Clock>,
}

/// Permissionless crank: when `total_staked >= graduation_threshold`, clamp
/// `ends_at` to `min(ends_at, now + post_threshold_secs)`.
///
/// Needed for stories that crossed the threshold before `post_threshold_secs`
/// existed (or with no subsequent stake) so `stake_on_narrative` never ran the
/// clamp. Idempotent — no-op when already within the final window.
pub fn clamp_post_threshold_handler(ctx: Context<ClampPostThreshold>) -> Result<()> {
    let clock = &ctx.accounts.clock;
    let config = &ctx.accounts.config;
    let story = &mut ctx.accounts.story;

    require!(
        story.total_staked >= story.graduation_threshold,
        NarrativeError::ThresholdNotMet
    );

    let window = if config.post_threshold_secs > 0 {
        config.post_threshold_secs
    } else {
        DEFAULT_POST_THRESHOLD_SECS
    };
    let capped = clock
        .unix_timestamp
        .checked_add(window)
        .ok_or(NarrativeError::MathOverflow)?;

    let previous_ends_at = story.ends_at;
    if capped < story.ends_at {
        story.ends_at = capped;
    }

    emit!(AuctionEndClamped {
        story: story.key(),
        previous_ends_at,
        ends_at: story.ends_at,
        total_staked: story.total_staked,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
