use anchor_lang::prelude::*;

#[error_code]
pub enum LoreError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Amount must be > 0")]
    ZeroAmount,
    #[msg("Invalid VelocityCurve account owner")]
    InvalidCurveOwner,
    #[msg("Failed to deserialize VelocityCurve account")]
    InvalidCurveData,
    #[msg("Holder position does not belong to voter / curve")]
    InvalidHolder,
    #[msg("Insufficient absorber holdings to propose (>1% required)")]
    InsufficientHoldings,
    #[msg("Absorber and target must differ")]
    SameToken,
    #[msg("Absorber lore not old enough for merge (need 7 days)")]
    AbsorberTooYoung,
    #[msg("Target lore already absorbed")]
    TargetAlreadyAbsorbed,
    #[msg("Absorber lore is absorbed / inactive")]
    AbsorberInactive,
    #[msg("Voting period has ended")]
    VotingEnded,
    #[msg("Voting period not ended")]
    VotingActive,
    #[msg("Quorum not reached")]
    QuorumNotMet,
    #[msg("Proposal rejected (no >= yes)")]
    ProposalRejected,
    #[msg("Proposal already executed")]
    AlreadyExecuted,
    #[msg("Absorption history at max capacity (10)")]
    HistoryFull,
    #[msg("Vote amount exceeds holder voting power")]
    InsufficientVotingPower,
    #[msg("Already voted on this proposal")]
    AlreadyVoted,
    #[msg("Curve is_merged flag set")]
    CurveMerged,
    #[msg("Config velocity_curve_program mismatch")]
    CurveProgramMismatch,
    #[msg("Lore asset origin_curve mismatch")]
    LoreMismatch,
}
