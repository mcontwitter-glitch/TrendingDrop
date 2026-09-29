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

// ---------------------------------------------------------------------------
// Pump.fun–style constant-product AMM defaults
// Invariant: virtual_sol * virtual_token = k
// Spot (lamports / whole token) = virtual_sol / virtual_token
// Launch FDV ≈ 30/1.073 * 1B ≈ 28 SOL ≈ $4.2k @ $150/SOL
// Graduate when real_sol ≈ 85 SOL → mcap ≈ $62–69k @ $150/SOL; ~200M tokens left
// ---------------------------------------------------------------------------

/// Initial virtual SOL reserves (30 SOL in lamports).
pub const INITIAL_VIRTUAL_SOL: u64 = 30_000_000_000;
/// Initial virtual token reserves (~1.073B whole tokens).
pub const INITIAL_VIRTUAL_TOKEN: u64 = 1_073_000_000;
/// Real SOL in curve that triggers bonding-curve completion / Raydium migrate stub.
pub const GRADUATE_REAL_SOL: u64 = 85_000_000_000;
/// Tokens available for curve trading (80% of 1B); 20% reserved for staker airdrop.
pub const CURVE_REAL_TOKEN: u64 = 800_000_000;
/// Staker airdrop share of notional supply (20%).
pub const STAKER_AIRDROP_BPS: u16 = 2_000;

/// Sell tax when attention outpaces price (steepen).
pub const STEEPEN_TAX_BPS: u16 = 1_500;
/// Sell tax when price outpaces attention (flatten).
pub const FLATTEN_TAX_BPS: u16 = 500;

/// EMA alpha = 0.3 → 3000 bps.
pub const EMA_ALPHA_BPS: u64 = 3_000;

/// Max |sell-tax attention adjust| hint (kept for oracle UI; pricing is CPMM).
pub const MAX_K_ADJUST_BPS: u64 = 2_500;

/// Constant-product bonding curve state (Pump.fun–style).
/// Seeds = [b"curve", story_id]
///
/// Wire layout: first fields keep historical offsets (virtual_sol was base_price,
/// virtual_token was curve_k, real_sol was sol_reserve). New fields append.
#[account]
#[derive(InitSpace)]
pub struct VelocityToken {
    pub mint: Pubkey,
    /// Link back to NarrativeAuction StoryMarket.
    pub story_id: Pubkey,
    pub creator: Pubkey,
    /// Virtual SOL reserves (lamports). Was `base_price`.
    pub virtual_sol: u64,
    /// Whole tokens sold / circulating from the curve (airdrop + buys − sells).
    pub current_supply: u64,
    /// Spot = virtual_sol / virtual_token (lamports per whole token).
    pub current_price: u64,
    /// EMA-smoothed attention score (oracle) — drives sell tax only.
    pub attention_score: u64,
    /// Moving average of price change.
    pub price_velocity: u64,
    /// Virtual token reserves (whole tokens). Was `curve_k`.
    pub virtual_token: u64,
    /// Dynamic 500–1500 bps (attention steepen / flatten).
    pub sell_tax_bps: u16,
    pub last_oracle_update: i64,
    /// How many narratives absorbed via LoreMerge.
    pub merge_count: u8,
    pub is_merged: bool,
    /// Real SOL held from buys / seed (lamports). Was `sol_reserve`.
    pub real_sol: u64,
    /// Accumulated protocol fees (lamports) still in vault.
    pub protocol_fees: u64,
    /// Sell-tax share reserved for holders (lamports) still in vault.
    pub holder_rewards_pool: u64,
    /// Cumulative reward index (scaled by REWARD_SCALE in math).
    pub reward_index: u128,
    /// Previous spot price for velocity MA.
    pub last_price: u64,
    /// SOL seeded at narrative graduate (stake principal + 80% losing).
    pub seed_liquidity: u64,
    pub bump: u8,
    pub vault_bump: u8,
    /// Remaining real tokens available to sell on the curve (whole).
    pub real_token: u64,
    /// Bonding curve complete (real_sol ≥ GRADUATE_REAL_SOL). Raydium migrate stub.
    pub complete: bool,
}

impl VelocityToken {
    pub const SEED: &'static [u8] = b"curve";
    pub const VAULT_SEED: &'static [u8] = b"curve-vault";

    /// Alias for vault accounting (UI / lore-merge historically used sol_reserve).
    pub fn sol_reserve(&self) -> u64 {
        self.real_sol
    }
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
///
/// Semantics (Pump CPMM):
/// - `base_price` → initial `virtual_sol` (lamports); 0 = use INITIAL_VIRTUAL_SOL
/// - `curve_k` → initial `virtual_token` (whole); 0 = use INITIAL_VIRTUAL_TOKEN
/// - `initial_liquidity` → seed SOL from narrative stakes (applied as Δx buy)
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TokenParams {
    pub base_price: u64,
    pub initial_liquidity: u64,
    pub creator: Pubkey,
    pub story_id: Pubkey,
    pub curve_k: u64,
}
