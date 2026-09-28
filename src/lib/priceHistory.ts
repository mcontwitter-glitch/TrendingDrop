import { fdvMarketCapSol } from './format'

export interface PriceSample {
  t: number
  priceLamports: number
  supply?: number
  mcapSol?: number
}

const STORAGE_KEY = 'td.curve.priceHist.v1'
const MAX_SAMPLES = 180
const DEDUPE_MS = 5_000

type Store = Record<string, PriceSample[]>

const memory: Store = {}

function loadAll(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Store
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function persist(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Quota / private mode — keep in-memory only.
  }
}

function ensureKey(pubkey: string): PriceSample[] {
  if (!memory[pubkey]) {
    const all = loadAll()
    memory[pubkey] = Array.isArray(all[pubkey]) ? all[pubkey]! : []
  }
  return memory[pubkey]!
}

function saveKey(pubkey: string, samples: PriceSample[]): void {
  memory[pubkey] = samples
  const all = loadAll()
  all[pubkey] = samples
  persist(all)
}

/**
 * Record an on-chain spot sample. Skips if price is unchanged within ~5s;
 * always records when price moves.
 * `mcapSol` is launchpad FDV (price × 1B / 1e9), not circ × price.
 */
export function recordPriceSample(
  pubkey: string,
  priceLamports: number,
  supply?: number,
): PriceSample[] {
  if (!pubkey || !Number.isFinite(priceLamports) || priceLamports < 0) {
    return getPriceHistory(pubkey)
  }

  const samples = [...ensureKey(pubkey)]
  const now = Date.now()
  const last = samples[samples.length - 1]

  if (last) {
    const samePrice = last.priceLamports === priceLamports
    const withinWindow = now - last.t < DEDUPE_MS
    if (samePrice && withinWindow) {
      return samples
    }
  }

  const sample: PriceSample = {
    t: now,
    priceLamports,
    mcapSol: fdvMarketCapSol(priceLamports),
  }
  if (supply !== undefined && Number.isFinite(supply)) {
    sample.supply = supply
  }

  samples.push(sample)
  while (samples.length > MAX_SAMPLES) samples.shift()
  saveKey(pubkey, samples)
  return samples
}

export function getPriceHistory(pubkey: string): PriceSample[] {
  if (!pubkey) return []
  return [...ensureKey(pubkey)]
}

/** Seed history (e.g. mock curves) only when the key is empty. */
export function seedPriceHistory(pubkey: string, samples: PriceSample[]): void {
  if (!pubkey || !samples.length) return
  const existing = ensureKey(pubkey)
  if (existing.length > 0) return
  const capped = samples.slice(-MAX_SAMPLES)
  saveKey(pubkey, capped)
}

export function clearPriceHistory(pubkey?: string): void {
  if (pubkey) {
    delete memory[pubkey]
    const all = loadAll()
    delete all[pubkey]
    persist(all)
    return
  }
  for (const k of Object.keys(memory)) delete memory[k]
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
