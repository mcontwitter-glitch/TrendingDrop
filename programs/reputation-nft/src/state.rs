use anchor_lang::prelude::*;

/// Max special traits stored on-chain (archive extras off-chain).
pub const MAX_TRAITS: usize = 8;

/// Volume unit for Weighted_Volume_Factor (1 SOL).
pub const VOLUME_UNIT_LAMPORTS: u64 = 1_000_000_000;
/// Cap on volume bonus applied to accuracy (50% = 5_000 bps).
pub const MAX_VOLUME_BONUS_BPS: u64 = 5_000;

/// Tier thresholds in accuracy bps (0–10_000).
/// - Bronze:  0–1999
/// - Silver:  2000–3999
/// - Gold:    4000–5999  (can create narratives without collateral)
/// - Diamond: 6000–7999  (can trigger emergency curve freezes)
/// - Mythic:  8000+      (top 1%)
pub const TIER_SILVER_BPS: u16 = 2_000;
pub const TIER_GOLD_BPS: u16 = 4_000;
pub const TIER_DIAMOND_BPS: u16 = 6_000;
pub const TIER_MYTHIC_BPS: u16 = 8_000;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum ReputationTier {
    Bronze,
    Silver,
    Gold,
    Diamond,
    Mythic,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace, Debug)]
pub enum Trait {
    /// Staked in first 100 narratives.
    EarlyAdopter,
    /// Predicted 5 attention spikes.
    OracleWhisperer,
    /// Participated in 3 successful merges.
    MergeMaster,
    /// Held through 3 volatility events.
    DiamondHands,
    /// Created a graduated narrative.
    NarrativeCreator,
}

/// Per-wallet prediction reputation profile.
/// Seeds = [b"profile", owner]
#[account]
#[derive(InitSpace)]
pub struct TraderProfile {
    pub owner: Pubkey,
    pub total_predictions: u32,
    pub correct_predictions: u32,
    /// Cumulative stake/trade volume in lamports.
    pub total_volume: u64,
    /// Accuracy in bps (0–10_000), includes Weighted_Volume_Factor.
    pub accuracy_score: u16,
    pub tier: ReputationTier,
    pub last_updated: i64,
    #[max_len(MAX_TRAITS)]
    pub special_traits: Vec<Trait>,
    /// Metaplex NFT mint pubkey (default until `mint_reputation_nft`).
    pub nft_mint: Pubkey,
    pub bump: u8,
}

impl TraderProfile {
    pub const SEED: &'static [u8] = b"profile";
}
