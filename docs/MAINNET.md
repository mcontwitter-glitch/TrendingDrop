# Mainnet ops runbook

Operational guide for deploying **TrendingDrop** programs to **Solana Mainnet-Beta** and cutting over the app + indexer. Treat this as a checklist, not an automated CI step.

**Prerequisite:** complete a full Devnet dress rehearsal first ([`DEVNET.md`](./DEVNET.md)). Do not Mainnet-deploy until init → create → stake → graduate → trade → merge works on Devnet.

---

## Status snapshot (as of Devnet cut)

| Item | Notes |
|------|--------|
| Programs (localnet / Devnet IDs) | Same four IDs currently used on Devnet — **generate new keypairs for Mainnet** |
| Upgrade authority (Devnet) | Deployer `8UxuHLFBjmaMPVzBXQzw2uMUAePNUyHafLocffyCEkGa` |
| Frontend Pages | https://www.findtrending.com (DNS) / https://mcontwitter-glitch.github.io/TrendingDrop/ |
| Display font | Orbitron (SIL OFL) — [`DISPLAY_FONT.md`](./DISPLAY_FONT.md) |
| Cross-chain | Deferred — [`CROSS_CHAIN.md`](./CROSS_CHAIN.md) |

---

## 0. Go / no-go

Before spending Mainnet SOL:

- [ ] Devnet E2E smoke passed (UI + real txs)
- [ ] Paid Mainnet JSON-RPC ready (Helius / Triton / QuickNode — not public `api.mainnet-beta`)
- [ ] Deployer + fee payer funded (see §2)
- [ ] Upgrade authority plan decided (Squads / multi-sig strongly preferred over a hot single key)
- [ ] Metadata HTTPS host ready (replace any `bcc.local` / placeholder URIs)
- [x] Display font libre / commercial-safe (Orbitron SIL OFL — [`DISPLAY_FONT.md`](./DISPLAY_FONT.md))
- [ ] Oracle operator keys provisioned (3–5) + crank process documented
- [ ] Incident contact + pause / upgrade playbook agreed

---

## 1. Fresh Mainnet program keys

**Do not reuse Devnet / localnet program keypairs on Mainnet** if you want a clean break and independent upgrade history. Generate new ones:

```bash
cd /path/to/trendingdrop
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
avm use 0.30.1

# Backup existing target/deploy/*-keypair.json first
mkdir -p backups/program-keys-$(date +%Y%m%d)
cp target/deploy/*-keypair.json backups/program-keys-$(date +%Y%m%d)/ 2>/dev/null || true

# New keys (Anchor will rewrite declare_id! on sync)
anchor keys sync   # or generate per-program and sync
anchor keys list
```

Then rebuild so `declare_id!`, IDL, and `Anchor.toml` `[programs.mainnet]` match:

```toml
[programs.mainnet]
narrative_auction = "<NEW>"
velocity_curve    = "<NEW>"
lore_merge        = "<NEW>"
reputation_nft    = "<NEW>"
```

Store keypairs in an offline vault. Never commit them. Restrict who can copy `target/deploy/*-keypair.json`.

---

## 2. Wallets, SOL budget, authority

| Role | Purpose | Guidance |
|------|---------|----------|
| **Deployer** | Pays for `solana program deploy` | Hardware or cold; fund once for deploy |
| **Upgrade authority** | Can change program bytecode | Prefer Squads / multi-sig; transfer after deploy |
| **Config / admin** | `initialize` config, oracle admin ixs | Separate from deployer if possible |
| **Oracle crankers** | 3–5 keys for `update_attention` | Hot OK if limited; monitor + rotate |
| **Treasury** | Fee / merge proceeds | Cold or multi-sig |

**Rough SOL budget (order-of-magnitude):**

- Four BPF deploys: often **several–tens of SOL** depending on binary size and rent (Devnet used ~8 SOL for these four binaries).
- Buffer for buffer accounts, failed retries, ATA / mint inits during smoke: keep a spare **2–5 SOL** on deployer.
- Prefer a **paid RPC** for deploy; public Mainnet RPC will flake under load.

```bash
solana config set --url https://YOUR-MAINNET-RPC
solana config get
solana balance
```

---

## 3. Build

```bash
cd /path/to/trendingdrop
export SBF_TOOLS_VERSION=v1.45
anchor build
# or per-program:
# anchor build -p narrative_auction
# anchor build -p velocity_curve
# anchor build -p lore_merge
# anchor build -p reputation_nft
```

Verify artifacts under `target/deploy/*.so` and IDL under `target/idl/`. Copy IDL into `src/idl/` if your release process expects checked-in copies.

---

## 4. Deploy

```bash
export SBF_TOOLS_VERSION=v1.45

anchor deploy -p narrative_auction --provider.cluster mainnet
anchor deploy -p velocity_curve    --provider.cluster mainnet
anchor deploy -p lore_merge        --provider.cluster mainnet
anchor deploy -p reputation_nft    --provider.cluster mainnet
```

Confirm each:

```bash
solana program show <PROGRAM_ID>
```

Record: Program Id, Authority, Data Length, Last Deploy Slot.

