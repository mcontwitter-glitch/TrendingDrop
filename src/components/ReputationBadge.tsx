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
      className="hidden items-center gap-1.5 rounded-lg border border-bcc-cyan/30 bg-bcc-cyan/10 px-2 py-1 transition hover:border-bcc-cyan/50 hover:bg-bcc-cyan/20 sm:inline-flex"
      title={`Reputation · ${source === 'chain' ? 'on-chain' : 'mock'}`}
    >
      <TierBadge tier={profile.tier} size="sm" />
      <span className="text-[10px] font-semibold text-bcc-cyan">
        {accuracyPct(profile.accuracyScoreBps)}
      </span>
    </Link>
  )
}
