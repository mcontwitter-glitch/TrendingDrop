import type { TraderProfileView } from '../types'

/** Mock profile used when wallet connected but RPC empty / offline. */
export const MOCK_PROFILE_OWNER = '4B9M97u8aubkRDA2DxWrnD2GyADZgBgvoyDd5D8VTxnP'

export const mockTraderProfile: TraderProfileView = {
  pubkey: '4B9M97u8aubkRDA2DxWrnD2GyADZgBgvoyDd5D8VTxnP',
  owner: MOCK_PROFILE_OWNER,
  totalPredictions: 24,
  correctPredictions: 16,
  totalVolumeLamports: 42_500_000_000,
  accuracyScoreBps: 7_280,
  tier: 'Diamond',
  lastUpdated: Date.now() - 3 * 60 * 60_000,
  traits: ['EarlyAdopter', 'DiamondHands', 'OracleWhisperer'],
  nftMint: null,
  onChain: false,
}

/** Lightweight mock tier for StoryCard / TradeDesk creator chips. */
export const mockCreatorTiers: Record<string, TraderProfileView['tier']> = {
  '0aSd…9fGh': 'Gold',
  '7kLm…2pQr': 'Silver',
  '9xYz…4bNw': 'Bronze',
  '7xKq…9mF2': 'Mythic',
  '9pLm…2aXc': 'Diamond',
  '4nRt…8kQw': 'Gold',
  '2vBn…5pLo': 'Silver',
  '8cXy…1dEr': 'Gold',
  '5mKp…3zAs': 'Bronze',
  '1qWe…7nTy': 'Silver',
  '6hJu…0vBn': 'Gold',
  '3tYu…4iOp': 'Diamond',
  '9zXc…2vBn': 'Silver',
  '7bNm…5cVx': 'Bronze',
  '4rTy…8uIo': 'Gold',
}
