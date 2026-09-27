use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::errors::VelocityError;
use crate::events::HolderRewardsClaimed;
use crate::math::settle_holder_rewards;
use crate::state::{HolderPosition, VelocityToken};

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(
        mut,
        seeds = [VelocityToken::SEED, curve.story_id.as_ref()],
        bump = curve.bump,
    )]
    pub curve: Account<'info, VelocityToken>,

    /// CHECK: Curve SOL vault holding redistributed sell-tax.
    #[account(
        mut,
        seeds = [VelocityToken::VAULT_SEED, curve.key().as_ref()],
        bump = curve.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [HolderPosition::SEED, curve.key().as_ref(), owner.key().as_ref()],
        bump = holder.bump,
        constraint = holder.owner == owner.key() @ VelocityError::Unauthorized,
    )]
    pub holder: Account<'info, HolderPosition>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Claim pro-rata share of accumulated sell-tax rewards.
pub fn claim_holder_rewards_handler(ctx: Context<ClaimRewards>) -> Result<()> {
    let clock = Clock::get()?;
    let curve_key = ctx.accounts.curve.key();
    let vault_bump = ctx.accounts.curve.vault_bump;

    let (claimable, debt) = settle_holder_rewards(
        ctx.accounts.holder.balance,
        ctx.accounts.holder.reward_debt,
        ctx.accounts.curve.reward_index,
        ctx.accounts.holder.claimable_rewards,
    )?;

    require!(claimable > 0, VelocityError::NothingToClaim);
    require!(
        ctx.accounts.curve.holder_rewards_pool >= claimable,
        VelocityError::InsufficientVault
    );

    let rent_min = Rent::get()?.minimum_balance(0);
    let available = ctx.accounts.vault.lamports().saturating_sub(rent_min);
    require!(claimable <= available, VelocityError::InsufficientVault);

    ctx.accounts.holder.claimable_rewards = 0;
    ctx.accounts.holder.reward_debt = debt;
    ctx.accounts.holder.last_attention_claim = clock.unix_timestamp;

    ctx.accounts.curve.holder_rewards_pool = ctx
        .accounts
        .curve
        .holder_rewards_pool
        .checked_sub(claimable)
        .ok_or(VelocityError::MathOverflow)?;

    let seeds: &[&[u8]] = &[
        VelocityToken::VAULT_SEED,
        curve_key.as_ref(),
        &[vault_bump],
    ];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.owner.to_account_info(),
            },
            &[seeds],
        ),
        claimable,
    )?;

    emit!(HolderRewardsClaimed {
        curve: curve_key,
        owner: ctx.accounts.owner.key(),
        amount: claimable,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
