import type { ActivityEvent } from '../types'

const now = Date.now()
const MIN = 60 * 1000

export const activityFeed: ActivityEvent[] = [
  { id: 'a1', type: 'stake', message: '8xKp…3mNq staked 4.2 SOL on King of the Agents', storyId: 'kot-ai-agents', amount: 4.2, timestamp: now - 0.4 * MIN },
  { id: 'a2', type: 'new_story', message: 'New story listed: Neon Noodles ($NOODLE)', storyId: 'neon-noodles', timestamp: now - 2 * MIN },
  { id: 'a3', type: 'graduation', message: 'Degen Dog graduated to tokenization 🎓', storyId: 'graduated-degen-dog', timestamp: now - 5 * MIN },
  { id: 'a4', type: 'stake', message: '1qWe…2rTy staked 8.0 SOL on The Meme Council', storyId: 'meme-council', amount: 8.0, timestamp: now - 8 * MIN },
  { id: 'a5', type: 'near_threshold', message: 'The Meme Council is 89% to graduation', storyId: 'meme-council', timestamp: now - 12 * MIN },
  { id: 'a6', type: 'stake', message: '2aBc…9dEf staked 2.0 SOL on Void Cats', storyId: 'void-cats', amount: 2.0, timestamp: now - 15 * MIN },
  { id: 'a7', type: 'new_story', message: 'New story listed: Ghost Liquidity ($GHOST)', storyId: 'ghost-liquidity', timestamp: now - 22 * MIN },
  { id: 'a8', type: 'stake', message: '5gHi…1jKl staked 1.5 SOL on Pixel Prophet', storyId: 'pixel-prophet', amount: 1.5, timestamp: now - 28 * MIN },
  { id: 'a9', type: 'near_threshold', message: 'King of the Agents is 76% funded', storyId: 'kot-ai-agents', timestamp: now - 35 * MIN },
  { id: 'a10', type: 'stake', message: '9mNo…4pQr staked 0.69 SOL on Rugged But Based', storyId: 'rugged-but-based', amount: 0.69, timestamp: now - 41 * MIN },
  { id: 'a11', type: 'graduation', message: 'Laser Eyes Forever graduated 🎓', storyId: 'graduated-laser-eyes', timestamp: now - 50 * MIN },
  { id: 'a12', type: 'stake', message: '3sTu…7vWx staked 3.1 SOL on Solana Summer Forever', storyId: 'solana-summer-forever', amount: 3.1, timestamp: now - 58 * MIN },
]
