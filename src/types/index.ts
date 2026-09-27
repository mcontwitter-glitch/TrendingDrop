export type StoryStatus = 'active' | 'graduating' | 'graduated' | 'failed'

export interface Story {
  id: string
  title: string
  ticker: string
  blurb: string
  description: string
  emoji: string
  gradient: string
  solStaked: number
  stakerCount: number
  graduationThreshold: number
  endsAt: number
  status: StoryStatus
  creator: string
  socials?: {
    twitter?: string
    telegram?: string
    website?: string
  }
  createdAt: number
  /** On-chain StoryMarket pubkey (base58). Present when source is chain. */
  pubkey?: string
  /** Hex-encoded content_hash. */
  contentHash?: string
  /** True when this Story was mapped from an on-chain account. */
  onChain?: boolean
  /** Linked VelocityCurve pubkey when graduated (chain or mock). */
  curveId?: string
}

export interface Staker {
  address: string
  amount: number
  timestamp: number
}

export type ActivityType = 'stake' | 'new_story' | 'graduation' | 'near_threshold'

export interface ActivityEvent {
  id: string
  type: ActivityType
  message: string
  storyId?: string
  amount?: number
  timestamp: number
}

export type VelocityMode = 'steepen' | 'flatten' | 'neutral'

/** UI model for a VelocityCurve token. */
export interface CurveToken {
  id: string
  pubkey: string
  storyId: string
  mint: string
  title: string
  ticker: string
  blurb: string
  emoji: string
  gradient: string
  creator: string
  creatorPubkey: string
  basePriceLamports: number
  currentPriceLamports: number
  currentSupply: number
  attentionScore: number
  priceVelocity: number
  curveK: number
  sellTaxBps: number
  mode: VelocityMode
  solReserveSol: number
  solReserveLamports: number
  holderRewardsPoolLamports: number
  rewardIndex: bigint
  mergeCount: number
  isMerged: boolean
  lastOracleUpdate: number
  onChain: boolean
  /** Sparkline samples for attention (optional mock history). */
  attentionHistory?: number[]
  /** Sparkline samples for price velocity. */
  velocityHistory?: number[]
}

export interface HolderPositionView {
  owner: string
  curve: string
  balance: number
  entryPriceLamports: number
  claimableRewardsLamports: number
  lorePower: number
  lastClaimAt: number
}

export type ReputationTierName = 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Mythic'

export type TraitName =
  | 'EarlyAdopter'
  | 'OracleWhisperer'
  | 'MergeMaster'
  | 'DiamondHands'
  | 'NarrativeCreator'

/** UI model for ReputationNFT TraderProfile. */
export interface TraderProfileView {
  pubkey: string
  owner: string
  totalPredictions: number
  correctPredictions: number
  totalVolumeLamports: number
  accuracyScoreBps: number
  tier: ReputationTierName
  lastUpdated: number
  traits: TraitName[]
  nftMint: string | null
  onChain: boolean
  bump?: number
}

export type MergeProposalStatus = 'active' | 'passed' | 'rejected' | 'executed' | 'pending_settlement'

/** UI model for LoreMerge MergeProposal. */
export interface MergeProposalView {
  id: string
  pubkey: string
  absorber: string
  target: string
  absorberTicker: string
  absorberTitle: string
  absorberEmoji: string
  targetTicker: string
  targetTitle: string
  targetEmoji: string
  proposer: string
  proposedAt: number
  votingEnds: number
  yesVotes: number
  noVotes: number
  quorumRequired: number
  executed: boolean
  absorptionRatio: number
  feeLamports: number
  liquidityLamports: number
  settlementPending: boolean
  status: MergeProposalStatus
  onChain: boolean
}

/** UI model for LoreAsset. */
export interface LoreAssetView {
  pubkey: string
  originStory: string
  originCurve: string
  currentHolder: string
  contentHashHex: string
  absorptionHistory: string[]
  loreValueLamports: number
  lorePowerBps: number
  registeredAt: number
  isAbsorbed: boolean
  ticker: string
  title: string
  emoji: string
  onChain: boolean
}
