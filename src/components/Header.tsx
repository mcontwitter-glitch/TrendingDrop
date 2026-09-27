import { Link, NavLink } from 'react-router-dom'
import { Plus, Sparkles } from 'lucide-react'
import { WalletButton } from './WalletButton'
import { ReputationBadge } from './ReputationBadge'
import { clusterLabel, RPC_URL } from '../lib/solana/constants'

export function Header() {
  const cluster = clusterLabel(RPC_URL)

  return (
    <header className="sticky top-0 z-50 border-b border-bcc-border/80 bg-bcc-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Link to="/" className="group flex items-center gap-2.5 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-bcc-border bg-bcc-surface text-lg transition group-hover:border-bcc-green/40">
            🎰
          </div>
          <div className="leading-tight">
            <div className="font-display text-sm font-bold tracking-tight sm:text-base">
              Bonding Curve Casino
            </div>
            <div className="hidden text-[10px] font-medium uppercase tracking-widest text-bcc-muted sm:block">
              Story Markets
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive ? 'bg-bcc-elevated text-bcc-text' : 'text-bcc-muted hover:text-bcc-text'
              }`
            }
          >
            Board
          </NavLink>
          <NavLink
            to="/create"
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive ? 'bg-bcc-elevated text-bcc-text' : 'text-bcc-muted hover:text-bcc-text'
              }`
            }
          >
            Create Story
          </NavLink>
          <NavLink
            to="/trade"
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive ? 'bg-bcc-elevated text-bcc-text' : 'text-bcc-muted hover:text-bcc-text'
              }`
            }
          >
            Trade
          </NavLink>
          <NavLink
            to="/merge"
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive ? 'bg-bcc-elevated text-bcc-text' : 'text-bcc-muted hover:text-bcc-text'
              }`
            }
          >
            Merge
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <span
            className="hidden rounded-full border border-bcc-border bg-bcc-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-bcc-muted sm:inline-flex"
            title={RPC_URL}
          >
            {cluster}
          </span>
          <ReputationBadge />
          <Link
            to="/create"
            className="inline-flex items-center gap-1.5 rounded-lg border border-bcc-border bg-transparent px-2.5 py-1.5 text-xs font-semibold text-bcc-text transition hover:border-bcc-muted hover:bg-bcc-elevated sm:px-3 sm:text-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Create</span>
          </Link>
          <WalletButton />
        </div>
      </div>
      <div className="flex items-center justify-center gap-1.5 border-t border-bcc-border/50 bg-bcc-surface/60 px-4 py-1 text-[10px] text-bcc-muted sm:text-xs">
        <Sparkles className="h-3 w-3 text-bcc-green" />
        Phase 1 auctions · Phase 2 trade · Phase 3 merge — stake, trade, absorb lore
      </div>
    </header>
  )
}
