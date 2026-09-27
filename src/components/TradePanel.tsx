import { useMemo, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { AlertCircle, ArrowDownUp, Zap } from 'lucide-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import type { CurveToken } from '../types'
import { useVelocityProgram } from '../hooks/useVelocityProgram'
import { buyOnCurve, sellOnCurve } from '../lib/solana/velocityTransactions'
import { estimateBuy, estimateSell } from '../lib/solana/velocityMath'
import { LAMPORTS_PER_SOL } from '../lib/solana/constants'
import { formatLamportsAsSol, formatTokenAmount } from '../lib/format'
import { useToast } from './Toast'

const QUICK_SOL = [0.1, 0.5, 1, 2]
const QUICK_PCT = [25, 50, 75, 100]

interface TradePanelProps {
  curve: CurveToken
  holderBalance?: number
  onTraded?: () => void
}

type Tab = 'buy' | 'sell'

export function TradePanel({ curve, holderBalance = 0, onTraded }: TradePanelProps) {
  const { program, publicKey, connected } = useVelocityProgram()
  const { setVisible } = useWalletModal()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('buy')
  const [amount, setAmount] = useState('0.5')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const num = parseFloat(amount) || 0
  const canOnChain = Boolean(connected && program && publicKey && curve.onChain)

  const buyQuote = useMemo(() => {
    if (tab !== 'buy' || num <= 0) return null
    return estimateBuy(
      Math.round(num * LAMPORTS_PER_SOL),
      curve.currentSupply,
      curve.basePriceLamports,
      curve.curveK,
      curve.attentionScore,
      curve.priceVelocity,
    )
  }, [tab, num, curve])

  const sellQuote = useMemo(() => {
    if (tab !== 'sell' || num <= 0) return null
    return estimateSell(
      Math.floor(num),
      curve.currentSupply,
      curve.basePriceLamports,
      curve.curveK,
      curve.attentionScore,
      curve.priceVelocity,
    )
  }, [tab, num, curve])

  async function handleSubmit() {
    setError(null)
    setMessage(null)
    if (num <= 0) {
      setError('Enter a positive amount')
      return
    }

    if (!connected || !publicKey) {
      setVisible(true)
      return
    }

    if (canOnChain && program) {
      setSubmitting(true)
      try {
        if (tab === 'buy') {
          const { signature, estimatedTokens } = await buyOnCurve(program, {
            curvePubkey: new PublicKey(curve.pubkey),
            solAmount: num,
            buyer: publicKey,
          })
          const ok = `Bought ~${formatTokenAmount(estimatedTokens)} $${curve.ticker}`
          setMessage(`${ok} · ${signature.slice(0, 12)}…`)
          toast.success('Buy confirmed', `${ok} · ${signature.slice(0, 16)}…`)
        } else {
          const { signature, estimatedSolLamports } = await sellOnCurve(program, {
            curvePubkey: new PublicKey(curve.pubkey),
            tokenAmount: Math.floor(num),
            seller: publicKey,
          })
          const ok = `Sold for ~${formatLamportsAsSol(estimatedSolLamports)} SOL`
          setMessage(`${ok} · ${signature.slice(0, 12)}…`)
          toast.success('Sell confirmed', `${ok} · ${signature.slice(0, 16)}…`)
        }
        onTraded?.()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        toast.error(tab === 'buy' ? 'Buy failed' : 'Sell failed', msg)
      } finally {
        setSubmitting(false)
      }
      return
    }

    const mockMsg = curve.onChain
      ? 'Connect wallet / program unavailable'
      : `Mock ${tab} — program not deployed / curve not on-chain`
    setMessage(mockMsg)
    toast.info(`Mock ${tab}`, mockMsg)
    window.setTimeout(() => setMessage(null), 2800)
  }

  const taxHint =
    curve.mode === 'steepen'
      ? 'Sell tax ~15% (attention steepen)'
      : curve.mode === 'flatten'
        ? 'Sell tax ~5% (price flatten)'
        : 'Sell tax 5–15% by velocity'

  return (
    <div className="rounded-2xl border border-bcc-border bg-bcc-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Trade desk</h3>
        <span className="text-[10px] uppercase tracking-wider text-bcc-muted">
          {canOnChain ? 'On-chain' : 'Mock · fallback'}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-bcc-bg p-1">
        {(['buy', 'sell'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t)
              setAmount(t === 'buy' ? '0.5' : holderBalance > 0 ? String(Math.floor(holderBalance * 0.25) || '0') : '1000')
              setError(null)
              setMessage(null)
            }}
            className={`rounded-lg py-2 text-sm font-bold capitalize transition ${
              tab === t
                ? t === 'buy'
                  ? 'bg-purple-600 text-white'
                  : 'bg-bcc-green text-white'
                : 'text-bcc-muted hover:text-bcc-text'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      {message && !error && (
        <div className="mb-3 rounded-lg border border-bcc-border bg-bcc-bg px-3 py-2 text-xs text-bcc-muted">
          {message}
        </div>
      )}

      <label className="mb-1.5 block text-xs font-medium text-bcc-muted">
        {tab === 'buy' ? 'You pay (SOL)' : `You sell ($${curve.ticker})`}
      </label>
      <div className="relative mb-3">
        <input
          type="number"
          min={0}
          step={tab === 'buy' ? '0.01' : '1'}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-xl border border-bcc-border bg-bcc-bg px-4 py-3 pr-16 font-display text-lg font-semibold text-bcc-text outline-none transition focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/25"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-bcc-muted">
          {tab === 'buy' ? 'SOL' : curve.ticker}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tab === 'buy'
          ? QUICK_SOL.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  num === q
                    ? 'border-purple-500/50 bg-purple-500/10 text-purple-300'
                    : 'border-bcc-border bg-bcc-elevated text-bcc-muted hover:border-zinc-500 hover:text-bcc-text'
                }`}
              >
                {q} SOL
              </button>
            ))
          : QUICK_PCT.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() =>
                  setAmount(String(Math.max(0, Math.floor((holderBalance * p) / 100))))
                }
                className="rounded-lg border border-bcc-border bg-bcc-elevated px-3 py-1.5 text-xs font-semibold text-bcc-muted transition hover:border-zinc-500 hover:text-bcc-text"
              >
                {p}%
              </button>
            ))}
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-bcc-border/60 bg-bcc-bg px-3 py-2.5 text-sm">
        <ArrowDownUp className="h-4 w-4 shrink-0 text-purple-400" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide text-bcc-muted">
            Estimated {tab === 'buy' ? 'tokens out' : 'SOL out'} · estimate
          </div>
          <div className="truncate font-display font-bold text-bcc-text">
            {tab === 'buy' && buyQuote
              ? `${formatTokenAmount(buyQuote.tokensOut)} $${curve.ticker}`
              : tab === 'sell' && sellQuote
                ? `${formatLamportsAsSol(sellQuote.solNetLamports)} SOL`
                : '—'}
          </div>
        </div>
      </div>

      <ul className="mb-4 space-y-1 text-[11px] text-bcc-muted">
        <li>· Protocol fee 1.5% on volume</li>
        <li>· {taxHint}</li>
        {tab === 'buy' && buyQuote && (
          <li>· Fee ≈ {formatLamportsAsSol(buyQuote.feeLamports)} SOL</li>
        )}
        {tab === 'sell' && sellQuote && (
          <li>
            · Tax ≈ {formatLamportsAsSol(sellQuote.taxLamports)} SOL · fee ≈{' '}
            {formatLamportsAsSol(sellQuote.feeLamports)} SOL
          </li>
        )}
      </ul>

      <button
        type="button"
        disabled={submitting || num <= 0}
        onClick={() => void handleSubmit()}
        style={{ color: '#fff' }}
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold tracking-wide text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
          tab === 'buy'
            ? 'bg-purple-600 hover:bg-purple-500'
            : 'bg-bcc-green hover:bg-bcc-green-dim'
        }`}
      >
        <Zap className="h-4 w-4 text-white" style={{ color: '#fff' }} />
        {!connected
          ? 'Connect Wallet'
          : submitting
            ? 'Confirm in wallet…'
            : tab === 'buy'
              ? `Buy $${curve.ticker}`
              : `Sell $${curve.ticker}`}
      </button>
    </div>
  )
}
