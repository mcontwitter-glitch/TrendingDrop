//! # ReputationNFT — Dynamic prediction-accuracy reputation (Phase 4)
//!
//! Every participant gets a `TraderProfile` that evolves with prediction accuracy.
//! These are reputation collateral for future launch allocations — not just JPEGs.
//!
//! ## Accuracy
//! ```text
//! Accuracy = (Correct Predictions / Total Predictions) * Weighted_Volume_Factor
//! ```
//! Stored as 0–10_000 bps. Volume factor = 1.0 + min(volume_SOL, 5000)/10000 (cap 1.5x).
//!
//! ## Tier thresholds (bps)
//! - Bronze:  0–1999
//! - Silver:  2000–3999
//! - Gold:    4000–5999  (can create narratives without collateral)
//! - Diamond: 6000–7999  (can trigger emergency curve freezes)
//! - Mythic:  8000+      (top 1%)
//!
//! ## PDA seeds
//! - `TraderProfile` = `["profile", owner]`
//!
//! ## Metaplex
//! NFT mint / metadata sync is **deferred**. `TraderProfile.nft_mint` is reserved;
//! on-chain profile state (tier, accuracy, traits) is enough for Phase 4 UI badges.
//!
//! Call `update_profile` after NarrativeAuction resolve / LoreMerge execute.

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod math;
pub mod state;

use instructions::*;
use state::Trait;

declare_id!("DrzQKZpvg8y7Gymp5yz2upX24v3fV7j7eFuqT31Nxgvd");

pub use state::{
    ReputationTier, TraderProfile, MAX_TRAITS, TIER_DIAMOND_BPS, TIER_GOLD_BPS, TIER_MYTHIC_BPS,
    TIER_SILVER_BPS,
};

#[program]
pub mod reputation_nft {
    use super::*;

    /// Initialize an empty TraderProfile for `owner`.
    pub fn initialize_profile(ctx: Context<InitializeProfile>) -> Result<()> {
        initialize_profile_handler(ctx)
    }

    /// Record a prediction outcome and recompute accuracy / tier.
    pub fn update_profile(
        ctx: Context<UpdateProfile>,
        was_correct: bool,
        volume: u64,
        new_trait: Option<Trait>,
    ) -> Result<()> {
        update_profile_handler(ctx, was_correct, volume, new_trait)
    }

    /// Append a special trait (owner-signed).
    pub fn add_trait(ctx: Context<AddTrait>, new_trait: Trait) -> Result<()> {
        add_trait_handler(ctx, new_trait)
    }
}
