use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::associated_token::{self, AssociatedToken, Create};
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer as TokenTransfer};

use crate::errors::NarrativeError;
use crate::events::{StakeAirdropClaimed, StakeClaimed, UserStakeIndexUpdated};
use crate::state::{
    AirdropClaim, MarketPhase, NarrativeConfig, StakeAirdrop, StakePosition, StoryMarket,
    UserStakeIndex,
};

#[derive(Accounts)]
pub struct ClaimStake<'info> {
    #[account(
        seeds = [NarrativeConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, NarrativeConfig>,

    #[account(
        mut,
        seeds = [StoryMarket::SEED, story.creator.as_ref(), story.content_hash.as_ref()],
        bump = story.bump,
        constraint = story.phase == MarketPhase::Graduated || story.phase == MarketPhase::Failed
            @ NarrativeError::NotActive,
    )]
    pub story: Account<'info, StoryMarket>,

    #[account(
        mut,
        seeds = [StoryMarket::VAULT_SEED, story.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA vault funding the SOL claim.
    pub vault: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [StakePosition::SEED, story.key().as_ref(), staker.key().as_ref()],
        bump = stake_position.bump,
        has_one = staker @ NarrativeError::Unauthorized,
        constraint = stake_position.story == story.key() @ NarrativeError::Unauthorized,
        constraint = stake_position.resolved @ NarrativeError::NothingToClaim,
        constraint = !stake_position.claimed @ NarrativeError::AlreadyClaimed,
        constraint = stake_position.claimable > 0 @ NarrativeError::NothingToClaim,
    )]
    pub stake_position: Account<'info, StakePosition>,

    #[account(
        mut,
        seeds = [UserStakeIndex::SEED, staker.key().as_ref()],
        bump = user_stake_index.bump,
        constraint = user_stake_index.user == staker.key() @ NarrativeError::StakeIndexMismatch,
    )]
    pub user_stake_index: Account<'info, UserStakeIndex>,

    /// Graduated + airdrop path (omit / pass none on Failed).
    #[account(
        mut,
        seeds = [StakeAirdrop::SEED, story.key().as_ref()],
        bump = stake_airdrop.bump,
        constraint = stake_airdrop.story == story.key() @ NarrativeError::Unauthorized,
    )]
    pub stake_airdrop: Option<Account<'info, StakeAirdrop>>,

    #[account(mut)]
    pub airdrop_token_vault: Option<Account<'info, TokenAccount>>,

    pub mint: Option<Account<'info, Mint>>,

    /// CHECK: staker ATA — created in handler if empty when claiming tokens.
    #[account(mut)]
    pub staker_token_ata: Option<UncheckedAccount<'info>>,

    #[account(
        init_if_needed,
        payer = staker,
        space = 8 + AirdropClaim::INIT_SPACE,
        seeds = [AirdropClaim::SEED, story.key().as_ref(), staker.key().as_ref()],
        bump
    )]
    pub airdrop_claim: Option<Account<'info, AirdropClaim>>,

    #[account(mut)]
    pub staker: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Option<Program<'info, Token>>,
    pub associated_token_program: Option<Program<'info, AssociatedToken>>,
}

