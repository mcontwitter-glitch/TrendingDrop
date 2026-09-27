use anchor_lang::prelude::*;
use anchor_lang::system_program::{create_account, CreateAccount};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::VelocityError;
use crate::events::TokenInitialized;
use crate::math::{spot_price, velocity_params};
use crate::state::{TokenParams, VelocityToken, FLATTEN_TAX_BPS, TOKEN_DECIMALS};

/// Account metas **must** match NarrativeAuction graduate CPI wire:
///   0. curve (mut, init PDA seeds=[b"curve", story_id])
///   1. story_id
///   2. mint (mut, signer — created here, authority = curve PDA)
///   3. vault (mut — curve SOL vault PDA, created if empty)
///   4. token_vault (mut — curve ATA, init)
///   5. payer (mut, signer)
///   6. system_program
///   7. token_program
///   8. associated_token_program
///   9. rent
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

    /// New SPL mint — mint authority = curve PDA.
    #[account(
        init,
        payer = payer,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = curve,
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: Curve SOL vault PDA (`["curve-vault", curve]`). Created if empty.
    #[account(
        mut,
        seeds = [VelocityToken::VAULT_SEED, curve.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    /// Curve-owned ATA holding no circulating supply (mint authority mints to buyers).
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = curve,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

/// Called via CPI from NarrativeAuction::graduate_narrative.
///
/// Creates the VelocityToken PDA, SPL mint (authority = curve), curve SOL vault,
/// and curve token ATA. Records `seed_liquidity` / `sol_reserve`; the graduate
/// instruction then transfers `liquidity_reserve` lamports from the story vault
/// into `vault` in the same transaction.
pub fn initialize_token_handler(ctx: Context<InitializeToken>, params: TokenParams) -> Result<()> {
    require!(params.base_price > 0, VelocityError::InvalidParams);
    require!(params.curve_k > 0, VelocityError::InvalidParams);

    let clock = Clock::get()?;
    let (eff_k, _) = velocity_params(params.curve_k, 0, 0)?;
    let price = spot_price(params.base_price, eff_k, 0)?;

    let curve_key = ctx.accounts.curve.key();
    let vault_bump = ctx.bumps.vault;
    ensure_curve_vault(
        &ctx.accounts.vault,
        &ctx.accounts.payer,
        &ctx.accounts.system_program,
        &curve_key,
        vault_bump,
    )?;

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
    // Expect NarrativeAuction to fund the vault with `initial_liquidity` next
    // in the same tx (atomic). Zero when no seed liquidity.
    curve.sol_reserve = params.initial_liquidity;
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

    let _ = &ctx.accounts.token_vault;
    let _ = &ctx.accounts.rent;
    let _ = &ctx.accounts.associated_token_program;

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
