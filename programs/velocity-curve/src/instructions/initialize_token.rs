use anchor_lang::prelude::*;
use anchor_lang::system_program::{create_account, CreateAccount};
use anchor_spl::associated_token::{self, AssociatedToken, Create};
use anchor_spl::token::{self, InitializeMint2, Mint, Token};

use crate::errors::VelocityError;
use crate::events::TokenInitialized;
use crate::math::spot_price;
use crate::state::{
    TokenParams, VelocityToken, CURVE_REAL_TOKEN, FLATTEN_TAX_BPS, INITIAL_VIRTUAL_SOL,
    INITIAL_VIRTUAL_TOKEN, TOKEN_DECIMALS,
};

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
pub struct InitializeToken<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + VelocityToken::INIT_SPACE,
        seeds = [VelocityToken::SEED, story_id.key().as_ref()],
        bump
    )]
    pub curve: Box<Account<'info, VelocityToken>>,

    /// CHECK: StoryMarket PDA from NarrativeAuction (CPI authority link).
    pub story_id: UncheckedAccount<'info>,

    /// CHECK: New SPL mint — signer; created via CPI in handler (authority = curve).
    #[account(mut, signer)]
    pub mint: Signer<'info>,

    /// CHECK: Curve SOL vault PDA (`["curve-vault", curve]`). Created if empty.
    #[account(
        mut,
        seeds = [VelocityToken::VAULT_SEED, curve.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    /// CHECK: Curve-owned ATA; created via associated_token CPI in handler.
    #[account(mut)]
    pub token_vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn initialize_token_handler(ctx: Context<InitializeToken>, params: TokenParams) -> Result<()> {
    // Snapshot params BEFORE any handler CPIs (mint/ATA/vault) can clobber stack.
    let virtual_sol = if params.base_price > 0 {
        params.base_price
    } else {
        INITIAL_VIRTUAL_SOL
    };
    let virtual_token = if params.curve_k > 0 {
        params.curve_k
    } else {
        INITIAL_VIRTUAL_TOKEN
    };
    let initial_liquidity = params.initial_liquidity;
    let creator = params.creator;
    let params_story = params.story_id;
    let story_id = ctx.accounts.story_id.key();
    require_keys_eq!(story_id, params_story, VelocityError::StoryMismatch);
    require!(
        virtual_sol > 0 && virtual_token > 0,
        VelocityError::InvalidParams
    );

    let clock = Clock::get()?;
    let price = spot_price(virtual_sol, virtual_token)?;

    let curve_key = ctx.accounts.curve.key();
    let vault_bump = ctx.bumps.vault;
    let curve_bump = ctx.bumps.curve;

    ensure_curve_vault(
        &ctx.accounts.vault,
        &ctx.accounts.payer,
        &ctx.accounts.system_program,
        &curve_key,
        vault_bump,
    )?;

    {
        let mint_ai = ctx.accounts.mint.to_account_info();
        let rent = Rent::get()?;
        let lamports = rent.minimum_balance(Mint::LEN);
        create_account(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                CreateAccount {
                    from: ctx.accounts.payer.to_account_info(),
                    to: mint_ai.clone(),
                },
            ),
            lamports,
            Mint::LEN as u64,
            &token::ID,
        )?;
        token::initialize_mint2(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                InitializeMint2 { mint: mint_ai },
            ),
            TOKEN_DECIMALS,
            &curve_key,
            None,
        )?;
    }

    if ctx.accounts.token_vault.data_is_empty() {
        associated_token::create(CpiContext::new(
            ctx.accounts.associated_token_program.to_account_info(),
            Create {
                payer: ctx.accounts.payer.to_account_info(),
                associated_token: ctx.accounts.token_vault.to_account_info(),
                authority: ctx.accounts.curve.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
        ))?;
    }

    let curve = &mut ctx.accounts.curve;
    curve.mint = ctx.accounts.mint.key();
    curve.story_id = story_id;
    curve.creator = creator;
    curve.virtual_sol = virtual_sol;
    curve.current_supply = 0;
    curve.current_price = price;
    curve.attention_score = 0;
    curve.price_velocity = 0;
    curve.virtual_token = virtual_token;
    curve.sell_tax_bps = FLATTEN_TAX_BPS;
    curve.last_oracle_update = clock.unix_timestamp;
    curve.merge_count = 0;
    curve.is_merged = false;
    // Seed SOL is applied as an AMM buy in mint_staker_airdrop (after vault transfer).
    curve.real_sol = 0;
    curve.protocol_fees = 0;
    curve.holder_rewards_pool = 0;
    curve.reward_index = 0;
    curve.last_price = price;
    curve.seed_liquidity = initial_liquidity;
    curve.bump = curve_bump;
    curve.vault_bump = vault_bump;
    curve.real_token = CURVE_REAL_TOKEN;
    curve.complete = false;

    emit!(TokenInitialized {
        curve: curve.key(),
        mint: curve.mint,
        story_id: curve.story_id,
        creator: curve.creator,
        base_price: curve.virtual_sol,
        curve_k: curve.virtual_token,
        seed_liquidity: curve.seed_liquidity,
        timestamp: clock.unix_timestamp,
    });

    let _ = &ctx.accounts.rent;
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
