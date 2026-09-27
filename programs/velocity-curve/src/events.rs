use anchor_lang::prelude::*;

#[event]
pub struct TokenInitialized {
    pub curve: Pubkey,
    pub mint: Pubkey,
    pub story_id: Pubkey,
    pub creator: Pubkey,
    pub base_price: u64,
    pub curve_k: u64,
    pub seed_liquidity: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokensBought {
    pub curve: Pubkey,
    pub buyer: Pubkey,
    pub sol_in: u64,
    pub fee: u64,
    pub tokens_out: u64,
    pub supply: u64,
    pub price: u64,
    pub effective_k: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokensSold {
    pub curve: Pubkey,
    pub seller: Pubkey,
    pub tokens_in: u64,
    pub sol_gross: u64,
    pub tax: u64,
    pub fee: u64,
    pub sol_net: u64,
    pub supply: u64,
    pub price: u64,
    pub sell_tax_bps: u16,
    pub timestamp: i64,
}

#[event]
pub struct AttentionUpdated {
    pub curve: Pubkey,
    pub twitter_delta: u64,
    pub telegram_delta: u64,
    pub new_holders: u64,
    pub raw_score: u64,
    pub attention_score: u64,
    pub price_velocity: u64,
    pub sell_tax_bps: u16,
    pub effective_k: u64,
    /// Number of distinct authorized oracle signers that attested this update.
    pub oracle_count: u8,
    pub quorum: u8,
    pub timestamp: i64,
}

#[event]
pub struct HolderRewardsClaimed {
    pub curve: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct OracleConfigInitialized {
    pub authority: Pubkey,
    pub update_interval: i64,
    pub quorum: u8,
    pub oracle_count: u8,
}

#[event]
pub struct OracleQuorumUpdated {
    pub authority: Pubkey,
    pub old_quorum: u8,
    pub new_quorum: u8,
}

#[event]
pub struct OracleAdded {
    pub authority: Pubkey,
    pub oracle: Pubkey,
    pub oracle_count: u8,
}

#[event]
pub struct OracleRemoved {
    pub authority: Pubkey,
    pub oracle: Pubkey,
    pub oracle_count: u8,
}
