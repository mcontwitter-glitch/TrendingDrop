use anchor_lang::prelude::*;

use crate::errors::NarrativeError;
use crate::events::StakesResolved;
use crate::state::{MarketPhase, NarrativeConfig, StakePosition, StoryMarket};

#[derive(Accounts)]
pub struct ResolveStakes<'info> {
    #[account(
        seeds = [NarrativeConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, NarrativeConfig>,

    #[account(
        mut,
        seeds = [StoryMarket::SEED, story.creator.as_ref(), story.content_hash.as_ref()],
        bump = story.bump,
        constraint = story.phase == MarketPhase::Graduated
            || story.phase == MarketPhase::Failed
            || story.phase == MarketPhase::Forfeited
            @ NarrativeError::NotActive,
    )]
    pub story: Account<'info, StoryMarket>,

    /// The stake being marked claimable in this crank call.
    #[account(
        mut,
        seeds = [StakePosition::SEED, story.key().as_ref(), stake_position.staker.as_ref()],
        bump = stake_position.bump,
        constraint = stake_position.story == story.key() @ NarrativeError::Unauthorized,
        constraint = !stake_position.claimed @ NarrativeError::AlreadyClaimed,
        constraint = !stake_position.resolved @ NarrativeError::StakeAlreadyResolved,
    )]
    pub stake_position: Account<'info, StakePosition>,
}

/// Mark a single StakePosition claimable after Graduated / Failed / Forfeited.
///
/// Redistribution math (per-position crank):
///
/// **Graduated (winner narrative):**
/// - Staker keeps 100% of their net principal (`amount`)
/// - Plus pro-rata share of `winner_bonus_pool` (20% of losing stakes):
///     bonus = winner_bonus_pool * position.amount / story.total_staked
/// - 80% (`liquidity_reserve`) stays locked for VelocityCurve initial liquidity
///
/// **Failed (below threshold):**
/// - Staker reclaim = 100% of net principal (`amount`)
///
/// **Forfeited (lost ranking; stakes feed winners):**
/// - claimable = 0 (SOL already / will be moved via `contribute_losing_pool`)
///
/// Full multi-account loops exceed CU limits; crank once per StakePosition.
pub fn resolve_stakes_handler(ctx: Context<ResolveStakes>) -> Result<()> {
    let story = &ctx.accounts.story;
    let position = &mut ctx.accounts.stake_position;

    let claimable = match story.phase {
        MarketPhase::Graduated => {
            position.is_winner = true;
            position.accuracy_score = 10_000;

            let bonus = if story.total_staked > 0 && story.winner_bonus_pool > 0 {
                (story.winner_bonus_pool as u128)
                    .checked_mul(position.amount as u128)
                    .ok_or(NarrativeError::MathOverflow)?
                    .checked_div(story.total_staked as u128)
                    .ok_or(NarrativeError::MathOverflow)? as u64
            } else {
                0
            };

            position
                .amount
                .checked_add(bonus)
                .ok_or(NarrativeError::MathOverflow)?
        }
        MarketPhase::Failed => {
            position.is_winner = false;
            position.accuracy_score = 0;
            position.amount
        }
        MarketPhase::Forfeited => {
            position.is_winner = false;
            position.accuracy_score = 0;
            // Principal feeds winner pools via contribute_losing_pool — nothing to claim.
            0
        }
        _ => return err!(NarrativeError::NotActive),
    };

    position.claimable = claimable;
    position.resolved = true;

    let phase_u8 = match story.phase {
        MarketPhase::Draft => 0,
        MarketPhase::Active => 1,
        MarketPhase::Graduated => 2,
        MarketPhase::Failed => 3,
        MarketPhase::Forfeited => 4,
    };

    emit!(StakesResolved {
        story: story.key(),
        staker: position.staker,
        phase: phase_u8,
        claimable,
        is_winner: position.is_winner,
        winner_bonus_pool: story.winner_bonus_pool,
        liquidity_reserve: story.liquidity_reserve,
    });

    Ok(())
}
