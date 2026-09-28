import { useState, type MouseEvent } from 'react'
import { Check, Copy } from 'lucide-react'
import { shortAddress } from '../lib/format'
import { useToast } from './Toast'

/** Prefer SPL mint (graduated); else story / account pubkey. */
export function resolveContractAddress(opts: {
  mint?: string | null
  pubkey?: string | null
}): string | undefined {
  const mint = opts.mint?.trim()
  if (mint && mint.length >= 32 && !mint.includes('…')) return mint
  const pk = opts.pubkey?.trim()
  if (pk && pk.length >= 32 && !pk.includes('…')) return pk
  return undefined
}

interface TickerCaChipProps {
  ticker: string
  /** Full base58 mint or story PDA — truncated + click-to-copy. */
  address?: string | null
  size?: 'sm' | 'md'
  className?: string
  /** Ticker pill color tone */
  tone?: 'cyan' | 'green'
}

/**
 * `$TICKER` pill with an adjacent truncated CA chip (copy on click).
 * Stops propagation so it works inside `<Link>` cards.
 */
export function TickerCaChip({
  ticker,
  address,
  size = 'sm',
  className = '',
  tone = 'cyan',
}: TickerCaChipProps) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const ca = resolveContractAddress({ mint: address, pubkey: address })

  const tickerTone =
    tone === 'green'
      ? 'border-white/10 bg-black/50 text-bcc-green'
      : 'border-bcc-cyan/30 bg-black/50 text-bcc-cyan'

  const tickerSize =
    size === 'md'
      ? 'px-2.5 py-0.5 text-xs'
      : 'px-2 py-0.5 text-[10px]'

  const caSize =
    size === 'md'
      ? 'px-2 py-0.5 text-[11px]'
      : 'px-1.5 py-0.5 text-[10px]'

  async function handleCopy(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!ca) return
    try {
      await navigator.clipboard.writeText(ca)
      setCopied(true)
      toast.success('Copied CA', shortAddress(ca))
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Copy failed', 'Clipboard permission denied')
    }
  }

  return (
    <span
      className={`inline-flex max-w-full flex-wrap items-center gap-1.5 ${className}`}
    >
      <span
        className={`rounded-full border font-bold backdrop-blur ${tickerTone} ${tickerSize}`}
      >
        ${ticker}
      </span>
      {ca ? (
        <button
          type="button"
          title={`Copy CA ${ca}`}
          onClick={handleCopy}
          className={`inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/55 font-mono text-white/85 backdrop-blur transition hover:border-bcc-cyan/50 hover:text-bcc-cyan ${caSize}`}
        >
          <span>{shortAddress(ca)}</span>
          {copied ? (
            <Check className="h-3 w-3 shrink-0 text-bcc-green" />
          ) : (
            <Copy className="h-3 w-3 shrink-0 opacity-70" />
          )}
        </button>
      ) : null}
    </span>
  )
}
