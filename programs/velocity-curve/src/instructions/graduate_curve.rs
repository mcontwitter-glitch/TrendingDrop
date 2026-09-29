use anchor_lang::prelude::*;

use crate::errors::VelocityError;
use crate::events::CurveGraduated;
use crate::state::{VelocityToken, GRADUATE_REAL_SOL};

/// Permissionless: mark bonding curve complete once real SOL ≥ threshold.
/// Raydium CPMM migration is a future stub — vault SOL/tokens stay accounted
/// on-chain until a migrate ix ships.
#[derive(Accounts)]
pub struct GraduateCurve<'info> {
    #[account(
        mut,
        seeds = [VelocityToken::SEED, curve.story_id.as_ref()],
        bump = curve.bump,
        constraint = !curve.complete @ VelocityError::CurveComplete,
        constraint = !curve.is_merged @ VelocityError::TradingPaused,
    )]
    pub curve: Account<'info, VelocityToken>,

    /// CHECK: Curve SOL vault — must hold at least real_sol (accounting check).
    #[account(
        seeds = [VelocityToken::VAULT_SEED, curve.key().as_ref()],
        bump = curve.vault_bump,
    )]
    pub vault: SystemAccount<'info>,
}

pub fn graduate_curve_handler(ctx: Context<GraduateCurve>) -> Result<()> {
    let curve = &mut ctx.accounts.curve;
    require!(
        curve.real_sol >= GRADUATE_REAL_SOL,
        VelocityError::GraduationThresholdNotMet
    );

    // Soft vault check: lamports should cover real_sol (+ rent exempt for empty PDA).
    let rent_min = Rent::get()?.minimum_balance(0);
    require!(
        ctx.accounts.vault.lamports() >= curve.real_sol.saturating_add(rent_min),
        VelocityError::InsufficientVault
    );

    curve.complete = true;

    msg!(
        "Curve graduated (complete) real_sol={} virtual_sol={} virtual_token={} real_token={} — Raydium migrate stub",
        curve.real_sol,
        curve.virtual_sol,
        curve.virtual_token,
        curve.real_token
    );

    emit!(CurveGraduated {
        curve: curve.key(),
        mint: curve.mint,
        story_id: curve.story_id,
        real_sol: curve.real_sol,
        virtual_sol: curve.virtual_sol,
        virtual_token: curve.virtual_token,
        real_token: curve.real_token,
        current_price: curve.current_price,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
