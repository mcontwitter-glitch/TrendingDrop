use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::errors::NarrativeError;
use crate::events::StakeClaimed;
use crate::state::{MarketPhase, NarrativeConfig, StakePosition, StoryMarket};

#[derive(Accounts)]
pub struct ClaimStake<'info> {
    #[account(
        seeds = [NarrativeConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, NarrativeConfig>,

    #[account(
        mut,
        seeds = [StoryMarket::SEED, story.creator.as_ref(), story.content_hash.as_ref()],
        bump = story.bump,
        constraint = story.phase == MarketPhase::Graduated || story.phase == MarketPhase::Failed
            @ NarrativeError::NotActive,
    )]
    pub story: Account<'info, StoryMarket>,

    #[account(
        mut,
        seeds = [StoryMarket::VAULT_SEED, story.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA vault funding the claim.
    pub vault: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [StakePosition::SEED, story.key().as_ref(), staker.key().as_ref()],
        bump = stake_position.bump,
        has_one = staker @ NarrativeError::Unauthorized,
        constraint = stake_position.story == story.key() @ NarrativeError::Unauthorized,
        constraint = stake_position.resolved @ NarrativeError::NothingToClaim,
        constraint = !stake_position.claimed @ NarrativeError::AlreadyClaimed,
        constraint = stake_position.claimable > 0 @ NarrativeError::NothingToClaim,
    )]
    pub stake_position: Account<'info, StakePosition>,

    #[account(mut)]
    pub staker: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Transfer `claimable` lamports from the story vault to the staker.
///
/// Vault safety:
/// - Always leave rent-exempt minimum
/// - On Graduated stories, also leave `liquidity_reserve` untouched for VelocityCurve
pub fn claim_stake_handler(ctx: Context<ClaimStake>) -> Result<()> {
    let amount = ctx.accounts.stake_position.claimable;
    let story_key = ctx.accounts.story.key();
    let bump = ctx.bumps.vault;

    let rent = Rent::get()?;
    let rent_min = rent.minimum_balance(0);
    let reserved = if ctx.accounts.story.phase == MarketPhase::Graduated {
        ctx.accounts
            .story
            .liquidity_reserve
            .checked_add(rent_min)
            .ok_or(NarrativeError::MathOverflow)?
    } else {
        rent_min
    };

    let vault_lamports = ctx.accounts.vault.lamports();
    let available = vault_lamports.saturating_sub(reserved);
    require!(amount <= available, NarrativeError::InsufficientVault);

    let seeds: &[&[u8]] = &[StoryMarket::VAULT_SEED, story_key.as_ref(), &[bump]];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.staker.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )?;

    let position = &mut ctx.accounts.stake_position;
    position.claimed = true;
    position.claimable = 0;

    let story = &mut ctx.accounts.story;
    story.claimed_total = story
        .claimed_total
        .checked_add(amount)
        .ok_or(NarrativeError::MathOverflow)?;

    emit!(StakeClaimed {
        story: story_key,
        staker: ctx.accounts.staker.key(),
        amount,
        claimed_total: story.claimed_total,
    });

    Ok(())
}
