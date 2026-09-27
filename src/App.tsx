import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Header } from './components/Header'
import { Board } from './pages/Board'
import { CreateStory } from './pages/CreateStory'
import { StoryDetail } from './pages/StoryDetail'
import { Trade } from './pages/Trade'
import { TradeDesk } from './pages/TradeDesk'
import { Merge } from './pages/Merge'
import { MergeDetail } from './pages/MergeDetail'
import { MergePropose } from './pages/MergePropose'
import { Profile } from './pages/Profile'
import { clusterLabel, RPC_URL } from './lib/solana/constants'

export default function App() {
  const cluster = clusterLabel(RPC_URL)

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <div className="app-bg min-h-screen">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Board />} />
            <Route path="/create" element={<CreateStory />} />
            <Route path="/story/:id" element={<StoryDetail />} />
            <Route path="/trade" element={<Trade />} />
            <Route path="/trade/:curveId" element={<TradeDesk />} />
            <Route path="/merge" element={<Merge />} />
            <Route path="/merge/propose" element={<MergePropose />} />
            <Route path="/merge/:proposalId" element={<MergeDetail />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>
        <footer className="border-t border-bcc-border py-8 text-center text-xs text-bcc-muted">
          <img
            src={`${import.meta.env.BASE_URL}brand/logo.png`}
            alt=""
            width={40}
            height={40}
            className="mx-auto mb-2 h-10 w-10 rounded-xl border border-bcc-cyan/25 object-cover shadow-[0_0_12px_rgba(34,211,238,0.2)]"
          />
          <p className="font-display font-semibold">TrendingDrop</p>
          <p className="mt-1">
            Story Markets · VelocityCurve · LoreMerge · Reputation · On-chain when connected · mock
            fallback · Not financial advice
          </p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-bcc-border/80 bg-bcc-surface/60 px-2.5 py-0.5 text-[10px] uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-bcc-cyan shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
            {cluster}
            <span className="text-bcc-muted/70 normal-case tracking-normal">
              {RPC_URL.replace(/^https?:\/\//, '')}
            </span>
          </p>
        </footer>
      </div>
    </BrowserRouter>
  )
}
