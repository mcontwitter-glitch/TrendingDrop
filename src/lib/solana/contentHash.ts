import type { NarrativeMetadata } from './metadata'

/** Stable JSON payload hashed into the on-chain content_hash ([u8; 32]). */
export function narrativePayload(meta: NarrativeMetadata): string {
  return JSON.stringify({
    title: meta.title.trim(),
    ticker: meta.ticker.trim().toUpperCase(),
    blurb: meta.blurb.trim(),
    description: meta.description.trim(),
    socials: meta.socials ?? {},
  })
}

export async function hashNarrativeContent(meta: NarrativeMetadata): Promise<Uint8Array> {
  const data = new TextEncoder().encode(narrativePayload(meta))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(digest)
}
