use anchor_lang::prelude::*;

/// Lifecycle of a StoryMarket.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum MarketPhase {
    /// Created but not yet accepting stakes (optional pre-launch).
    Draft,
    /// Auction open — staking allowed until `ends_at`.
    Active,
    /// Ranked in top narratives; ready for VelocityCurve CPI.
    Graduated,
    /// Auction ended below graduation threshold — stakers reclaim principal.
    Failed,
    /// Ended at/above threshold but did not take a top rank — stakes feed winners (20/80).
    Forfeited,
}

/// Global config PDA: seeds = [b"narrative-config"]
#[account]
#[derive(InitSpace)]
pub struct NarrativeConfig {
    pub authority: Pubkey,
    /// Protocol fee on each stake. 200 = 2%.
    pub fee_bps: u16,
    pub min_stake: u64,
    pub max_stakes_per_user: u8,
    /// Default auction duration in seconds (24–48h).
    pub graduation_window: i64,
    pub treasury: Pubkey,
    /// VelocityCurve program id for graduation CPI.
    pub curve_program: Pubkey,
    pub bump: u8,
}

impl NarrativeConfig {
    pub const SEED: &'static [u8] = b"narrative-config";
}

/// One narrative / story market.
/// Seeds = [b"story", creator, content_hash]
#[account]
#[derive(InitSpace)]
pub struct StoryMarket {
    pub creator: Pubkey,
    /// IPFS / content-addressed hash of the narrative JSON.
    pub content_hash: [u8; 32],
    pub phase: MarketPhase,
    /// Net SOL credited to this narrative after fees (lamports).
    pub total_staked: u64,
    pub unique_stakers: u32,
    pub created_at: i64,
    pub ends_at: i64,
    /// Minimum total_staked required to graduate.
    pub graduation_threshold: u64,
    /// Accumulated losing-stake SOL attributed to this winner (pre-split).
    pub winning_pool: u64,
    /// Rank assigned at graduation (1..=5). 0 = unranked.
    pub rank: u8,
    /// SOL reserved for initial VelocityCurve liquidity (80% of winning_pool).
    pub liquidity_reserve: u64,
    /// SOL reserved for proportional winner payouts (20% of winning_pool).
    pub winner_bonus_pool: u64,
    /// Lamports already transferred out of this vault via contribute (Forfeited).
    pub contributed_out: u64,
    /// Lamports paid out via claim_stake (vault accounting).
    pub claimed_total: u64,
    pub bump: u8,
}

impl StoryMarket {
    pub const SEED: &'static [u8] = b"story";
    pub const VAULT_SEED: &'static [u8] = b"story-vault";
}

/// Per-user stake on a story.
/// Seeds = [b"stake", story, staker]
#[account]
#[derive(InitSpace)]
pub struct StakePosition {
    pub staker: Pubkey,
    pub story: Pubkey,
    /// Net amount credited after fee (lamports).
    pub amount: u64,
    pub locked_at: i64,
    pub claimed: bool,
    /// Updated post-resolution (0–10000 bps accuracy).
    pub accuracy_score: u16,
    /// Claimable lamports after resolve (winner bonus and/or principal).
    pub claimable: u64,
    /// True if this stake is on a Graduated narrative.
    pub is_winner: bool,
    /// True once resolve_stakes has set claimable (even if 0 for Forfeited).
    pub resolved: bool,
    pub bump: u8,
}

impl StakePosition {
    pub const SEED: &'static [u8] = b"stake";
}

/// Singleton King-of-the-Hill board: which stories occupy ranks 1..=5.
/// Seeds = [b"ranking-board"]
#[account]
#[derive(InitSpace)]
pub struct RankingBoard {
    /// Story pubkeys for ranks 1..=5 (`Pubkey::default()` = empty slot).
    pub ranks: [Pubkey; 5],
    pub bump: u8,
}

impl RankingBoard {
    pub const SEED: &'static [u8] = b"ranking-board";
    pub const MAX_RANK: u8 = 5;
}

/// Per-user index of distinct open story stakes.
/// Seeds = [b"user-stakes", user]
///
/// Enforces `NarrativeConfig.max_stakes_per_user` (default 20): counts how many
/// distinct stories the user currently has an open StakePosition on. Incremented
/// when a new position is opened; decremented on claim (Graduated/Failed) or on
/// resolve when Forfeited (claimable = 0, lifecycle ends without claim).
#[account]
#[derive(InitSpace)]
pub struct UserStakeIndex {
    pub user: Pubkey,
    /// Distinct stories with an open (not yet closed) stake.
    pub active_stakes: u8,
    pub bump: u8,
}

impl UserStakeIndex {
    pub const SEED: &'static [u8] = b"user-stakes";
}
