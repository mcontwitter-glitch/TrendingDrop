# Staker Token Airdrop (Graduation)

## Goal

On graduation, narrative stakers’ **net SOL principal seeds the bonding curve** as
the purchase that backs their token allocation. They receive a **pro-rata SPL
airdrop** — not a SOL principal reclaim.

## Economics (defaults)

| Parameter | Default | Notes |
|-----------|---------|-------|
| Notional total supply | **1,000,000,000** whole tokens | Matches UI / FDV (`TOTAL_SUPPLY_WHOLE`); 6 decimals → `10^15` raw units |
| Staker airdrop share | **20%** (`staker_airdrop_bps = 2000`) | Tunable on `NarrativeConfig.staker_airdrop_bps` (max 5000 = 50%) |
| Reserved raw amount | `TOTAL_SUPPLY_RAW * bps / 10_000` | e.g. 20% → `2 * 10^14` raw (200M whole) |
| Allocation | Pro-rata by `stake.amount / story.total_staked` | Net stake after fee |
| Curve seed SOL | **`total_staked` + 80% of losing pool** | Moves story vault → curve vault at graduate |
| Winner SOL bonus | **20% of losing pool** (optional) | Pro-rata via `winner_bonus_pool`; often 0 if no forfeits |
| Graduated claim | **Tokens + optional bonus SOL** | Principal claimable = **0** (already bought into the curve) |
| Failed claim | **Full principal reclaim** | No mint / no airdrop |
| Curve accounting | Airdrop mints escrow ATA; `current_supply` = **seed-SOL buy size** (not notional 20% of 1B) | Keeps spot tradeable; sells are reserve-capped |
| Initial `base_price` | `seed_sol / 1_000_000_000` (lamports per whole) | So spot × 1B / 1e9 ≈ seed SOL FDV |

### Coherent story

1. **Winning stake principal** → curve vault (seed buy that backs the airdrop).
2. **Airdrop tokens** = proceeds of that buy (escrowed, claimed pro-rata).
3. **Losing pool 20/80** stays: 20% small winner SOL bonus; 80% also feeds curve liquidity.
4. Stakers on graduated stories **do not get principal SOL back** via `claim_stake`.
   They can only realize SOL by trading airdrop tokens on the curve (reserve-capped).

Failed / forfeited stories mint **no** airdrop. Forfeited SOL still feeds winners via
`contribute_losing_pool` (20/80) unless a future redesign moves 100% into the curve.

## Claim flow (B — escrow then claim)

```
graduate_narrative
  ├─ CPI VelocityCurve::initialize_token
  │     initial_liquidity = total_staked + 80% losing  → sol_reserve / seed_liquidity
  ├─ transfer seed SOL story vault → curve vault
  └─ CPI VelocityCurve::mint_staker_airdrop(amount)
        ├─ mint reserved raw → StakeAirdrop token vault (ATA)
        └─ set curve.current_supply = tokens_out(seed SOL); refresh current_price

resolve_stakes (Graduated)
  └─ claimable SOL = pro-rata winner_bonus only (principal = 0)

claim_stake
  ├─ if claimable > 0: transfer bonus SOL
  └─ if Graduated + StakeAirdrop + no AirdropClaim yet:
        share = total_airdrop * position.amount / story.total_staked
        transfer share from airdrop vault → staker ATA
        init AirdropClaim receipt PDA ["airdrop-claim", story, staker]
```

Flow A (mint to every staker inside `graduate_narrative`) is rejected: tx size / CU
blow up with unique stakers.

## Accounts

| Account | Seeds | Role |
|---------|-------|------|
| `NarrativeConfig` | `["narrative-config"]` | `staker_airdrop_bps` (u16) |
| `StakeAirdrop` | `["stake-airdrop", story]` | mint, total_amount, claimed_amount, bps, bump |
| Airdrop token vault | ATA(mint, StakeAirdrop PDA) | Escrowed SPL |
| `AirdropClaim` | `["airdrop-claim", story, staker]` | Idempotent token claim receipt |

`StoryMarket` / `StakePosition` / `VelocityToken` layouts are **unchanged** (Devnet-safe).

## VelocityCurve

Ix `mint_staker_airdrop(amount)`:

- Curve PDA signs `mint_to`
- Requires `mint.supply == 0` (must run immediately after `initialize_token`, before any buy)
- **Does** increase `curve.current_supply` (and refreshes `current_price`) so circulating
  supply and spot reflect the seed buy
- `sol_reserve` already set from `initialize_token.initial_liquidity` (= seed SOL)
- Emits `StakerAirdropMinted`

Sells remain capped by `sol_reserve` (integral refund cannot exceed vault accounting).

## Migration (Devnet)

Adding `staker_airdrop_bps` grows `NarrativeConfig` by 2 bytes (appended after `bump` for
prefix-compatible deserialize). After program upgrade, authority must call `update_config`
(handler uses `UncheckedAccount` + manual pad/realloc):

```bash
node scripts/devnet-migrate-airdrop.mjs
# sets staker_airdrop_bps = 2000 and reallocs config 124 → 126 bytes
```

Until migrated, other ixs that decode `NarrativeConfig` via typed `Account` fail.

Auction `initialize_story` duration floor is **60s** (was 1h) so Devnet smoke can run end-to-end.

**Post-threshold final window:** once `total_staked >= graduation_threshold`,
`stake_on_narrative` clamps `ends_at = min(ends_at, now + post_threshold_secs)`.
Default `post_threshold_secs = 1800` (30 minutes) on `NarrativeConfig`. Never extends
a shorter auction (60s smoke stays short). Migrate after upgrade:

```bash
node scripts/devnet-migrate-post-threshold.mjs
# reallocs config (+8 bytes) and sets post_threshold_secs = 1800
```

Stories that already met the threshold **before** the clamp shipped (or with no
stake after migrate) keep the create-time `ends_at` until cranked. Permissionless:

```bash
# all Active threshold-met stories with long ends_at
node scripts/devnet-clamp-post-threshold.mjs
# or one story:
STORY=<storyPda> node scripts/devnet-clamp-post-threshold.mjs
```

`clamp_post_threshold` is idempotent and uses the same formula as stake.


**Auto-graduate after the post-threshold timer:** once `ends_at` has passed and
`total_staked >= graduation_threshold` while still `Active`, anyone can call
permissionless `graduate_narrative`. Pass `rank = 0` to auto-pick the first free
RankingBoard slot (1–5); explicit ranks still work. A mint keypair must sign
(vanity `…drop` grind on UI / crank).

```bash
# crank all ready stories (vanity mint by default)
node scripts/devnet-try-graduate.mjs
# one story / on-chain auto rank after upgrade:
STORY=<storyPda> RANK=0 node scripts/devnet-try-graduate.mjs
```

UI: Story detail auto-launches when the timer hits 0 (connected wallet) and
never hardcodes rank 1 — it reads the RankingBoard for the first empty slot.

Smoke: `node scripts/devnet-smoke-stake-airdrop.mjs` (set `SMOKE_VANITY=1` for …drop mint grind).

Asserts: staker ATA > 0, `curve.sol_reserve ≈` net stake (+ 80% losing if any),
post-resolve `claimable` principal ≈ 0 (bonus only).

## UI

- Stake panel: show **est. airdrop share** = `userStake / totalStaked * (bps/10000) * 1B` tokens
  — copy makes clear SOL buys into the curve / tokens on graduate (not “get SOL back”)
- Graduated panel: **Claim tokens** (and bonus SOL if any) — no “reclaim principal” language
