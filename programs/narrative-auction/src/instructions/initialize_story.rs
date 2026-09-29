use anchor_lang::prelude::*;

use crate::errors::NarrativeError;
use crate::events::StoryInitialized;
use crate::state::{MarketPhase, NarrativeConfig, StoryMarket};

/// Default graduation threshold: 10 SOL.
pub const DEFAULT_GRADUATION_THRESHOLD: u64 = 10_000_000_000;

#[derive(Accounts)]
#[instruction(content_hash: [u8; 32], duration: i64)]
pub struct InitializeStory<'info> {
    #[account(
        seeds = [NarrativeConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, NarrativeConfig>,

    #[account(
        init,
        payer = creator,
        space = 8 + StoryMarket::INIT_SPACE,
        seeds = [StoryMarket::SEED, creator.key().as_ref(), content_hash.as_ref()],
        bump
    )]
    pub story: Account<'info, StoryMarket>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_story_handler(
    ctx: Context<InitializeStory>,
    content_hash: [u8; 32],
    duration: i64,
    graduation_threshold: Option<u64>,
) -> Result<()> {
    require!(
        content_hash != [0u8; 32],
        NarrativeError::InvalidContentHash
    );

    let config = &ctx.accounts.config;
    // Allow 60s .. graduation_window (default 48h). Short floor enables Devnet smoke.
    require!(
        duration >= 60 && duration <= config.graduation_window,
        NarrativeError::InvalidDuration
    );

    let clock = Clock::get()?;
    let story = &mut ctx.accounts.story;
    story.creator = ctx.accounts.creator.key();
    story.content_hash = content_hash;
    story.phase = MarketPhase::Active;
    story.total_staked = 0;
    story.unique_stakers = 0;
    story.created_at = clock.unix_timestamp;
    story.ends_at = clock
        .unix_timestamp
        .checked_add(duration)
        .ok_or(NarrativeError::MathOverflow)?;
    story.graduation_threshold =
        graduation_threshold.unwrap_or(DEFAULT_GRADUATION_THRESHOLD);
    story.winning_pool = 0;
    story.rank = 0;
    story.liquidity_reserve = 0;
    story.winner_bonus_pool = 0;
    story.contributed_out = 0;
    story.claimed_total = 0;
    story.bump = ctx.bumps.story;

    emit!(StoryInitialized {
        story: story.key(),
        creator: story.creator,
        content_hash,
        ends_at: story.ends_at,
        graduation_threshold: story.graduation_threshold,
    });

    Ok(())
}
