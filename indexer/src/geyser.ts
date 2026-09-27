/**
 * Yellowstone / Geyser gRPC consumer (scaffold).
 *
 * Production path when `GEYSER_ENDPOINT` is set (Helius LaserStream, Triton,
 * self-hosted Geyser plugin, etc.):
 *
 *   1. Connect via `@triton-one/yellowstone-grpc` (or equivalent)
 *      - endpoint:  process.env.GEYSER_ENDPOINT
 *      - x-token:   process.env.GEYSER_X_TOKEN || process.env.GEYSER_API_TOKEN
 *   2. Subscribe to account updates where owner ∈ {
 *        NarrativeAuction, VelocityCurve, LoreMerge, ReputationNFT
 *      }
 *   3. Subscribe to transactions / logs mentioning those program IDs
 *   4. Decode with the same helpers in `decode.ts` and write to SQLite/Postgres
 *   5. On disconnect, keep RpcPoller running until the stream recovers
 *
 * Poll mode remains the default. This module does **not** pull the heavy gRPC
 * client yet — no Docker / paid Geyser slot required for localnet.
 *
 * Env:
 *   GEYSER_ENDPOINT   — gRPC URL; unset/empty → return null (poll-only)
 *   GEYSER_X_TOKEN    — provider x-token (Helius / Triton)
 *   GEYSER_API_TOKEN  — alternate name for the same token
 */

import { config } from './config.js'

export type GeyserHandle = {
  /** Tear down the stream (no-op while scaffolded). */
  stop: () => void
  /** True once a live Yellowstone client is connected. */
  active: boolean
}

function geyserAuthToken(): string | undefined {
  const t =
    process.env.GEYSER_X_TOKEN?.trim() ||
    process.env.GEYSER_API_TOKEN?.trim() ||
    ''
  return t || undefined
}

/**
 * Start Geyser consumer if configured. Always safe to call:
 * - unset endpoint → null (caller uses RpcPoller only)
 * - set but client not wired → warn + null-ish handle; poll remains primary
 */
export function startGeyserScaffold(): GeyserHandle | null {
  const endpoint = config.geyserEndpoint?.trim()
  if (!endpoint) {
    console.log('[geyser] GEYSER_ENDPOINT unset — using RPC poll mode only')
    return null
  }

  const xToken = geyserAuthToken()
  console.log('[geyser] GEYSER_ENDPOINT set — Yellowstone scaffold (poll still primary)')
  console.log(`[geyser] endpoint=${endpoint}`)
  console.log(`[geyser] x-token=${xToken ? '(set)' : '(none — set GEYSER_X_TOKEN if required)'}`)

  // ---------------------------------------------------------------------------
  // Connection skeleton (not executed until @triton-one/yellowstone-grpc is added)
  //
  //   import Client from '@triton-one/yellowstone-grpc'
  //   const client = new Client(endpoint, xToken, { /* channel options */ })
  //   const stream = await client.subscribe()
  //   stream.write({
  //     accounts: {
  //       casino: {
  //         account: [],
  //         owner: [
  //           config.programs.narrativeAuction.toBase58(),
  //           config.programs.velocityCurve.toBase58(),
  //           config.programs.loreMerge.toBase58(),
  //           config.programs.reputationNft.toBase58(),
  //         ],
  //         filters: [],
  //       },
  //     },
  //     slots: {},
  //     transactions: {},
  //     transactionsStatus: {},
  //     blocks: {},
  //     blocksMeta: {},
  //     entry: {},
  //     accountsDataSlice: [],
  //     ping: undefined,
  //     commitment: /* CONFIRMED */,
  //   })
  //   stream.on('data', (update) => { /* decode.ts → db upsert */ })
  //   stream.on('error', (err) => { console.error('[geyser]', err) /* poll continues */ })
  // ---------------------------------------------------------------------------

  try {
    // Graceful no-op: do not throw if endpoint is set but client missing.
    console.warn(
      '[geyser] Yellowstone client not wired yet — install @triton-one/yellowstone-grpc and implement subscribe above.',
    )
    console.warn('[geyser] Falling back to RPC poll until Geyser consumer is implemented.')
    return {
      active: false,
      stop: () => {
        console.log('[geyser] stop (scaffold no-op)')
      },
    }
  } catch (err) {
    // Any future connect attempt should land here so poll mode stays up.
    console.error('[geyser] failed to start — continuing with RPC poll only', err)
    return null
  }
}
