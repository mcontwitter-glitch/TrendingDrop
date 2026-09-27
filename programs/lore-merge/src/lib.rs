//! # LoreMerge — Phase 3 Narrative Absorption
//!
//! After ~7 days, top-performing VelocityTokens can absorb related failed
//! narratives. Community votes with holder balance (+ lore_power bonus); on
//! execute:
//! - Target `LoreAsset` transfers to absorber
//! - Absorber `lore_power` bumps; `absorption_history` gains target (cap 10)
//! - 5% merge fee + 90% liquidity amounts recorded (`settlement_pending` until
//!   VelocityCurve vault CPI settles SOL)
//! - Target holders burn for absorber tokens at `absorption_ratio` (30-day
//!   window — SPL burn/mint deferred)
//!
//! Protocol fee on merger transactions: **5%** (`MERGE_FEE_BPS = 500`).
//!
//! ## PDA seeds
//! - `MergeConfig`   = `["merge-config"]`
//! - `MergeProposal` = `["merge", absorber, target]`
//! - `LoreAsset`     = `["lore", origin_curve]`
//! - `VoteRecord`    = `["vote", proposal, voter]`
//!
//! ## VelocityCurve integration
//! Holder / curve accounts are read via owner check + Borsh deserialize
//! (no hard CPI crate dependency). Vault SOL moves and `is_merged` /
//! `merge_count` updates require a follow-up VelocityCurve settle instruction.

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod math;
pub mod state;
pub mod velocity_read;

use instructions::*;

declare_id!("8pSr3X9iP66rvqMWT4S2gsEGtS8VnCLZtJayY9NB9ySy");

pub use state::{MERGE_FEE_BPS, MAX_ABSORPTION_HISTORY};

#[program]
pub mod lore_merge {
    use super::*;

    /// Bootstrap protocol config (treasury, velocity program, vote params).
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        fee_bps: Option<u16>,
        proposer_min_bps: Option<u16>,
        quorum_bps: Option<u16>,
        voting_duration_secs: Option<i64>,
    ) -> Result<()> {
        initialize_config_handler(
            ctx,
            fee_bps,
            proposer_min_bps,
            quorum_bps,
            voting_duration_secs,
        )
    }

    /// Register a LoreAsset for a graduated VelocityToken curve.
    pub fn initialize_lore_asset(
        ctx: Context<InitializeLoreAsset>,
        content_hash: [u8; 32],
    ) -> Result<()> {
        initialize_lore_asset_handler(ctx, content_hash)
    }

    /// Create merge proposal. Requires holding >1% of absorber supply.
    pub fn propose_merge(
        ctx: Context<ProposeMerge>,
        target_token: Pubkey,
        absorption_ratio: u16,
    ) -> Result<()> {
        propose_merge_handler(ctx, target_token, absorption_ratio)
    }

    /// Vote with holder balance (lore_power soft bonus). One vote per wallet.
    pub fn vote_merge(ctx: Context<VoteMerge>, amount: u64, support: bool) -> Result<()> {
        vote_merge_handler(ctx, amount, support)
    }

    /// Execute absorption after quorum + voting window.
    pub fn execute_merge(ctx: Context<ExecuteMerge>) -> Result<()> {
        execute_merge_handler(ctx)
    }
}
