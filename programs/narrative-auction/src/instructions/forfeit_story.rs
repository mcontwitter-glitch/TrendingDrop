use anchor_lang::prelude::*;

use crate::errors::NarrativeError;
use crate::events::StoryForfeited;
use crate::state::{MarketPhase, NarrativeConfig, StoryMarket};

#[derive(Accounts)]
pub struct ForfeitStory<'info> {
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

/// Permissionless crank: mark a competitive loser as Forfeited.
///
/// Preconditions:
/// - Auction ended
/// - `total_staked >= graduation_threshold` (was a contender; below-threshold → `fail_story`)
///
/// Forfeited stakes do **not** reclaim principal. Use `contribute_losing_pool` to
/// move vault SOL into a winner's `winning_pool` (then graduate splits 20/80).
pub fn forfeit_story_handler(ctx: Context<ForfeitStory>) -> Result<()> {
    let clock = &ctx.accounts.clock;
    let story = &mut ctx.accounts.story;

    require!(
        clock.unix_timestamp > story.ends_at,
        NarrativeError::AuctionNotEnded
    );
    require!(
        story.total_staked >= story.graduation_threshold,
        NarrativeError::ThresholdNotMet
    );

    story.phase = MarketPhase::Forfeited;

    emit!(StoryForfeited {
        story: story.key(),
        total_staked: story.total_staked,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
