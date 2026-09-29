//! # NarrativeAuction — Phase 1 of TrendingDrop
//!
//! Story Markets where users stake SOL on narratives before tokens exist.
//! Top narratives graduate to VelocityCurve: staker principal seeds the bonding
//! curve as the buy that backs their token airdrop (tokens only — no principal
//! reclaim). Losing stakes still split 20% winner SOL bonus / 80% curve liquidity.
//! Protocol takes `fee_bps` (default 2%) on stake. Below-threshold stories fail
//! with full principal reclaim.
//!
//! ## Instructions
//! - `initialize_config` / `update_config` — singleton protocol config
//! - `initialize_story` — open a new Active StoryMarket
//! - `stake_on_narrative` — stake SOL (fee → treasury, net → vault); enforces
//!   `max_stakes_per_user` via `UserStakeIndex` PDA `["user-stakes", user]`
//! - `graduate_narrative` — permissionless crank: seed curve + airdrop; `rank=0` = first free slot
//! - `fail_story` — mark Failed when below threshold (reclaim path)
//! - `forfeit_story` — mark Forfeited when above threshold but not top-ranked
//! - `contribute_losing_pool` — move Forfeited vault SOL → winner winning_pool
//! - `resolve_stakes` — Graduated: claimable = bonus only; Failed: principal; Forfeited: 0
//! - `claim_stake` — Graduated: token airdrop (+ optional bonus SOL); Failed: reclaim SOL
//! - `clamp_post_threshold` — permissionless: clamp ends_at for threshold-met Active stories

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
        staker_airdrop_bps: Option<u16>,
        post_threshold_secs: Option<i64>,
    ) -> Result<()> {
        update_config_handler(
            ctx,
            fee_bps,
            min_stake,
            treasury,
            curve_program,
            staker_airdrop_bps,
            post_threshold_secs,
        )
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

    pub fn clamp_post_threshold(ctx: Context<ClampPostThreshold>) -> Result<()> {
        clamp_post_threshold_handler(ctx)
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
