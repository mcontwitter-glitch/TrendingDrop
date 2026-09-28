import { useEffect, useMemo, useState } from 'react'
import type { CurveToken } from '../types'
import { marketCapSol } from '../lib/format'
import {
  getPriceHistory,
  recordPriceSample,
  seedPriceHistory,
  type PriceSample,
} from '../lib/priceHistory'

export interface UsePriceHistoryResult {
  samples: PriceSample[]
  latestMcapSol: number
}

const RECORD_INTERVAL_MS = 10_000

/**
 * Records on-chain spot samples whenever `curve` updates (and on a light
 * interval while mounted) and returns history for PriceChart. Seeds from
 * mock `priceHistory` when the local store is empty.
 */
export function usePriceHistory(curve: CurveToken | undefined): UsePriceHistoryResult {
  const pubkey = curve?.pubkey
  const priceLamports = curve?.currentPriceLamports
  const supply = curve?.currentSupply
  const mockHistory = curve?.priceHistory

  const [samples, setSamples] = useState<PriceSample[]>(() =>
    pubkey ? getPriceHistory(pubkey) : [],
  )

  useEffect(() => {
    if (!pubkey || priceLamports === undefined || supply === undefined) {
      setSamples([])
      return
    }

    if (mockHistory?.length) {
      seedPriceHistory(pubkey, mockHistory)
    }

    const write = () => {
      const next = recordPriceSample(pubkey, priceLamports, supply)
      setSamples(next)
    }

    write()
    const id = window.setInterval(write, RECORD_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [pubkey, priceLamports, supply, mockHistory])

  const latestMcapSol = useMemo(() => {
    if (priceLamports === undefined || supply === undefined) return 0
    const last = samples[samples.length - 1]
    if (last?.mcapSol !== undefined) return last.mcapSol
    return marketCapSol(priceLamports, supply)
  }, [priceLamports, supply, samples])

  return { samples, latestMcapSol }
}
