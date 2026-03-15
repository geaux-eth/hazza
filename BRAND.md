# hazza Brand Kit

Reference guide for creating on-brand hazza assets — images, pages, embeds, and integrations.

## Name & Voice

| Use | Example |
|-----|---------|
| Brand name | **hazza** (always lowercase) |
| Domain | **hazza.name** |
| Tagline | **immediately useful names** |
| Attribution | **powered by x402 and Net Protocol** |

### Naming Rules

- "hazza" or "hazza.name" — never "HAZZA", "Hazza", or "HAZZA Names"
- Never combine "hazza.name" + "immediately useful **names**" (double "name")
- **OK:** "hazza — immediately useful names"
- **OK:** "hazza.name — immediately useful"
- **NOT OK:** "hazza.name — immediately useful names"
- "built on Base" and "powered by x402 and Net Protocol" always on **separate lines**, never combined
- Always include "powered by x402 and Net Protocol" in footers/about sections

## Colorway — Moonlit B

Derived from Nomi (Nibble #4240): bandana red for the icon, hat blue for accents, cream from the Nibbles palette.

### Colors

| Name | Hex | Usage |
|------|-----|-------|
| Moon cream | `#F7EBBD` | Primary background, cards, inputs |
| Moon cream light | `#FFF8E1` | Gradient start (subtle warmth) |
| Bandana red | `#CF3748` | Primary accent — icon, buttons, CTA pills, active states |
| Bandana red hover | `#B82E3E` | Button hover state |
| Hat blue | `#4870D4` | Secondary accent — `.name` suffix, links, decorative lines |
| Hat blue light | `#5981E7` | "powered by" text, link hover |
| Deep navy | `#131325` | Primary text — headings, body, wordmark |
| Warm muted | `#8a7d5a` | Secondary text — "built on Base", meta info, footer |
| Card white | `#fff` / `#FFFDF5` | Card/panel backgrounds on cream |
| Shirt gold | `#F2CE62` | Nomi's shirt color — reference only, not a UI color |
| Cream border | `#E8DCAB` | Borders — cards, inputs, dividers |
| Error red | `#D32F2F` | Error states, validation failures |

### Color Roles

- **Buttons:** `background: #CF3748; color: #fff` (white text on red)
- **Hover:** `#B82E3E` (slightly darker red)
- **Links:** `color: #4870D4` (hat blue)
- **Active/selected states:** red border or red text
- **`.name` suffix:** hat blue `#4870D4` everywhere
- **Decorative top/bottom bars:** hat blue `#4870D4`, 6px
- **Currency badges:** blue `#4870D4` for USDC, `#131325` for ETH

### Background

All pages use cream `#F7EBBD` (or gradient `#FFF8E1` → `#F7EBBD` for images). This is a **light theme** — text is dark, backgrounds are warm.

## Typography

**Font family:** [Fredoka](https://fonts.google.com/specimen/Fredoka) (Google Fonts)

| Weight | Name | Usage |
|--------|------|-------|
| 700 | Bold | Logo wordmark, page headings, name display, prices, buttons |
| 600 | SemiBold | Tagline, subheadings, nav links, labels |
| 400 | Regular | Body text, descriptions |

### CSS Import

```css
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap');
font-family: 'Fredoka', -apple-system, BlinkMacSystemFont, sans-serif;
```

## Logo

### Icon (the "h" mark)

A white **h** in Fredoka Bold inside a **red filled** rounded rectangle. No border — the red fill IS the icon.

```
┌──────────┐
│          │  fill: #CF3748 (bandana red)
│    h     │  text: #ffffff (Fredoka 700)
│          │  border-radius: 10-14px (scales with size)
└──────────┘  no border/stroke
```

**Sizes:**
- Nav: 30x30px, 10px radius, 1rem font
- OG image: 64x64px, 12px radius, 36px font
- Share image: 104x104px, 18px radius, 58px font

### Wordmark

```
hazza.name
```
- "hazza" in deep navy (`#131325`), Fredoka Bold (700)
- ".name" in hat blue (`#4870D4`), Fredoka Bold (700)
- Always on cream background

### SVG Icon Template

```svg
<rect x="0" y="0" width="64" height="64" rx="12" fill="#CF3748"/>
<text x="32" y="32" font-family="'Fredoka', sans-serif" font-size="36"
      fill="#ffffff" font-weight="700" text-anchor="middle" dominant-baseline="central">h</text>
```

## Nomi — The Mascot

Nomi is hazza's mascot and most active user. He is **not** the brand — he complements it. hazza is the product; Nomi gives it personality.

### Origin

- **NFT:** Nibble #4240 from The Nibbles by Lonely Lily Studios (Franky The Frog ecosystem)
- **Character:** Gnome with pale skin, blue moons hat, gnome glasses, grey mustache/beard, yellow bandana
- **Background:** Originally peach `#FFC088` — removed for transparent PNG
- **Contract:** `0x5e52d41f0e40d7cdb204db0d9659846f7404547` (Ethereum mainnet)

### Visual Identity

- **Transparent PNG:** `colorways/nomi-transparent.png` (1048x1054) — background removed via chroma-key
- **Base64:** `colorways/nomi-transparent-b64.txt` — for embedding in SVGs
- **Direction:** Nomi faces **right** — always place him on the **left** so he faces INTO adjacent text
- **Grey details:** Beard and eyebrows are warm grey — protected during background removal (saturation < 20% = always opaque)

### Nomi's PFP

- Cream background `#F7EBBD` with extra bleed for circle crop
- Small red "h" badge in bottom-right corner
- 500x500 viewBox, Nomi centered at 400x400

### Brand PFP (for @hazzaname)

- Red circle with white "h" on cream background — the "h" mark only, no Nomi
- Cream bleed ensures clean circle crop on Twitter

### Nomi in Compositions

- **Ads/banners:** Nomi on the left, text on the right (he faces right, into the copy)
- **Square formats:** Nomi centered, text above and below
- **Copy pattern:** Brand line + Nomi's take (or vice versa). Example: "immediately useful names." + "pay once. yours forever."
- **Never:** Nomi with his back to the text. Never Nomi alone without hazza branding.

### What Nomi Is NOT

- Not the brand itself — hazza exists independently
- Not a logo — the "h" mark is the logo
- Not required on every asset — some assets are brand-only (the "h" mark)
- Not a mascot who speaks FOR the brand — he speaks ABOUT it, as its biggest fan

## Image Endpoints

Live image endpoints for use in embeds, social, and integrations:

| Endpoint | Size | Format | Use |
|----------|------|--------|-----|
| `/api/share` | 1200x1200 | PNG | Farcaster Mini App embed, social share (square) |
| `/api/icon` | 1200x1200 | PNG | App icon, PFP, splash screen |
| `/api/og/:name` | 1200x630 | PNG | Per-name OG/Twitter card (landscape) |

### OG Image Layout (1200x630)

Split layout: Nomi on the left (faces right), brand text on the right.

```
┌──────────────────────────────────────────────────┐
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ hat blue top bar ▬▬▬▬▬▬ │
│                                                   │
│  [Nomi]        ┌──┐                               │
│  faces →       │h │  red icon                     │
│  into text     └──┘                               │
│                                                   │
│              hazza.name                           │  Fredoka Bold
│              immediately useful names              │  SemiBold, 0.70 opacity
│                                                   │
│              built on Base                        │  warm muted
│              powered by x402 and Net Protocol     │  hat blue light
│                                                   │
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ hat blue bottom bar ▬▬▬ │
└──────────────────────────────────────────────────┘  bg: #F7EBBD
```

## Page Layout

All pages follow the same shell:

```
nav:    [h] hazza.name    register  marketplace  dashboard
body:   centered content, max-width 720px
footer: Powered by x402 and Net Protocol on Base
```

- Nav logo: red icon + "hazza" navy + ".name" blue
- Nav links: warm muted (`#8a7d5a`), 0.85rem, semibold
- Container: `max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem`
- Background: cream `#F7EBBD`

## UI Components

### Buttons

```css
/* Primary (red) */
background: #CF3748; color: #fff;
border: none; border-radius: 8px;
font-weight: 700; font-family: 'Fredoka', sans-serif;

/* Secondary (outline) */
background: transparent; color: #CF3748;
border: 1px solid #CF3748; border-radius: 8px;
```

### Cards

```css
background: #fff;
border: 1px solid #E8DCAB;
border-radius: 10px;
padding: 1.25rem;
/* hover: border-color: #CF3748 */
```

### Inputs

```css
background: #fff;
border: 1px solid #E8DCAB;
border-radius: 8px;
color: #131325;
font-family: 'Fredoka', sans-serif;
/* focus: border-color: #4870D4; outline: none */
```

## Social Assets

All social assets are generated from `hazza-agent/colorways/build-social.js` and output to `social-assets.html`.

### Available Assets

| Asset | Size | Description |
|-------|------|-------------|
| Centered banner | 1500x500 | Brand only — icon, wordmark, tagline |
| Split banner | 1500x500 | Nomi left, brand right |
| Landscape ad | 1200x675 | "immediately useful names" with Nomi |
| Square ad | 1080x1080 | "first name free" with Nomi |
| Announcement card | 1200x675 | "gm. i'm nomi." intro |
| Intro post | 1080x1080 | "gm. i'm nomi." square |
| Nomi PFP | 500x500 | For Nomi's own profiles |
| Brand PFP | 500x500 | Red "h" mark for @hazzaname |
| OG image | 1200x630 | Split layout for link previews |

## Farcaster Mini App

- **Manifest:** `hazza.name/.well-known/farcaster.json`
- **Name:** "hazza"
- **Subtitle:** "immediately useful"
- **Description:** "register and trade onchain names on Base, powered by x402 and Net Protocol"
- **Splash background:** `#F7EBBD`
- **Icon:** `/api/icon` (1200x1200 red h on cream)
- **Embed image:** `/api/share` (1200x1200 square with wordmark)
- **Category:** utility

## Quick Reference for Agents

When generating hazza-branded content:

1. **Background:** always cream `#F7EBBD` (or gradient `#FFF8E1`→`#F7EBBD` for images)
2. **Primary accent:** `#CF3748` (bandana red) for buttons, icons, CTAs
3. **Secondary accent:** `#4870D4` (hat blue) for links, `.name` suffix, decorative bars
4. **Text:** navy `#131325` for headings, `#131325` for body, `#8a7d5a` for meta
5. **Font:** Fredoka — Bold (700) for headings, SemiBold (600) for labels, Regular (400) for body
6. **Logo:** white "h" in red filled rounded rect (no border)
7. **Wordmark:** "hazza" navy + ".name" blue, Fredoka Bold
8. **Nomi:** Place on LEFT (faces right), transparent PNG, never alone without hazza branding
9. **Never:** uppercase HAZZA, "HAZZA Names", "hazza.name immediately useful names"
10. **Always:** "powered by x402 and Net Protocol" somewhere, on its own line
