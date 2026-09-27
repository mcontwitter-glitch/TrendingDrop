import { PublicKey } from '@solana/web3.js'

function env(key: string, fallback = ''): string {
  return process.env[key]?.trim() || fallback
}

export const config = {
  rpcUrl: env('RPC_URL', 'https://api.devnet.solana.com'),
  /** Yellowstone/Geyser gRPC endpoint. Empty → RPC poll mode. */
  geyserEndpoint: env('GEYSER_ENDPOINT'),
  databaseUrl: env('DATABASE_URL', 'sqlite:./data/indexer.db'),
  pollIntervalMs: Number(env('POLL_INTERVAL_MS', '15000')) || 15_000,
  port: Number(env('PORT', '8787')) || 8787,
  host: env('HOST', '0.0.0.0'),
  dryRun: env('INDEXER_DRY_RUN') === '1',
  programs: {
    narrativeAuction: new PublicKey(
      env(
        'NARRATIVE_AUCTION_PROGRAM_ID',
        '75xWzXGb3A7UgpqDDL9ByVXpaZ8Zw4AF4i7whnVXyh8m',
      ),
    ),
    velocityCurve: new PublicKey(
      env(
        'VELOCITY_CURVE_PROGRAM_ID',
        '5VbDjccBDNVCPLpSgxyuw7ptYekrcxH8FySBxaAXx6C',
      ),
    ),
    loreMerge: new PublicKey(
      env(
        'LORE_MERGE_PROGRAM_ID',
        '8pSr3X9iP66rvqMWT4S2gsEGtS8VnCLZtJayY9NB9ySy',
      ),
    ),
    reputationNft: new PublicKey(
      env(
        'REPUTATION_NFT_PROGRAM_ID',
        'DrzQKZpvg8y7Gymp5yz2upX24v3fV7j7eFuqT31Nxgvd',
      ),
    ),
  },
} as const

export function sqlitePathFromUrl(url: string): string {
  if (url.startsWith('sqlite:')) {
    return url.slice('sqlite:'.length) || './data/indexer.db'
  }
  // Postgres URLs are reserved for a later adapter; fall back to local sqlite.
  return './data/indexer.db'
}
