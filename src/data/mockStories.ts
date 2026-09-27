import type { Story, Staker } from '../types'

const HOUR = 60 * 60 * 1000
const now = Date.now()

export const GRADUATION_DEFAULT = 69

export const stories: Story[] = [
  {
    id: 'kot-ai-agents',
    title: 'King of the Agents',
    ticker: 'KOTA',
    blurb: 'Autonomous AI agents that tip each other in SOL and roast humans on-chain.',
    description:
      'Imagine a pantheon of agent personalities living on Solana — they trade memes, tip creators, and compete for narrative dominance. King of the Agents is the lore layer before the token: stake if you believe agent culture eats social feeds alive. Graduates into a bonding-curve launch with agent-themed utility later.',
    emoji: '🤖',
    imageUrl: '/tokens/kota.png',
    gradient: 'from-cyan-500/40 via-teal-400/20 to-blue-900/40',
    solStaked: 52.4,
    stakerCount: 187,
    graduationThreshold: GRADUATION_DEFAULT,
    endsAt: now + 6 * HOUR,
    status: 'graduating',
    creator: '7xKq…9mF2',
    socials: { twitter: 'https://x.com', telegram: 'https://t.me' },
    createdAt: now - 18 * HOUR,
  },
  {
    id: 'void-cats',
    title: 'Void Cats',
    ticker: 'VOID',
    blurb: 'Cats that fell into the blockchain and came back neon.',
    description:
      'They say the first Void Cat appeared when a JPEG got rugged so hard it punched a hole in memespace. Now the litter multiplies whenever someone says "wen." Stake on the lore that absorbs every cat coin ever launched.',
    emoji: '🐈‍⬛',
    imageUrl: '/tokens/void.png',
    gradient: 'from-sky-500/40 via-cyan-400/20 to-indigo-900/40',
    solStaked: 41.2,
    stakerCount: 143,
    graduationThreshold: GRADUATION_DEFAULT,
    endsAt: now + 14 * HOUR,
    status: 'active',
    creator: '9pLm…2aXc',
    socials: { twitter: 'https://x.com' },
    createdAt: now - 10 * HOUR,
  },
  {
    id: 'solana-summer-forever',
    title: 'Solana Summer Forever',
    ticker: 'SSF',
    blurb: 'It is always summer on Solana. The chain never leaves the beach.',
    description:
      'A perennial narrative auction for eternal vibes: beach, speed, and absurdly cheap fees. If this graduates, the token becomes the official merch of never-ending summer — sunsets, boardwalks, and 400ms block times.',
    emoji: '🌴',
    imageUrl: '/tokens/ssf.png',
    gradient: 'from-amber-400/40 via-orange-500/25 to-yellow-300/20',
    solStaked: 38.7,
    stakerCount: 211,
    graduationThreshold: GRADUATION_DEFAULT,
    endsAt: now + 22 * HOUR,
    status: 'active',
    creator: '4nRt…8kQw',
    createdAt: now - 26 * HOUR,
  },
  {
    id: 'rugged-but-based',
    title: 'Rugged But Based',
    ticker: 'RBB',
    blurb: 'The anti-hero of degen lore. Getting rugged is a personality trait.',
    description:
      'Not financial advice — a story about resilience. Every chart that went to zero becomes lore. Stake if you think the culture of surviving rugs is hotter than any green candle.',
    emoji: '💀',
    imageUrl: '/tokens/rbb.png',
    gradient: 'from-cyan-500/35 via-teal-600/20 to-slate-800/40',
    solStaked: 29.1,
    stakerCount: 98,
    graduationThreshold: GRADUATION_DEFAULT,
    endsAt: now + 31 * HOUR,
    status: 'active',
    creator: '2vBn…5pLo',
    socials: { telegram: 'https://t.me' },
    createdAt: now - 8 * HOUR,
  },
  {
    id: 'meme-council',
    title: 'The Meme Council',
    ticker: 'COUNCIL',
    blurb: 'Twelve anonymous frogs decide which narratives live.',
    description:
      'A DAO of frogs in hoodies who never dox. They vote on stories, roast submissions, and crown seasonal kings. Phase 1 is the auction for the council mythos itself.',
    emoji: '🐸',
    imageUrl: '/tokens/council.png',
    gradient: 'from-sky-500/40 via-cyan-300/25 to-teal-700/30',
    solStaked: 61.8,
    stakerCount: 256,
    graduationThreshold: GRADUATION_DEFAULT,
    endsAt: now + 3 * HOUR,
    status: 'graduating',
    creator: '8cXy…1dEr',
    socials: { twitter: 'https://x.com', website: 'https://example.com' },
    createdAt: now - 40 * HOUR,
  },
  {
    id: 'clockwork-ape',
    title: 'Clockwork Ape',
    ticker: 'TICK',
    blurb: 'An ape wound by a spring who only wakes when TPS peaks.',
    description:
      'Mechanical primate energy. When Solana culms, the ape ticks louder. Narrative fuel for a token that celebrates reliability theater and banana-shaped charts.',
    emoji: '🦧',
    imageUrl: '/tokens/tick.png',
    gradient: 'from-amber-500/35 via-yellow-600/25 to-cyan-900/30',
    solStaked: 18.4,
    stakerCount: 67,
    graduationThreshold: GRADUATION_DEFAULT,
    endsAt: now + 40 * HOUR,
    status: 'active',
    creator: '5mKp…3zAs',
    createdAt: now - 5 * HOUR,
  },
  {
    id: 'ghost-liquidity',
    title: 'Ghost Liquidity',
    ticker: 'GHOST',
    blurb: 'Liquidity that appears at 3am and vanishes by sunrise.',
    description:
      'A spooky market myth: phantom depth, haunted order books, candles that scream. Stake if you believe the scariest stories make the best memes.',
    emoji: '👻',
    imageUrl: '/tokens/ghost.png',
    gradient: 'from-slate-400/30 via-indigo-500/25 to-blue-900/40',
    solStaked: 12.6,
    stakerCount: 44,
    graduationThreshold: GRADUATION_DEFAULT,
    endsAt: now + 45 * HOUR,
    status: 'active',
    creator: '1qWe…7nTy',
    createdAt: now - 3 * HOUR,
  },
  {
    id: 'pixel-prophet',
    title: 'Pixel Prophet',
    ticker: 'PXPH',
    blurb: 'An 8-bit oracle that only speaks in candle patterns.',
    description:
      'Retro fortune-telling for degens. The prophet predicted three pumps and one existential crisis. This auction decides if the lore graduates into a tradable relic.',
    emoji: '🕹️',
    imageUrl: '/tokens/pxph.png',
    gradient: 'from-teal-500/35 via-cyan-400/20 to-amber-500/25',
    solStaked: 24.9,
    stakerCount: 89,
    graduationThreshold: GRADUATION_DEFAULT,
    endsAt: now + 19 * HOUR,
    status: 'active',
    creator: '6hJu…0vBn',
    socials: { twitter: 'https://x.com' },
    createdAt: now - 12 * HOUR,
  },
  {
    id: 'neon-noodles',
    title: 'Neon Noodles',
    ticker: 'NOODLE',
    blurb: 'Cyberpunk ramen that wires your brain to the order book.',
    description:
      'Late-night bowl energy. Steam rises in hex neon. If this story graduates, expect a bonding curve flavored like midnight hunger and chrome chopsticks.',
    emoji: '🍜',
    imageUrl: '/tokens/noodle.png',
    gradient: 'from-cyan-400/35 via-sky-500/20 to-blue-600/30',
    solStaked: 9.3,
    stakerCount: 31,
    graduationThreshold: GRADUATION_DEFAULT,
    endsAt: now + 47 * HOUR,
    status: 'active',
    creator: '3tYu…4iOp',
    createdAt: now - 2 * HOUR,
  },
  {
    id: 'graduated-degen-dog',
    title: 'Degen Dog',
    ticker: 'DDOG',
    blurb: 'The goodest boy who only fetches green candles.',
    description:
      'Graduated narrative. Degen Dog already won the auction and moved to tokenization. This page is historical lore for the pack that believed early.',
    emoji: '🐕',
    imageUrl: '/tokens/ddog.png',
    gradient: 'from-cyan-400/40 via-sky-500/25 to-blue-900/30',
    solStaked: 72.0,
    stakerCount: 312,
    graduationThreshold: GRADUATION_DEFAULT,
    endsAt: now - 2 * HOUR,
    status: 'graduated',
    curveId: '3xE6mWJQQXyUKBtqeYUw24HS3Hn4Q1Ej4UhfkMrX3ZLC',
    creator: '0aSd…9fGh',
    socials: { twitter: 'https://x.com', telegram: 'https://t.me' },
    createdAt: now - 72 * HOUR,
  },
  {
    id: 'graduated-laser-eyes',
    title: 'Laser Eyes Forever',
    ticker: 'LASER',
    blurb: 'Everyone got laser eyes. Nobody asked for permission.',
    description:
      'A graduated classic. The narrative auction filled, the story became a token, and the lasers never turned off.',
    emoji: '👀',
    imageUrl: '/tokens/laser.png',
    gradient: 'from-amber-400/40 via-yellow-500/30 to-cyan-600/20',
    solStaked: 80.5,
    stakerCount: 401,
    graduationThreshold: GRADUATION_DEFAULT,
    endsAt: now - 20 * HOUR,
    status: 'graduated',
    curveId: 'C2GcfSG2VCDWgs2dmTMs9sje96SxUzVyWm6y8yhVHwHS',
    creator: '9zXc…2vBn',
    createdAt: now - 96 * HOUR,
  },
  {
    id: 'failed-quiet-coin',
    title: 'Quiet Coin',
    ticker: 'SHHH',
    blurb: 'A narrative so quiet nobody heard it.',
    description:
      'Failed to hit the graduation threshold before the auction clock ran out. A reminder that not every story deserves a bonding curve — yet.',
    emoji: '🤫',
    imageUrl: '/tokens/shhh.png',
    gradient: 'from-slate-600/40 via-cyan-900/30 to-slate-900/40',
    solStaked: 4.2,
    stakerCount: 12,
    graduationThreshold: GRADUATION_DEFAULT,
    endsAt: now - 5 * HOUR,
    status: 'failed',
    creator: '7bNm…5cVx',
    createdAt: now - 53 * HOUR,
  },
  {
    id: 'failed-slow-llama',
    title: 'Slow Llama',
    ticker: 'SLOW',
    blurb: 'The llama that refused to rush the meta.',
    description:
      'Auction expired under threshold. Charming lore, thin conviction. Maybe next season.',
    emoji: '🦙',
    imageUrl: '/tokens/slow.png',
    gradient: 'from-slate-500/35 via-amber-700/20 to-cyan-900/35',
    solStaked: 7.8,
    stakerCount: 22,
    graduationThreshold: GRADUATION_DEFAULT,
    endsAt: now - 12 * HOUR,
    status: 'failed',
    creator: '4rTy…8uIo',
    createdAt: now - 60 * HOUR,
  },
]

