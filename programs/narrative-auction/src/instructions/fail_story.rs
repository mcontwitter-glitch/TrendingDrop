use anchor_lang::prelude::*;

use crate::errors::NarrativeError;
use crate::events::StoryFailed;
use crate::state::{MarketPhase, NarrativeConfig, StoryMarket};

#[derive(Accounts)]
pub struct FailStory<'info> {
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

/// Permissionless: mark story Failed when auction ended **below** graduation threshold.
/// Stakers reclaim principal via `resolve_stakes` + `claim_stake`.
///
/// If threshold is met but the story did not take a top rank, use `forfeit_story`
/// instead so stakes can feed winner pools (20/80).
pub fn fail_story_handler(ctx: Context<FailStory>) -> Result<()> {
    let clock = &ctx.accounts.clock;
    let story = &mut ctx.accounts.story;

    require!(
        clock.unix_timestamp > story.ends_at,
        NarrativeError::AuctionNotEnded
    );
    require!(
        story.total_staked < story.graduation_threshold,
        NarrativeError::ThresholdMet
    );

    story.phase = MarketPhase::Failed;

    emit!(StoryFailed {
        story: story.key(),
        total_staked: story.total_staked,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
