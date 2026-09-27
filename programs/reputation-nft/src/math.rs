use crate::state::{
    ReputationTier, MAX_VOLUME_BONUS_BPS, TIER_DIAMOND_BPS, TIER_GOLD_BPS, TIER_MYTHIC_BPS,
    TIER_SILVER_BPS, VOLUME_UNIT_LAMPORTS,
};

/// Map accuracy bps → ReputationTier (Bronze→Mythic).
pub fn tier_from_score(bps: u16) -> ReputationTier {
    match bps {
        0..=1999 => ReputationTier::Bronze,
        2000..=3999 => ReputationTier::Silver,
        4000..=5999 => ReputationTier::Gold,
        6000..=7999 => ReputationTier::Diamond,
        _ => ReputationTier::Mythic,
    }
}

/// Raw hit-rate in bps: (correct / total) * 10_000.
pub fn raw_accuracy_bps(correct: u32, total: u32) -> u16 {
    if total == 0 {
        return 0;
    }
    ((correct as u64).saturating_mul(10_000) / total as u64).min(10_000) as u16
}

/// Weighted_Volume_Factor in bps (10_000 = 1.0x).
///
/// ```text
/// factor = 10_000 + min(total_volume / 1_SOL, 5_000)
/// ```
/// Caps at 1.5x so volume alone cannot mint Mythic without accuracy.
pub fn volume_factor_bps(total_volume: u64) -> u64 {
    let units = total_volume / VOLUME_UNIT_LAMPORTS;
    10_000u64.saturating_add(units.min(MAX_VOLUME_BONUS_BPS))
}

/// Accuracy = (Correct / Total) * Weighted_Volume_Factor, capped at 10_000 bps.
pub fn compute_accuracy_score(correct: u32, total: u32, total_volume: u64) -> u16 {
    let raw = raw_accuracy_bps(correct, total) as u64;
    let factor = volume_factor_bps(total_volume);
    ((raw.saturating_mul(factor)) / 10_000).min(10_000) as u16
}

#[inline]
pub fn tier_thresholds() -> [(ReputationTier, u16); 5] {
    [
        (ReputationTier::Bronze, 0),
        (ReputationTier::Silver, TIER_SILVER_BPS),
        (ReputationTier::Gold, TIER_GOLD_BPS),
        (ReputationTier::Diamond, TIER_DIAMOND_BPS),
        (ReputationTier::Mythic, TIER_MYTHIC_BPS),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bronze_to_mythic() {
        assert_eq!(tier_from_score(0), ReputationTier::Bronze);
        assert_eq!(tier_from_score(1999), ReputationTier::Bronze);
        assert_eq!(tier_from_score(2000), ReputationTier::Silver);
        assert_eq!(tier_from_score(4000), ReputationTier::Gold);
        assert_eq!(tier_from_score(6000), ReputationTier::Diamond);
        assert_eq!(tier_from_score(8000), ReputationTier::Mythic);
    }

    #[test]
    fn volume_boosts_accuracy() {
        // 50% hit rate, 0 volume → 5000 bps Gold
        assert_eq!(compute_accuracy_score(5, 10, 0), 5_000);
        // 50% + 100 SOL volume → factor 1.1 → 5500
        assert_eq!(
            compute_accuracy_score(5, 10, 100 * VOLUME_UNIT_LAMPORTS),
            5_500
        );
    }
}
