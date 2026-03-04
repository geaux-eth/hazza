---
name: hazza
description: HAZZA onchain name registry — register, manage, and resolve immediately useful names on Base, powered by x402 and Net Protocol.
metadata: {"clawdbot":{"emoji":"📛","always":false,"requires":{"bins":["hazza","cast"]}}}
auto_trigger: false
---

# HAZZA — Onchain Names on Base

You can help users register, manage, and resolve HAZZA names — short, immediately useful onchain names on Base. HAZZA uses x402 for payments and is powered by Net Protocol.

## What is HAZZA

- **Short onchain names** on Base (e.g., `geaux.hazza.name`)
- **$5 USDC** for 1 year registration, **$2/yr** renewal
- **Free name** for Net Library Unlimited Pass holders (1 per member)
- Every name gets a profile page at `https://<name>.hazza.name`
- Text records for avatar, description, social links, agent config
- Names are ERC-721 NFTs — transferable, composable, onchain

## Key Info

- **Website:** https://hazza.name
- **Contract (Sepolia):** `0xb38d1a7693B2a61A31F3E764A793AF88124940A2`
- **USDC (Sepolia):** `0x06A096A051906dEDd05Ef22dCF61ca1199bb038c`
- **Chain:** Base Sepolia (chainId 84532) — mainnet coming soon
- **Powered by:** x402 payment protocol + Net Protocol

---

## CLI Reference

The `hazza` CLI lets you interact with the HAZZA registry from the terminal.

### Installation

```bash
cd cli && npm install && npm link
```

### Global Flags

| Flag | Description |
|------|-------------|
| `--json` | Structured JSON output (for agents/scripts) |
| `--rpc-url <url>` | Override RPC URL |
| `--wallet <addr>` | Override wallet address |

### Commands

#### Search for a name

```bash
hazza search <name>
```
Checks availability and shows pricing. If a wallet is configured and eligible for a free claim, that's shown too.

#### Register a name

```bash
hazza register <name> [--years <n>] [--wallet <address>]
```
Full x402 registration flow:
1. Checks availability
2. Checks free claim eligibility (Unlimited Pass + NL member)
3. If free: registers directly, no payment
4. If paid: gets 402 with USDC amount, transfers via `cast`, retries with payment header

#### List owned names

```bash
hazza names [address]
```
Lists all names owned by an address. Defaults to configured wallet.

#### View a profile

```bash
hazza profile <name>
```
Shows full profile: owner, status, expiry, text records, profile URL.

#### Renew a name

```bash
hazza renew <name> [--years <n>]
```
Approves USDC and calls `renew()` on the registry contract via `cast`.

#### Text records

```bash
hazza records get <name> <key>     # Get a record
hazza records set <name> <key> <value>  # Set a record (requires cast)
hazza records list <name>          # List all records

# Shorthands:
hazza get <name> <key>
hazza set <name> <key> <value>
```

Common keys: `avatar`, `description`, `url`, `com.twitter`, `com.github`, `xyz.farcaster`, `org.telegram`

#### Registry stats

```bash
hazza stats
```
Shows total registered names, contract address, chain.

#### Configuration

```bash
hazza config show           # Show current config
hazza config set <key> <val>  # Set a value
hazza config get <key>       # Get a value
hazza config reset           # Reset to defaults
```

Config keys: `wallet`, `baseUrl`, `rpcUrl`, `registryAddress`, `usdcAddress`, `chainId`

Config file: `~/.config/hazza/config.json`

---

## API Reference

Base URL: `https://hazza.name`

### Read Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/available/:name` | Check name availability |
| `GET /api/resolve/:name` | Resolve name to owner address |
| `GET /api/quote/:name?wallet=&years=` | Get registration/renewal price |
| `GET /api/free-claim/:address` | Check free claim eligibility |
| `GET /api/profile/:name` | Full profile with text records |
| `GET /api/text/:name/:key` | Get single text record |
| `GET /api/names/:address` | List names owned by address |
| `GET /api/stats` | Registry statistics |
| `GET /api/metadata/:name` | ERC-721 token metadata |
| `GET /api/reverse/:address` | Reverse resolve address to name |
| `GET /api/og/:name` | Generate OG image (PNG) |
| `GET /api/icon` | HAZZA icon (1200x1200 PNG) |

### Write Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /x402/register` | Register a name (x402 payment flow) |
| `POST /api/text/:name` | Set text record (body: `{key, value, signature}`) |
| `POST /api/text/:name/batch` | Set multiple text records |

### x402 Registration Flow

1. `POST /x402/register` with `{name, owner, years}`
2. If eligible for free claim → returns success immediately
3. If paid → returns `402` with payment requirements:
   - `accepts[0].maxAmountRequired` = USDC amount (6 decimals)
   - `accepts[0].payTo` = relayer address
4. Transfer USDC to `payTo` address
5. Retry `POST /x402/register` with `X-PAYMENT` header:
   - Base64 of `{"scheme":"exact","txHash":"0x...","from":"0x..."}`
