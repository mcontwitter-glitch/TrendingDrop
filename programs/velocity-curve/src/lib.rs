//! # VelocityCurve — Pump.fun–style Constant-Product Bonding Curve
//!
//! Fair-launch AMM integrated with TrendingDrop narrative graduation.
//!
//! ## Mathematical model (Pump.fun CPMM)
//! ```text
//! k = virtual_sol * virtual_token
//! spot (lamports / whole token) = virtual_sol / virtual_token
//!
//! Buy  Δx SOL:     Δy = y − k/(x+Δx)
//! Sell Δy tokens:  Δx = x − k/(y+Δy)
//! ```
//! Defaults: virtual_sol ≈ 30 SOL, virtual_token ≈ 1.073B whole tokens.
//! Launch FDV ≈ $4.2k @ $150/SOL. Graduate / complete when real_sol ≈ 85 SOL
//! (~$62–69k mcap); ~200M tokens remain on the curve side for Raydium migrate.
//!
//! Attention score drives **sell tax only** (steepen 15% / flatten 5%) — it does
//! not alter the constant-product invariant.
//!
//! Protocol fee on curve volume: **1.5%** (`CURVE_FEE_BPS = 150`).
//!
//! ## Narrative graduation
//! `initialize_token` sets Pump virtual reserves + 800M real_token (80% of 1B).
//! Staker seed SOL is applied as a Δx buy in `mint_staker_airdrop` (20% escrowed).
//! `graduate_curve` flips `complete` at the real-SOL threshold (Raydium stub).
//!
//! ## PDA seeds
//! - `VelocityToken`  = `["curve", story_id]`
//! - Curve vault      = `["curve-vault", curve]`
//! - `HolderPosition` = `["holder", curve, owner]`
//! - `OracleConfig`   = `["oracle-config"]`

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod math;
pub mod oracle_proof;
pub mod state;

use instructions::*;

declare_id!("5VbDjccBDNVCPLpSgxyuw7ptYekrcxH8FySBxaAXx6C");

pub use state::CURVE_FEE_BPS;

#[program]
pub mod velocity_curve {
    use super::*;

    /// Bootstrap oracle config. Default quorum = 3 (pass `Some(1)` for local mock).
    pub fn initialize_oracle_config(
        ctx: Context<InitializeOracleConfig>,
        update_interval: Option<i64>,
        authorized_oracles: Option<Vec<Pubkey>>,
        quorum: Option<u8>,
    ) -> Result<()> {
        initialize_oracle_config_handler(ctx, update_interval, authorized_oracles, quorum)
    }

    pub fn set_oracle_quorum(ctx: Context<SetOracleQuorum>, new_quorum: u8) -> Result<()> {
        set_oracle_quorum_handler(ctx, new_quorum)
    }

    pub fn add_oracle(ctx: Context<AddOracle>, oracle: Pubkey) -> Result<()> {
        add_oracle_handler(ctx, oracle)
    }

    pub fn remove_oracle(ctx: Context<RemoveOracle>, oracle: Pubkey) -> Result<()> {
        remove_oracle_handler(ctx, oracle)
    }

    /// Called via CPI from NarrativeAuction::graduate_narrative.
    /// Creates SPL mint (authority = curve) + curve vault + curve ATA.
    /// `TokenParams.base_price` / `curve_k` → virtual_sol / virtual_token (0 = Pump defaults).
    pub fn initialize_token(ctx: Context<InitializeToken>, params: state::TokenParams) -> Result<()> {
        initialize_token_handler(ctx, params)
    }

    /// Buy tokens on the constant-product AMM (mints SPL).
    pub fn buy(ctx: Context<Buy>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
        buy_handler(ctx, sol_amount, min_tokens_out)
    }

    /// Sell tokens with attention-dependent tax (burns SPL).
    pub fn sell(ctx: Context<Sell>, token_amount: u64, min_sol_out: u64) -> Result<()> {
        sell_handler(ctx, token_amount, min_sol_out)
    }

    /// Oracle crank — EMA update. Tx-signer quorum or ed25519 proof mode.
    pub fn update_attention<'info>(
        ctx: Context<'_, '_, 'info, 'info, UpdateAttention<'info>>,
        twitter_delta: u64,
        telegram_delta: u64,
        new_holders: u64,
        proof: Vec<u8>,
    ) -> Result<()> {
        update_attention_handler(ctx, twitter_delta, telegram_delta, new_holders, proof)
    }

    pub fn claim_holder_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        claim_holder_rewards_handler(ctx)
    }

    pub fn settle_merge(
        ctx: Context<SettleMerge>,
        fee_lamports: u64,
        liquidity_lamports: u64,
    ) -> Result<()> {
        settle_merge_handler(ctx, fee_lamports, liquidity_lamports)
    }

    /// Repair / migrate curve to Pump CPMM virtual reserves (creator-only).
    /// `base_price`/`curve_k` args = virtual_sol / virtual_token (0 = defaults).
    pub fn repair_curve(ctx: Context<RepairCurve>, base_price: u64, curve_k: u64) -> Result<()> {
        repair_curve_handler(ctx, base_price, curve_k)
    }

    /// Mint reserved staker-airdrop into escrow ATA + apply seed SOL as AMM buy.
    pub fn mint_staker_airdrop(ctx: Context<MintStakerAirdrop>, amount: u64) -> Result<()> {
        mint_staker_airdrop_handler(ctx, amount)
    }

    pub fn repair_curve_supply(
        ctx: Context<RepairCurve>,
        current_supply: u64,
    ) -> Result<()> {
        repair_curve_supply_handler(ctx, current_supply)
    }

    /// Permissionless: mark curve complete when real_sol ≥ GRADUATE_REAL_SOL.
    /// Raydium migration is a stub — vault accounting remains on-chain.
    pub fn graduate_curve(ctx: Context<GraduateCurve>) -> Result<()> {
        graduate_curve_handler(ctx)
    }
}
