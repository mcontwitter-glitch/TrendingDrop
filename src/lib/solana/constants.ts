import { PublicKey, type Commitment } from '@solana/web3.js'

/** NarrativeAuction program id (localnet / devnet). Override with VITE_NARRATIVE_AUCTION_PROGRAM_ID. */
export const DEFAULT_PROGRAM_ID = '75xWzXGb3A7UgpqDDL9ByVXpaZ8Zw4AF4i7whnVXyh8m'

/** VelocityCurve program id (localnet / devnet). Override with VITE_VELOCITY_CURVE_PROGRAM_ID. */
export const DEFAULT_VELOCITY_CURVE_PROGRAM_ID =
  '5VbDjccBDNVCPLpSgxyuw7ptYekrcxH8FySBxaAXx6C'

/** LoreMerge program id. Override with VITE_LORE_MERGE_PROGRAM_ID. */
export const DEFAULT_LORE_MERGE_PROGRAM_ID = '8pSr3X9iP66rvqMWT4S2gsEGtS8VnCLZtJayY9NB9ySy'

/** ReputationNFT program id. Override with VITE_REPUTATION_NFT_PROGRAM_ID. */
export const DEFAULT_REPUTATION_NFT_PROGRAM_ID =
  'DrzQKZpvg8y7Gymp5yz2upX24v3fV7j7eFuqT31Nxgvd'

/** Default localnet RPC. Override with VITE_SOLANA_RPC_URL. */
export const DEFAULT_RPC_URL = 'http://127.0.0.1:8899'

export const COMMITMENT: Commitment = 'confirmed'

export const PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_NARRATIVE_AUCTION_PROGRAM_ID || DEFAULT_PROGRAM_ID,
)

export const VELOCITY_CURVE_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_VELOCITY_CURVE_PROGRAM_ID || DEFAULT_VELOCITY_CURVE_PROGRAM_ID,
)

export const LORE_MERGE_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_LORE_MERGE_PROGRAM_ID || DEFAULT_LORE_MERGE_PROGRAM_ID,
)

export const REPUTATION_NFT_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_REPUTATION_NFT_PROGRAM_ID || DEFAULT_REPUTATION_NFT_PROGRAM_ID,
)

/** @deprecated Prefer VELOCITY_CURVE_PROGRAM_ID — kept for NarrativeAuction config CPI. */
export const CURVE_PROGRAM_ID = VELOCITY_CURVE_PROGRAM_ID

export const RPC_URL: string = import.meta.env.VITE_SOLANA_RPC_URL || DEFAULT_RPC_URL

export const LAMPORTS_PER_SOL = 1_000_000_000

/** Default graduation threshold on-chain: 10 SOL. */
export const DEFAULT_GRADUATION_THRESHOLD_LAMPORTS = 10_000_000_000

/** Protocol fee on bonding-curve volume (1.5%). */
export const CURVE_FEE_BPS = 150
/** Sell tax when attention outpaces price (steepen). */
export const STEEPEN_TAX_BPS = 1_500
/** Sell tax when price outpaces attention (flatten). */
export const FLATTEN_TAX_BPS = 500
/** Lore merge fee (5%). */
export const MERGE_FEE_BPS = 500

export function clusterLabel(rpcUrl: string = RPC_URL): 'Localnet' | 'Devnet' | 'Mainnet' | 'Custom' {
  const u = rpcUrl.toLowerCase()
  if (u.includes('127.0.0.1') || u.includes('localhost')) return 'Localnet'
  if (u.includes('devnet')) return 'Devnet'
  if (u.includes('mainnet')) return 'Mainnet'
  return 'Custom'
}

/** Default staker airdrop share of notional 1B supply (20%). */
export const DEFAULT_STAKER_AIRDROP_BPS = 2000