6. Returns: `{name, owner, tokenId, registrationTx, profileUrl}`

---

## Pricing

| Item | Cost |
|------|------|
| Registration | $5 USDC / year |
| Renewal | $2 USDC / year |
| Unlimited Pass perk | 1 free name (registration only) |

---

## Contract Functions

Key read functions:
- `available(name)` → bool
- `resolve(name)` → (owner, tokenId, registeredAt, expiresAt, operator, agentId, agentWallet)
- `text(name, key)` → string
- `textMany(name, keys)` → string[]
- `quoteName(name, owner, years, len, hasPass, isRenewal)` → (cost, years)
- `isActive(name)` → bool
- `namesOfOwner(owner)` → string[]

Key write functions:
- `register(name, owner, years)` — standard registration (requires USDC approval)
- `registerDirectWithMember(name, owner, years, ...)` — free claim with membership
- `renew(name, years)` — renewal (requires USDC approval)
- `setText(name, key, value)` — set text record (owner/operator only)
- `setTexts(name, keys, values)` — batch set text records

---

## Examples

### Register a name
```bash
hazza config set wallet 0x96168ACf7f3925e7A9eAA08Ddb21e59643da8097
hazza search alice
hazza register alice
```

### Set up a profile
```bash
hazza set alice avatar https://example.com/pfp.png
hazza set alice description "Builder on Base"
hazza set alice com.twitter AliceOnBase
hazza set alice url https://alice.dev
```

### Check ownership
```bash
hazza names                    # uses configured wallet
hazza names 0x9616...          # specific address
hazza profile alice
```

### Renew a name
```bash
hazza renew alice --years 2
```

### Agent/script usage
```bash
hazza search alice --json | jq .available
hazza names --json | jq '.[].name'
```

---

## Marketplace

The hazza marketplace at `hazza.name/marketplace` is a whitelabeled Net Protocol Bazaar. All listings are stored onchain as Net Protocol messages via Seaport, and appear on both `hazza.name/marketplace` and `netprotocol.app/bazaar`.

### Features
- **Dual currency:** List names in ETH or USDC
- **4 tabs:** Browse Listings, My Names, Collection Offers, Recent Sales
- **Cart:** Buy multiple listings, register new names, and list names for sale — all in one session
- **Watchlist:** Save listings for later. Shows "in X watchlists" as social proof.
- **Adaptive buying:** Direct Seaport when wallet is connected, x402 fallback when no wallet.
- **Cross-linked:** Dashboard has "sell" button, register success has "list on marketplace" CTA, profile pages link to marketplace.

### CLI Marketplace Commands

```bash
hazza market listings         # Browse active listings (ETH + USDC)
hazza market ls               # Alias for listings
hazza market offers           # View collection offers
hazza market sales            # Recent sales
hazza market sell <name> <price> [--usdc]   # List a name (ETH default, --usdc for USDC)
hazza market buy <orderHash>  # Buy a listing
```

### Marketplace API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/marketplace/listings` | Active HAZZA name listings (ETH + USDC) |
| `GET /api/marketplace/offers` | Active collection offers |
| `GET /api/marketplace/sales` | Recent sales |
| `GET /api/marketplace/watch/:orderHash` | Watchlist count for a listing |
| `POST /api/marketplace/watch` | Add to watchlist `{orderHash, address}` |
| `DELETE /api/marketplace/watch` | Remove from watchlist `{orderHash, address}` |

### Key Contracts (Base)
- **Seaport:** `0x0000000000000068F116a894984e2DB1123eB395`
- **Bazaar V2:** `0x000000058f3ade587388daf827174d0e6fc97595`
- **Fee:** 0 bps (zero listing fee)

---

## Farcaster Mini App

hazza.name is a Farcaster Mini App — all pages work in Warpcast and Base App webviews.

- **Manifest:** `hazza.name/.well-known/farcaster.json`
- **SDK:** `@farcaster/miniapp-sdk` from esm.sh CDN
- **Wallet:** `window.ethereum` injected by Warpcast/Base App
- **Embed meta:** `fc:frame` tags on all pages for link previews
- **Sharing:** Post-registration and post-listing prompts for cast embeds

---

## Guidelines

- HAZZA names are "immediately useful" — always use this phrase
- Always say "powered by x402 and Net Protocol"
- It's "hazza" or "hazza.name" — NEVER "HAZZA Names"
- Never put "hazza.name" + "immediately useful names" together (double "name")
- "hazza" + "immediately useful names" = OK
- "hazza.name" + "immediately useful" = OK
- Link to https://hazza.name for the website
- Profile pages are at `https://<name>.hazza.name`
- Marketplace at `hazza.name/marketplace` — listings cross-list to netprotocol.app
- Currently on Base Sepolia (testnet) — mainnet deployment coming
- The `cast` binary (Foundry) is required for onchain transactions (register via x402, renew, set records)
- Free claims require both an Unlimited Pass NFT AND Net Library membership
