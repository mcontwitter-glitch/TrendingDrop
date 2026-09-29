use anchor_lang::prelude::*;

/// Cap authorized oracles (3/5 quorum network).
pub const MAX_ORACLES: usize = 5;

/// Protocol fee on bonding-curve volume (1.5%).
pub const CURVE_FEE_BPS: u16 = 150;

/// SPL mint decimals for VelocityCurve tokens.
pub const TOKEN_DECIMALS: u8 = 6;

/// Notional total supply (whole tokens) for FDV / staker airdrop math.
pub const TOTAL_SUPPLY_WHOLE: u64 = 1_000_000_000;
/// Raw units = 1B * 10^TOKEN_DECIMALS.
pub const TOTAL_SUPPLY_RAW: u64 = TOTAL_SUPPLY_WHOLE * 1_000_000;
/// 10^TOKEN_DECIMALS — curve math uses whole tokens; SPL mint/burn uses raw.
pub const DECIMALS_FACTOR: u64 = 1_000_000;

/// Launch spot in lamports per whole token. FDV_SOL ≈ this value (price × 1B / 1e9).
/// ~$4k at $150/SOL → 27.
pub const LAUNCH_BASE_PRICE: u64 = 27;
/// Bonding slope with PRICE_SCALE=1e9: ~12 SOL seed buys ~20% of 1B → spot ~100 (~$15k FDV).
pub const DEFAULT_CURVE_K: u64 = 365;


/// Sell tax when attention outpaces price (steepen).
pub const STEEPEN_TAX_BPS: u16 = 1_500;
/// Sell tax when price outpaces attention (flatten).
pub const FLATTEN_TAX_BPS: u16 = 500;

/// EMA alpha = 0.3 → 3000 bps.
pub const EMA_ALPHA_BPS: u64 = 3_000;

/// Max |effective_k / k − 1| per oracle update (25%).
pub const MAX_K_ADJUST_BPS: u64 = 2_500;

/// Dual-curve token state.
/// Seeds = [b"curve", story_id]
#[account]
#[derive(InitSpace)]
pub struct VelocityToken {
    pub mint: Pubkey,
    /// Link back to NarrativeAuction StoryMarket.
    pub story_id: Pubkey,
    pub creator: Pubkey,
    pub base_price: u64,
    pub current_supply: u64,
    pub current_price: u64,
    /// EMA-smoothed attention score (oracle).
    pub attention_score: u64,
    /// Moving average of price change.
    pub price_velocity: u64,
    /// Base curve constant `k` (before velocity modifier).
    pub curve_k: u64,
    /// Dynamic 500–1500 bps.
    pub sell_tax_bps: u16,
    pub last_oracle_update: i64,
    /// How many narratives absorbed via LoreMerge.
    pub merge_count: u8,
    pub is_merged: bool,
    /// Actual SOL held in the curve vault (lamports).
    pub sol_reserve: u64,
    /// Accumulated protocol fees (lamports) still in vault.
    pub protocol_fees: u64,
    /// Sell-tax share reserved for holders (lamports) still in vault.
    pub holder_rewards_pool: u64,
    /// Cumulative reward index (scaled by REWARD_SCALE in math).
    pub reward_index: u128,
    /// Previous spot price for velocity MA.
    pub last_price: u64,
    /// Liquidity amount recorded at graduation (SOL moved into curve vault on graduate).
    pub seed_liquidity: u64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl VelocityToken {
    pub const SEED: &'static [u8] = b"curve";
    pub const VAULT_SEED: &'static [u8] = b"curve-vault";
}

/// Per-holder position — tracks reward-index / claimable alongside SPL balances.
/// Seeds = [b"holder", curve, owner]
#[account]
#[derive(InitSpace)]
pub struct HolderPosition {
    pub owner: Pubkey,
    pub token: Pubkey,
    pub balance: u64,
    pub entry_price: u64,
    pub last_attention_claim: i64,
    /// Governance weight for LoreMerge votes.
    pub lore_power: u32,
    /// Reward index snapshot (debt) for pro-rata sell-tax claims.
    pub reward_debt: u128,
    /// Claimable lamports from redistributed sell tax.
    pub claimable_rewards: u64,
    pub bump: u8,
}

impl HolderPosition {
    pub const SEED: &'static [u8] = b"holder";
}

/// Oracle network config — Phase-1 mainnet: N-of-M multi-sig crank (default 3/5).
/// Seeds = [b"oracle-config"]
#[account]
#[derive(InitSpace)]
pub struct OracleConfig {
    pub authority: Pubkey,
    /// Target update interval (e.g. 300s = 5 min).
    pub update_interval: i64,
    /// Weights in bps of 10_000 (default 4000 / 3000 / 3000).
    pub twitter_weight: u16,
    pub telegram_weight: u16,
    pub onchain_weight: u16,
    /// Required distinct authorized oracle signers per `update_attention` (default 3).
    pub quorum: u8,
    #[max_len(MAX_ORACLES)]
    pub authorized_oracles: Vec<Pubkey>,
    pub bump: u8,
}

impl OracleConfig {
    pub const SEED: &'static [u8] = b"oracle-config";
    pub const DEFAULT_UPDATE_INTERVAL: i64 = 300;
    pub const DEFAULT_TWITTER_WEIGHT: u16 = 4_000;
    pub const DEFAULT_TELEGRAM_WEIGHT: u16 = 3_000;
    pub const DEFAULT_ONCHAIN_WEIGHT: u16 = 3_000;
    /// Mainnet-ready default: 3-of-5.
    pub const DEFAULT_QUORUM: u8 = 3;
}

/// CPI / init params — field order must stay wire-compatible with
/// NarrativeAuction `TokenParamsWire`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TokenParams {
    pub base_price: u64,
    pub initial_liquidity: u64,
    pub creator: Pubkey,
    pub story_id: Pubkey,
    pub curve_k: u64,
}
