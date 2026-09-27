//! # VelocityCurve — Phase 2 Dual-Curve Engine
//!
//! Token launches with a **dual-curve system**: price follows a bonding curve,
//! while a parallel "attention curve" tracks social velocity.
//!
//! ## Mathematical model
//!
//! Architecture (PDF): `Price = Base_Price * e^(k * Supply)`.
//! On-chain implementation uses the linearized form (see `math` module):
//! ```text
//! P(s) = base_price + (effective_k * s) / PRICE_SCALE
//! ```
//! Buy/sell use closed-form integrals of P(s) with u128 checked arithmetic.
//!
//! Velocity modifier:
//! ```text
//! Attention_Score = Twitter*0.4 + Telegram*0.3 + New_Holders*0.3
//!
//! if Attention > Price_Velocity:
//!     Effective_k = k * (1 + (A - P)/100)   // Steepen; sell tax 15%
//! else:
//!     Effective_k = k * (1 - (P - A)/200)   // Flatten; sell tax 5%
//! ```
//! Modifiers clamped ±25%. Sell tax: 50% holders / 50% treasury.
//! Protocol fee on curve volume: **1.5%** (`CURVE_FEE_BPS = 150`).
//! `update_attention` EMA alpha = 0.3.
//!
//! ## Oracle network (3/5)
//! Two attestation modes (see `oracle_proof` + ARCHITECTURE.md):
//! 1. Tx-signer quorum — `proof` empty; cranker + remaining signers ≥ quorum
//! 2. Ed25519 offline — `proof` = timestamp i64 LE; prior Ed25519Program ixs
//!    sign canonical message; Instructions sysvar introspection
//!
//! ## SPL
//! `initialize_token` creates mint (authority = curve PDA) + curve ATA.
//! `buy` mints to buyer ATA; `sell` burns from seller ATA. HolderPosition
//! remains for reward-index / lore_power.
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

    /// Authority: set required oracle quorum (1..=authorized_oracles.len()).
    pub fn set_oracle_quorum(ctx: Context<SetOracleQuorum>, new_quorum: u8) -> Result<()> {
        set_oracle_quorum_handler(ctx, new_quorum)
    }

    /// Authority: add an authorized oracle (max 5).
    pub fn add_oracle(ctx: Context<AddOracle>, oracle: Pubkey) -> Result<()> {
        add_oracle_handler(ctx, oracle)
    }

    /// Authority: remove an authorized oracle (must not drop below quorum).
    pub fn remove_oracle(ctx: Context<RemoveOracle>, oracle: Pubkey) -> Result<()> {
        remove_oracle_handler(ctx, oracle)
    }

    /// Called via CPI from NarrativeAuction::graduate_narrative.
    /// Creates SPL mint (authority = curve) + curve vault + curve ATA.
    pub fn initialize_token(ctx: Context<InitializeToken>, params: state::TokenParams) -> Result<()> {
        initialize_token_handler(ctx, params)
    }

    /// Buy tokens along the dual curve with slippage protection (mints SPL).
    pub fn buy(ctx: Context<Buy>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
        buy_handler(ctx, sol_amount, min_tokens_out)
    }

    /// Sell tokens with velocity-dependent tax (burns SPL).
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

    /// Claim pro-rata share of accumulated sell-tax rewards.
    pub fn claim_holder_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        claim_holder_rewards_handler(ctx)
    }

    /// Settle LoreMerge: move fee/liquidity SOL, mark target merged, bump absorber merge_count.
    pub fn settle_merge(
        ctx: Context<SettleMerge>,
        fee_lamports: u64,
        liquidity_lamports: u64,
    ) -> Result<()> {
        settle_merge_handler(ctx, fee_lamports, liquidity_lamports)
    }
}