/// Transfer claimable SOL; on Graduated also pay pro-rata staker token airdrop.
pub fn claim_stake_handler(ctx: Context<ClaimStake>) -> Result<()> {
    let amount = ctx.accounts.stake_position.claimable;
    let story_key = ctx.accounts.story.key();
    let bump = ctx.bumps.vault;
    let staker_key = ctx.accounts.staker.key();
    let position_amount = ctx.accounts.stake_position.amount;
    let total_staked = ctx.accounts.story.total_staked;
    let phase = ctx.accounts.story.phase;

    let rent_min = Rent::get()?.minimum_balance(0);
    let reserved = if phase == MarketPhase::Graduated {
        ctx.accounts
            .story
            .liquidity_reserve
            .checked_add(rent_min)
            .ok_or(NarrativeError::MathOverflow)?
    } else {
        rent_min
    };

    let vault_lamports = ctx.accounts.vault.lamports();
    let available = vault_lamports.saturating_sub(reserved);
    require!(amount <= available, NarrativeError::InsufficientVault);

    let seeds: &[&[u8]] = &[StoryMarket::VAULT_SEED, story_key.as_ref(), &[bump]];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.staker.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )?;

    let mut token_amount: u64 = 0;

    if phase == MarketPhase::Graduated {
        if let (Some(airdrop), Some(vault_ata), Some(mint), Some(staker_ata), Some(claim), Some(token_program), Some(ata_program)) = (
            ctx.accounts.stake_airdrop.as_mut(),
            ctx.accounts.airdrop_token_vault.as_ref(),
            ctx.accounts.mint.as_ref(),
            ctx.accounts.staker_token_ata.as_ref(),
            ctx.accounts.airdrop_claim.as_mut(),
            ctx.accounts.token_program.as_ref(),
            ctx.accounts.associated_token_program.as_ref(),
        ) {
            require_keys_eq!(mint.key(), airdrop.mint, NarrativeError::AirdropVaultMismatch);
            require_keys_eq!(
                vault_ata.mint,
                airdrop.mint,
                NarrativeError::AirdropVaultMismatch
            );
            require_keys_eq!(
                vault_ata.owner,
                airdrop.key(),
                NarrativeError::AirdropVaultMismatch
            );

            let already_claimed = claim.amount > 0;
            if !already_claimed && airdrop.total_amount > 0 && total_staked > 0 {
                token_amount = (airdrop.total_amount as u128)
                    .checked_mul(position_amount as u128)
                    .ok_or(NarrativeError::MathOverflow)?
                    .checked_div(total_staked as u128)
                    .ok_or(NarrativeError::MathOverflow)? as u64;

                if token_amount > 0 {
                    if staker_ata.data_is_empty() {
                        associated_token::create(CpiContext::new(
                            ata_program.to_account_info(),
                            Create {
                                payer: ctx.accounts.staker.to_account_info(),
                                associated_token: staker_ata.to_account_info(),
                                authority: ctx.accounts.staker.to_account_info(),
                                mint: mint.to_account_info(),
                                system_program: ctx.accounts.system_program.to_account_info(),
                                token_program: token_program.to_account_info(),
                            },
                        ))?;
                    }

                    let airdrop_bump = airdrop.bump;
                    let airdrop_seeds: &[&[u8]] =
                        &[StakeAirdrop::SEED, story_key.as_ref(), &[airdrop_bump]];

                    token::transfer(
                        CpiContext::new_with_signer(
                            token_program.to_account_info(),
                            TokenTransfer {
                                from: vault_ata.to_account_info(),
                                to: staker_ata.to_account_info(),
                                authority: airdrop.to_account_info(),
                            },
                            &[airdrop_seeds],
                        ),
                        token_amount,
                    )?;

                    airdrop.claimed_amount = airdrop
                        .claimed_amount
                        .checked_add(token_amount)
                        .ok_or(NarrativeError::MathOverflow)?;

                    claim.story = story_key;
                    claim.staker = staker_key;
                    claim.amount = token_amount;
                    claim.bump = ctx.bumps.airdrop_claim.unwrap_or(airdrop_bump);

                    emit!(StakeAirdropClaimed {
                        story: story_key,
                        staker: staker_key,
                        token_amount,
                        airdrop_claimed_total: airdrop.claimed_amount,
                    });
                }
            }
        }
    }

    let position = &mut ctx.accounts.stake_position;
    position.claimed = true;
    position.claimable = 0;

    let story = &mut ctx.accounts.story;
    story.claimed_total = story
        .claimed_total
        .checked_add(amount)
        .ok_or(NarrativeError::MathOverflow)?;

    let index = &mut ctx.accounts.user_stake_index;
    if index.active_stakes > 0 {
        index.active_stakes = index.active_stakes.saturating_sub(1);
        emit!(UserStakeIndexUpdated {
            user: index.user,
            story: story_key,
            active_stakes: index.active_stakes,
            delta: -1,
        });
    }

    emit!(StakeClaimed {
        story: story_key,
        staker: staker_key,
        amount,
        claimed_total: story.claimed_total,
        token_amount,
    });

    Ok(())
}
