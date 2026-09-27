use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;

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

    /// CHECK: Absorber VelocityToken (mut for merge_count / sol_reserve via settle CPI).
    #[account(mut)]
    pub absorber_curve: UncheckedAccount<'info>,

    /// CHECK: Target VelocityToken (mut for is_merged / sol_reserve via settle CPI).
    #[account(mut)]
    pub target_curve: UncheckedAccount<'info>,

    /// CHECK: Target curve SOL vault PDA.
    #[account(mut)]
    pub target_vault: UncheckedAccount<'info>,

    /// CHECK: Absorber curve SOL vault PDA.
    #[account(mut)]
    pub absorber_vault: UncheckedAccount<'info>,

    /// CHECK: VelocityCurve program — must match config.
    #[account(
        constraint = velocity_program.key() == config.velocity_curve_program @ LoreError::CurveProgramMismatch,
    )]
    pub velocity_program: UncheckedAccount<'info>,

    /// CHECK: Treasury — fee destination (SOL settle via VelocityCurve CPI).
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
/// On-chain effects:
/// - Mark proposal executed; record 5% fee + 90% liquidity amounts
/// - Transfer target LoreAsset → absorber (`current_holder`, `is_absorbed`)
/// - Push target origin into absorber `absorption_history` (cap 10)
/// - Bump absorber `lore_power`
/// - CPI VelocityCurve::settle_merge — move vault SOL, set `is_merged`, bump `merge_count`
/// - Clear `settlement_pending` when settle succeeds (or when reserve was 0)
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

    // Prefer live sol_reserve (seeded on graduate + updated by buy/sell).
    // Fall back to seed_liquidity only if reserve accounting is still zero.
    let reserve = if target.sol_reserve > 0 {
        target.sol_reserve
    } else {
        target.seed_liquidity
    };
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
    proposal.settlement_pending = reserve > 0 && (fee > 0 || liquidity > 0);

    // --- CPI VelocityCurve::settle_merge when there is SOL to move ---
    if proposal.settlement_pending {
        let ix = build_settle_merge_ix(
            ctx.accounts.velocity_program.key(),
            ctx.accounts.target_curve.key(),
            ctx.accounts.absorber_curve.key(),
            ctx.accounts.target_vault.key(),
            ctx.accounts.absorber_vault.key(),
            ctx.accounts.treasury.key(),
            ctx.accounts.executor.key(),
            fee,
            liquidity,
        );
        invoke(
            &ix,
            &[
                ctx.accounts.target_curve.to_account_info(),
                ctx.accounts.absorber_curve.to_account_info(),
                ctx.accounts.target_vault.to_account_info(),
                ctx.accounts.absorber_vault.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.executor.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        proposal.settlement_pending = false;
    }

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

    Ok(())
}

fn build_settle_merge_ix(
    velocity_program: Pubkey,
    target_curve: Pubkey,
    absorber_curve: Pubkey,
    target_vault: Pubkey,
    absorber_vault: Pubkey,
    treasury: Pubkey,
    payer: Pubkey,
    fee_lamports: u64,
    liquidity_lamports: u64,
) -> Instruction {
    let mut disc = [0u8; 8];
    let h = hash(b"global:settle_merge");
    disc.copy_from_slice(&h.to_bytes()[..8]);

    let mut data = Vec::with_capacity(8 + 8 + 8);
    data.extend_from_slice(&disc);
    data.extend_from_slice(&fee_lamports.to_le_bytes());
    data.extend_from_slice(&liquidity_lamports.to_le_bytes());

    Instruction {
        program_id: velocity_program,
        accounts: vec![
            AccountMeta::new(target_curve, false),
            AccountMeta::new(absorber_curve, false),
            AccountMeta::new(target_vault, false),
            AccountMeta::new(absorber_vault, false),
            AccountMeta::new(treasury, false),
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(anchor_lang::system_program::ID, false),
        ],
        data,
    }
}
