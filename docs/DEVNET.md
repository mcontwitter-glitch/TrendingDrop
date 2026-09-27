# Devnet deploy checklist

Document-only guide for deploying Bonding Curve Casino programs to **Solana Devnet**.
Do **not** treat this as an automated CI step — public RPC airdrops are unreliable from
shared boxes. Prefer a funded keypair + a stable RPC (Helius / Triton / QuickNode) when
you actually deploy.

## Prerequisites

- Solana CLI matching `Anchor.toml` (`solana_version = "1.18.26"`) or a compatible 1.18.x
- Anchor `0.30.1` (`avm use 0.30.1`)
- Platform tools **v1.45** for BPF builds (see below)
- A keypair at `~/.config/solana/id.json` (or set `ANCHOR_WALLET`)

### Platform tools v1.45

Anchor/Solana BPF builds need the platform-tools toolchain. Pin **v1.45** when building:

```bash
# One-time (or when cargo-build-sbf complains about tools)
cargo-build-sbf --tools-version v1.45 --version   # sanity
# Or export for the session:
export SBF_TOOLS_VERSION=v1.45
```

Then build with Anchor as usual (`anchor build` invokes `cargo-build-sbf`).

## 1. Point Solana CLI at Devnet

```bash
solana config set --url https://api.devnet.solana.com
solana config get
solana address
```

Optional: use a paid RPC for deploy reliability:

```bash
solana config set --url https://devnet.helius-rpc.com/?api-key=YOUR_KEY
```

## 2. Fund the deployer wallet

```bash
# Public faucet (rate-limited; may fail)
solana airdrop 2
solana balance

# If airdrop fails, use https://faucet.solana.com or transfer from a funded wallet.
# Aim for ≥ ~5 SOL before deploying all four programs.
```

## 3. Build (tools-version v1.45)

From the repo root:

```bash
cd /path/to/bonding-curve-casino
export SBF_TOOLS_VERSION=v1.45
anchor build
```

Or per-program:

```bash
export SBF_TOOLS_VERSION=v1.45
anchor build -p narrative_auction
anchor build -p velocity_curve
anchor build -p lore_merge
anchor build -p reputation_nft
```

If program IDs must change for a fresh deploy, generate keys and sync first:

```bash
anchor keys list
anchor keys sync
# Then rebuild so declare_id! + Anchor.toml match the keypair files under target/deploy/
```

## 4. Deploy each program

```bash
export SBF_TOOLS_VERSION=v1.45

anchor deploy -p narrative_auction --provider.cluster devnet
anchor deploy -p velocity_curve    --provider.cluster devnet
anchor deploy -p lore_merge        --provider.cluster devnet
anchor deploy -p reputation_nft    --provider.cluster devnet
```

Confirm on-chain:

```bash
solana program show 75xWzXGb3A7UgpqDDL9ByVXpaZ8Zw4AF4i7whnVXyh8m   # or new ID after keys sync
```

Update `Anchor.toml` `[programs.devnet]` if IDs changed.

## 5. Update frontend env

Copy root `.env.example` → `.env` and set the **new** program IDs + Devnet RPC:

```bash
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_NARRATIVE_AUCTION_PROGRAM_ID=<deployed>
VITE_VELOCITY_CURVE_PROGRAM_ID=<deployed>
VITE_LORE_MERGE_PROGRAM_ID=<deployed>
VITE_REPUTATION_NFT_PROGRAM_ID=<deployed>
VITE_INDEXER_URL=http://localhost:8787   # optional; see indexer/README.md
```

Restart Vite (`npm run dev`) so `import.meta.env` picks up changes.

Indexer (optional) should use the same IDs via `indexer/.env`:

```bash
RPC_URL=https://api.devnet.solana.com
NARRATIVE_AUCTION_PROGRAM_ID=<deployed>
# …same for the other three
```

## 6. Point Phantom (or Solflare) at Devnet

1. Open Phantom → **Settings** → **Developer Settings** → enable **Testnet Mode** / set network to **Devnet**.
2. Or Solflare → Settings → Network → **Devnet**.
3. Confirm the wallet address matches a funded Devnet account before submitting txs.
4. Open the Vite app; the cluster label should read **Devnet** when `VITE_SOLANA_RPC_URL` contains `devnet`.

## 7. Smoke (optional)

Local smoke script targets localnet by default:

```bash
# Localnet only — see scripts/localnet-smoke.mjs
RPC_URL=http://127.0.0.1:8899 node scripts/localnet-smoke.mjs
```

For Devnet, prefer a short manual flow (initialize config → create story → stake) from the UI
or a one-off script with `RPC_URL` pointing at Devnet — do not expect the local smoke
script to pass against public Devnet without funded accounts and matching program state.

## Blockers / notes

- **No guaranteed airdrop** from CI or shared agents — fund offline if faucet fails.
- **Wesayso** remains personal-use until commercial purchase (`docs/WESAYSO_LICENSE.md`).
- **Geyser**: leave `GEYSER_ENDPOINT` unset on Devnet unless you have a Yellowstone slot;
  indexer poll mode is the default (`indexer/README.md`).
