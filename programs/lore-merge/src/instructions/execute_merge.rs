use anchor_lang::prelude::*;

use crate::errors::LoreError;
use crate::events::MergeExecuted;
use crate::math::{apply_lore_power, bps_of, merge_split};
use crate::state::{LoreAsset, MergeConfig, MergeProposal, MAX_ABSORPTION_HISTORY};
use crate::velocity_read::read_velocity_token;

#[derive(Accounts)]
pub struct ExecuteMerge<'info> {
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

    /// Absorber lore — gains history entry + lore_power bump.
    #[account(
        mut,
        seeds = [LoreAsset::SEED, proposal.absorber.as_ref()],
        bump = absorber_lore.bump,
        constraint = absorber_lore.origin_curve == proposal.absorber @ LoreError::LoreMismatch,
        constraint = !absorber_lore.is_absorbed @ LoreError::AbsorberInactive,
    )]
    pub absorber_lore: Account<'info, LoreAsset>,

    /// Target lore — transfers current_holder to absorber.
    #[account(
        mut,
        seeds = [LoreAsset::SEED, proposal.target.as_ref()],
        bump = target_lore.bump,
        constraint = target_lore.origin_curve == proposal.target @ LoreError::LoreMismatch,
        constraint = !target_lore.is_absorbed @ LoreError::TargetAlreadyAbsorbed,
    )]
    pub target_lore: Account<'info, LoreAsset>,

    /// CHECK: Absorber VelocityToken (read merge_count / sol_reserve context).
    pub absorber_curve: UncheckedAccount<'info>,

    /// CHECK: Target VelocityToken (read sol_reserve for fee / liquidity split).
    pub target_curve: UncheckedAccount<'info>,

    /// CHECK: Treasury — fee accounting destination (SOL settle deferred).
    #[account(
        mut,
        constraint = treasury.key() == config.treasury @ LoreError::Unauthorized,
    )]
    pub treasury: UncheckedAccount<'info>,

    #[account(mut)]
    pub executor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Execute absorption after quorum + voting window.
///
/// On-chain effects in this program:
/// - Mark proposal executed; record 5% fee + 90% liquidity amounts
/// - Transfer target LoreAsset → absorber (`current_holder`, `is_absorbed`)
/// - Push target origin into absorber `absorption_history` (cap 10)
/// - Bump absorber `lore_power`
///
/// Deferred (needs VelocityCurve CPI / vault signer):
/// - Move 90% target vault SOL → absorber vault
/// - Move 5% fee SOL → treasury
/// - Set target `VelocityToken.is_merged` / bump absorber `merge_count`
/// - SPL burn-and-mint at `absorption_ratio` (30-day claim window)
pub fn execute_merge_handler(ctx: Context<ExecuteMerge>) -> Result<()> {
    let clock = Clock::get()?;
    let proposal = &ctx.accounts.proposal;

    require!(
        clock.unix_timestamp >= proposal.voting_ends,
        LoreError::VotingActive
    );
    require!(
        proposal.yes_votes >= proposal.quorum_required,
        LoreError::QuorumNotMet
    );
    require!(
        proposal.yes_votes > proposal.no_votes,
        LoreError::ProposalRejected
    );

    require_keys_eq!(
        ctx.accounts.absorber_curve.key(),
        proposal.absorber,
        LoreError::LoreMismatch
    );
    require_keys_eq!(
        ctx.accounts.target_curve.key(),
        proposal.target,
        LoreError::LoreMismatch
    );

    let config = &ctx.accounts.config;
    let _absorber = read_velocity_token(
        &ctx.accounts.absorber_curve.to_account_info(),
        &config.velocity_curve_program,
    )?;
    let target = read_velocity_token(
        &ctx.accounts.target_curve.to_account_info(),
        &config.velocity_curve_program,
    )?;
    require!(!target.is_merged, LoreError::CurveMerged);

    // Prefer live sol_reserve; fall back to seed_liquidity for empty curves.
    let reserve = target.sol_reserve.max(target.seed_liquidity);
    let (mut fee, liquidity) = merge_split(reserve)?;
    // Honor config.fee_bps if governance changed it from default 500.
    if config.fee_bps != crate::state::MERGE_FEE_BPS {
        fee = bps_of(reserve, config.fee_bps)?;
    }

    // --- Mutate lore assets ---
    let target_key = ctx.accounts.proposal.target;
    let absorber_key = ctx.accounts.proposal.absorber;
    let target_lore_value = ctx.accounts.target_lore.lore_value;
    let absorption_ratio = ctx.accounts.proposal.absorption_ratio;

    {
        let absorber_lore = &mut ctx.accounts.absorber_lore;
        require!(
            absorber_lore.absorption_history.len() < MAX_ABSORPTION_HISTORY,
            LoreError::HistoryFull
        );
        absorber_lore.absorption_history.push(target_key);
        absorber_lore.lore_power = apply_lore_power(absorber_lore.lore_power, target_lore_value)?;
        absorber_lore.lore_value = absorber_lore
            .lore_value
            .checked_add(target_lore_value)
            .ok_or(LoreError::MathOverflow)?;
    }

    {
        let target_lore = &mut ctx.accounts.target_lore;
        target_lore.current_holder = absorber_key;
        target_lore.is_absorbed = true;
        // Record absorber in target history for provenance (if room).
        if target_lore.absorption_history.len() < MAX_ABSORPTION_HISTORY {
            target_lore.absorption_history.push(absorber_key);
        }
    }

    let history_len = ctx.accounts.absorber_lore.absorption_history.len() as u8;
    let new_power = ctx.accounts.absorber_lore.lore_power;

    let proposal = &mut ctx.accounts.proposal;
    proposal.executed = true;
    proposal.target_liquidity_snapshot = reserve;
    proposal.fee_lamports = fee;
    proposal.liquidity_lamports = liquidity;
    proposal.settlement_pending = reserve > 0;

    emit!(MergeExecuted {
        proposal: proposal.key(),
        absorber: absorber_key,
        target: target_key,
        lore_asset: ctx.accounts.target_lore.key(),
        absorber_lore_power: new_power,
        fee_lamports: fee,
        liquidity_lamports: liquidity,
        absorption_ratio,
        history_len,
        settlement_pending: proposal.settlement_pending,
        timestamp: clock.unix_timestamp,
    });

    let _ = &ctx.accounts.treasury;
    let _ = &ctx.accounts.executor;
    let _ = &ctx.accounts.system_program;

    Ok(())
}
