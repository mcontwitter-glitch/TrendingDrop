import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Search, TrendingUp } from 'lucide-react'
import { CurveCard } from '../components/CurveCard'
import { useCurves } from '../hooks/useCurves'

export function Trade() {
  const [query, setQuery] = useState('')
  const { curves, source, loading, error, refresh } = useCurves()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return curves
      .filter(
        (c) =>
          !q ||
          c.title.toLowerCase().includes(q) ||
          c.ticker.toLowerCase().includes(q) ||
          c.pubkey.toLowerCase().includes(q) ||
          c.blurb.toLowerCase().includes(q),
      )
      .sort((a, b) => b.solReserveSol - a.solReserveSol)
  }, [curves, query])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Trade
          </h1>
          <p className="mt-1 max-w-xl text-sm text-bcc-muted">
            VelocityCurve tokens — buy/sell SOL↔tokens with attention-weighted curves.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wider ${
                source === 'chain'
                  ? 'border-bcc-green/30 bg-bcc-green/10 text-bcc-green'
                  : 'border-bcc-border bg-bcc-elevated text-bcc-muted'
              }`}
            >
              {loading ? 'Loading…' : source === 'chain' ? 'On-chain' : 'Mock fallback'}
            </span>
            {error && <span className="text-bcc-muted">{error}</span>}
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-1 rounded-full border border-bcc-border px-2 py-0.5 text-bcc-muted transition hover:border-bcc-cyan/40 hover:text-bcc-text"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-bcc-cyan/30 bg-bcc-cyan/10 px-3 py-2 text-xs font-semibold text-bcc-cyan">
          <TrendingUp className="h-4 w-4" />
          Phase 2 · VelocityCurve
        </div>
      </div>

      <div className="mb-5 relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bcc-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search curves…"
          className="w-full rounded-xl border border-bcc-border bg-bcc-surface py-2.5 pl-9 pr-3 text-sm text-bcc-text outline-none transition placeholder:text-bcc-muted focus:border-bcc-cyan/50"
        />
      </div>

      {loading && curves.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bcc-border bg-bcc-surface/50 px-6 py-16 text-center">
          <p className="font-medium text-bcc-text">Fetching velocity curves…</p>
          <p className="mt-1 text-sm text-bcc-muted">Will fall back to mock if RPC is offline.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bcc-border bg-bcc-surface/50 px-6 py-16 text-center">
          <div className="mb-2 text-3xl">📉</div>
          <p className="font-medium text-bcc-text">No curves found</p>
          <p className="mt-1 text-sm text-bcc-muted">
            Graduate a story market to spawn a VelocityToken, or browse{' '}
            <Link to="/" className="text-bcc-cyan hover:underline">
              the board
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((curve, i) => (
            <CurveCard key={curve.pubkey} curve={curve} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
