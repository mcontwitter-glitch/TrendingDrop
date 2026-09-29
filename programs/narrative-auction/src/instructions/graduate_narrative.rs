use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::{invoke, invoke_signed};
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::sysvar::rent::ID as RENT_ID;

use crate::errors::NarrativeError;
use crate::events::{NarrativeGraduated, StakeAirdropCreated};
use crate::instructions::initialize_config::DEFAULT_STAKER_AIRDROP_BPS;
use crate::state::{MarketPhase, NarrativeConfig, RankingBoard, StakeAirdrop, StoryMarket};

/// Winner bonus share of the losing-stake pool (20%).
pub const WINNER_BONUS_BPS: u64 = 2000;
/// Initial curve liquidity share of the losing-stake pool (80%).
pub const LIQUIDITY_BPS: u64 = 8000;

/// Default curve_k passed to VelocityCurve::initialize_token when CPI is enabled.
pub const DEFAULT_CURVE_K: u64 = 1_000;

/// Notional 1B whole tokens × 10^6 decimals (must match velocity_curve::TOTAL_SUPPLY_RAW).
pub const TOTAL_SUPPLY_RAW: u64 = 1_000_000_000 * 1_000_000;

fn token_program_id() -> Pubkey {
    Pubkey::new_from_array([
        6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28, 180, 133,
        237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169,
    ]) // TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
}

fn associated_token_program_id() -> Pubkey {
    Pubkey::new_from_array([
        140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142, 13, 131, 11, 90, 19, 153, 218,
        255, 16, 132, 4, 142, 123, 216, 219, 233, 248, 89,
    ]) // ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL
}

#[derive(Accounts)]
pub struct GraduateNarrative<'info> {
    #[account(
        seeds = [NarrativeConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, NarrativeConfig>,

    #[account(
        mut,
        seeds = [StoryMarket::SEED, story.creator.as_ref(), story.content_hash.as_ref()],
        bump = story.bump,
        constraint = story.phase == MarketPhase::Active @ NarrativeError::NotActive,
    )]
    pub story: Account<'info, StoryMarket>,

    /// King-of-the-Hill rank slots (1..=5). Lazy-init on first graduate.
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + RankingBoard::INIT_SPACE,
        seeds = [RankingBoard::SEED],
        bump
    )]
    pub ranking_board: Account<'info, RankingBoard>,

    /// Story SOL vault — seed (principal + 80% losing) moves to curve; bonus stays.
    #[account(
        mut,
        seeds = [StoryMarket::VAULT_SEED, story.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA vault; liquidity_reserve transferred to curve_vault after CPI.
    pub vault: SystemAccount<'info>,

    /// Staker airdrop escrow metadata (created at graduate).
    #[account(
        init,
        payer = payer,
        space = 8 + StakeAirdrop::INIT_SPACE,
        seeds = [StakeAirdrop::SEED, story.key().as_ref()],
        bump
    )]
    pub stake_airdrop: Account<'info, StakeAirdrop>,

    /// CHECK: ATA(mint, stake_airdrop) — created inside VelocityCurve mint_staker_airdrop CPI.
    #[account(mut)]
    pub airdrop_token_vault: UncheckedAccount<'info>,

    /// CHECK: VelocityCurve program — must match config.curve_program.
    #[account(
        constraint = curve_program.key() == config.curve_program @ NarrativeError::InvalidCurveProgram,
    )]
    pub curve_program: UncheckedAccount<'info>,

    /// New SPL mint for VelocityCurve::initialize_token (must sign; created in CPI).
    /// CHECK: signer keypair; VelocityCurve inits as Mint with authority = curve PDA.
    #[account(mut)]
    pub token_mint: Signer<'info>,

    /// CHECK: VelocityToken PDA (`seeds = [b"curve", story]`) — maps to `curve`.
    #[account(mut)]
    pub curve_state: UncheckedAccount<'info>,

    /// CHECK: VelocityCurve SOL vault PDA (`["curve-vault", curve_state]`).
    #[account(mut)]
    pub curve_vault: UncheckedAccount<'info>,

    /// CHECK: Curve-owned associated token account (init in VelocityCurve CPI).
    #[account(mut)]
    pub token_vault: UncheckedAccount<'info>,

    /// Crank / payer for RankingBoard init and CPI rent.
    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: SPL Token program.
    #[account(constraint = token_program.key() == token_program_id() @ NarrativeError::InvalidCurveProgram)]
    pub token_program: UncheckedAccount<'info>,

    /// CHECK: Associated Token program.
    #[account(constraint = associated_token_program.key() == associated_token_program_id() @ NarrativeError::InvalidCurveProgram)]
    pub associated_token_program: UncheckedAccount<'info>,

    /// CHECK: Rent sysvar.
    #[account(address = RENT_ID)]
    pub rent: UncheckedAccount<'info>,

    pub clock: Sysvar<'info, Clock>,
}

