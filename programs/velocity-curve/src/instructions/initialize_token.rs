use anchor_lang::prelude::*;

use crate::errors::VelocityError;
use crate::events::TokenInitialized;
use crate::math::{spot_price, velocity_params};
use crate::state::{TokenParams, VelocityToken, FLATTEN_TAX_BPS};

/// Account metas **must** match NarrativeAuction graduate CPI wire:
///   0. curve (mut, init PDA seeds=[b"curve", story_id])
///   1. story_id
///   2. mint (mut)
///   3. payer (mut, signer)
///   4. system_program
#[derive(Accounts)]
#[instruction(params: TokenParams)]
pub struct InitializeToken<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + VelocityToken::INIT_SPACE,
        seeds = [VelocityToken::SEED, story_id.key().as_ref()],
        bump
    )]
    pub curve: Account<'info, VelocityToken>,

    /// CHECK: StoryMarket PDA from NarrativeAuction (CPI authority link).
    /// Constrained to match `params.story_id`.
    #[account(constraint = story_id.key() == params.story_id @ VelocityError::StoryMismatch)]
    pub story_id: UncheckedAccount<'info>,

    /// CHECK: Mint pubkey recorded for future SPL wiring; may be pre-created.
    #[account(mut)]
    pub mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Called via CPI from NarrativeAuction::graduate_narrative.
///
/// Seeds the VelocityToken PDA. Actual SOL liquidity transfer from the story
/// vault is recorded as `seed_liquidity` — vault funding can follow in a
/// dedicated top-up once remaining-accounts / vault metas are added to the CPI.
pub fn initialize_token_handler(ctx: Context<InitializeToken>, params: TokenParams) -> Result<()> {
    require!(params.base_price > 0, VelocityError::InvalidParams);
    require!(params.curve_k > 0, VelocityError::InvalidParams);

    let clock = Clock::get()?;
    let (eff_k, _) = velocity_params(params.curve_k, 0, 0)?;
    let price = spot_price(params.base_price, eff_k, 0)?;

    // Derive vault bump for later buy/sell (vault created on first transfer).
    let (vault_key, vault_bump) = Pubkey::find_program_address(
        &[VelocityToken::VAULT_SEED, ctx.accounts.curve.key().as_ref()],
        ctx.program_id,
    );
    let _ = vault_key;

    let curve = &mut ctx.accounts.curve;
    curve.mint = ctx.accounts.mint.key();
    curve.story_id = params.story_id;
    curve.creator = params.creator;
    curve.base_price = params.base_price;
    curve.current_supply = 0;
    curve.current_price = price;
    curve.attention_score = 0;
    curve.price_velocity = 0;
    curve.curve_k = params.curve_k;
    curve.sell_tax_bps = FLATTEN_TAX_BPS;
    curve.last_oracle_update = clock.unix_timestamp;
    curve.merge_count = 0;
    curve.is_merged = false;
    curve.sol_reserve = 0;
    curve.protocol_fees = 0;
    curve.holder_rewards_pool = 0;
    curve.reward_index = 0;
    curve.last_price = price;
    curve.seed_liquidity = params.initial_liquidity;
    curve.bump = ctx.bumps.curve;
    curve.vault_bump = vault_bump;

    emit!(TokenInitialized {
        curve: curve.key(),
        mint: curve.mint,
        story_id: curve.story_id,
        creator: curve.creator,
        base_price: curve.base_price,
        curve_k: curve.curve_k,
        seed_liquidity: curve.seed_liquidity,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
