use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::errors::NarrativeError;
use crate::events::LosingPoolContributed;
use crate::instructions::graduate_narrative::{LIQUIDITY_BPS, WINNER_BONUS_BPS};
use crate::state::{MarketPhase, NarrativeConfig, StoryMarket};

#[derive(Accounts)]
pub struct ContributeLosingPool<'info> {
    #[account(
        seeds = [NarrativeConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, NarrativeConfig>,

    /// Forfeited story whose vault SOL feeds the winner.
    #[account(
        mut,
        seeds = [StoryMarket::SEED, source_story.creator.as_ref(), source_story.content_hash.as_ref()],
        bump = source_story.bump,
        constraint = source_story.phase == MarketPhase::Forfeited @ NarrativeError::NotForfeited,
    )]
    pub source_story: Account<'info, StoryMarket>,

    #[account(
        mut,
        seeds = [StoryMarket::VAULT_SEED, source_story.key().as_ref()],
        bump,
    )]
    /// CHECK: Source vault PDA.
    pub source_vault: SystemAccount<'info>,

    /// Winner (or soon-to-graduate Active) narrative receiving the losing pool.
    #[account(
        mut,
        seeds = [StoryMarket::SEED, dest_story.creator.as_ref(), dest_story.content_hash.as_ref()],
        bump = dest_story.bump,
        constraint = dest_story.phase == MarketPhase::Active
            || dest_story.phase == MarketPhase::Graduated
            @ NarrativeError::InvalidContributeDest,
        constraint = dest_story.key() != source_story.key() @ NarrativeError::Unauthorized,
    )]
    pub dest_story: Account<'info, StoryMarket>,

    #[account(
        mut,
        seeds = [StoryMarket::VAULT_SEED, dest_story.key().as_ref()],
        bump,
    )]
    /// CHECK: Destination vault PDA.
    pub dest_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Move SOL from a Forfeited story vault into a winner's vault + `winning_pool`.
///
/// - If dest is still Active: only bumps `winning_pool` (graduate will 20/80 split).
/// - If dest is already Graduated: also bumps `winner_bonus_pool` / `liquidity_reserve`
///   by the 20/80 split of this contribution (late crank support).
///
/// `amount = None` contributes all lamports above rent-exempt minimum.
pub fn contribute_losing_pool_handler(
    ctx: Context<ContributeLosingPool>,
    amount: Option<u64>,
) -> Result<()> {
    let rent = Rent::get()?;
    let rent_min = rent.minimum_balance(0);
    let source_lamports = ctx.accounts.source_vault.lamports();
    let available = source_lamports.saturating_sub(rent_min);
    require!(available > 0, NarrativeError::InsufficientVault);

    let transfer_amount = match amount {
        Some(a) => {
            require!(a > 0 && a <= available, NarrativeError::InvalidContributeAmount);
            a
        }
        None => available,
    };

    let source_key = ctx.accounts.source_story.key();
    let source_bump = ctx.bumps.source_vault;
    let seeds: &[&[u8]] = &[
        StoryMarket::VAULT_SEED,
        source_key.as_ref(),
        &[source_bump],
    ];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.source_vault.to_account_info(),
                to: ctx.accounts.dest_vault.to_account_info(),
            },
            &[seeds],
        ),
        transfer_amount,
    )?;

    let source = &mut ctx.accounts.source_story;
    source.contributed_out = source
        .contributed_out
        .checked_add(transfer_amount)
        .ok_or(NarrativeError::MathOverflow)?;

    let dest = &mut ctx.accounts.dest_story;
    dest.winning_pool = dest
        .winning_pool
        .checked_add(transfer_amount)
        .ok_or(NarrativeError::MathOverflow)?;

    // Late contribution into an already-graduated winner: split immediately.
    if dest.phase == MarketPhase::Graduated {
        let bonus = transfer_amount
            .checked_mul(WINNER_BONUS_BPS)
            .ok_or(NarrativeError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(NarrativeError::MathOverflow)?;
        let liq = transfer_amount
            .checked_mul(LIQUIDITY_BPS)
            .ok_or(NarrativeError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(NarrativeError::MathOverflow)?;
        dest.winner_bonus_pool = dest
            .winner_bonus_pool
            .checked_add(bonus)
            .ok_or(NarrativeError::MathOverflow)?;
        dest.liquidity_reserve = dest
            .liquidity_reserve
            .checked_add(liq)
            .ok_or(NarrativeError::MathOverflow)?;
    }

    emit!(LosingPoolContributed {
        source_story: source_key,
        dest_story: dest.key(),
        amount: transfer_amount,
        dest_winning_pool: dest.winning_pool,
        dest_winner_bonus_pool: dest.winner_bonus_pool,
        dest_liquidity_reserve: dest.liquidity_reserve,
    });

    Ok(())
}