export function getStoryById(id: string): Story | undefined {
  return stories.find((s) => s.id === id)
}

export function getKingOfTheHill(): Story {
  return [...stories]
    .filter((s) => s.status === 'active' || s.status === 'graduating')
    .sort((a, b) => b.solStaked - a.solStaked)[0]
}

export const mockStakers: Record<string, Staker[]> = {
  'kot-ai-agents': [
    { address: '8xKp…3mNq', amount: 4.2, timestamp: now - 0.5 * HOUR },
    { address: '2aBc…9dEf', amount: 2.0, timestamp: now - 1.2 * HOUR },
    { address: '5gHi…1jKl', amount: 6.5, timestamp: now - 2 * HOUR },
    { address: '9mNo…4pQr', amount: 1.1, timestamp: now - 3.5 * HOUR },
    { address: '3sTu…7vWx', amount: 3.8, timestamp: now - 5 * HOUR },
    { address: '6yZa…0bCd', amount: 0.5, timestamp: now - 7 * HOUR },
  ],
  'meme-council': [
    { address: '1qWe…2rTy', amount: 8.0, timestamp: now - 0.3 * HOUR },
    { address: '4uIo…5pAs', amount: 3.3, timestamp: now - 1 * HOUR },
    { address: '7dFg…8hJk', amount: 5.1, timestamp: now - 2.4 * HOUR },
    { address: '0lZx…9cVb', amount: 2.2, timestamp: now - 4 * HOUR },
  ],
}

export function getStakersForStory(storyId: string): Staker[] {
  if (mockStakers[storyId]) return mockStakers[storyId]
  // Generate consistent-ish mock stakers from story id hash
  const base = storyId.length * 17
  return [
    { address: `${(base % 9) + 1}aBc…${(base % 7) + 1}dEf`, amount: 2.4, timestamp: now - 1 * HOUR },
    { address: `${(base % 5) + 2}gHi…${(base % 8) + 2}jKl`, amount: 1.0, timestamp: now - 2.5 * HOUR },
    { address: `${(base % 6) + 3}mNo…${(base % 4) + 3}pQr`, amount: 3.7, timestamp: now - 4 * HOUR },
    { address: `${(base % 8) + 1}sTu…${(base % 9) + 1}vWx`, amount: 0.8, timestamp: now - 6 * HOUR },
  ]
}
