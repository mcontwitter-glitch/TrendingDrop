use anchor_lang::prelude::*;

#[error_code]
pub enum VelocityError {
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Oracle data stale")]
    StaleOracle,
    #[msg("Invalid oracle proof / unauthorized oracle")]
    InvalidOracleProof,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Amount must be > 0")]
    ZeroAmount,
    #[msg("Insufficient holder balance")]
    InsufficientBalance,
    #[msg("Insufficient vault SOL for payout")]
    InsufficientVault,
    #[msg("Nothing claimable")]
    NothingToClaim,
    #[msg("Invalid curve parameters (base_price / curve_k)")]
    InvalidParams,
    #[msg("Curve is merged / trading paused")]
    TradingPaused,
    #[msg("Oracle weights must sum to 10000 bps")]
    InvalidOracleWeights,
    #[msg("Too many authorized oracles")]
    TooManyOracles,
    #[msg("story_id param mismatch")]
    StoryMismatch,
    #[msg("Insufficient distinct authorized oracle signers for quorum")]
    InsufficientOracleQuorum,
    #[msg("Duplicate oracle signer in attestation set")]
    DuplicateOracle,
    #[msg("Oracle remaining account is not a signer")]
    OracleNotSigner,
    #[msg("Oracle not in authorized set")]
    UnauthorizedOracle,
    #[msg("Oracle already authorized")]
    OracleAlreadyAuthorized,
    #[msg("Oracle not found in authorized set")]
    OracleNotFound,
    #[msg("Quorum must be between 1 and authorized oracle count")]
    InvalidQuorum,
    #[msg("Cannot remove oracle: would drop below quorum")]
    OracleRemovalBreaksQuorum,
    #[msg("Mint account does not match curve.mint")]
    MintMismatch,
    #[msg("Settlement amounts exceed target reserve / vault")]
    SettlementOverflow,
}

