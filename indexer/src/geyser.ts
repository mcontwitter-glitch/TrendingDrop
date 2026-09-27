/**
 * Yellowstone / Geyser gRPC plan (scaffold).
 *
 * When `GEYSER_ENDPOINT` is set, a production indexer should:
 * 1. Connect via `@triton-one/yellowstone-grpc` (or equivalent)
 * 2. Subscribe to account updates where owner ∈ {
 *      NarrativeAuction, VelocityCurve, LoreMerge, ReputationNFT
 *    }
 * 3. Subscribe to transactions / logs mentioning those program IDs
 * 4. Decode with the same helpers in `decode.ts` and write to SQLite/Postgres
 * 5. On disconnect, fall back to RpcPoller until the stream recovers
 *
 * This module intentionally does **not** pull the heavy gRPC client yet —
 * poll mode is the default working path without Docker or a paid Geyser slot.
 */

import { config } from './config.js'

export type GeyserHandle = {
  stop: () => void
}

export function startGeyserScaffold(): GeyserHandle | null {
  if (!config.geyserEndpoint) {
    console.log('[geyser] GEYSER_ENDPOINT unset — using RPC poll mode only')
    return null
  }

  console.warn(
    `[geyser] endpoint configured (${config.geyserEndpoint}) but Yellowstone client is not wired yet.`,
  )
  console.warn(
    '[geyser] TODO: npm i @triton-one/yellowstone-grpc and subscribe to program owners.',
  )
  console.warn('[geyser] Falling back to RPC poll until Geyser consumer is implemented.')
  return {
    stop: () => {
      /* no-op scaffold */
    },
  }
}
