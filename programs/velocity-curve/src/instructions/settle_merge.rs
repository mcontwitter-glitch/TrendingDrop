use anchor_lang::prelude::*;
use anchor_lang::system_program::{create_account, transfer, CreateAccount, Transfer};

use crate::errors::VelocityError;
use crate::events::MergeSettled;
use crate::state::VelocityToken;

/// Settle LoreMerge liquidity + mark target merged.
///
/// Called via CPI from LoreMerge::execute_merge (also permissionless with the
/// recorded fee/liquidity amounts once lore has voted).
///
/// Effects:
/// - Move `fee_lamports` SOL from target vault → treasury
/// - Move `liquidity_lamports` SOL from target vault → absorber vault
/// - Debit target `real_sol`; credit absorber `real_sol`
/// - Set target `is_merged = true`; bump absorber `merge_count`
#[derive(Accounts)]
pub struct SettleMerge<'info> {
    #[account(
        mut,
        seeds = [VelocityToken::SEED, target_curve.story_id.as_ref()],
        bump = target_curve.bump,
        constraint = !target_curve.is_merged @ VelocityError::TradingPaused,
    )]
    pub target_curve: Account<'info, VelocityToken>,

    #[account(
        mut,
        seeds = [VelocityToken::SEED, absorber_curve.story_id.as_ref()],
        bump = absorber_curve.bump,
        constraint = !absorber_curve.is_merged @ VelocityError::TradingPaused,
        constraint = absorber_curve.key() != target_curve.key() @ VelocityError::InvalidParams,
    )]
    pub absorber_curve: Account<'info, VelocityToken>,

    /// CHECK: Target curve SOL vault.
    #[account(
        mut,
        seeds = [VelocityToken::VAULT_SEED, target_curve.key().as_ref()],
        bump = target_curve.vault_bump,
    )]
    pub target_vault: SystemAccount<'info>,

    /// CHECK: Absorber curve SOL vault (created if empty).
    #[account(
        mut,
        seeds = [VelocityToken::VAULT_SEED, absorber_curve.key().as_ref()],
        bump = absorber_curve.vault_bump,
    )]
    pub absorber_vault: SystemAccount<'info>,

    /// CHECK: Protocol treasury receiving the merge fee.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    /// Pays rent if absorber vault must be created.
    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn settle_merge_handler(
    ctx: Context<SettleMerge>,
    fee_lamports: u64,
    liquidity_lamports: u64,
) -> Result<()> {
    let total = fee_lamports
        .checked_add(liquidity_lamports)
        .ok_or(VelocityError::MathOverflow)?;
    require!(total > 0, VelocityError::ZeroAmount);

    let target_key = ctx.accounts.target_curve.key();
    let absorber_key = ctx.accounts.absorber_curve.key();
    let target_vault_bump = ctx.accounts.target_curve.vault_bump;
    let absorber_vault_bump = ctx.accounts.absorber_curve.vault_bump;

    require!(
        ctx.accounts.target_curve.real_sol >= total,
        VelocityError::InsufficientVault
    );

    let rent_min = Rent::get()?.minimum_balance(0);
    let available = ctx
        .accounts
        .target_vault
        .lamports()
        .saturating_sub(rent_min);
    require!(total <= available, VelocityError::InsufficientVault);

    ensure_curve_vault(
        &ctx.accounts.absorber_vault,
        &ctx.accounts.payer,
        &ctx.accounts.system_program,
        &absorber_key,
        absorber_vault_bump,
    )?;

    let seeds: &[&[u8]] = &[
        VelocityToken::VAULT_SEED,
        target_key.as_ref(),
        &[target_vault_bump],
    ];

    if fee_lamports > 0 {
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.target_vault.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
                &[seeds],
            ),
            fee_lamports,
        )?;
    }
    if liquidity_lamports > 0 {
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.target_vault.to_account_info(),
                    to: ctx.accounts.absorber_vault.to_account_info(),
                },
                &[seeds],
            ),
            liquidity_lamports,
        )?;
    }

    let clock = Clock::get()?;
    let target = &mut ctx.accounts.target_curve;
    target.real_sol = target
        .real_sol
        .checked_sub(total)
        .ok_or(VelocityError::MathOverflow)?;
    target.is_merged = true;

    let absorber = &mut ctx.accounts.absorber_curve;
    absorber.real_sol = absorber
        .real_sol
        .checked_add(liquidity_lamports)
        .ok_or(VelocityError::MathOverflow)?;
    absorber.merge_count = absorber.merge_count.saturating_add(1);

    emit!(MergeSettled {
        target: target_key,
        absorber: absorber_key,
        fee_lamports,
        liquidity_lamports,
        absorber_merge_count: absorber.merge_count,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

fn ensure_curve_vault<'info>(
    vault: &SystemAccount<'info>,
    payer: &Signer<'info>,
    system_program: &Program<'info, System>,
    curve_key: &Pubkey,
    vault_bump: u8,
) -> Result<()> {
    if vault.lamports() > 0 || !vault.data_is_empty() {
        return Ok(());
    }
    let lamports = Rent::get()?.minimum_balance(0);
    let seeds: &[&[u8]] = &[
        VelocityToken::VAULT_SEED,
        curve_key.as_ref(),
        &[vault_bump],
    ];
    create_account(
        CpiContext::new_with_signer(
            system_program.to_account_info(),
            CreateAccount {
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
