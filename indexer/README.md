# Bonding Curve Casino — Indexer

Node/TypeScript service that indexes **NarrativeAuction**, **VelocityCurve**, **LoreMerge**, and **ReputationNFT** program accounts for the Story Markets frontend.

## Modes

| Mode | When | How |
|------|------|-----|
| **RPC poll** (default) | `GEYSER_ENDPOINT` unset | `getProgramAccounts` + `onLogs` every `POLL_INTERVAL_MS` |
| **Yellowstone / Geyser** | `GEYSER_ENDPOINT` set | Planned gRPC subscribe (scaffold in `src/geyser.ts`) |

No Docker required. Storage defaults to **SQLite** via `sql.js` (WASM; no native build / Docker).

## Yellowstone / Geyser plan

1. Provision a Yellowstone-compatible gRPC endpoint (Helius LaserStream, Triton, self-hosted Geyser plugin, etc.).
2. Set `GEYSER_ENDPOINT=https://…` (and auth headers via env when the client is wired).
3. Subscribe to **account updates** where `owner` ∈ the four program IDs below.
4. Subscribe to **transactions / logs** mentioning those programs for activity feed enrichment.
5. Decode with `src/decode.ts` (same layouts as Anchor accounts) → upsert SQLite/Postgres.
6. On stream disconnect, keep `RpcPoller` running as a safety net.

Program IDs (defaults):

| Program | ID |
|---------|-----|
| NarrativeAuction | `75xWzXGb3A7UgpqDDL9ByVXpaZ8Zw4AF4i7whnVXyh8m` |
| VelocityCurve | `5VbDjccBDNVCPLpSgxyuw7ptYekrcxH8FySBxaAXx6C` |
| LoreMerge | `8pSr3X9iP66rvqMWT4S2gsEGtS8VnCLZtJayY9NB9ySy` |
| ReputationNFT | `DrzQKZpvg8y7Gymp5yz2upX24v3fV7j7eFuqT31Nxgvd` |

## Config (env)

Copy `.env.example`. Important keys:

- `RPC_URL` — Solana HTTP RPC
- `GEYSER_ENDPOINT` — optional Yellowstone gRPC URL
- `DATABASE_URL` — `sqlite:./data/indexer.db` (Postgres URL reserved)
- `*_PROGRAM_ID` — override program IDs
- `POLL_INTERVAL_MS` — default `15000`
- `PORT` / `HOST` — HTTP API bind (default `8787`)

## HTTP API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Mode, last poll timestamp |
| GET | `/api/stories` | Indexed story markets (JSON for frontend) |
| GET | `/api/activity` | Recent activity feed |
| GET | `/api/curves` | Velocity curve stats |

## Run

```bash
cd indexer
npm install
cp .env.example .env   # optional
npm run dev            # watch
# or
npm start

# one-shot poll + exit
npm run dry-run
npm run typecheck
```

Point the Vite app at the indexer:

```bash
# repo root
VITE_INDEXER_URL=http://localhost:8787 npm run dev
```

`useIndexerFeed` tries the indexer first, then falls back to mock/chain data.
