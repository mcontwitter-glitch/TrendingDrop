import express from 'express'
import cors from 'cors'
import type { IndexerDb } from './db.js'
import { config } from './config.js'

const LAMPORTS_PER_SOL = 1_000_000_000

export function createApi(db: IndexerDb) {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      mode: db.getMeta('mode') ?? 'unknown',
      lastPollAt: Number(db.getMeta('last_poll_at') ?? 0),
      geyserConfigured: Boolean(config.geyserEndpoint),
    })
  })

  app.get('/api/stories', (_req, res) => {
    const rows = db.listStories()
    res.json({
      source: 'indexer',
      stories: rows.map((s) => ({
        id: s.pubkey,
        pubkey: s.pubkey,
        creator: s.creator,
        phase: s.phase,
        solStaked: s.total_staked / LAMPORTS_PER_SOL,
        stakerCount: s.unique_stakers,
        graduationThreshold: s.graduation_threshold / LAMPORTS_PER_SOL,
        endsAt: s.ends_at * 1000,
        contentHash: s.content_hash,
        updatedAt: s.updated_at,
        onChain: true,
      })),
    })
  })

  app.get('/api/activity', (_req, res) => {
    const limit = Math.min(Number(_req.query.limit ?? 50) || 50, 200)
    const rows = db.listActivity(limit)
    res.json({
      source: 'indexer',
      activity: rows.map((a) => ({
        id: a.id,
        type: a.type,
        message: a.message,
        storyId: a.story_id ?? undefined,
        amount: a.amount ?? undefined,
        signature: a.signature ?? undefined,
        timestamp: a.timestamp,
      })),
    })
  })

  app.get('/api/curves', (_req, res) => {
    const rows = db.listCurves()
    res.json({
      source: 'indexer',
      curves: rows.map((c) => ({
        id: c.pubkey,
        pubkey: c.pubkey,
        storyId: c.story_id,
        mint: c.mint,
        currentPriceLamports: c.current_price,
        currentSupply: c.current_supply,
        attentionScore: c.attention_score,
        priceVelocity: c.price_velocity,
        sellTaxBps: c.sell_tax_bps,
        solReserveSol: c.sol_reserve / LAMPORTS_PER_SOL,
        lastOracleUpdate: c.last_oracle_update,
        updatedAt: c.updated_at,
        onChain: true,
      })),
    })
  })

  return app
}
