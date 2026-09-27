use anchor_lang::prelude::*;

#[event]
pub struct MergeConfigInitialized {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub velocity_curve_program: Pubkey,
    pub fee_bps: u16,
}

#[event]
pub struct LoreAssetInitialized {
    pub lore: Pubkey,
    pub origin_curve: Pubkey,
    pub origin_story: Pubkey,
    pub lore_value: u64,
    pub lore_power: u32,
    pub timestamp: i64,
}

#[event]
pub struct MergeProposed {
    pub proposal: Pubkey,
    pub absorber: Pubkey,
    pub target: Pubkey,
    pub proposer: Pubkey,
    pub absorption_ratio: u16,
    pub quorum_required: u64,
    pub voting_ends: i64,
    pub timestamp: i64,
}

#[event]
pub struct MergeVoteCast {
    pub proposal: Pubkey,
    pub voter: Pubkey,
    pub amount: u64,
    pub support: bool,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub timestamp: i64,
}

#[event]
pub struct MergeExecuted {
    pub proposal: Pubkey,
    pub absorber: Pubkey,
    pub target: Pubkey,
    pub lore_asset: Pubkey,
    pub absorber_lore_power: u32,
    pub fee_lamports: u64,
    pub liquidity_lamports: u64,
    pub absorption_ratio: u16,
    pub history_len: u8,
    pub settlement_pending: bool,
    pub timestamp: i64,
}
