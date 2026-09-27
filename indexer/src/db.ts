import initSqlJs, { type Database } from 'sql.js'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { sqlitePathFromUrl } from './config.js'

const require = createRequire(import.meta.url)

export type StoryRow = {
  pubkey: string
  creator: string
  phase: number
  total_staked: number
  unique_stakers: number
  ends_at: number
  graduation_threshold: number
  content_hash: string
  updated_at: number
}

export type CurveRow = {
  pubkey: string
  story_id: string
  mint: string
  current_price: number
  current_supply: number
  attention_score: number
  price_velocity: number
  sell_tax_bps: number
  sol_reserve: number
  last_oracle_update: number
  updated_at: number
}

export type ActivityRow = {
  id: string
  type: string
  message: string
  story_id: string | null
  amount: number | null
  signature: string | null
  timestamp: number
}

export class IndexerDb {
  private db!: Database
  private filePath!: string
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  static async open(databaseUrl: string): Promise<IndexerDb> {
    const self = new IndexerDb()
    const file = sqlitePathFromUrl(databaseUrl)
    self.filePath = path.resolve(file)
    fs.mkdirSync(path.dirname(self.filePath), { recursive: true })

    const wasmPath = path.join(
      path.dirname(require.resolve('sql.js')),
      'sql-wasm.wasm',
    )
    const SQL = await initSqlJs({
      locateFile: () => wasmPath,
    })

    if (fs.existsSync(self.filePath)) {
      const buf = fs.readFileSync(self.filePath)
      self.db = new SQL.Database(buf)
    } else {
      self.db = new SQL.Database()
    }
    self.migrate()
    self.persist()
    return self
  }

  private migrate() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS stories (
        pubkey TEXT PRIMARY KEY,
        creator TEXT NOT NULL,
        phase INTEGER NOT NULL,
        total_staked INTEGER NOT NULL,
        unique_stakers INTEGER NOT NULL,
        ends_at INTEGER NOT NULL,
        graduation_threshold INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS curves (
        pubkey TEXT PRIMARY KEY,
        story_id TEXT NOT NULL,
        mint TEXT NOT NULL,
        current_price INTEGER NOT NULL,
        current_supply INTEGER NOT NULL,
        attention_score INTEGER NOT NULL,
        price_velocity INTEGER NOT NULL,
        sell_tax_bps INTEGER NOT NULL,
        sol_reserve INTEGER NOT NULL,
        last_oracle_update INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS activity (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        story_id TEXT,
        amount REAL,
        signature TEXT,
        timestamp INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity(timestamp DESC);
    `)
  }

  private schedulePersist() {
    if (this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      this.persist()
    }, 250)
  }

  persist() {
    const data = this.db.export()
    fs.writeFileSync(this.filePath, Buffer.from(data))
  }

  upsertStory(row: StoryRow) {
    this.db.run(
      `INSERT INTO stories (
        pubkey, creator, phase, total_staked, unique_stakers,
        ends_at, graduation_threshold, content_hash, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(pubkey) DO UPDATE SET
        creator=excluded.creator,
        phase=excluded.phase,
        total_staked=excluded.total_staked,
        unique_stakers=excluded.unique_stakers,
        ends_at=excluded.ends_at,
        graduation_threshold=excluded.graduation_threshold,
        content_hash=excluded.content_hash,
        updated_at=excluded.updated_at`,
      [
        row.pubkey,
        row.creator,
        row.phase,
        row.total_staked,
        row.unique_stakers,
        row.ends_at,
        row.graduation_threshold,
        row.content_hash,
        row.updated_at,
      ],
    )
    this.schedulePersist()
  }

  upsertCurve(row: CurveRow) {
    this.db.run(
      `INSERT INTO curves (
        pubkey, story_id, mint, current_price, current_supply,
        attention_score, price_velocity, sell_tax_bps, sol_reserve,
        last_oracle_update, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(pubkey) DO UPDATE SET
        story_id=excluded.story_id,
        mint=excluded.mint,
        current_price=excluded.current_price,
        current_supply=excluded.current_supply,
        attention_score=excluded.attention_score,
        price_velocity=excluded.price_velocity,
        sell_tax_bps=excluded.sell_tax_bps,
        sol_reserve=excluded.sol_reserve,
        last_oracle_update=excluded.last_oracle_update,
        updated_at=excluded.updated_at`,
      [
        row.pubkey,
        row.story_id,
        row.mint,
        row.current_price,
        row.current_supply,
        row.attention_score,
        row.price_velocity,
        row.sell_tax_bps,
        row.sol_reserve,
        row.last_oracle_update,
        row.updated_at,
      ],
    )
    this.schedulePersist()
  }

  insertActivity(row: ActivityRow) {
    this.db.run(
      `INSERT OR IGNORE INTO activity
        (id, type, message, story_id, amount, signature, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.type,
        row.message,
        row.story_id,
        row.amount,
        row.signature,
        row.timestamp,
      ],
    )
    this.schedulePersist()
  }

  private allRows<T>(sql: string, params: (string | number)[] = []): T[] {
    const stmt = this.db.prepare(sql)
    stmt.bind(params)
    const out: T[] = []
    while (stmt.step()) {
      out.push(stmt.getAsObject() as T)
    }
    stmt.free()
    return out
  }

  listStories(limit = 100): StoryRow[] {
    return this.allRows<StoryRow>(
      `SELECT * FROM stories ORDER BY total_staked DESC LIMIT ?`,
      [limit],
    )
  }

  listCurves(limit = 100): CurveRow[] {
    return this.allRows<CurveRow>(
      `SELECT * FROM curves ORDER BY attention_score DESC LIMIT ?`,
      [limit],
    )
  }

  listActivity(limit = 50): ActivityRow[] {
    return this.allRows<ActivityRow>(
      `SELECT * FROM activity ORDER BY timestamp DESC LIMIT ?`,
      [limit],
    )
  }

  setMeta(key: string, value: string) {
    this.db.run(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [key, value],
    )
    this.schedulePersist()
  }

  getMeta(key: string): string | null {
    const rows = this.allRows<{ value: string }>(
      `SELECT value FROM meta WHERE key = ?`,
      [key],
    )
    return rows[0]?.value ?? null
  }
}
