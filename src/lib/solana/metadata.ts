/**
 * Off-chain narrative metadata cache.
 *
 * On-chain StoryMarket only stores content_hash — title/ticker/blurb live here
 * (localStorage) keyed by story pubkey and content-hash hex so CreateStory
 * survivors and Board mappers can render human-readable cards.
 */

export interface NarrativeMetadata {
  title: string
  ticker: string
  blurb: string
  description: string
  socials?: {
    twitter?: string
    telegram?: string
    website?: string
  }
}

const BY_PUBKEY = 'bcc.narrative.meta.byPubkey'
const BY_HASH = 'bcc.narrative.meta.byHash'

function readMap(key: string): Record<string, NarrativeMetadata> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, NarrativeMetadata>
  } catch {
    return {}
  }
}

function writeMap(key: string, map: Record<string, NarrativeMetadata>) {
  try {
    localStorage.setItem(key, JSON.stringify(map))
  } catch {
    /* quota / private mode — ignore */
  }
}

export function saveNarrativeMetadata(
  contentHashHex: string,
  meta: NarrativeMetadata,
  storyPubkey?: string,
) {
  const byHash = readMap(BY_HASH)
  byHash[contentHashHex] = meta
  writeMap(BY_HASH, byHash)
  if (storyPubkey) {
    const byPk = readMap(BY_PUBKEY)
    byPk[storyPubkey] = meta
    writeMap(BY_PUBKEY, byPk)
  }
}

export function getMetadataByPubkey(pubkey: string): NarrativeMetadata | undefined {
  return readMap(BY_PUBKEY)[pubkey]
}

export function getMetadataByHash(contentHashHex: string): NarrativeMetadata | undefined {
  return readMap(BY_HASH)[contentHashHex]
}

export function bytesToHex(bytes: Uint8Array | number[] | Buffer): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
