export function formatSol(n: number): string {
  if (n >= 100) return n.toFixed(1)
  if (n >= 10) return n.toFixed(2)
  return n.toFixed(2)
}

export function formatPct(n: number): string {
  return `${Math.min(100, Math.round(n))}%`
}

export function fundedPct(staked: number, threshold: number): number {
  return Math.min(100, (staked / threshold) * 100)
}

export function formatCountdown(endsAt: number, now = Date.now()): string {
  const diff = endsAt - now
  if (diff <= 0) return 'Ended'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1000)
  if (h > 48) {
    const d = Math.floor(h / 24)
    return `${d}d ${h % 24}h`
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function timeAgo(ts: number, now = Date.now()): string {
  const sec = Math.floor((now - ts) / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export function shortAddress(addr: string): string {
  if (addr.includes('…') || addr.includes('...')) return addr
  if (addr.length < 10) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

export function formatLamportsAsSol(lamports: number | bigint, digits = 4): string {
  const n = typeof lamports === 'bigint' ? Number(lamports) : lamports
  const sol = n / 1_000_000_000
  if (sol === 0) return '0'
  if (sol < 0.0001) return sol.toExponential(2)
  if (sol < 1) return sol.toFixed(digits)
  return formatSol(sol)
}

export function formatTokenAmount(n: number | bigint): string {
  const v = typeof n === 'bigint' ? Number(n) : n
  if (!Number.isFinite(v)) return '0'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (v >= 10_000) return `${(v / 1_000).toFixed(1)}k`
  if (v >= 100) return v.toFixed(0)
  if (v >= 1) return v.toFixed(2)
  return v.toFixed(4)
}

export function formatPriceLamports(lamports: number): string {
  const sol = lamports / 1_000_000_000
  if (sol === 0) return '0 SOL'
  if (sol < 0.000001) return `${lamports} lamports`
  if (sol < 0.001) return `${sol.toFixed(6)} SOL`
  return `${sol.toFixed(4)} SOL`
}
