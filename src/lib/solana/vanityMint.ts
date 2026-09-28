import { Keypair, PublicKey } from '@solana/web3.js'

/** Vanity suffix for VelocityCurve SPL mint addresses (case-sensitive base58). */
export const MINT_VANITY_SUFFIX = 'drop'

/** Yield to the event loop every this many attempts so browser UI stays responsive. */
const YIELD_EVERY = 2_000

/** ~58^4 ≈ 11M expected for a 4-char base58 suffix; allow headroom. */
const DEFAULT_MAX_ATTEMPTS = 50_000_000

export interface GrindMintOptions {
  /** Case-sensitive base58 suffix (default `drop`). */
  suffix?: string
  /** Abort after this many Keypair.generate() calls. */
  maxAttempts?: number
  /** Optional abort (e.g. component unmount / user cancel). */
  signal?: AbortSignal
  /** Called periodically with attempt count (after each yield batch). */
  onProgress?: (attempts: number) => void
}

/**
 * Grind ed25519 keypairs until `publicKey.toBase58().endsWith(suffix)`.
 * Yields to the event loop every {@link YIELD_EVERY} attempts.
 */
export async function grindMintKeypair(
  options: GrindMintOptions = {},
): Promise<Keypair> {
  const suffix = options.suffix ?? MINT_VANITY_SUFFIX
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const { signal, onProgress } = options

  if (!suffix) {
    throw new Error('vanity mint suffix must be non-empty')
  }

  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    if (signal?.aborted) {
      throw new Error(`Mint vanity grind aborted after ${attempts - 1} attempts (wanted …${suffix})`)
    }

    const kp = Keypair.generate()
    if (kp.publicKey.toBase58().endsWith(suffix)) {
      onProgress?.(attempts)
      return kp
    }

    if (attempts % YIELD_EVERY === 0) {
      onProgress?.(attempts)
      await new Promise<void>((r) => setTimeout(r, 0))
    }
  }

  throw new Error(
    `Mint vanity grind exceeded ${maxAttempts} attempts (wanted suffix …${suffix})`,
  )
}

/** True when the pubkey base58 ends with the vanity suffix (default `drop`). */
export function isVanityMint(
  pubkey: PublicKey | string,
  suffix: string = MINT_VANITY_SUFFIX,
): boolean {
  const s = typeof pubkey === 'string' ? pubkey : pubkey.toBase58()
  return s.endsWith(suffix)
}
