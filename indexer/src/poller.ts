import { Connection, PublicKey } from '@solana/web3.js'
import type { IndexerDb } from './db.js'
import { config } from './config.js'
import {
  decodeStoryMarket,
  decodeVelocityToken,
  PHASE_LABEL,
} from './decode.js'

const LAMPORTS_PER_SOL = 1_000_000_000

function shortKey(k: string): string {
  return k.length > 8 ? `${k.slice(0, 4)}…${k.slice(-4)}` : k
}

export class RpcPoller {
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false

  constructor(
    private readonly connection: Connection,
    private readonly db: IndexerDb,
  ) {}

  start() {
    if (this.timer) return
    void this.tick()
    this.timer = setInterval(() => void this.tick(), config.pollIntervalMs)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async tick() {
    if (this.running) return
    this.running = true
    const now = Date.now()
    try {
      await Promise.all([this.pollStories(now), this.pollCurves(now)])
      this.db.setMeta('last_poll_at', String(now))
      this.db.setMeta('mode', config.geyserEndpoint ? 'geyser+poll' : 'rpc-poll')
    } catch (err) {
      console.error('[poller] tick failed', err)
    } finally {
      this.running = false
    }
  }

  private async pollStories(now: number) {
    const accounts = await this.connection.getProgramAccounts(
      config.programs.narrativeAuction,
      { commitment: 'confirmed' },
    )
    for (const { pubkey, account } of accounts) {
      const decoded = decodeStoryMarket(Buffer.from(account.data))
      if (!decoded) continue
      const pk = pubkey.toBase58()
      const prev = this.db.listStories(10_000).find((s) => s.pubkey === pk)
      this.db.upsertStory({
        pubkey: pk,
        creator: decoded.creator,
        phase: decoded.phase,
        total_staked: decoded.totalStaked,
        unique_stakers: decoded.uniqueStakers,
        ends_at: decoded.endsAt,
        graduation_threshold: decoded.graduationThreshold,
        content_hash: decoded.contentHash,
        updated_at: now,
      })

      const sol = decoded.totalStaked / LAMPORTS_PER_SOL
      if (!prev) {
        this.db.insertActivity({
          id: `story-${pk}-${now}`,
          type: 'new_story',
          message: `Indexed story ${shortKey(pk)} (${PHASE_LABEL[decoded.phase] ?? decoded.phase})`,
          story_id: pk,
          amount: null,
          signature: null,
          timestamp: now,
        })
      } else if (decoded.totalStaked > prev.total_staked) {
        const delta = (decoded.totalStaked - prev.total_staked) / LAMPORTS_PER_SOL
        this.db.insertActivity({
          id: `stake-${pk}-${decoded.totalStaked}`,
          type: 'stake',
          message: `${shortKey(decoded.creator)} stake update on ${shortKey(pk)} (+${delta.toFixed(2)} SOL)`,
          story_id: pk,
          amount: delta,
          signature: null,
          timestamp: now,
        })
      } else if (decoded.phase === 2 && prev.phase !== 2) {
        this.db.insertActivity({
          id: `grad-${pk}`,
          type: 'graduation',
          message: `Story ${shortKey(pk)} graduated 🎓`,
          story_id: pk,
          amount: sol,
          signature: null,
          timestamp: now,
        })
      } else if (
        decoded.phase === 1 &&
        decoded.graduationThreshold > 0 &&
        decoded.totalStaked / decoded.graduationThreshold >= 0.75
      ) {
        this.db.insertActivity({
          id: `near-${pk}-${Math.floor(sol)}`,
          type: 'near_threshold',
          message: `Story ${shortKey(pk)} is near graduation (${sol.toFixed(1)} SOL)`,
          story_id: pk,
          amount: sol,
          signature: null,
          timestamp: now,
        })
      }
    }
    console.log(`[poller] stories=${accounts.length}`)
  }

  private async pollCurves(now: number) {
    const accounts = await this.connection.getProgramAccounts(
      config.programs.velocityCurve,
      { commitment: 'confirmed' },
    )
    for (const { pubkey, account } of accounts) {
      const decoded = decodeVelocityToken(Buffer.from(account.data))
      if (!decoded) continue
      this.db.upsertCurve({
        pubkey: pubkey.toBase58(),
        story_id: decoded.storyId,
        mint: decoded.mint,
        current_price: decoded.currentPrice,
        current_supply: decoded.currentSupply,
        attention_score: decoded.attentionScore,
        price_velocity: decoded.priceVelocity,
        sell_tax_bps: decoded.sellTaxBps,
        sol_reserve: decoded.solReserve,
        last_oracle_update: decoded.lastOracleUpdate,
        updated_at: now,
      })
    }
    console.log(`[poller] curves=${accounts.length}`)
  }
}

/** Optional log subscription for richer activity (RPC mode). */
export function subscribeProgramLogs(
  connection: Connection,
  db: IndexerDb,
  programId: PublicKey,
  label: string,
) {
  return connection.onLogs(
    programId,
    (log) => {
      if (log.err) return
      const now = Date.now()
      const sig = log.signature
      const joined = log.logs.join(' ')
      let type = 'activity'
      let message = `${label} tx ${shortKey(sig)}`
      if (/stake/i.test(joined)) {
        type = 'stake'
        message = `Stake activity (${label}) ${shortKey(sig)}`
      } else if (/graduat/i.test(joined)) {
        type = 'graduation'
        message = `Graduation (${label}) ${shortKey(sig)}`
      } else if (/AttentionUpdated|update_attention/i.test(joined)) {
        type = 'oracle'
        message = `Attention update (${label}) ${shortKey(sig)}`
      }
      db.insertActivity({
        id: `log-${sig}`,
        type,
        message,
        story_id: null,
        amount: null,
        signature: sig,
        timestamp: now,
      })
    },
    'confirmed',
  )
}
