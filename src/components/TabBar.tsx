import type { StoryStatus } from '../types'

export type BoardTab = 'active' | 'graduating' | 'graduated' | 'failed'

interface TabBarProps {
  active: BoardTab
  onChange: (tab: BoardTab) => void
  counts: Record<BoardTab, number>
}

const tabs: { id: BoardTab; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'graduating', label: 'Graduating soon' },
  { id: 'graduated', label: 'Graduated' },
  { id: 'failed', label: 'Failed' },
]

export function TabBar({ active, onChange, counts }: TabBarProps) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-bcc-border bg-bcc-surface p-1">
      {tabs.map((tab) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
              isActive
                ? 'bg-bcc-elevated text-bcc-text'
                : 'text-bcc-muted hover:bg-bcc-elevated/60 hover:text-bcc-text'
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                isActive ? 'bg-bcc-green/20 text-bcc-green' : 'bg-bcc-border text-bcc-muted'
              }`}
            >
              {counts[tab.id]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function statusMatchesTab(status: StoryStatus, tab: BoardTab): boolean {
  if (tab === 'graduating') return status === 'graduating'
  return status === tab
}
