/**
 * Off-chain narrative metadata cache.
 *
 * On-chain StoryMarket only stores content_hash — title/ticker/blurb/image live here.
 * Lookup order: localStorage (creator browser) merged with shared public/meta/stories.json
 * → caller fallback. Names/covers are local-only unless added to public/meta/stories.json
 * for cross-browser / GitHub Pages viewers.
 */

export interface NarrativeMetadata {
  title: string
  ticker: string
  blurb: string
  description: string
  /**
   * Cover art URL: `/meta/covers/<pubkey>.jpg` (Pages-static) or a compressed
   * `data:image/jpeg;base64,…` from Create Story (localStorage / registry).
   */
  image?: string
  /** Alias for `image` (accepted when reading shared registry entries). */
  coverUrl?: string
  socials?: {
    twitter?: string
    telegram?: string
    website?: string
  }
}

interface SharedRegistry {
  byPubkey: Record<string, NarrativeMetadata>
  byHash: Record<string, NarrativeMetadata>
}

const BY_PUBKEY = 'bcc.narrative.meta.byPubkey'
const BY_HASH = 'bcc.narrative.meta.byHash'

/** In-memory merge of fetched shared registry (and same-session saves). */
let sharedRegistry: SharedRegistry = { byPubkey: {}, byHash: {} }
let loadPromise: Promise<SharedRegistry> | null = null
let loadStarted = false

function readMap(key: string): Record<string, NarrativeMetadata> {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, NarrativeMetadata>
  } catch {
    return {}
  }
}

function writeMap(key: string, map: Record<string, NarrativeMetadata>) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, JSON.stringify(map))
  } catch {
    /* quota / private mode — ignore */
  }
}

function registryUrl(): string {
  const base =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? String(import.meta.env.BASE_URL)
      : '/'
  const normalized = base.endsWith('/') ? base : `${base}/`
  return `${normalized}meta/stories.json`
}

/** Prefer whichever side has a concrete cover. Local text fields win. */
function mergeMeta(
  local?: NarrativeMetadata,
  shared?: NarrativeMetadata,
): NarrativeMetadata | undefined {
  if (!local && !shared) return undefined
  if (!local) return shared
  if (!shared) return local
  const image =
    local.image ||
    local.coverUrl ||
    shared.image ||
    shared.coverUrl ||
    undefined
  return {
    ...shared,
    ...local,
    image,
    coverUrl: image,
    socials: { ...shared.socials, ...local.socials },
  }
}

/**
 * Fetch shared static metadata once (GitHub Pages–friendly). Safe to call
 * repeatedly; subsequent calls return the same Promise / cached registry.
 */
export function loadSharedMetadata(): Promise<SharedRegistry> {
  if (loadPromise) return loadPromise
  if (typeof fetch === 'undefined') {
    loadPromise = Promise.resolve(sharedRegistry)
    return loadPromise
  }
  loadStarted = true
  loadPromise = fetch(registryUrl(), { cache: 'no-cache' })
    .then(async (res) => {
      if (!res.ok) return sharedRegistry
      const data = (await res.json()) as Partial<SharedRegistry>
      sharedRegistry = {
        byPubkey: { ...sharedRegistry.byPubkey, ...(data.byPubkey ?? {}) },
        byHash: { ...sharedRegistry.byHash, ...(data.byHash ?? {}) },
      }
      return sharedRegistry
    })
    .catch(() => sharedRegistry)
  return loadPromise
}

/** Kick off fetch on first module use in the browser (non-blocking). */
function ensureLoadStarted() {
  if (!loadStarted && typeof window !== 'undefined') {
    void loadSharedMetadata()
  }
}

export function saveNarrativeMetadata(
  contentHashHex: string,
  meta: NarrativeMetadata,
  storyPubkey?: string,
) {
  const normalized: NarrativeMetadata = {
    ...meta,
    image: meta.image || meta.coverUrl,
  }
  const byHash = readMap(BY_HASH)
  byHash[contentHashHex] = normalized
  writeMap(BY_HASH, byHash)
  sharedRegistry.byHash[contentHashHex] = normalized
  if (storyPubkey) {
    const byPk = readMap(BY_PUBKEY)
    byPk[storyPubkey] = normalized
    writeMap(BY_PUBKEY, byPk)
    sharedRegistry.byPubkey[storyPubkey] = normalized
  }
}

export function getMetadataByPubkey(pubkey: string): NarrativeMetadata | undefined {
  ensureLoadStarted()
  return mergeMeta(readMap(BY_PUBKEY)[pubkey], sharedRegistry.byPubkey[pubkey])
}

export function getMetadataByHash(contentHashHex: string): NarrativeMetadata | undefined {
  ensureLoadStarted()
  return mergeMeta(readMap(BY_HASH)[contentHashHex], sharedRegistry.byHash[contentHashHex])
}

/** Resolved cover URL from meta (image | coverUrl), or undefined. */
export function metaCoverUrl(meta?: NarrativeMetadata | null): string | undefined {
  if (!meta) return undefined
  const url = meta.image || meta.coverUrl
  return url && url.length > 0 ? url : undefined
}

export function bytesToHex(bytes: Uint8Array | number[] | Buffer): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Decode a printable ASCII prefix from content_hash hex (e.g. smoke script
 * writes `smoke-…` into the 32-byte hash). Returns null if <4 consecutive
 * printable chars at the start.
 */
export function printableAsciiPrefixFromHash(contentHashHex: string): string | null {
  const hex = contentHashHex.replace(/^0x/i, '')
  if (hex.length < 8) return null
  let out = ''
  for (let i = 0; i + 1 < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16)
    if (Number.isNaN(code)) break
    // Printable ASCII excluding DEL
    if (code >= 0x20 && code <= 0x7e) {
      out += String.fromCharCode(code)
    } else {
      break
    }
  }
  // Trim trailing null-padding / whitespace for title use
  const trimmed = out.replace(/\0+$/g, '').trim()
  if (trimmed.length < 4) return null
  return trimmed
}

/** Ticker from ASCII prefix: prefer first alnum run (e.g. smoke-xxx → SMOKE). */
export function tickerFromAsciiPrefix(prefix: string): string {
  const run = prefix.match(/[a-zA-Z0-9]+/)?.[0] ?? ''
  if (run.length >= 4) return run.slice(0, Math.min(6, run.length)).toUpperCase()
  const alnum = prefix.replace(/[^a-zA-Z0-9]/g, '')
  if (alnum.length >= 4) return alnum.slice(0, Math.min(6, alnum.length)).toUpperCase()
  if (alnum.length > 0) return alnum.toUpperCase().padEnd(4, 'X')
  return 'STORY'
}
