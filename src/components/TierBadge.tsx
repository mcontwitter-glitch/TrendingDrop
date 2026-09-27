import type { ReputationTierName } from '../types'
import { TIER_COLORS, accuracyPct } from '../lib/solana/reputationMappers'

interface TierBadgeProps {
  tier: ReputationTierName
  accuracyBps?: number
  size?: 'sm' | 'md'
  className?: string
}

export function TierBadge({ tier, accuracyBps, size = 'sm', className = '' }: TierBadgeProps) {
  const pad = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wide ${TIER_COLORS[tier]} ${pad} ${className}`}
      title={accuracyBps != null ? `Accuracy ${accuracyPct(accuracyBps)}` : tier}
    >
      <span aria-hidden>{tierEmoji(tier)}</span>
      {tier}
      {accuracyBps != null && size === 'md' && (
        <span className="font-medium opacity-80 normal-case tracking-normal">
          {accuracyPct(accuracyBps)}
        </span>
      )}
    </span>
  )
}

function tierEmoji(tier: ReputationTierName): string {
  switch (tier) {
    case 'Bronze':
      return '🥉'
    case 'Silver':
      return '🥈'
    case 'Gold':
      return '🥇'
    case 'Diamond':
      return '💎'
    case 'Mythic':
      return '✦'
  }
}