### Post-deploy authority handoff

```bash
# Example: set upgrade authority to a Squads vault / multisig pubkey
solana program set-upgrade-authority <PROGRAM_ID> --new-upgrade-authority <MULTISIG>
```

Do this for all four programs. Revoke deployer upgrade rights once the multisig is verified.

---

## 5. On-chain initialize (order)

Exact ix names follow the IDL / UI. Typical order:

1. **NarrativeAuction** — initialize global config (fees, thresholds, admin).
2. **VelocityCurve** — oracle config: set quorum (e.g. 3), `add_oracle` × N.
3. **LoreMerge** — config if required.
4. **ReputationNFT** — config + metadata base URI pointing at your HTTPS host.
5. Sanity: create one story, stake small SOL, (optional) graduate path on a throwaway market.

Document every signature / explorer link in an ops log (private).

---

## 6. Frontend cutover

Root `.env` (or host secrets for Pages / Cloudflare / Vercel — **never commit**):

```bash
VITE_SOLANA_RPC_URL=https://YOUR-MAINNET-RPC
VITE_NARRATIVE_AUCTION_PROGRAM_ID=<mainnet>
VITE_VELOCITY_CURVE_PROGRAM_ID=<mainnet>
VITE_LORE_MERGE_PROGRAM_ID=<mainnet>
VITE_REPUTATION_NFT_PROGRAM_ID=<mainnet>
VITE_INDEXER_URL=https://indexer.yourdomain.com
```

- Rebuild and redeploy GitHub Pages (or your host) so `base: '/'` + custom domain stay correct.
- Confirm UI cluster label shows **Mainnet**.
- Disable mock fallbacks for live markets if any remain behind a flag.
- Wallet: Phantom / Solflare on **Mainnet**.

---

## 7. Indexer + Geyser

`indexer/.env`:

```bash
RPC_URL=https://YOUR-MAINNET-RPC
NARRATIVE_AUCTION_PROGRAM_ID=<mainnet>
VELOCITY_CURVE_PROGRAM_ID=<mainnet>
LORE_MERGE_PROGRAM_ID=<mainnet>
REPUTATION_NFT_PROGRAM_ID=<mainnet>
# Optional when you have a Yellowstone slot:
# GEYSER_ENDPOINT=https://...
# GEYSER_X_TOKEN=...
POLL_INTERVAL_MS=15000
PORT=8787
```

- Poll mode is fine for early traffic; add Yellowstone when you have a slot ([`indexer/README.md`](../indexer/README.md)).
- Put the indexer behind HTTPS; point `VITE_INDEXER_URL` at it.
- Health: `GET /health`, then `/api/stories`, `/api/activity`, `/api/curves`.

---

## 8. Oracle ops

| Mode | Use when |
|------|----------|
| Tx-signer | Cranker + remaining signers meet quorum (simpler) |
| Ed25519 offline | Prior Ed25519Program ixs + timestamp proof (see `ARCHITECTURE.md` §9) |

- [ ] 3–5 authorized oracles on-chain
- [ ] Crank host with alerting (missed updates, RPC errors)
- [ ] Key rotation runbook (`remove_oracle` / `add_oracle`)
- [ ] Quorum change procedure (`set_oracle_quorum`)

---

## 9. Monitoring & incident

Watch:

- Program upgrade authority still = intended multisig
- Deployer / treasury / vault SOL balances
- Failed user txs (RPC + explorer)
- Oracle lag / attention freshness
- Indexer poll lag and SQLite/disk growth

**If compromised or critical bug:**

1. Pause markets via admin / stop cranking (document which ix or operational stop you use).
2. Do **not** upgrade from a hot laptop if authority is multisig — convene the vault.
3. Notify users on status / X; freeze frontend RPC to a read-only banner if needed.
4. Patch on Devnet → audit → Mainnet upgrade through multisig.

---

## 10. Launch blockers still tracked in-repo

| Item | Doc |
|------|-----|
| LoreMerge SPL burn→mint claim window | Deferred on-chain (see `ARCHITECTURE.md`) |
| Cross-chain Base/Arbitrum | [`CROSS_CHAIN.md`](./CROSS_CHAIN.md) — not required for Solana Mainnet v1 |

---

## 11. Rollback / dual-run

- Keep Devnet deployment healthy as a staging twin after Mainnet launch.
- Frontend can be rolled back by redeploying Pages with previous env (program IDs immutable on-chain — rollback = UI / indexer / pause, not “undeploy”).
- Program bugs require a new upgrade (authority) or a successor program + migration.

---

## Quick command cheat sheet

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
avm use 0.30.1
solana config set --url https://YOUR-MAINNET-RPC
export SBF_TOOLS_VERSION=v1.45
anchor build
anchor deploy -p narrative_auction --provider.cluster mainnet
# …repeat for velocity_curve, lore_merge, reputation_nft
solana program show <ID>
solana program set-upgrade-authority <ID> --new-upgrade-authority <MULTISIG>
```

When Mainnet IDs exist, update this doc’s status table and `.env.example` comments (not secrets).
