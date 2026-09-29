use anchor_lang::prelude::*;
use anchor_spl::associated_token::{self, AssociatedToken, Create};
use anchor_spl::token::{self, Mint, MintTo, Token};

use crate::errors::VelocityError;
use crate::events::StakerAirdropMinted;
use crate::math::{apply_buy, tokens_out_for_sol};
use crate::state::{VelocityToken, GRADUATE_REAL_SOL, TOTAL_SUPPLY_RAW};

/// Mint reserved staker-airdrop supply into an escrow ATA and apply seed SOL
/// as a constant-product AMM buy (deepens real/virtual SOL, reduces token side).
///
/// Called via CPI from NarrativeAuction::graduate_narrative immediately after
/// `initialize_token` (seed SOL already transferred to the curve vault).
/// Requires `mint.supply == 0` so this runs before any public buy.
#[derive(Accounts)]
pub struct MintStakerAirdrop<'info> {
    #[account(
        mut,
        seeds = [VelocityToken::SEED, curve.story_id.as_ref()],
        bump = curve.bump,
    )]
    pub curve: Account<'info, VelocityToken>,

    #[account(
        mut,
        address = curve.mint @ VelocityError::MintMismatch,
        constraint = mint.supply == 0 @ VelocityError::AirdropSupplyNotZero,
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: StoryMarket pubkey — must match curve.story_id.
    #[account(
        constraint = story_id.key() == curve.story_id @ VelocityError::StoryMismatch,
    )]
    pub story_id: UncheckedAccount<'info>,

    /// Destination ATA (typically owned by NarrativeAuction StakeAirdrop PDA).
    /// CHECK: validated as ATA in handler / token program.
    #[account(mut)]
    pub airdrop_vault: UncheckedAccount<'info>,

    /// CHECK: Authority of airdrop_vault (StakeAirdrop PDA). Used when creating ATA.
    pub airdrop_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn mint_staker_airdrop_handler(ctx: Context<MintStakerAirdrop>, amount: u64) -> Result<()> {
    require!(amount > 0, VelocityError::ZeroAmount);
    require!(amount <= TOTAL_SUPPLY_RAW, VelocityError::AirdropTooLarge);

    if ctx.accounts.airdrop_vault.data_is_empty() {
        associated_token::create(CpiContext::new(
            ctx.accounts.associated_token_program.to_account_info(),
            Create {
                payer: ctx.accounts.payer.to_account_info(),
                associated_token: ctx.accounts.airdrop_vault.to_account_info(),
                authority: ctx.accounts.airdrop_authority.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
        ))?;
    }

    let story_id = ctx.accounts.curve.story_id;
    let bump = ctx.accounts.curve.bump;
    let seeds: &[&[u8]] = &[VelocityToken::SEED, story_id.as_ref(), &[bump]];

    // Mint fixed airdrop (typically 20% of 1B) into escrow.
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.airdrop_vault.to_account_info(),
                authority: ctx.accounts.curve.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )?;

    // Apply seed SOL as a true CPMM buy so staker capital deepens the pool and
    // moves spot along the invariant. Tokens from that buy are the economic
    // backing for the airdrop (already minted above — do not mint twice).
    let seed = ctx.accounts.curve.seed_liquidity;
    let curve = &mut ctx.accounts.curve;

    if seed > 0 {
        let tokens_from_seed =
            tokens_out_for_sol(seed, curve.virtual_sol, curve.virtual_token)?;
        // Cap by remaining real_token on the curve.
        let dy = tokens_from_seed.min(curve.real_token);
        require!(dy > 0, VelocityError::ZeroAmount);

        let (vs, vt, rs, rt, supply, price) = apply_buy(
            curve.virtual_sol,
            curve.virtual_token,
            curve.real_sol,
            curve.real_token,
            curve.current_supply,
            seed,
            dy,
        )?;
        curve.virtual_sol = vs;
        curve.virtual_token = vt;
        curve.real_sol = rs;
        curve.real_token = rt;
        curve.current_supply = supply;
        curve.current_price = price;
        curve.last_price = price;

        if curve.real_sol >= GRADUATE_REAL_SOL {
            curve.complete = true;
        }
    }

    emit!(StakerAirdropMinted {
        curve: curve.key(),
        mint: ctx.accounts.mint.key(),
        story_id,
        airdrop_vault: ctx.accounts.airdrop_vault.key(),
        amount,
        timestamp: Clock::get()?.unix_timestamp,
    });

    let _ = &ctx.accounts.rent;
    Ok(())
}
