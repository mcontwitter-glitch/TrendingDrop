import { PublicKey } from '@solana/web3.js'
import type { LoreAssetView, MergeProposalStatus, MergeProposalView } from '../../types'
import { mockCurves } from '../../data/mockCurves'

export interface OnChainMergeProposal {
  absorber: PublicKey
  target: PublicKey
  proposer: PublicKey
  proposedAt: { toNumber(): number } | number
  votingEnds: { toNumber(): number } | number
  yesVotes: { toNumber(): number } | number | bigint
  noVotes: { toNumber(): number } | number | bigint
  quorumRequired: { toNumber(): number } | number | bigint
  executed: boolean
  absorptionRatio: number
  targetLiquiditySnapshot?: { toNumber(): number } | number | bigint
  feeLamports: { toNumber(): number } | number | bigint
  liquidityLamports: { toNumber(): number } | number | bigint
  settlementPending: boolean
  bump: number
}

export interface OnChainLoreAsset {
  originStory: PublicKey
  originCurve: PublicKey
  currentHolder: PublicKey
  contentHash: number[] | Uint8Array
  absorptionHistory: PublicKey[]
  loreValue: { toNumber(): number } | number | bigint
  lorePower: number
  registeredAt: { toNumber(): number } | number
  isAbsorbed: boolean
  bump: number
}

function num(v: { toNumber(): number } | number | bigint | undefined): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'bigint') return Number(v)
  return v.toNumber()
}

function curveMeta(pubkey: string): { ticker: string; title: string; emoji: string } {
  const c = mockCurves.find((x) => x.pubkey === pubkey || x.id === pubkey)
  if (c) return { ticker: c.ticker, title: c.title, emoji: c.emoji }
  return { ticker: pubkey.slice(0, 4).toUpperCase(), title: 'Curve', emoji: '📜' }
}

export function deriveMergeStatus(
  executed: boolean,
  settlementPending: boolean,
  votingEndsSec: number,
  yes: number,
  no: number,
  quorum: number,
  nowSec = Math.floor(Date.now() / 1000),
): MergeProposalStatus {
  if (executed) return settlementPending ? 'pending_settlement' : 'executed'
  if (nowSec < votingEndsSec) return 'active'
  if (yes >= quorum && yes > no) return 'passed'
  return 'rejected'
}

export function mapMergeProposal(
  pubkey: string,
  a: OnChainMergeProposal,
): MergeProposalView {
  const absorber = a.absorber.toBase58()
  const target = a.target.toBase58()
  const abs = curveMeta(absorber)
  const tgt = curveMeta(target)
  const votingEnds = num(a.votingEnds)
  const yes = num(a.yesVotes)
  const no = num(a.noVotes)
  const quorum = num(a.quorumRequired)
  return {
    id: pubkey,
    pubkey,
    absorber,
    target,
    absorberTicker: abs.ticker,
    absorberTitle: abs.title,
    absorberEmoji: abs.emoji,
    targetTicker: tgt.ticker,
    targetTitle: tgt.title,
    targetEmoji: tgt.emoji,
    proposer: a.proposer.toBase58(),
    proposedAt: num(a.proposedAt) * 1000,
    votingEnds: votingEnds * 1000,
    yesVotes: yes,
    noVotes: no,
    quorumRequired: quorum,
    executed: a.executed,
    absorptionRatio: a.absorptionRatio,
    feeLamports: num(a.feeLamports),
    liquidityLamports: num(a.liquidityLamports),
    settlementPending: a.settlementPending,
    status: deriveMergeStatus(
      a.executed,
      a.settlementPending,
      votingEnds,
      yes,
      no,
      quorum,
    ),
    onChain: true,
  }
}

function bytesToHex(bytes: number[] | Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function mapLoreAsset(pubkey: string, a: OnChainLoreAsset): LoreAssetView {
  const originCurve = a.originCurve.toBase58()
  const meta = curveMeta(originCurve)
  return {
    pubkey,
    originStory: a.originStory.toBase58(),
    originCurve,
    currentHolder: a.currentHolder.toBase58(),
    contentHashHex: bytesToHex(a.contentHash),
    absorptionHistory: a.absorptionHistory.map((p) => p.toBase58()),
    loreValueLamports: num(a.loreValue),
    lorePowerBps: a.lorePower,
    registeredAt: num(a.registeredAt) * 1000,
    isAbsorbed: a.isAbsorbed,
    ticker: meta.ticker,
    title: meta.title,
    emoji: meta.emoji,
    onChain: true,
  }
}
