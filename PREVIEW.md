# Preview — TrendingDrop Story Markets

## How to run

```bash
cd /workspace/trendingdrop
npm install
npm run dev
```

Open **http://localhost:5173** (port `5173`, `strictPort: true`).

Production check:

```bash
npm run build
npm run preview
```

## Routes

- **`/`** — Board (home): live activity ticker, King of the Hill banner, tabs (Active / Graduating soon / Graduated / Failed), searchable story card grid
- **`/create`** — Create Story form (title, ticker, description, image placeholder, socials, 24h/48h duration, min stake). Submit is client-only mock; redirects home after success toast state
- **`/story/:id`** — Detail for a narrative (e.g. `/story/meme-council`, `/story/kot-ai-agents`): full description, metrics, graduation progress, stake panel with quick SOL amounts, top stakers list, recent activity

## Mock data shown

**13 stories** across statuses:

| Status | Examples | Count |
|--------|----------|-------|
| Active | Void Cats, Solana Summer Forever, Rugged But Based, Clockwork Ape, Ghost Liquidity, Pixel Prophet, Neon Noodles | 7 |
| Graduating soon | King of the Agents ($KOTA), The Meme Council ($COUNCIL) | 2 |
| Graduated | Degen Dog, Laser Eyes Forever | 2 |
| Failed | Quiet Coin, Slow Llama | 2 |

- **King of the Hill**: highest-staked among active/graduating (typically The Meme Council ~61.8 SOL)
- **Graduation threshold**: 69 SOL on all stories; cards show % funded + shimmer progress bars
- **Live ticker**: scrolling mock events (stakes, new stories, graduations, near-threshold alerts)
- **Connect Wallet**: header button is visual only (no wallet adapter)
- **Stake CTA**: simulates success locally; does not write on-chain

## Visual notes

- Dark bg `#0a0a0a`, neon green `#39ff14`, pump.fun–inspired layout (not a logo/copy clone)
- Branding: **TrendingDrop** / **Story Markets**
- Mobile-first card grid, hover lifts, staggered fade-in, king banner glow

## GitHub Pages

- **Custom domain (primary):** https://www.findtrending.com  
- **Fallback:** https://mcontwitter-glitch.github.io/TrendingDrop/

Deployed via `.github/workflows/pages.yml`. Vite `base` is `/` (custom domain). `public/CNAME` is `www.findtrending.com`.

**Cluster:** GitHub Pages builds with **Devnet** RPC + program IDs (workflow env). Indexer URL is unset on Pages (on-chain/mock fallbacks). Switch to Mainnet per `docs/MAINNET.md` when ready.

### DNS for www.findtrending.com
1. At your DNS host, create a **CNAME** for `www` → `mcontwitter-glitch.github.io`
2. (Optional) Apex `findtrending.com`: four **A** records → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, then enable apex→www redirect in GitHub Pages or at your DNS host
3. Wait for GitHub to verify DNS and provision HTTPS (can take minutes to hours)

