use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::errors::NarrativeError;
use crate::events::NarrativeStaked;
use crate::state::{MarketPhase, NarrativeConfig, StakePosition, StoryMarket};

#[derive(Accounts)]
pub struct StakeOnNarrative<'info> {
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

    /// Story SOL vault PDA.
    #[account(
        mut,
        seeds = [StoryMarket::VAULT_SEED, story.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA vault holding staked SOL.
    pub vault: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = staker,
        space = 8 + StakePosition::INIT_SPACE,
        seeds = [StakePosition::SEED, story.key().as_ref(), staker.key().as_ref()],
        bump
    )]
    pub stake_position: Account<'info, StakePosition>,

    /// CHECK: Must match config.treasury.
    #[account(
        mut,
        constraint = treasury.key() == config.treasury @ NarrativeError::Unauthorized,
    )]
    pub treasury: UncheckedAccount<'info>,

    #[account(mut)]
    pub staker: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Stake SOL on an Active narrative before `ends_at`.
///
/// Business rules:
/// - Staking only while Active and before ends_at
/// - Fee `fee_bps` (default 2%) transferred to treasury
/// - Net amount credited to story.total_staked and vault
/// - Cannot top-up a position that was already resolved/claimed
pub fn stake_on_narrative_handler(ctx: Context<StakeOnNarrative>, amount: u64) -> Result<()> {
    let config = &ctx.accounts.config;
    let clock = Clock::get()?;

    require!(
        clock.unix_timestamp < ctx.accounts.story.ends_at,
        NarrativeError::AuctionEnded
    );
    require!(amount >= config.min_stake, NarrativeError::StakeTooSmall);

    let position = &ctx.accounts.stake_position;
    // Reject top-ups on resolved/claimed positions (lifecycle complete).
    require!(!position.resolved, NarrativeError::StakeAlreadyResolved);
    require!(!position.claimed, NarrativeError::AlreadyClaimed);

    // fee = amount * fee_bps / 10_000  (checked; rounds down — house keeps floor)
    let fee = amount
        .checked_mul(config.fee_bps as u64)
        .ok_or(NarrativeError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(NarrativeError::MathOverflow)?;
    let net = amount
        .checked_sub(fee)
        .ok_or(NarrativeError::MathOverflow)?;
    require!(net > 0, NarrativeError::StakeTooSmall);

    // Transfer fee → treasury
    if fee > 0 {
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.staker.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            fee,
        )?;
    }

    // Ensure vault PDA exists, then transfer net → vault
    let story_key = ctx.accounts.story.key();
    let vault_bump = ctx.bumps.vault;
    ensure_vault(
        &ctx.accounts.vault,
        &ctx.accounts.staker,
        &ctx.accounts.system_program,
        &story_key,
        vault_bump,
    )?;

    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.staker.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        net,
    )?;

    let story = &mut ctx.accounts.story;
    let position = &mut ctx.accounts.stake_position;
    let is_new = position.amount == 0 && position.staker == Pubkey::default();

    if is_new || position.staker == Pubkey::default() {
        position.staker = ctx.accounts.staker.key();
        position.story = story_key;
        position.locked_at = clock.unix_timestamp;
        position.claimed = false;
        position.resolved = false;
        position.accuracy_score = 0;
        position.claimable = 0;
        position.is_winner = false;
        position.bump = ctx.bumps.stake_position;
        story.unique_stakers = story
            .unique_stakers
            .checked_add(1)
            .ok_or(NarrativeError::MathOverflow)?;
    }

    position.amount = position
        .amount
        .checked_add(net)
        .ok_or(NarrativeError::MathOverflow)?;

    story.total_staked = story
        .total_staked
        .checked_add(net)
        .ok_or(NarrativeError::MathOverflow)?;

    emit!(NarrativeStaked {
        story: story_key,
        staker: ctx.accounts.staker.key(),
        gross_amount: amount,
        fee,
        net_amount: net,
        total_staked: story.total_staked,
    });

    Ok(())
}

/// Create the vault PDA as a 0-data System account if it does not exist yet.
fn ensure_vault<'info>(
    vault: &SystemAccount<'info>,
    payer: &Signer<'info>,
    system_program: &Program<'info, System>,
    story_key: &Pubkey,
    vault_bump: u8,
) -> Result<()> {
    if vault.lamports() > 0 || !vault.data_is_empty() {
        return Ok(());
    }

    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(0);
    let seeds: &[&[u8]] = &[
        StoryMarket::VAULT_SEED,
        story_key.as_ref(),
        &[vault_bump],
    ];

    anchor_lang::system_program::create_account(
        CpiContext::new_with_signer(
            system_program.to_account_info(),
            anchor_lang::system_program::CreateAccount {
                from: payer.to_account_info(),
                to: vault.to_account_info(),
            },
            &[seeds],
        ),
        lamports,
        0,
        &anchor_lang::system_program::ID,
    )?;

    Ok(())
}
