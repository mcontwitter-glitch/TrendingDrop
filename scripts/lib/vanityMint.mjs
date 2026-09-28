/**
 * Shared vanity grind for VelocityCurve SPL mint addresses (scripts).
 * Mirrors src/lib/solana/vanityMint.ts — keep suffix in sync.
 *
 * Scripts yield rarely (every 50k) so Node grind stays fast; the browser
 * helper yields more often for UI responsiveness.
 */
import { Keypair } from '@solana/web3.js'

export const MINT_VANITY_SUFFIX = 'drop'

const YIELD_EVERY = 50_000
const DEFAULT_MAX_ATTEMPTS = 50_000_000

/**
 * @param {{ suffix?: string, maxAttempts?: number, onProgress?: (n: number) => void }} [options]
 * @returns {Promise<import('@solana/web3.js').Keypair>}
 */
export async function grindMintKeypair(options = {}) {
  const suffix = options.suffix ?? MINT_VANITY_SUFFIX
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const onProgress = options.onProgress

  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    const kp = Keypair.generate()
    if (kp.publicKey.toBase58().endsWith(suffix)) {
      onProgress?.(attempts)
      return kp
    }
    if (attempts % YIELD_EVERY === 0) {
      onProgress?.(attempts)
      await new Promise((r) => setImmediate(r))
    }
  }

  throw new Error(
    `Mint vanity grind exceeded ${maxAttempts} attempts (wanted suffix …${suffix})`,
  )
}

/**
 * @param {import('@solana/web3.js').PublicKey | string} pubkey
 * @param {string} [suffix]
 */
export function isVanityMint(pubkey, suffix = MINT_VANITY_SUFFIX) {
  const s = typeof pubkey === 'string' ? pubkey : pubkey.toBase58()
  return s.endsWith(suffix)
}
