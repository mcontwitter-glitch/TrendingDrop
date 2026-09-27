# TrendingDrop — Indexer

Node/TypeScript service that indexes **NarrativeAuction**, **VelocityCurve**, **LoreMerge**, and **ReputationNFT** program accounts for the Story Markets frontend.

## Modes

| Mode | When | How |
|------|------|-----|
| **RPC poll** (default) | `GEYSER_ENDPOINT` unset or empty | `getProgramAccounts` + `onLogs` every `POLL_INTERVAL_MS` |
| **Yellowstone / Geyser** | `GEYSER_ENDPOINT` set | gRPC subscribe scaffold in `src/geyser.ts` (falls back to poll until the client is fully wired) |

No Docker required. Storage defaults to **SQLite** via `sql.js` (WASM; no native build / Docker).

Poll mode is the supported default for localnet and casual Devnet. Geyser is optional and requires a paid / self-hosted Yellowstone-compatible slot.

## Yellowstone / Geyser setup (Helius / Triton-style)

### 1. Provision an endpoint

Pick one:

| Provider | Typical env shape | Notes |
|----------|-------------------|--------|
| **Helius** LaserStream / Geyser | `GEYSER_ENDPOINT=https://atlas-mainnet.helius-rpc.com` (or Devnet equivalent) + `GEYSER_X_TOKEN=<api-key>` | Yellowstone-compatible gRPC; use the LaserStream / Geyser URL from the Helius dashboard, not the regular JSON-RPC URL |
| **Triton** / RPC Pool | `GEYSER_ENDPOINT=https://<project>.rpcpool.com` + `GEYSER_X_TOKEN=<token>` | Same Yellowstone subscribe API (`@triton-one/yellowstone-grpc`) |
| **Self-hosted** | `GEYSER_ENDPOINT=http://127.0.0.1:10000` | Geyser plugin on your validator; auth often none or custom header |

Exact hostnames change — copy the **gRPC / Yellowstone** URL from your provider dashboard, not the HTTPS JSON-RPC URL used for `RPC_URL`.

### 2. Required env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `RPC_URL` | yes | Solana JSON-RPC (always used for poll fallback + bootstrapping) |
| `GEYSER_ENDPOINT` | no | Yellowstone gRPC base URL. **Empty → poll-only** |
| `GEYSER_X_TOKEN` | when provider needs it | x-token / API key (Helius, Triton). Passed as gRPC metadata `x-token` |
| `GEYSER_API_TOKEN` | alt | Same as `GEYSER_X_TOKEN` if your provider uses a different name — either works in the scaffold |
| `DATABASE_URL` | no | Default `sqlite:./data/indexer.db` |
| `*_PROGRAM_ID` | no | Override the four program IDs (defaults = `Anchor.toml` localnet) |
| `POLL_INTERVAL_MS` | no | Default `15000` |
| `PORT` / `HOST` | no | HTTP API bind (default `8787` / `0.0.0.0`) |

Copy `indexer/.env.example` → `indexer/.env`.

### 3. Poll vs Geyser behavior

```text
GEYSER_ENDPOINT unset  →  RpcPoller only (default, production-safe without a slot)
GEYSER_ENDPOINT set    →  startGeyserScaffold() logs intent + still keeps RpcPoller
                          as safety net until @triton-one/yellowstone-grpc is wired
```

When the Yellowstone client is implemented (`src/geyser.ts`):

1. Connect with `@triton-one/yellowstone-grpc` (or equivalent) using `GEYSER_ENDPOINT` + `x-token`.
2. Subscribe to **account updates** where `owner` ∈ the four program IDs.
3. Subscribe to **transactions / logs** mentioning those programs for the activity feed.
4. Decode with `src/decode.ts` → upsert SQLite/Postgres.
5. On stream disconnect, keep `RpcPoller` running until the stream recovers.

Program IDs (defaults — match `Anchor.toml` `[programs.localnet]`):

| Program | ID |
|---------|-----|
| NarrativeAuction | `75xWzXGb3A7UgpqDDL9ByVXpaZ8Zw4AF4i7whnVXyh8m` |
| VelocityCurve | `5VbDjccBDNVCPLpSgxyuw7ptYekrcxH8FySBxaAXx6C` |
| LoreMerge | `8pSr3X9iP66rvqMWT4S2gsEGtS8VnCLZtJayY9NB9ySy` |
| ReputationNFT | `DrzQKZpvg8y7Gymp5yz2upX24v3fV7j7eFuqT31Nxgvd` |

### 4. Frontend: `VITE_INDEXER_URL`

The Vite app does **not** talk to Geyser directly. Flow:

```text
Yellowstone / RPC poll  →  indexer HTTP (PORT)  →  frontend VITE_INDEXER_URL
```

1. Run the indexer (`npm run dev` in `indexer/`) so `GET http://localhost:8787/health` works.
2. In the **repo root** `.env` (see root `.env.example`):

   ```bash
   VITE_INDEXER_URL=http://localhost:8787
   ```

3. Restart Vite. `useIndexerFeed` calls `/api/activity`, `/api/stories`, `/api/curves` on that base URL, then falls back to mock/chain data if the indexer is down.

Cross-origin: indexer listens on `0.0.0.0:8787` by default; Vite is `:5173`. CORS is enabled on the indexer API for local use.

## Config (env) — quick list

Copy `.env.example`. Important keys:

- `RPC_URL` — Solana HTTP RPC
- `GEYSER_ENDPOINT` — optional Yellowstone gRPC URL (empty = poll mode)
- `GEYSER_X_TOKEN` / `GEYSER_API_TOKEN` — provider auth for Geyser
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
