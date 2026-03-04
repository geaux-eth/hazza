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
- Always include "powered by x402 and Net Protocol" in footers/about sections

## Colors

| Name | Hex | Usage |
|------|-----|-------|
| Green | `#00e676` | Primary accent — buttons, badges, links, .name suffix, borders |
| Black | `#0a0a0a` | Background — all pages, cards, inputs |
| White | `#ffffff` | Primary text, headings, "hazza" in wordmark |
| Muted green | `#6b8f6b` | Secondary text — meta info, nav links, descriptions |
| Dark green | `#1a2e1a` | Borders — cards, inputs, dividers |
| Card bg | `#111111` | Card/panel backgrounds |
| Deep bg | `#050a05` to `#0a1a0a` | Gradient for OG images |

### Color Roles

- **Buttons:** `background: #00e676; color: #000` (black text on green)
- **Hover:** `#00c853` (slightly darker green)
- **Links:** `color: #00e676`
- **Active/selected states:** green border or green text
- **Currency badges:** green `#00e676` for USDC, blue `#3b82f6` for ETH

## Typography

**Font family:** [Rubik](https://fonts.google.com/specimen/Rubik) (Google Fonts)

| Weight | Name | Usage |
|--------|------|-------|
| 900 | Black | Logo wordmark, page headings, name display, prices |
| 700 | Bold | Subheadings, buttons, labels, tagline |
| 500 | Medium | Nav links, secondary UI |
| 400 | Regular | Body text, descriptions |

### CSS Import

```css
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;900&display=swap');
font-family: 'Rubik', -apple-system, BlinkMacSystemFont, sans-serif;
```

## Logo

### Icon (the "h" mark)

A white **h** in Rubik Black inside a rounded rectangle with a green border on black background.

```
┌──────────┐
│          │  border: #00e676, 2-3px
│    h     │  fill: #ffffff (Rubik 900)
│          │  background: #0a0a0a
└──────────┘  border-radius: 6-14px (scales with size)
```

**Sizes:**
- Nav: 30x30px, 2px border, 6px radius, 1rem font
- OG image: 44x44px, 3px border, 8px radius, 24px font
- App icon: 600x600px (centered in 1200x1200), 12px border, 64px radius, 360px font
- Share image: 88x88px, 5px border, 14px radius, 48px font

### Wordmark

```
hazza.name
```
- "hazza" in white (`#ffffff`), Rubik Black (900)
- ".name" in green (`#00e676`), Rubik Black (900)
- Always on dark background

### SVG Icon Template

```svg
<rect x="0" y="0" width="88" height="88" rx="14" fill="#0a0a0a" stroke="#00e676" stroke-width="5"/>
<text x="44" y="44" font-family="Rubik, sans-serif" font-size="48"
      fill="#ffffff" font-weight="900" text-anchor="middle" dominant-baseline="central">h</text>
```

## Image Endpoints

Live image endpoints for use in embeds, social, and integrations:

| Endpoint | Size | Format | Use |
|----------|------|--------|-----|
| `/api/share` | 1200x1200 | PNG | Farcaster Mini App embed, social share (square) |
| `/api/icon` | 1200x1200 | PNG | App icon, PFP, splash screen |
| `/api/og/:name` | 1200x630 | PNG | Per-name OG/Twitter card (landscape) |

### Share Image Layout (1200x1200)

```
┌────────────────────────────────┐
│                                │
│                                │
│            ┌────┐              │
│            │ h  │  icon        │
│            └────┘              │
│                                │
│       hazza.name               │  96px Rubik Black
│                                │  (hazza white, .name green)
│     immediately useful         │  42px Rubik Bold, white
│                                │
│                                │
└────────────────────────────────┘  bg: #0a0a0a
```

### OG Image Layout (1200x630)

```
┌────────────────────────────────────────────────────┐
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ green top bar ▬▬▬ │
│ ┌──┐                              hazza.name       │
│ │h │ icon                         (top right)       │
│ └──┘                                                │
│                                                     │
│                    alice                             │  name (Rubik Black)
│                 REGISTERED                           │  status pill
│              owner / ENS name                        │  muted
│              description text                        │
│                                                     │
│           immediately useful names                   │  footer
│        powered by x402 and Net Protocol              │
└─────────────────────────────────────────────────────┘  bg: gradient #050a05→#0a1a0a
```

## Page Layout

All pages follow the same shell:

```
nav:    [h] hazza.name    register  marketplace  dashboard
body:   centered content, max-width 720px
footer: Powered by x402 and Net Protocol on Base
```

- Nav logo: icon + "hazza" white + ".name" green
- Nav links: muted green (`#6b8f6b`), 0.85rem, medium weight
- Container: `max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem`

## UI Components

### Buttons

```css
/* Primary (green) */
background: #00e676; color: #000;
border: none; border-radius: 8px;
font-weight: 700; font-family: 'Rubik', sans-serif;

/* Secondary (outline) */
background: transparent; color: #00e676;
border: 1px solid #00e676; border-radius: 8px;
```

### Cards

```css
background: #111;
border: 1px solid #1a2e1a;
border-radius: 10px;
padding: 1.25rem;
/* hover: border-color: #00e676 */
```

### Inputs

```css
background: #111;
border: 1px solid #1a2e1a;
border-radius: 8px;
color: #fff;
font-family: 'Rubik', sans-serif;
/* focus: border-color: #00e676; outline: none */
```

## Farcaster Mini App

- **Manifest:** `hazza.name/.well-known/farcaster.json`
- **Name:** "hazza"
- **Subtitle:** "immediately useful"
- **Description:** "register and trade onchain names on Base, powered by x402 and Net Protocol"
- **Splash background:** `#0a0a0a`
- **Icon:** `/api/icon` (1200x1200 green-bordered h)
- **Embed image:** `/api/share` (1200x1200 square with wordmark)
- **Category:** utility

## Quick Reference for Agents

When generating hazza-branded content:

1. **Background:** always `#0a0a0a` (or gradient `#050a05`→`#0a1a0a` for images)
2. **Primary color:** `#00e676` for accents, buttons, highlights
3. **Text:** white `#fff` for headings, `#e0e0e0` for body, `#6b8f6b` for meta
4. **Font:** Rubik — Black (900) for headings, Bold (700) for labels, Regular (400) for body
5. **Logo:** white "h" in green-bordered rounded rect on black
6. **Wordmark:** "hazza" white + ".name" green, Rubik Black
7. **Never:** uppercase HAZZA, "HAZZA Names", "hazza.name immediately useful names"
8. **Always:** "powered by x402 and Net Protocol" somewhere
