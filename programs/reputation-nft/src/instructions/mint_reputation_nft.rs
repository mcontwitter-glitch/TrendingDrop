use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, SetAuthority, Token, TokenAccount};
use anchor_spl::token::spl_token::instruction::AuthorityType;

use crate::errors::ReputationError;
use crate::events::ReputationNftMinted;
use crate::metaplex::{
    create_metadata_accounts_v3, find_metadata_account, reputation_name, reputation_uri,
    REPUTATION_SYMBOL, TOKEN_METADATA_PROGRAM_ID,
};
use crate::state::{TraderProfile, ReputationTier};

#[derive(Accounts)]
pub struct MintReputationNft<'info> {
    #[account(
        mut,
        seeds = [TraderProfile::SEED, owner.key().as_ref()],
        bump = profile.bump,
        has_one = owner @ ReputationError::Unauthorized,
        constraint = profile.nft_mint == Pubkey::default() @ ReputationError::NftAlreadyMinted,
    )]
    pub profile: Account<'info, TraderProfile>,

    /// New SPL mint (decimals = 0). Mint authority = owner for the create+mint flow;
    /// revoked to None after minting supply=1.
    #[account(
        init,
        payer = owner,
        mint::decimals = 0,
        mint::authority = owner,
        mint::freeze_authority = owner,
    )]
    pub mint: Account<'info, Mint>,

    /// Owner's ATA receiving the single NFT token.
    #[account(
        init,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// CHECK: Metaplex metadata PDA ["metadata", token_metadata_program, mint].
    #[account(
        mut,
        constraint = metadata.key() == find_metadata_account(&mint.key()).0
            @ ReputationError::InvalidMetadataPda,
    )]
    pub metadata: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,

    /// CHECK: Metaplex Token Metadata program.
    #[account(address = TOKEN_METADATA_PROGRAM_ID @ ReputationError::InvalidMetadataProgram)]
    pub token_metadata_program: UncheckedAccount<'info>,
}

fn tier_label(tier: ReputationTier) -> &'static str {
    match tier {
        ReputationTier::Bronze => "Bronze",
        ReputationTier::Silver => "Silver",
        ReputationTier::Gold => "Gold",
        ReputationTier::Diamond => "Diamond",
        ReputationTier::Mythic => "Mythic",
    }
}

/// Mint a Metaplex-compatible reputation NFT for an existing TraderProfile.
///
/// - Creates mint (0 decimals), ATA, mints 1 token to owner
/// - CreateMetadataAccountV3 with update_authority = profile PDA
/// - URI placeholder: `https://bcc.local/reputation/{tier}/{owner}.json`
/// - Revokes mint + freeze authority (immutable supply)
pub fn mint_reputation_nft_handler(ctx: Context<MintReputationNft>) -> Result<()> {
    let tier = ctx.accounts.profile.tier;
    let label = tier_label(tier);
    let owner_key = ctx.accounts.owner.key();
    let name = reputation_name(label);
    let uri = reputation_uri(label, &owner_key);
    let profile_key = ctx.accounts.profile.key();

    // Mint supply = 1 to owner ATA.
    token::mint_to(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        1,
    )?;

    // Create Metaplex metadata; update_authority = profile PDA (for later tier sync).
    create_metadata_accounts_v3(
        ctx.accounts.metadata.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.owner.to_account_info(),
        ctx.accounts.owner.to_account_info(),
        ctx.accounts.profile.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        &name,
        REPUTATION_SYMBOL,
        &uri,
        &[],
    )?;

    // Revoke mint authority.
    token::set_authority(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            SetAuthority {
                current_authority: ctx.accounts.owner.to_account_info(),
                account_or_mint: ctx.accounts.mint.to_account_info(),
            },
        ),
        AuthorityType::MintTokens,
        None,
    )?;

    // Revoke freeze authority.
    token::set_authority(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            SetAuthority {
                current_authority: ctx.accounts.owner.to_account_info(),
                account_or_mint: ctx.accounts.mint.to_account_info(),
            },
        ),
        AuthorityType::FreezeAccount,
        None,
    )?;

    let profile = &mut ctx.accounts.profile;
    profile.nft_mint = ctx.accounts.mint.key();
    let clock = Clock::get()?;
    profile.last_updated = clock.unix_timestamp;

    emit!(ReputationNftMinted {
        profile: profile_key,
        owner: owner_key,
        mint: profile.nft_mint,
        metadata: ctx.accounts.metadata.key(),
        tier,
        uri,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
