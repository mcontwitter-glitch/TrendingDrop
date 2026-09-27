use anchor_lang::prelude::*;

use crate::errors::LoreError;
use crate::events::MergeProposed;
use crate::math::{min_proposer_balance, quorum_from_supply};
use crate::state::{LoreAsset, MergeConfig, MergeProposal};
use crate::velocity_read::{read_holder_position, read_velocity_token, verify_holder};

#[derive(Accounts)]
pub struct ProposeMerge<'info> {
    #[account(
        seeds = [MergeConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, MergeConfig>,

    #[account(
        init,
        payer = proposer,
        space = 8 + MergeProposal::INIT_SPACE,
        seeds = [MergeProposal::SEED, absorber.key().as_ref(), target.key().as_ref()],
        bump
    )]
    pub proposal: Account<'info, MergeProposal>,

    /// CHECK: Absorber VelocityToken curve PDA.
    pub absorber: UncheckedAccount<'info>,

    /// CHECK: Target VelocityToken curve PDA.
    pub target: UncheckedAccount<'info>,

    #[account(
        seeds = [LoreAsset::SEED, absorber.key().as_ref()],
        bump = absorber_lore.bump,
        constraint = absorber_lore.origin_curve == absorber.key() @ LoreError::LoreMismatch,
        constraint = !absorber_lore.is_absorbed @ LoreError::AbsorberInactive,
    )]
    pub absorber_lore: Account<'info, LoreAsset>,

    #[account(
        seeds = [LoreAsset::SEED, target.key().as_ref()],
        bump = target_lore.bump,
        constraint = target_lore.origin_curve == target.key() @ LoreError::LoreMismatch,
        constraint = !target_lore.is_absorbed @ LoreError::TargetAlreadyAbsorbed,
    )]
    pub target_lore: Account<'info, LoreAsset>,

    /// CHECK: Proposer HolderPosition on absorber (velocity-curve PDA).
    pub proposer_holder: UncheckedAccount<'info>,

    #[account(mut)]
    pub proposer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Create merge proposal. Requires holding >1% of absorber supply.
pub fn propose_merge_handler(
    ctx: Context<ProposeMerge>,
    _target_token: Pubkey,
    absorption_ratio: u16,
) -> Result<()> {
    require!(absorption_ratio > 0, LoreError::ZeroAmount);
    require!(
        ctx.accounts.absorber.key() != ctx.accounts.target.key(),
        LoreError::SameToken
    );
    // Arg must match accounts.target (PDF: propose_merge(target_token)).
    require_keys_eq!(
        _target_token,
        ctx.accounts.target.key(),
        LoreError::LoreMismatch
    );

    let config = &ctx.accounts.config;
    let clock = Clock::get()?;

    require!(
        clock.unix_timestamp
            >= ctx
                .accounts
                .absorber_lore
                .registered_at
                .saturating_add(config.merge_min_age_secs),
        LoreError::AbsorberTooYoung
    );

    let absorber_curve = read_velocity_token(
        &ctx.accounts.absorber.to_account_info(),
        &config.velocity_curve_program,
    )?;
    require!(!absorber_curve.is_merged, LoreError::CurveMerged);

    let target_curve = read_velocity_token(
        &ctx.accounts.target.to_account_info(),
        &config.velocity_curve_program,
    )?;
    require!(!target_curve.is_merged, LoreError::CurveMerged);

    let holder = read_holder_position(
        &ctx.accounts.proposer_holder.to_account_info(),
        &config.velocity_curve_program,
    )?;
    verify_holder(
        &holder,
        &ctx.accounts.proposer.key(),
        &ctx.accounts.absorber.key(),
    )?;

    let min_bal = min_proposer_balance(absorber_curve.current_supply, config.proposer_min_bps)?;
    require!(
        holder.balance >= min_bal,
        LoreError::InsufficientHoldings
    );

    let quorum = quorum_from_supply(absorber_curve.current_supply, config.quorum_bps)?;
    let voting_ends = clock
        .unix_timestamp
        .checked_add(config.voting_duration_secs)
        .ok_or(LoreError::MathOverflow)?;

    let proposal = &mut ctx.accounts.proposal;
    proposal.absorber = ctx.accounts.absorber.key();
    proposal.target = ctx.accounts.target.key();
    proposal.proposer = ctx.accounts.proposer.key();
    proposal.proposed_at = clock.unix_timestamp;
    proposal.voting_ends = voting_ends;
    proposal.yes_votes = 0;
    proposal.no_votes = 0;
    proposal.quorum_required = quorum;
    proposal.executed = false;
    proposal.absorption_ratio = absorption_ratio;
    proposal.target_liquidity_snapshot = 0;
    proposal.fee_lamports = 0;
    proposal.liquidity_lamports = 0;
    proposal.settlement_pending = false;
    proposal.bump = ctx.bumps.proposal;

    emit!(MergeProposed {
        proposal: proposal.key(),
        absorber: proposal.absorber,
        target: proposal.target,
        proposer: proposal.proposer,
        absorption_ratio,
        quorum_required: quorum,
        voting_ends,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
