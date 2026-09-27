# Wesayso font — commercial license checklist

The Bonding Curve Casino UI uses **Wesayso** (Billy Argel) as the display / branding typeface.

## Current status

| Item | Status |
|------|--------|
| Source | [FontSpace — Wesayso](https://www.fontspace.com/) (Billy Argel) — **personal use** download |
| Commercial license | **Not purchased** — **blocker before public / commercial launch** |
| Files in repo | See below |

> **Do not treat personal-use FontSpace fonts as cleared for production marketing, paid products, or public commercial sites.** Buy a commercial license first.

## Files under `public/fonts/`

| File | Format |
|------|--------|
| `public/fonts/Wesayso-Bold.woff2` | Webfont (preferred) |
| `public/fonts/Wesayso-Bold.otf` | Desktop / fallback |

Referenced from `src/index.css` (`@font-face "Wesayso"` → `--font-display`).

## Designer / purchase links

- Designer: **Billy Argel**
- Font listing (FontSpace search): https://www.fontspace.com/search?q=wesayso
- Prefer the designer’s official shop or FontSpace commercial license option when available; keep the receipt.

## Pre-launch checklist

- [ ] **Purchase** a commercial / webfont license covering website use for Bonding Curve Casino
- [ ] **Keep the receipt** (PDF + order ID) in company records (not necessarily in git)
- [ ] **Confirm webfont embedding is allowed** under the purchased license (WOFF2 in `public/fonts/`)
- [ ] **Update this doc** with:
  - [ ] License purchase date: `_YYYY-MM-DD_`
  - [ ] License owner / entity: `_legal name_`
  - [ ] License type (e.g. commercial webfont, seats): `_type_`
  - [ ] Vendor / order reference: `_order id_`
- [ ] If license forbids redistributing the OTF in a public repo, move binary fonts to a private asset store and document the fetch step

## Until licensed

Ship previews / internal demos only, or swap `--font-display` to a libre alternative (e.g. Inter / system UI) for any public commercial surface.
