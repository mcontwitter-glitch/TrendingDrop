use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;

use crate::errors::NarrativeError;
use crate::events::NarrativeGraduated;
use crate::state::{MarketPhase, NarrativeConfig, RankingBoard, StoryMarket};

/// Winner bonus share of the losing-stake pool (20%).
pub const WINNER_BONUS_BPS: u64 = 2000;
/// Initial curve liquidity share of the losing-stake pool (80%).
pub const LIQUIDITY_BPS: u64 = 8000;

/// Default curve_k passed to VelocityCurve::initialize_token when CPI is enabled.
pub const DEFAULT_CURVE_K: u64 = 1_000;

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

    /// Story SOL vault — retains winner principals + winning_pool / liquidity.
    #[account(
        mut,
        seeds = [StoryMarket::VAULT_SEED, story.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA vault; liquidity_reserve remains for VelocityCurve seeding.
    pub vault: SystemAccount<'info>,

    /// CHECK: VelocityCurve program — must match config.curve_program.
    #[account(
        constraint = curve_program.key() == config.curve_program @ NarrativeError::InvalidCurveProgram,
    )]
    pub curve_program: UncheckedAccount<'info>,

    /// CHECK: Mint account for VelocityCurve::initialize_token (maps to `mint`).
    #[account(mut)]
    pub token_mint: UncheckedAccount<'info>,

    /// CHECK: VelocityToken PDA (`seeds = [b"curve", story]`) — maps to `curve`.
    #[account(mut)]
    pub curve_state: UncheckedAccount<'info>,

    /// Crank / payer for RankingBoard init and CPI rent.
    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,

    pub clock: Sysvar<'info, Clock>,
}

/// Permissionless crank: graduate when `ends_at` has passed and threshold is met.
///
/// Business rules:
/// - Top narratives (rank 1–5) graduate; rank slot must be empty or this story
/// - `winning_pool` (fed by `contribute_losing_pool`) splits 20% → winner_bonus_pool,
///   80% → liquidity_reserve
/// - CPI invokes VelocityCurve::initialize_token (account metas + TokenParams wire)
pub fn graduate_narrative_handler(ctx: Context<GraduateNarrative>, rank: u8) -> Result<()> {
    require!(
        (1..=RankingBoard::MAX_RANK).contains(&rank),
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
    let slot = &mut board.ranks[(rank as usize) - 1];
    require!(
        *slot == Pubkey::default() || *slot == story_key,
        NarrativeError::RankTaken
    );
    *slot = story_key;

    // --- Redistribution accounting (20% winners / 80% liquidity) ---
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

    let base_price = ctx.accounts.story.total_staked.saturating_div(1000).max(1);
    let creator = ctx.accounts.story.creator;
    let total_staked = ctx.accounts.story.total_staked;

    {
        let story = &mut ctx.accounts.story;
        story.winner_bonus_pool = winner_bonus;
        story.liquidity_reserve = liquidity;
        story.rank = rank;
        story.phase = MarketPhase::Graduated;
    }

    // -----------------------------------------------------------------------
    // CPI — VelocityCurve::initialize_token
    // Account layout matches velocity_curve::InitializeToken:
    //   0. curve  1. story_id  2. mint  3. payer  4. system_program
    // -----------------------------------------------------------------------
    let ix = build_initialize_token_ix(
        ctx.accounts.curve_program.key(),
        ctx.accounts.curve_state.key(),
        story_key,
        ctx.accounts.token_mint.key(),
        ctx.accounts.payer.key(),
        TokenParamsWire {
            base_price,
            initial_liquidity: liquidity,
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
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    let _ = &ctx.accounts.vault;

    msg!(
        "Narrative graduated rank={} pool={} liq={} bonus={} (VelocityCurve CPI invoked)",
        rank,
        pool,
        liquidity,
        winner_bonus
    );

    emit!(NarrativeGraduated {
        story: story_key,
        rank,
        total_staked,
        liquidity_reserve: liquidity,
        winner_bonus_pool: winner_bonus,
        winning_pool: pool,
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
    payer: Pubkey,
    params: TokenParamsWire,
) -> Instruction {
    // Anchor discriminator = sha256("global:initialize_token")[0..8]
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
            AccountMeta::new(mint, false),
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(anchor_lang::system_program::ID, false),
        ],
        data,
    }
}
