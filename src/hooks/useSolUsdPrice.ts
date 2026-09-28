import { useEffect, useState } from 'react'

const SOL_USD_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
const CACHE_TTL_MS = 60_000
const FALLBACK_SOL_USD = 150

let cachedSolUsd = FALLBACK_SOL_USD
let cachedAt = 0
let inflight: Promise<number> | null = null

async function refreshSolUsd(): Promise<number> {
  if (inflight) return inflight

  inflight = fetch(SOL_USD_URL)
    .then(async (response) => {
      if (!response.ok) throw new Error(`SOL/USD request failed: ${response.status}`)
      const data: unknown = await response.json()
      const usd =
        typeof data === 'object' && data !== null && 'solana' in data
          ? (data as { solana?: { usd?: unknown } }).solana?.usd
          : undefined
      if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0) {
        throw new Error('Invalid SOL/USD response')
      }
      cachedSolUsd = usd
      cachedAt = Date.now()
      return cachedSolUsd
    })
    .catch(() => {
      cachedAt = Date.now()
      return cachedSolUsd
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

/** Shared, cached SOL/USD quote for converting SOL-denominated FDV to USD. */
export function useSolUsdPrice(): { solUsd: number; loading: boolean } {
  const [solUsd, setSolUsd] = useState(cachedSolUsd)
  const [loading, setLoading] = useState(cachedAt === 0)

  useEffect(() => {
    let active = true

    const refresh = () => {
      if (Date.now() - cachedAt < CACHE_TTL_MS) {
        setSolUsd(cachedSolUsd)
        setLoading(false)
        return
      }

      setLoading(true)
      void refreshSolUsd().then((value) => {
        if (!active) return
        setSolUsd(value)
        setLoading(false)
      })
    }

    refresh()
    const id = window.setInterval(refresh, CACHE_TTL_MS)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [])

  return { solUsd, loading }
}
