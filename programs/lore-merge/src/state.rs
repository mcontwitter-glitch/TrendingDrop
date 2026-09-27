use anchor_lang::prelude::*;

/// Protocol fee on merge execution (5%).
pub const MERGE_FEE_BPS: u16 = 500;
/// Share of target liquidity intended for absorber pool (90%).
pub const LIQUIDITY_TRANSFER_BPS: u16 = 9_000;
/// Max on-chain absorption history length (archive to IPFS beyond).
pub const MAX_ABSORPTION_HISTORY: usize = 10;
/// Proposer must hold >1% of absorber supply.
pub const PROPOSER_MIN_BPS: u16 = 100;
/// Default quorum = 10% of absorber supply at proposal time.
pub const DEFAULT_QUORUM_BPS: u16 = 1_000;
/// Default voting window (3 days).
pub const DEFAULT_VOTING_DURATION_SECS: i64 = 3 * 24 * 60 * 60;
/// Absorber must be at least 7 days old before proposing merges.
pub const MERGE_MIN_AGE_SECS: i64 = 7 * 24 * 60 * 60;
/// Base lore_power multiplier (1.0x) in bps.
pub const BASE_LORE_POWER_BPS: u32 = 10_000;
/// Flat lore_power bump per successful absorb (5% equiv).
pub const LORE_POWER_BUMP_BASE: u32 = 500;
/// Extra bump per SOL of target lore_value (capped).
pub const LORE_VALUE_UNIT_LAMPORTS: u64 = 1_000_000_000;
/// Max extra lore_power from lore_value.
pub const LORE_POWER_BUMP_VALUE_CAP: u32 = 2_000;
/// Claim window for target→absorber burn/mint (informational; SPL deferred).
pub const ABSORPTION_CLAIM_WINDOW_SECS: i64 = 30 * 24 * 60 * 60;

/// Protocol config for LoreMerge.
/// Seeds = [b"merge-config"]
#[account]
#[derive(InitSpace)]
pub struct MergeConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    /// VelocityCurve program id (owner check for curve / holder PDAs).
    pub velocity_curve_program: Pubkey,
    pub fee_bps: u16,
    pub proposer_min_bps: u16,
    pub quorum_bps: u16,
    pub voting_duration_secs: i64,
    pub merge_min_age_secs: i64,
    pub bump: u8,
}

impl MergeConfig {
    pub const SEED: &'static [u8] = b"merge-config";
}

/// Community merge proposal (strong token absorbs weak).
/// Seeds = [b"merge", absorber, target]
#[account]
#[derive(InitSpace)]
pub struct MergeProposal {
    /// Strong token curve PDA.
    pub absorber: Pubkey,
    /// Weak token curve PDA to absorb.
    pub target: Pubkey,
    pub proposer: Pubkey,
    pub proposed_at: i64,
    pub voting_ends: i64,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub quorum_required: u64,
    pub executed: bool,
    /// Target:absorber conversion scaled ×100 (e.g. 500 = 1:5).
    pub absorption_ratio: u16,
    /// Snapshot of target sol_reserve at execute (for settlement crank).
    pub target_liquidity_snapshot: u64,
    /// 5% fee lamports computed at execute.
    pub fee_lamports: u64,
    /// 90% liquidity lamports intended for absorber vault.
    pub liquidity_lamports: u64,
    /// True until VelocityCurve settle CPI moves vault SOL (deferred).
    pub settlement_pending: bool,
    pub bump: u8,
}

impl MergeProposal {
    pub const SEED: &'static [u8] = b"merge";
}

/// NFT-like lore asset tied to a curve/token.
/// Seeds = [b"lore", origin_curve]
#[account]
#[derive(InitSpace)]
pub struct LoreAsset {
    /// NarrativeAuction StoryMarket (from VelocityToken.story_id).
    pub origin_story: Pubkey,
    /// Origin VelocityToken curve PDA.
    pub origin_curve: Pubkey,
    /// Which token curve currently owns this lore.
    pub current_holder: Pubkey,
    pub content_hash: [u8; 32],
    /// Chain of absorbed origin curves (capped at MAX_ABSORPTION_HISTORY).
    #[max_len(MAX_ABSORPTION_HISTORY)]
    pub absorption_history: Vec<Pubkey>,
    /// Calculated from original stakes / seed liquidity.
    pub lore_value: u64,
    /// Multiplier in bps (10_000 = 1.0x). Bumps on each absorb.
    pub lore_power: u32,
    pub registered_at: i64,
    /// Set when this lore has been absorbed into another token.
    pub is_absorbed: bool,
    pub bump: u8,
}

impl LoreAsset {
    pub const SEED: &'static [u8] = b"lore";
}

/// One vote per voter per proposal.
/// Seeds = [b"vote", proposal, voter]
#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub proposal: Pubkey,
    pub voter: Pubkey,
    pub amount: u64,
    pub support: bool,
    pub voted_at: i64,
    pub bump: u8,
}

impl VoteRecord {
    pub const SEED: &'static [u8] = b"vote";
}
