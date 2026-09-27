# Display font — Orbitron

TrendingDrop uses **Orbitron** (Bold / 700) as the display / branding typeface (`--font-display`).

| Item | Detail |
|------|--------|
| License | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) — commercial-safe |
| Source | [Google Fonts — Orbitron](https://fonts.google.com/specimen/Orbitron) / [@fontsource/orbitron](https://www.npmjs.com/package/@fontsource/orbitron) |
| File | `public/fonts/Orbitron-Bold.woff2` (self-hosted; no Google CDN at runtime) |
| Wired in | `src/index.css` (`@font-face "Orbitron"` → `--font-display`) |

Body / UI chrome and numeric stats stay on **Inter** (`--font-sans` / `.font-stat`).

## Closed: Wesayso personal-use blocker

The previous personal-use **Wesayso** (Billy Argel / FontSpace) display font and its commercial-license launch blocker are **closed**. Wesayso binaries and `docs/WESAYSO_LICENSE.md` have been removed in favor of Orbitron.
