# TrendingDrop — Story Markets

Phase 1 frontend demo for **TrendingDrop**: a Solana launchpad where meme coin launches start as **prediction markets on narratives**. Creators submit stories; users stake SOL; top narratives graduate to tokenization later.

This UI is **mock-data only** — no Solana wallet wiring yet. On-chain Anchor programs now live in-repo (see below).

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 (`@tailwindcss/vite`)
- React Router
- Lucide icons

## Run locally

```bash
cd /workspace/bonding-curve-casino
npm install
npm run dev
```

Dev server defaults to **http://localhost:5173**.

```bash
npm run build    # production build
npm run preview  # preview production build
```

## Routes

| Path | Description |
|------|-------------|
| `/` | Story Markets board (tabs, King of the Hill, live ticker, card grid) |
| `/create` | Create Story form (client-only mock submit) |
| `/story/:id` | Story detail (stake panel, stakers, countdown, activity) |

## Product framing (Phase 1)

- Creators submit meme **concepts/stories** (not tokens yet)
- Users stake SOL on which story deserves to exist
- Top narratives graduate to tokenization in a later phase

See [PREVIEW.md](./PREVIEW.md) for mock data notes and screenshot guidance.

## On-chain programs

Anchor workspace (Solana) scaffolds four programs under `programs/`:

| Program | Path | Status |
|---------|------|--------|
| NarrativeAuction | `programs/narrative-auction` | Phase 1 — full accounts + instruction logic |
| VelocityCurve | `programs/velocity-curve` | Phase 2 — typed stub |
| LoreMerge | `programs/lore-merge` | Phase 3 — typed stub |
| ReputationNFT | `programs/reputation-nft` | Typed stub + accuracy/tier math |

**Read [ARCHITECTURE.md](./ARCHITECTURE.md)** for phases, account diagram, CPI flow, fees (2% / 1.5% / 5%), and deploy next steps.

Requires Anchor 0.30.x + Solana CLI to build/deploy (`anchor` / `solana` are not required to run the Vite UI).

## Infra

- **Env**: copy [`.env.example`](./.env.example) → `.env` for Vite (`VITE_SOLANA_RPC_URL`, program IDs, `VITE_INDEXER_URL`).
- **Indexer** (optional): see [`indexer/README.md`](./indexer/README.md). Set `VITE_INDEXER_URL=http://localhost:8787` for the LiveTicker feed.
- **Devnet**: [`docs/DEVNET.md`](./docs/DEVNET.md) — `solana config set --url devnet`, airdrop, `anchor deploy` with tools-version v1.45, Phantom → Devnet.
- **CI**: [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)
- **Localnet smoke**: `node scripts/localnet-smoke.mjs` (requires running validator + deployed programs).

## License / Fonts

- **Wesayso**: personal-use only until commercial purchase — see [`docs/WESAYSO_LICENSE.md`](./docs/WESAYSO_LICENSE.md).
