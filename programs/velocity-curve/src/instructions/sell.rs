use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::errors::VelocityError;
use crate::events::TokensSold;
use crate::math::{
    accrue_holder_rewards, apply_bps, apply_sell, curve_fee, ema_update, settle_holder_rewards,
    sol_out_for_tokens, velocity_params,
};
use crate::state::{HolderPosition, VelocityToken, CURVE_FEE_BPS, DECIMALS_FACTOR, EMA_ALPHA_BPS};

#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(
        mut,
        seeds = [VelocityToken::SEED, curve.story_id.as_ref()],
        bump = curve.bump,
        constraint = !curve.is_merged @ VelocityError::TradingPaused,
        constraint = !curve.complete @ VelocityError::CurveComplete,
    )]
    pub curve: Box<Account<'info, VelocityToken>>,

    /// CHECK: Curve SOL vault PDA.
    #[account(
        mut,
        seeds = [VelocityToken::VAULT_SEED, curve.key().as_ref()],
        bump = curve.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    #[account(
        mut,
        address = curve.mint @ VelocityError::MintMismatch,
    )]
    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = seller_ata.mint == mint.key() @ VelocityError::MintMismatch,
        constraint = seller_ata.owner == seller.key() @ VelocityError::Unauthorized,
    )]
    pub seller_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [HolderPosition::SEED, curve.key().as_ref(), seller.key().as_ref()],
        bump = holder.bump,
        constraint = holder.owner == seller.key() @ VelocityError::Unauthorized,
    )]
    pub holder: Box<Account<'info, HolderPosition>>,

    /// CHECK: Receives 50% of sell tax + curve fee share.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

/// Sell tokens on the constant-product AMM with attention-dependent tax.
pub fn sell_handler(ctx: Context<Sell>, token_amount: u64, min_sol_out: u64) -> Result<()> {
    require!(token_amount > 0, VelocityError::ZeroAmount);
    let raw_amount = token_amount
        .checked_mul(DECIMALS_FACTOR)
        .ok_or(VelocityError::MathOverflow)?;
    require!(
        ctx.accounts.holder.balance >= token_amount,
        VelocityError::InsufficientBalance
    );
    require!(
        ctx.accounts.seller_ata.amount >= raw_amount,
        VelocityError::InsufficientBalance
    );

    let clock = Clock::get()?;
    let curve_key = ctx.accounts.curve.key();
    let seller_key = ctx.accounts.seller.key();
    let vault_bump = ctx.accounts.curve.vault_bump;

    let (_, sell_tax_bps) = velocity_params(
        ctx.accounts.curve.virtual_token,
        ctx.accounts.curve.attention_score,
        ctx.accounts.curve.price_velocity,
    )?;

    let sol_gross = sol_out_for_tokens(
        token_amount,
        ctx.accounts.curve.virtual_sol,
        ctx.accounts.curve.virtual_token,
    )?;

    let tax = apply_bps(sol_gross, sell_tax_bps)?;
    let after_tax = sol_gross
        .checked_sub(tax)
        .ok_or(VelocityError::MathOverflow)?;
    let (fee, sol_net) = curve_fee(after_tax, CURVE_FEE_BPS)?;
    require!(sol_net >= min_sol_out, VelocityError::SlippageExceeded);

    let mut holder_share = tax / 2;
    let treasury_tax = tax.saturating_sub(holder_share);
    let mut treasury_pay = treasury_tax
        .checked_add(fee)
        .ok_or(VelocityError::MathOverflow)?;

    {
        let idx = ctx.accounts.curve.reward_index;
        let holder = &mut ctx.accounts.holder;
        let (claimable, _) = settle_holder_rewards(
            holder.balance,
            holder.reward_debt,
            idx,
            holder.claimable_rewards,
        )?;
        holder.claimable_rewards = claimable;
    }

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.seller_ata.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        raw_amount,
    )?;

    let curve = &mut ctx.accounts.curve;
    let holder = &mut ctx.accounts.holder;

    holder.balance = holder
        .balance
        .checked_sub(token_amount)
        .ok_or(VelocityError::MathOverflow)?;

    let old_price = curve.current_price;
    // Apply full gross to AMM reserves; fee+tax leave the vault separately.
    let (vs, vt, rs, rt, supply, price) = apply_sell(
        curve.virtual_sol,
        curve.virtual_token,
        curve.real_sol,
        curve.real_token,
        curve.current_supply,
        sol_gross,
        token_amount,
    )?;
    curve.virtual_sol = vs;
    curve.virtual_token = vt;
    curve.real_sol = rs;
    curve.real_token = rt;
    curve.current_supply = supply;
    curve.current_price = price;
    curve.sell_tax_bps = sell_tax_bps;

    if holder_share > 0 && curve.current_supply > 0 {
        curve.reward_index =
            accrue_holder_rewards(curve.reward_index, curve.current_supply, holder_share)?;
        curve.holder_rewards_pool = curve
            .holder_rewards_pool
            .checked_add(holder_share)
            .ok_or(VelocityError::MathOverflow)?;
    } else if holder_share > 0 {
        treasury_pay = treasury_pay
            .checked_add(holder_share)
            .ok_or(VelocityError::MathOverflow)?;
        // holder_share stays in treasury_pay; zero for clarity in later accounting
        #[allow(unused_assignments)]
        {
            holder_share = 0;
        }
    }

    holder.reward_debt = curve.reward_index;
    let price_delta = curve.current_price.abs_diff(old_price);
    curve.price_velocity = ema_update(curve.price_velocity, price_delta, EMA_ALPHA_BPS)?;
    curve.last_price = curve.current_price;

    // real_sol already reduced by sol_gross; pay sol_net + treasury_pay from vault.
    // holder_share remains in vault (holder_rewards_pool).
    let supply_now = curve.current_supply;
    let price_now = curve.current_price;

    let seeds: &[&[u8]] = &[
        VelocityToken::VAULT_SEED,
        curve_key.as_ref(),
        &[vault_bump],
    ];

    if sol_net > 0 {
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.seller.to_account_info(),
                },
                &[seeds],
            ),
            sol_net,
        )?;
    }
    if treasury_pay > 0 {
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
                &[seeds],
            ),
            treasury_pay,
        )?;
    }

    emit!(TokensSold {
        curve: curve_key,
        seller: seller_key,
        tokens_in: token_amount,
        sol_gross,
        tax,
        fee,
        sol_net,
        supply: supply_now,
        price: price_now,
        sell_tax_bps,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
