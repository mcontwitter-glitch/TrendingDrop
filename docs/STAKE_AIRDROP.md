# Staker Token Airdrop (Graduation)

## Goal

On graduation, narrative stakers automatically share a **percentage of the notional token supply** as an SPL airdrop — in addition to today’s SOL claim (principal + winner bonus).

## Economics (defaults)

| Parameter | Default | Notes |
|-----------|---------|-------|
| Notional total supply | **1,000,000,000** whole tokens | Matches UI / FDV (`TOTAL_SUPPLY_WHOLE`); 6 decimals → `10^15` raw units |
| Staker airdrop share | **20%** (`staker_airdrop_bps = 2000`) | Tunable on `NarrativeConfig.staker_airdrop_bps` (max 5000 = 50%) |
| Reserved raw amount | `TOTAL_SUPPLY_RAW * bps / 10_000` | e.g. 20% → `2 * 10^14` raw (200M whole) |
| Allocation | Pro-rata by `stake.amount / story.total_staked` | Net stake after fee |
| SOL claim | **Unchanged** | Principal + pro-rata `winner_bonus_pool` (20% of losing pool) |
| Curve pricing | Airdrop **does not** increase `VelocityToken.current_supply` | Off-curve reserve; buys still start from supply 0 |

Stakers of a graduated story therefore receive **both**:

1. SOL upside (principal + bonus) via existing `resolve_stakes` → `claim_stake`
2. Token airdrop share via the same `claim_stake` (transfers from escrow)

Failed / forfeited stories mint **no** airdrop.

## Claim flow (B — escrow then claim)

Preferred for scalability (many stakers; graduate tx stays bounded):

```
graduate_narrative
  ├─ CPI VelocityCurve::initialize_token   (mint authority = curve PDA)
  ├─ seed SOL liquidity → curve vault
  └─ CPI VelocityCurve::mint_staker_airdrop(amount)
        └─ mint reserved raw → StakeAirdrop token vault (ATA)
             authority = StakeAirdrop PDA ["stake-airdrop", story]

resolve_stakes   (unchanged SOL math)

claim_stake
  ├─ transfer claimable SOL (as today)
  └─ if Graduated + StakeAirdrop exists + no AirdropClaim receipt yet:
        share = total_airdrop * position.amount / story.total_staked
        transfer share from airdrop vault → staker ATA (create if needed)
        init AirdropClaim receipt PDA ["airdrop-claim", story, staker]
```

Flow A (mint to every staker inside `graduate_narrative`) is rejected: tx size / CU blow up with unique stakers.

## Accounts

| Account | Seeds | Role |
|---------|-------|------|
| `NarrativeConfig` | `["narrative-config"]` | `staker_airdrop_bps` (u16) |
| `StakeAirdrop` | `["stake-airdrop", story]` | mint, total_amount, claimed_amount, bps, bump |
| Airdrop token vault | ATA(mint, StakeAirdrop PDA) | Escrowed SPL |
| `AirdropClaim` | `["airdrop-claim", story, staker]` | Idempotent token claim receipt |

`StoryMarket` / `StakePosition` / `VelocityToken` layouts are **unchanged** (Devnet-safe).

## VelocityCurve

New ix `mint_staker_airdrop(amount)`:

- Signer: none beyond payer (curve PDA signs `mint_to`)
- Requires `mint.supply == 0` (must run immediately after `initialize_token`, before any buy)
- Does **not** bump `curve.current_supply`
- Emits `StakerAirdropMinted`

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

Smoke: `node scripts/devnet-smoke-stake-airdrop.mjs` (set `SMOKE_VANITY=1` for …drop mint grind).

## UI

- Stake panel: show **est. airdrop share** = `userStake / totalStaked * (bps/10000) * 1B` tokens
- Graduated panel: **Claim SOL + tokens** when position is resolved / claimable
