use anchor_lang::prelude::*;

#[error_code]
pub enum ReputationError {
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Unauthorized profile update")]
    Unauthorized,
    #[msg("Profile already initialized")]
    AlreadyInitialized,
    #[msg("Trait list is full (max 8)")]
    TraitCapacity,
    #[msg("Trait already present on profile")]
    TraitDuplicate,
    #[msg("Invalid volume amount")]
    InvalidVolume,
}
