import { useMemo, useRef, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { AlertCircle, Pencil } from 'lucide-react'
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
const SLIDER_MARKS = [0, 25, 50, 75, 100]
/** Soft max SOL for buy-side % slider (maps 100% → this amount). */
const BUY_SOFT_MAX_SOL = 2

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
  const amountInputRef = useRef<HTMLInputElement>(null)
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

  const sliderPct = useMemo(() => {
    if (tab === 'buy') {
      if (BUY_SOFT_MAX_SOL <= 0) return 0
      return Math.min(100, Math.max(0, Math.round((num / BUY_SOFT_MAX_SOL) * 100)))
    }
    if (holderBalance <= 0) return 0
    return Math.min(100, Math.max(0, Math.round((num / holderBalance) * 100)))
  }, [tab, num, holderBalance])

  function switchTab(t: Tab) {
    setTab(t)
    setAmount(t === 'buy' ? '0.5' : holderBalance > 0 ? String(Math.floor(holderBalance * 0.25) || '0') : '1000')
    setError(null)
    setMessage(null)
  }

  function setSliderPct(pct: number) {
    const clamped = Math.min(100, Math.max(0, pct))
    if (tab === 'buy') {
      const sol = (BUY_SOFT_MAX_SOL * clamped) / 100
      // Keep a readable precision for small values
      const rounded = clamped === 0 ? '0' : sol >= 0.1 ? String(Number(sol.toFixed(2))) : String(Number(sol.toFixed(4)))
      setAmount(rounded)
      return
    }
    setAmount(String(Math.max(0, Math.floor((holderBalance * clamped) / 100))))
  }

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
      ? 'Sell tax ~15%'
      : curve.mode === 'flatten'
        ? 'Sell tax ~5%'
        : 'Sell tax 5–15%'

  const feeCompact =
    tab === 'buy'
      ? `Fee 1.5%${buyQuote ? ` · ≈${formatLamportsAsSol(buyQuote.feeLamports)} SOL` : ''}`
      : `Fee 1.5% · ${taxHint}${
          sellQuote
            ? ` · tax≈${formatLamportsAsSol(sellQuote.taxLamports)} · fee≈${formatLamportsAsSol(sellQuote.feeLamports)} SOL`
            : ''
        }`

  const estimateLabel =
    tab === 'buy'
      ? buyQuote
        ? `≈ ${formatTokenAmount(buyQuote.tokensOut)} $${curve.ticker}`
        : '—'
      : sellQuote
        ? `≈ ${formatLamportsAsSol(sellQuote.solNetLamports)} SOL`
        : '—'

  const ctaLabel = !connected
    ? 'Connect'
    : submitting
      ? '…'
      : tab === 'buy'
        ? 'Buy'
        : 'Sell'

  return (
    <div className="bcc-card rounded-2xl p-3.5 sm:p-4">
      {/* Tabs + settings row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-bcc-bg p-0.5">
          {(['buy', 'sell'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-bold capitalize transition ${
                tab === t
                  ? t === 'buy'
                    ? 'bg-bcc-cyan text-bcc-bg shadow-[0_0_12px_rgba(34,211,238,0.45)]'
                    : 'bg-bcc-gold text-bcc-bg shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                  : 'text-bcc-muted hover:text-bcc-text'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5 text-[10px] text-bcc-muted">
          <span className="rounded-md border border-bcc-border bg-bcc-elevated px-2 py-1 font-semibold text-bcc-text">
            Market
          </span>
          <span
            className="rounded-md border border-bcc-border/70 bg-bcc-bg px-2 py-1 tabular-nums"
            title={feeCompact}
          >
            1.5% fee
            {tab === 'sell' ? ` · ${taxHint}` : ''}
          </span>
          <span
            className={`rounded-md border px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider ${
              canOnChain
                ? 'border-bcc-cyan/40 bg-bcc-cyan/10 text-bcc-cyan'
                : 'border-bcc-border bg-bcc-elevated text-bcc-muted'
            }`}
          >
            {canOnChain ? 'On-chain' : 'Mock'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-2.5 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-2.5 py-1.5 text-[11px] text-red-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      {message && !error && (
        <div className="mb-2.5 rounded-lg border border-bcc-border bg-bcc-bg px-2.5 py-1.5 text-[11px] text-bcc-muted">
          {message}
        </div>
      )}

      {/* Quick amounts */}
      <div className="mb-2.5 flex items-center gap-1.5">
        <div className="grid flex-1 grid-cols-4 gap-1.5">
          {tab === 'buy'
            ? QUICK_SOL.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className={`rounded-lg border py-2 text-[11px] font-semibold tabular-nums transition ${
                    num === q
                      ? 'border-bcc-cyan/55 bg-bcc-cyan/15 text-bcc-cyan shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                      : 'border-bcc-border bg-bcc-elevated text-bcc-muted hover:border-bcc-cyan/40 hover:text-bcc-text'
                  }`}
                >
                  {q} SOL
                </button>
              ))
            : QUICK_PCT.map((p) => {
                const tokens = Math.max(0, Math.floor((holderBalance * p) / 100))
                const active = holderBalance > 0 && Math.floor(num) === tokens && tokens > 0
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(String(tokens))}
                    className={`rounded-lg border py-2 text-[11px] font-semibold tabular-nums transition ${
                      active
                        ? 'border-bcc-cyan/55 bg-bcc-cyan/15 text-bcc-cyan shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                        : 'border-bcc-border bg-bcc-elevated text-bcc-muted hover:border-bcc-cyan/40 hover:text-bcc-text'
                    }`}
                  >
                    {p}%
                  </button>
                )
              })}
        </div>
        <button
          type="button"
          title="Custom amount"
          aria-label="Focus custom amount"
          onClick={() => {
            amountInputRef.current?.focus()
            amountInputRef.current?.select()
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-bcc-border bg-bcc-elevated text-bcc-muted transition hover:border-bcc-cyan/40 hover:text-bcc-cyan"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Amount + primary CTA on same row */}
      <div className="mb-2.5 flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-medium uppercase tracking-wide text-bcc-muted">
            Amount
          </span>
          <input
            ref={amountInputRef}
            type="number"
            min={0}
            step={tab === 'buy' ? '0.01' : '1'}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="amount-input h-full w-full rounded-xl border border-bcc-border bg-bcc-bg py-3 pl-[4.25rem] pr-12 text-base font-semibold text-bcc-text outline-none transition focus:border-bcc-cyan/60 focus:ring-1 focus:ring-bcc-cyan/25"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-bcc-muted">
            {tab === 'buy' ? 'SOL' : curve.ticker}
          </span>
        </div>
        <button
          type="button"
          disabled={submitting || num <= 0}
          onClick={() => void handleSubmit()}
          className={`min-w-[5.5rem] shrink-0 rounded-xl px-4 text-sm font-bold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[6.5rem] ${
            tab === 'buy'
              ? 'bcc-glow-btn text-white'
              : 'bg-bcc-gold text-bcc-bg shadow-[0_0_14px_rgba(251,191,36,0.35)] hover:bg-bcc-gold-dim'
          }`}
        >
          {ctaLabel}
        </button>
      </div>

      {/* Percentage slider */}
      <div className="mb-2.5">
        <div className="mb-1 flex justify-between px-0.5 text-[10px] tabular-nums text-bcc-muted">
          {SLIDER_MARKS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSliderPct(m)}
              className={`transition hover:text-bcc-cyan ${sliderPct === m ? 'font-semibold text-bcc-cyan' : ''}`}
            >
              {m}%
            </button>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={sliderPct}
          onChange={(e) => setSliderPct(Number(e.target.value))}
          aria-label={tab === 'buy' ? 'Percent of 2 SOL max' : 'Percent of balance'}
          className="trade-pct-slider w-full"
          style={{ ['--trade-pct' as string]: `${sliderPct}%` }}
        />
        <div className="mt-0.5 text-right text-[9px] text-bcc-muted/80">
          {tab === 'buy' ? `of ${BUY_SOFT_MAX_SOL} SOL` : holderBalance > 0 ? `of ${formatTokenAmount(holderBalance)} $${curve.ticker}` : 'no balance'}
        </div>
      </div>

      {/* Compact quote + fees */}
      <div className="rounded-lg border border-bcc-border/50 bg-bcc-bg/70 px-2.5 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wide text-bcc-muted">
            Est. {tab === 'buy' ? 'out' : 'SOL out'}
          </span>
          <span className="truncate font-stat text-sm text-bcc-text">{estimateLabel}</span>
        </div>
        <p className="mt-1 truncate text-[10px] text-bcc-muted" title={feeCompact}>
          {feeCompact}
        </p>
      </div>
    </div>
  )
}
