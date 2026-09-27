# Cross-chain scaffold — Base / Arbitrum mirrors

> **Status:** design + Solidity interface stubs only. Not deployed. Compile optional
> (Foundry not required in CI). Solana remains the source of truth for Story Markets.

## Goal

Mirror selected Bonding Curve Casino **read state** onto EVM L2s (Base, Arbitrum)
so Ethereum wallets can browse narrative velocity / stakes without holding SOL,
while **writes** (stake, graduate, buy/sell, merge) stay on Solana until a later
phase adds inbound message handling.

## Approach: canonical bridge + message-passing

```
┌──────────────────────┐     attest / post      ┌─────────────────────────┐
│  Solana (canonical)  │ ─────────────────────▶ │  L2 mirror contracts    │
│  NarrativeAuction    │   Wormhole / LayerZero │  StoryMarketMirror      │
│  VelocityCurve       │   / custom relayer     │  VelocityMirror         │
│  LoreMerge           │                        │  (Base + Arbitrum)      │
└──────────────────────┘                        └─────────────────────────┘
```

1. **Solana is canonical** for balances, vaults, and phase transitions.
2. A **relayer** watches program logs / indexer (`indexer/`) and posts attested
   messages to L2 via a message-passing bridge (Wormhole Core, LayerZero, or
   Chainlink CCIP — TBD at implementation time).
3. L2 contracts store a **lossy mirror**: pubkeys as `bytes32`, lamports as `uint64`,
   phases as `uint8`. No SOL custody on L2 in v1.
4. Optional later: L2 → Solana messages for “intent to stake” that a Solana crank
   fulfills after bridging USDC/SOL — out of scope for this scaffold.

## Accounts mirrored

| Solana account        | Mirror surface                         | Fields (subset)                                      |
|-----------------------|----------------------------------------|------------------------------------------------------|
| `StoryMarket`         | `IStoryMarketMirror`                   | creator, contentHash, phase, totalStaked, endsAt, rank |
| `NarrativeConfig`     | config view on mirror                  | feeBps, maxStakesPerUser, graduationWindow           |
| `VelocityToken`       | `IVelocityMirror`                      | storyId, currentPrice, attentionScore, supply, taxBps |
| `TraderProfile`       | optional reputation view               | accuracyBps, tier (enum), nftMint (bytes32)          |
| `MergeProposal`       | deferred                               | —                                                    |

**Not mirrored in v1:** vault lamports as spendable balances, StakePosition
claimable amounts (users must act on Solana), RankingBoard slots (derivable).

## Message schema (v0)

```text
domain     = "bcc-mirror-v0"
payload    =
  version (u8)
  || chain_hint (u8)          // 0=solana-source
  || account_kind (u8)        // 1=StoryMarket 2=VelocityToken 3=Profile
  || pubkey (32)
  || body (borsh/abi-encoded snapshot)
  || slot (u64)
  || timestamp (i64)
```

Relayer posts `payload` + bridge VAAs / LZ packets. Mirror contracts verify
bridge authentication then `upsert*` storage.

## Folder layout

```
cross-chain/
  README.md                 ← pointer to this doc
  env/
    base.env.example
    arbitrum.env.example
  solidity/
    IStoryMarketMirror.sol
    IVelocityMirror.sol
    interfaces/IBccBridgeReceiver.sol
```

## Env placeholders

See `cross-chain/env/*.env.example` for:

- `BASE_RPC_URL` / `ARBITRUM_RPC_URL`
- `*_BRIDGE_ENDPOINT` (Wormhole / LZ endpoint addresses)
- `*_STORY_MIRROR` / `*_VELOCITY_MIRROR` (deployed proxy addresses)
- Relayer key / Solana RPC used by the poster

Root `.env.example` also lists optional Vite flags for displaying L2 mirrors
in the UI later (`VITE_BASE_MIRROR_URL`, etc.).

## Security notes

- Never trust L2 state for payouts.
- Quorum / guardian set of the chosen bridge is the trust root for mirrors.
- Pause switch on mirror contracts before mainnet messaging is enabled.

## Implementation phases

| Phase | Work |
|-------|------|
| **Now (scaffold)** | This doc + Solidity interfaces + env placeholders |
| **Next** | Relayer prototype posting StoryMarket snapshots to a single L2 |
| **Later** | Dual-L2 deploy, UI “view on Base”, optional inbound stake intents |
