//! # NarrativeAuction — Phase 1 of Bonding Curve Casino
//!
//! Story Markets where users stake SOL on narratives before tokens exist.
//! Top narratives graduate to VelocityCurve; competitive losers forfeit and
//! feed winners (20% bonus) + initial curve liquidity (80%). Protocol takes
//! `fee_bps` (default 2%) on stake. Below-threshold stories fail with full
//! principal reclaim.
//!
//! ## Instructions
//! - `initialize_config` / `update_config` — singleton protocol config
//! - `initialize_story` — open a new Active StoryMarket
//! - `stake_on_narrative` — stake SOL (fee → treasury, net → vault)
//! - `graduate_narrative` — permissionless crank when ended + threshold + rank 1–5
//! - `fail_story` — mark Failed when below threshold (reclaim path)
//! - `forfeit_story` — mark Forfeited when above threshold but not top-ranked
//! - `contribute_losing_pool` — move Forfeited vault SOL → winner winning_pool
//! - `resolve_stakes` — mark a StakePosition claimable (20/80 / reclaim / forfeit)
//! - `claim_stake` — withdraw claimable from vault (preserves liquidity_reserve)

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("75xWzXGb3A7UgpqDDL9ByVXpaZ8Zw4AF4i7whnVXyh8m");

#[program]
pub mod narrative_auction {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        fee_bps: Option<u16>,
        min_stake: Option<u64>,
    ) -> Result<()> {
        initialize_config_handler(ctx, fee_bps, min_stake)
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        fee_bps: Option<u16>,
        min_stake: Option<u64>,
        treasury: Option<Pubkey>,
        curve_program: Option<Pubkey>,
    ) -> Result<()> {
        update_config_handler(ctx, fee_bps, min_stake, treasury, curve_program)
    }

    pub fn initialize_story(
        ctx: Context<InitializeStory>,
        content_hash: [u8; 32],
        duration: i64,
        graduation_threshold: Option<u64>,
    ) -> Result<()> {
        initialize_story_handler(ctx, content_hash, duration, graduation_threshold)
    }

    pub fn stake_on_narrative(ctx: Context<StakeOnNarrative>, amount: u64) -> Result<()> {
        stake_on_narrative_handler(ctx, amount)
    }

    pub fn graduate_narrative(ctx: Context<GraduateNarrative>, rank: u8) -> Result<()> {
        graduate_narrative_handler(ctx, rank)
    }

    pub fn fail_story(ctx: Context<FailStory>) -> Result<()> {
        fail_story_handler(ctx)
    }

    pub fn forfeit_story(ctx: Context<ForfeitStory>) -> Result<()> {
        forfeit_story_handler(ctx)
    }

    pub fn contribute_losing_pool(
        ctx: Context<ContributeLosingPool>,
        amount: Option<u64>,
    ) -> Result<()> {
        contribute_losing_pool_handler(ctx, amount)
    }

    pub fn resolve_stakes(ctx: Context<ResolveStakes>) -> Result<()> {
        resolve_stakes_handler(ctx)
    }

    pub fn claim_stake(ctx: Context<ClaimStake>) -> Result<()> {
        claim_stake_handler(ctx)
    }
}
