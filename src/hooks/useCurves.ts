import { useCallback, useEffect, useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { mockCurves } from '../data/mockCurves'
import type { CurveToken, HolderPositionView } from '../types'
import {
  fetchVelocityToken,
  fetchVelocityTokens,
  getReadonlyVelocityProgram,
} from '../lib/solana/velocityProgram'
import { findHolderPda } from '../lib/solana/velocityPdas'
import { loadSharedMetadata } from '../lib/solana/metadata'
import {
  mapHolderPosition,
  type OnChainHolderPosition,
} from '../lib/solana/velocityMappers'

export type CurvesSource = 'chain' | 'mock'

export interface UseCurvesResult {
  curves: CurveToken[]
  source: CurvesSource
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  getById: (id: string) => CurveToken | undefined
}

export function useCurves(): UseCurvesResult {
  const { connection } = useConnection()
  const [curves, setCurves] = useState<CurveToken[]>(mockCurves)
  const [source, setSource] = useState<CurvesSource>('mock')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await loadSharedMetadata()
      const program = getReadonlyVelocityProgram(connection)
      const onChain = await fetchVelocityTokens(program)
      if (onChain.length > 0) {
        setCurves(onChain)
        setSource('chain')
        setError(null)
      } else {
        setCurves(mockCurves)
        setSource('mock')
        setError(null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setCurves(mockCurves)
      setSource('mock')
      setError(
        /fetch|ECONNREFUSED|Failed to fetch|network/i.test(msg)
          ? 'RPC offline — showing mock curves'
          : `Chain fetch failed — showing mock curves (${msg.slice(0, 120)})`,
      )
    } finally {
      setLoading(false)
    }
  }, [connection])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const getById = useCallback(
    (id: string) => curves.find((c) => c.id === id || c.pubkey === id || c.storyId === id),
    [curves],
  )

  return { curves, source, loading, error, refresh, getById }
}

function findMock(curveId: string): CurveToken | undefined {
  return mockCurves.find((c) => c.id === curveId || c.pubkey === curveId || c.storyId === curveId)
}

export function useCurveDetail(curveId: string | undefined) {
  const { connection } = useConnection()
  const [curve, setCurve] = useState<CurveToken | undefined>(() =>
    curveId ? findMock(curveId) : undefined,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<CurvesSource>('mock')

  const refresh = useCallback(async () => {
    if (!curveId) {
      setCurve(undefined)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const pk = new PublicKey(curveId)
      const program = getReadonlyVelocityProgram(connection)
      const onChain = await fetchVelocityToken(program, pk)
      if (onChain) {
        setCurve(onChain)
        setSource('chain')
        setError(null)
      } else {
        setCurve(findMock(curveId))
        setSource('mock')
        setError(null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/Invalid public key/i.test(msg)) {
        setError('Invalid curve id')
        setCurve(undefined)
        setSource('mock')
      } else {
        setCurve(findMock(curveId))
        setSource('mock')
        setError(
          /fetch|ECONNREFUSED|Failed to fetch|network/i.test(msg)
            ? 'RPC offline — mock mode'
            : `Fetch failed — mock mode (${msg.slice(0, 100)})`,
        )
      }
    } finally {
      setLoading(false)
    }
  }, [connection, curveId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { curve, loading, error, source, refresh }
}

export function useHolderPosition(
  curve: CurveToken | undefined,
  owner: PublicKey | null,
) {
  const { connection } = useConnection()
  const [holder, setHolder] = useState<HolderPositionView | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!curve || !owner || !curve.onChain) {
      setHolder(null)
      return
    }
    setLoading(true)
    try {
      const program = getReadonlyVelocityProgram(connection)
      const curvePk = new PublicKey(curve.pubkey)
      const [holderPda] = findHolderPda(curvePk, owner, program.programId)
      const account = await program.account.holderPosition.fetch(holderPda)
      setHolder(
        mapHolderPosition(
          account as unknown as OnChainHolderPosition,
          curve.rewardIndex,
        ),
      )
    } catch {
      setHolder(null)
    } finally {
      setLoading(false)
    }
  }, [connection, curve, owner])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { holder, loading, refresh }
}
