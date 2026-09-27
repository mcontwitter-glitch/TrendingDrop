use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::errors::VelocityError;
use crate::events::TokensBought;
use crate::math::{
    curve_fee, ema_update, settle_holder_rewards, spot_price, tokens_out_for_sol, velocity_params,
};
use crate::state::{HolderPosition, VelocityToken, CURVE_FEE_BPS, EMA_ALPHA_BPS};

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(
        mut,
        seeds = [VelocityToken::SEED, curve.story_id.as_ref()],
        bump = curve.bump,
        constraint = !curve.is_merged @ VelocityError::TradingPaused,
    )]
    pub curve: Account<'info, VelocityToken>,

    /// CHECK: Curve SOL vault PDA.
    #[account(
        mut,
        seeds = [VelocityToken::VAULT_SEED, curve.key().as_ref()],
        bump = curve.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + HolderPosition::INIT_SPACE,
        seeds = [HolderPosition::SEED, curve.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub holder: Account<'info, HolderPosition>,

    /// CHECK: Protocol fee destination (typically treasury).
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Buy tokens along the dual curve with slippage protection.
///
/// 1.5% fee → treasury; net SOL → vault; credit internal holder balance using
/// `effective_k` from last oracle attention vs price_velocity.
pub fn buy_handler(ctx: Context<Buy>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
    require!(sol_amount > 0, VelocityError::ZeroAmount);

    let clock = Clock::get()?;
    let curve_key = ctx.accounts.curve.key();
    let buyer_key = ctx.accounts.buyer.key();

    let (eff_k, _) = velocity_params(
        ctx.accounts.curve.curve_k,
        ctx.accounts.curve.attention_score,
        ctx.accounts.curve.price_velocity,
    )?;
    let (fee, sol_net) = curve_fee(sol_amount, CURVE_FEE_BPS)?;
    require!(sol_net > 0, VelocityError::ZeroAmount);

    let tokens_out = tokens_out_for_sol(
        sol_net,
        ctx.accounts.curve.current_supply,
        ctx.accounts.curve.base_price,
        eff_k,
    )?;
    require!(tokens_out >= min_tokens_out, VelocityError::SlippageExceeded);

    if fee > 0 {
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            fee,
        )?;
    }

    let vault_bump = ctx.accounts.curve.vault_bump;
    ensure_curve_vault(
        &ctx.accounts.vault,
        &ctx.accounts.buyer,
        &ctx.accounts.system_program,
        &curve_key,
        vault_bump,
    )?;

    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        sol_net,
    )?;

    let curve = &mut ctx.accounts.curve;
    let holder = &mut ctx.accounts.holder;

    let (claimable, _) = settle_holder_rewards(
        holder.balance,
        holder.reward_debt,
        curve.reward_index,
        holder.claimable_rewards,
    )?;
    holder.claimable_rewards = claimable;

    if holder.owner == Pubkey::default() {
        holder.owner = buyer_key;
        holder.token = curve_key;
        holder.entry_price = curve.current_price;
        holder.lore_power = 0;
        holder.last_attention_claim = clock.unix_timestamp;
        holder.bump = ctx.bumps.holder;
    }

    holder.balance = holder
        .balance
        .checked_add(tokens_out)
        .ok_or(VelocityError::MathOverflow)?;
    // New tokens don't earn historical rewards.
    holder.reward_debt = curve.reward_index;

    let old_price = curve.current_price;
    curve.current_supply = curve
        .current_supply
        .checked_add(tokens_out)
        .ok_or(VelocityError::MathOverflow)?;
    curve.sol_reserve = curve
        .sol_reserve
        .checked_add(sol_net)
        .ok_or(VelocityError::MathOverflow)?;
    curve.current_price = spot_price(curve.base_price, eff_k, curve.current_supply)?;

    let price_delta = curve.current_price.abs_diff(old_price);
    curve.price_velocity = ema_update(curve.price_velocity, price_delta, EMA_ALPHA_BPS)?;
    curve.last_price = curve.current_price;
    holder.lore_power = holder.lore_power.saturating_add(1);

    emit!(TokensBought {
        curve: curve_key,
        buyer: buyer_key,
        sol_in: sol_amount,
        fee,
        tokens_out,
        supply: curve.current_supply,
        price: curve.current_price,
        effective_k: eff_k,
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
