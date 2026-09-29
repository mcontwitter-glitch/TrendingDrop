use anchor_lang::prelude::*;

#[event]
pub struct ConfigInitialized {
    pub authority: Pubkey,
    pub fee_bps: u16,
    pub treasury: Pubkey,
}

#[event]
pub struct ConfigUpdated {
    pub authority: Pubkey,
    pub fee_bps: u16,
    pub min_stake: u64,
    pub treasury: Pubkey,
    pub curve_program: Pubkey,
    pub staker_airdrop_bps: u16,
    pub post_threshold_secs: i64,
}

#[event]
pub struct StoryInitialized {
    pub story: Pubkey,
    pub creator: Pubkey,
    pub content_hash: [u8; 32],
    pub ends_at: i64,
    pub graduation_threshold: u64,
}

#[event]
pub struct NarrativeStaked {
    pub story: Pubkey,
    pub staker: Pubkey,
    pub gross_amount: u64,
    pub fee: u64,
    pub net_amount: u64,
    pub total_staked: u64,
    /// Current auction end (may be clamped when threshold is met).
    pub ends_at: i64,
}

#[event]
pub struct NarrativeGraduated {
    pub story: Pubkey,
    pub rank: u8,
    pub total_staked: u64,
    pub liquidity_reserve: u64,
    pub winner_bonus_pool: u64,
    pub winning_pool: u64,
    pub airdrop_amount: u64,
    pub airdrop_bps: u16,
    pub timestamp: i64,
}

#[event]
pub struct StoryFailed {
    pub story: Pubkey,
    pub total_staked: u64,
    pub timestamp: i64,
}

#[event]
pub struct StoryForfeited {
    pub story: Pubkey,
    pub total_staked: u64,
    pub timestamp: i64,
}

#[event]
pub struct LosingPoolContributed {
    pub source_story: Pubkey,
    pub dest_story: Pubkey,
    pub amount: u64,
    pub dest_winning_pool: u64,
    pub dest_winner_bonus_pool: u64,
    pub dest_liquidity_reserve: u64,
}

#[event]
pub struct StakesResolved {
    pub story: Pubkey,
    pub staker: Pubkey,
    pub phase: u8,
    pub claimable: u64,
    pub is_winner: bool,
    pub winner_bonus_pool: u64,
    pub liquidity_reserve: u64,
}

#[event]
pub struct StakeClaimed {
    pub story: Pubkey,
    pub staker: Pubkey,
    pub amount: u64,
    pub claimed_total: u64,
    pub token_amount: u64,
}

#[event]
pub struct UserStakeIndexUpdated {
    pub user: Pubkey,
    pub story: Pubkey,
    pub active_stakes: u8,
    /// +1 on open, -1 on close (claim / forfeited resolve).
    pub delta: i8,
}

#[event]
pub struct StakeAirdropCreated {
    pub story: Pubkey,
    pub mint: Pubkey,
    pub total_amount: u64,
    pub bps: u16,
}

#[event]
pub struct StakeAirdropClaimed {
    pub story: Pubkey,
    pub staker: Pubkey,
    pub token_amount: u64,
    pub airdrop_claimed_total: u64,
}
