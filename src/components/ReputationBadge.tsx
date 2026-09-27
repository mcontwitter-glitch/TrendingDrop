import { Link } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { TierBadge } from './TierBadge'
import { accuracyPct } from '../lib/solana/reputationMappers'

/** Compact header badge when wallet connected — links to /profile. */
export function ReputationBadge() {
  const { profile, connected, source } = useProfile()
  if (!connected || !profile) return null

  return (
    <Link
      to="/profile"
      className="hidden items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2 py-1 transition hover:border-purple-400/50 hover:bg-purple-500/20 sm:inline-flex"
      title={`Reputation · ${source === 'chain' ? 'on-chain' : 'mock'}`}
    >
      <TierBadge tier={profile.tier} size="sm" />
      <span className="text-[10px] font-semibold text-purple-200">
        {accuracyPct(profile.accuracyScoreBps)}
      </span>
    </Link>
  )
}