/// Permissionless crank: graduate when `ends_at` has passed and threshold is met.
/// Anyone can pay; `rank = 0` auto-selects the first free RankingBoard slot.
///
/// Business rules:
/// - Top narratives (rank 1–5) graduate; rank slot must be empty or this story
/// - Staker principal (`total_staked`) + 80% of `winning_pool` seed the bonding curve
///   as the initial buy that backs the staker token airdrop (no SOL principal reclaim)
/// - `winning_pool` 20% → `winner_bonus_pool` (optional small SOL bonus for winners)
/// - CPI VelocityCurve::initialize_token, transfer seed SOL → curve vault, then
///   mint_staker_airdrop (bumps curve.current_supply so spot/FDV stay honest)
pub fn graduate_narrative_handler(ctx: Context<GraduateNarrative>, rank: u8) -> Result<()> {
    // rank 0 = permissionless auto: first empty slot (or this story's existing slot).
    // rank 1..=5 = explicit King-of-the-Hill slot.
    require!(
        rank == 0 || (1..=RankingBoard::MAX_RANK).contains(&rank),
        NarrativeError::InvalidRank
    );

    let clock = &ctx.accounts.clock;
    let story_key = ctx.accounts.story.key();

    require!(
        clock.unix_timestamp > ctx.accounts.story.ends_at,
        NarrativeError::AuctionNotEnded
    );
    require!(
        ctx.accounts.story.total_staked >= ctx.accounts.story.graduation_threshold,
        NarrativeError::ThresholdNotMet
    );

    // --- King-of-the-Hill: occupy rank slot ---
    let board = &mut ctx.accounts.ranking_board;
    if board.bump == 0 {
        board.bump = ctx.bumps.ranking_board;
        board.ranks = [Pubkey::default(); 5];
    }

    let rank = if rank == 0 {
        // Prefer an existing slot for this story, else first empty.
        if let Some(i) = board.ranks.iter().position(|r| *r == story_key) {
            (i as u8) + 1
        } else if let Some(i) = board.ranks.iter().position(|r| *r == Pubkey::default()) {
            (i as u8) + 1
        } else {
            return err!(NarrativeError::RankTaken);
        }
    } else {
        rank
    };

    let slot = &mut board.ranks[(rank as usize) - 1];
    require!(
        *slot == Pubkey::default() || *slot == story_key,
        NarrativeError::RankTaken
    );
    *slot = story_key;

    // --- Redistribution: principal → curve seed; losing pool 20% bonus / 80% curve ---
    let pool = ctx.accounts.story.winning_pool;
    let winner_bonus = pool
        .checked_mul(WINNER_BONUS_BPS)
        .ok_or(NarrativeError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(NarrativeError::MathOverflow)?;
    let liquidity = pool
        .checked_mul(LIQUIDITY_BPS)
        .ok_or(NarrativeError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(NarrativeError::MathOverflow)?;

    let total_staked = ctx.accounts.story.total_staked;
    // Seed liquidity = winning stake principal + 80% losing pool (backs airdrop "buy").
    let seed_sol = total_staked
        .checked_add(liquidity)
        .ok_or(NarrativeError::MathOverflow)?;

    let base_price = total_staked.saturating_div(1000).max(1);
    let creator = ctx.accounts.story.creator;

    let mut airdrop_bps = ctx.accounts.config.staker_airdrop_bps;
    if airdrop_bps == 0 {
        airdrop_bps = DEFAULT_STAKER_AIRDROP_BPS;
    }
    let airdrop_amount = (TOTAL_SUPPLY_RAW as u128)
        .checked_mul(airdrop_bps as u128)
        .ok_or(NarrativeError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(NarrativeError::MathOverflow)? as u64;

    {
        let story = &mut ctx.accounts.story;
        story.winner_bonus_pool = winner_bonus;
        story.liquidity_reserve = liquidity;
        story.rank = rank;
        story.phase = MarketPhase::Graduated;
    }

    // -----------------------------------------------------------------------
    // CPI — VelocityCurve::initialize_token
    // -----------------------------------------------------------------------
    let ix = build_initialize_token_ix(
        ctx.accounts.curve_program.key(),
        ctx.accounts.curve_state.key(),
        story_key,
        ctx.accounts.token_mint.key(),
        ctx.accounts.curve_vault.key(),
        ctx.accounts.token_vault.key(),
        ctx.accounts.payer.key(),
        TokenParamsWire {
            base_price,
            initial_liquidity: seed_sol,
            creator,
            story_id: story_key,
            curve_k: DEFAULT_CURVE_K,
        },
    );

    invoke(
        &ix,
        &[
            ctx.accounts.curve_state.to_account_info(),
            ctx.accounts.story.to_account_info(),
            ctx.accounts.token_mint.to_account_info(),
            ctx.accounts.curve_vault.to_account_info(),
            ctx.accounts.token_vault.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.associated_token_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ],
    )?;

    // -----------------------------------------------------------------------
    // Seed curve buy — move staker principal (+ 80% losing) story vault → curve vault
    // Winner bonus (20% losing) remains in vault for optional SOL claim.
    // -----------------------------------------------------------------------
    if seed_sol > 0 {
        let rent_min = Rent::get()?.minimum_balance(0);
        let vault_lamports = ctx.accounts.vault.lamports();
        // Leave rent + winner_bonus in the story vault for bonus claims.
        let must_remain = rent_min
            .checked_add(winner_bonus)
            .ok_or(NarrativeError::MathOverflow)?;
        require!(
            vault_lamports >= seed_sol.saturating_add(must_remain),
            NarrativeError::InsufficientVault
        );

        let vault_bump = ctx.bumps.vault;
        let seeds: &[&[u8]] = &[StoryMarket::VAULT_SEED, story_key.as_ref(), &[vault_bump]];

        invoke_signed(
            &system_instruction::transfer(
                ctx.accounts.vault.key,
                ctx.accounts.curve_vault.key,
                seed_sol,
            ),
            &[
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.curve_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[seeds],
        )?;

        ctx.accounts.story.liquidity_reserve = 0;
    }

    // -----------------------------------------------------------------------
    // CPI — VelocityCurve::mint_staker_airdrop → StakeAirdrop ATA
    // -----------------------------------------------------------------------
    if airdrop_amount > 0 {
        let mint_ix = build_mint_staker_airdrop_ix(
            ctx.accounts.curve_program.key(),
            ctx.accounts.curve_state.key(),
            ctx.accounts.token_mint.key(),
            story_key,
            ctx.accounts.airdrop_token_vault.key(),
            ctx.accounts.stake_airdrop.key(),
            ctx.accounts.payer.key(),
            airdrop_amount,
        );

        invoke(
            &mint_ix,
            &[
                ctx.accounts.curve_state.to_account_info(),
                ctx.accounts.token_mint.to_account_info(),
                ctx.accounts.story.to_account_info(),
                ctx.accounts.airdrop_token_vault.to_account_info(),
                ctx.accounts.stake_airdrop.to_account_info(),
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.associated_token_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
            ],
        )?;
    }

    {
        let airdrop = &mut ctx.accounts.stake_airdrop;
        airdrop.story = story_key;
        airdrop.mint = ctx.accounts.token_mint.key();
        airdrop.total_amount = airdrop_amount;
        airdrop.claimed_amount = 0;
        airdrop.bps = airdrop_bps;
        airdrop.bump = ctx.bumps.stake_airdrop;
    }

    emit!(StakeAirdropCreated {
        story: story_key,
        mint: ctx.accounts.token_mint.key(),
        total_amount: airdrop_amount,
        bps: airdrop_bps,
    });

    msg!(
        "Narrative graduated rank={} pool={} seed={} bonus={} airdrop={} ({} bps)",
        rank,
        pool,
        seed_sol,
        winner_bonus,
        airdrop_amount,
        airdrop_bps
    );

    emit!(NarrativeGraduated {
        story: story_key,
        rank,
        total_staked,
        // Event field = SOL seeded into curve (principal + 80% losing).
        liquidity_reserve: seed_sol,
        winner_bonus_pool: winner_bonus,
        winning_pool: pool,
        airdrop_amount,
        airdrop_bps,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Wire-compatible TokenParams for VelocityCurve (must stay in sync with
/// `velocity_curve::TokenParams` field order).
struct TokenParamsWire {
    base_price: u64,
    initial_liquidity: u64,
    creator: Pubkey,
    story_id: Pubkey,
    curve_k: u64,
}

fn build_initialize_token_ix(
    curve_program: Pubkey,
    curve_state: Pubkey,
    story_id: Pubkey,
    mint: Pubkey,
    curve_vault: Pubkey,
    token_vault: Pubkey,
    payer: Pubkey,
    params: TokenParamsWire,
) -> Instruction {
    let mut disc = [0u8; 8];
    let h = hash(b"global:initialize_token");
    disc.copy_from_slice(&h.to_bytes()[..8]);

    let mut data = Vec::with_capacity(8 + 8 + 8 + 32 + 32 + 8);
    data.extend_from_slice(&disc);
    data.extend_from_slice(&params.base_price.to_le_bytes());
    data.extend_from_slice(&params.initial_liquidity.to_le_bytes());
    data.extend_from_slice(params.creator.as_ref());
    data.extend_from_slice(params.story_id.as_ref());
    data.extend_from_slice(&params.curve_k.to_le_bytes());

    Instruction {
        program_id: curve_program,
        accounts: vec![
            AccountMeta::new(curve_state, false),
            AccountMeta::new_readonly(story_id, false),
            AccountMeta::new(mint, true),
            AccountMeta::new(curve_vault, false),
            AccountMeta::new(token_vault, false),
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(anchor_lang::system_program::ID, false),
            AccountMeta::new_readonly(token_program_id(), false),
            AccountMeta::new_readonly(associated_token_program_id(), false),
            AccountMeta::new_readonly(RENT_ID, false),
        ],
        data,
    }
}

fn build_mint_staker_airdrop_ix(
    curve_program: Pubkey,
    curve_state: Pubkey,
    mint: Pubkey,
    story_id: Pubkey,
    airdrop_vault: Pubkey,
    airdrop_authority: Pubkey,
    payer: Pubkey,
    amount: u64,
) -> Instruction {
    let mut disc = [0u8; 8];
    let h = hash(b"global:mint_staker_airdrop");
    disc.copy_from_slice(&h.to_bytes()[..8]);

    let mut data = Vec::with_capacity(8 + 8);
    data.extend_from_slice(&disc);
    data.extend_from_slice(&amount.to_le_bytes());

    Instruction {
        program_id: curve_program,
        accounts: vec![
            AccountMeta::new(curve_state, false),
            AccountMeta::new(mint, false),
            AccountMeta::new_readonly(story_id, false),
            AccountMeta::new(airdrop_vault, false),
            AccountMeta::new_readonly(airdrop_authority, false),
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(anchor_lang::system_program::ID, false),
            AccountMeta::new_readonly(token_program_id(), false),
            AccountMeta::new_readonly(associated_token_program_id(), false),
            AccountMeta::new_readonly(RENT_ID, false),
        ],
        data,
    }
}
