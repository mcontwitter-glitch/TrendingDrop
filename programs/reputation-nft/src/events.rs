use anchor_lang::prelude::*;

use crate::state::{ReputationTier, Trait};

#[event]
pub struct ProfileInitialized {
    pub profile: Pubkey,
    pub owner: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ProfileUpdated {
    pub profile: Pubkey,
    pub owner: Pubkey,
    pub was_correct: bool,
    pub volume: u64,
    pub accuracy_score: u16,
    pub tier: ReputationTier,
    pub total_predictions: u32,
    pub timestamp: i64,
}

#[event]
pub struct TraitAdded {
    pub profile: Pubkey,
    pub owner: Pubkey,
    pub trait_kind: Trait,
    pub timestamp: i64,
}
