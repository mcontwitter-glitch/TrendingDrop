use anchor_lang::prelude::*;

use crate::errors::LoreError;
use crate::events::MergeVoteCast;
use crate::state::{MergeConfig, MergeProposal, VoteRecord};
use crate::velocity_read::{read_holder_position, verify_holder, voting_power};

#[derive(Accounts)]
pub struct VoteMerge<'info> {
    #[account(
        seeds = [MergeConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, MergeConfig>,

    #[account(
        mut,
        seeds = [MergeProposal::SEED, proposal.absorber.as_ref(), proposal.target.as_ref()],
        bump = proposal.bump,
        constraint = !proposal.executed @ LoreError::AlreadyExecuted,
    )]
    pub proposal: Account<'info, MergeProposal>,

    #[account(
        init,
        payer = voter,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [VoteRecord::SEED, proposal.key().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    /// CHECK: Voter HolderPosition on absorber curve (velocity-curve PDA).
    pub voter_holder: UncheckedAccount<'info>,

    #[account(mut)]
    pub voter: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Vote with holder balance (+ lore_power bonus). One vote per wallet per proposal.
pub fn vote_merge_handler(ctx: Context<VoteMerge>, amount: u64, support: bool) -> Result<()> {
    require!(amount > 0, LoreError::ZeroAmount);

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp < ctx.accounts.proposal.voting_ends,
        LoreError::VotingEnded
    );

    let holder = read_holder_position(
        &ctx.accounts.voter_holder.to_account_info(),
        &ctx.accounts.config.velocity_curve_program,
    )?;
    verify_holder(
        &holder,
        &ctx.accounts.voter.key(),
        &ctx.accounts.proposal.absorber,
    )?;

    let power = voting_power(&holder)?;
    require!(amount <= power, LoreError::InsufficientVotingPower);

    let proposal = &mut ctx.accounts.proposal;
    if support {
        proposal.yes_votes = proposal
            .yes_votes
            .checked_add(amount)
            .ok_or(LoreError::MathOverflow)?;
    } else {
        proposal.no_votes = proposal
            .no_votes
            .checked_add(amount)
            .ok_or(LoreError::MathOverflow)?;
    }

    let record = &mut ctx.accounts.vote_record;
    record.proposal = proposal.key();
    record.voter = ctx.accounts.voter.key();
    record.amount = amount;
    record.support = support;
    record.voted_at = clock.unix_timestamp;
    record.bump = ctx.bumps.vote_record;

    emit!(MergeVoteCast {
        proposal: proposal.key(),
        voter: ctx.accounts.voter.key(),
        amount,
        support,
        yes_votes: proposal.yes_votes,
        no_votes: proposal.no_votes,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
