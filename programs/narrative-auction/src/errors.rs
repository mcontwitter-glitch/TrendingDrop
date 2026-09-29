use anchor_lang::prelude::*;

#[error_code]
pub enum NarrativeError {
    #[msg("Stake amount below minimum")]
    StakeTooSmall,
    #[msg("Story market is not Active")]
    NotActive,
    #[msg("Auction has already ended")]
    AuctionEnded,
    #[msg("Auction has not ended yet")]
    AuctionNotEnded,
    #[msg("Graduation threshold not met")]
    ThresholdNotMet,
    #[msg("Cannot fail: graduation threshold is met (graduate or forfeit instead)")]
    ThresholdMet,
    #[msg("Rank must be 1–5 for graduation")]
    InvalidRank,
    #[msg("Rank slot already occupied by another story")]
    RankTaken,
    #[msg("Story already resolved (Graduated, Failed, or Forfeited)")]
    AlreadyResolved,
    #[msg("Stake position already resolved")]
    StakeAlreadyResolved,
    #[msg("Stake already claimed")]
    AlreadyClaimed,
    #[msg("Nothing claimable on this position")]
    NothingToClaim,
    #[msg("Invalid fee bps (max 1000 = 10%)")]
    InvalidFeeBps,
    #[msg("Duration outside allowed graduation window")]
    InvalidDuration,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Content hash must be non-zero")]
    InvalidContentHash,
    #[msg("Story must be Forfeited to contribute losing stakes")]
    NotForfeited,
    #[msg("Destination must be Active or Graduated to receive losing pool")]
    InvalidContributeDest,
    #[msg("Vault has insufficient lamports (rent / liquidity reserve)")]
    InsufficientVault,
    #[msg("Contribute amount is zero or exceeds available")]
    InvalidContributeAmount,
    #[msg("Curve program id mismatch")]
    InvalidCurveProgram,
    #[msg("User has reached max_stakes_per_user open story stakes")]
    MaxStakesExceeded,
    #[msg("UserStakeIndex user mismatch")]
    StakeIndexMismatch,
    #[msg("Invalid staker airdrop bps (max 5000 = 50%)")]
    InvalidAirdropBps,
    #[msg("Stake airdrop already initialized for this story")]
    AirdropAlreadyInitialized,
    #[msg("Stake airdrop token vault mismatch")]
    AirdropVaultMismatch,
    #[msg("Airdrop claim receipt already exists")]
    AirdropAlreadyClaimed,
    #[msg("Airdrop share is zero")]
    NothingToAirdrop,
}

