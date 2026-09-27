/** Stable pool of cyberpunk cover art for story / curve / merge card faces. */
export const TOKEN_COVERS = [
  '/tokens/kota.png',
  '/tokens/void.png',
  '/tokens/ssf.png',
  '/tokens/rbb.png',
  '/tokens/council.png',
  '/tokens/tick.png',
  '/tokens/ghost.png',
  '/tokens/pxph.png',
  '/tokens/noodle.png',
  '/tokens/ddog.png',
  '/tokens/laser.png',
  '/tokens/shhh.png',
  '/tokens/slow.png',
] as const

const TICKER_COVER: Record<string, string> = {
  KOTA: '/tokens/kota.png',
  VOID: '/tokens/void.png',
  SSF: '/tokens/ssf.png',
  RBB: '/tokens/rbb.png',
  COUNCIL: '/tokens/council.png',
  TICK: '/tokens/tick.png',
  GHOST: '/tokens/ghost.png',
  PXPH: '/tokens/pxph.png',
  NOODLE: '/tokens/noodle.png',
  DDOG: '/tokens/ddog.png',
  LASER: '/tokens/laser.png',
  SHHH: '/tokens/shhh.png',
  SLOW: '/tokens/slow.png',
}

export function coverForTicker(ticker: string): string {
  const key = ticker.trim().toUpperCase()
  return TICKER_COVER[key] ?? hashCover(key)
}

export function hashCover(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return TOKEN_COVERS[h % TOKEN_COVERS.length]
}
