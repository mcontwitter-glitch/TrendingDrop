use anchor_lang::prelude::*;
use anchor_spl::associated_token::{self, AssociatedToken, Create};
use anchor_spl::token::{self, Mint, MintTo, Token};

use crate::errors::VelocityError;
use crate::events::StakerAirdropMinted;
use crate::math::{spot_price, velocity_params};
use crate::state::{VelocityToken, TOTAL_SUPPLY_RAW};

/// Mint reserved staker-airdrop supply into an escrow ATA and count it as sold
/// curve supply so spot / FDV stay honest with the seed SOL buy.
///
/// Called via CPI from NarrativeAuction::graduate_narrative immediately after
/// `initialize_token` (and after seed SOL is recorded on `sol_reserve`).
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
    /// Created if empty.
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

    // Create destination ATA if needed (owner = airdrop_authority).
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

    // Count airdrop as sold supply backed by seed SOL already on sol_reserve.
    let (eff_k, _) = velocity_params(
        ctx.accounts.curve.curve_k,
        ctx.accounts.curve.attention_score,
        ctx.accounts.curve.price_velocity,
    )?;
    let curve = &mut ctx.accounts.curve;
    curve.current_supply = curve
        .current_supply
        .checked_add(amount)
        .ok_or(VelocityError::MathOverflow)?;
    curve.current_price = spot_price(curve.base_price, eff_k, curve.current_supply)?;
    curve.last_price = curve.current_price;

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
