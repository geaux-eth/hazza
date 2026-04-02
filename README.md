# hazza — Onchain Name Registry

Onchain name registry on Base. Register `yourname.hazza.name` with USDC, get an ERC-721 NFT, ENS-compatible resolution via CCIP-Read, and an optional ERC-8004 AI agent identity. **Pay once, available forever.**

**Live:** [hazza.name](https://hazza.name)

## Architecture

- **Contract:** Solidity (Foundry), deployed on Base mainnet
- **Worker:** Cloudflare Worker (TypeScript/Hono), serves the site + API + x402 payment protocol
- **Resolution:** CCIP-Read (ERC-3668) gateway for ENS-compatible `.hazza.name` resolution

## Contract (Base Mainnet)

**Registry:** `0xD4E420201fE02F44AaF6d28D4c8d3A56fEaE0D3E`
**USDC:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

### Key Functions

| Function | Description |
|----------|-------------|
| `registerDirect(...)` | Relayer-only registration (8 params) |
| `registerDirectWithMember(...)` | Registration with Net Library member ID for free claim (9 params) |
| `quoteName(...)` | Get registration price |
| `quoteNameWithMember(...)` | Get price with free claim check |
| `hasClaimedFreeName(uint256)` | Check if member already claimed free name |
| `resolve(string)` | Resolve name to owner, token ID, agent |
| `reverseResolve(address)` | Wallet to primary name |
| `contractURI()` | Collection-level metadata for marketplaces |

### Pricing

**All names: $5 flat.** Pay once, available forever — no renewals, no expiration.

**First name free** — everyone's first registration costs nothing (just pay gas).

**Free names do NOT count toward progressive pricing tiers.**

Progressive anti-squat pricing applies to paid registrations within a 90-day window:

| Paid names in window | Multiplier | Price |
|----------------------|------------|-------|
| 1–3 | 1x | $5 |
| 4–5 | 2.5x | $12.50 |
| 6–7 | 5x | $25 |
| 8+ | 10x | $50 |

Unlimited Pass holders get 20% off all paid registrations.

## Unlimited Pass

[Net Library](https://netlibrary.app) members with an **Unlimited Pass** ($10 NFT on Base) get:

- **1 free hazza name** (bonus, in addition to everyone's first-free)
- **20% discount** on all additional registrations
- No daily or total registration limits (same as everyone — progressive pricing is the only brake)

### Anti-Abuse

Free names are tracked by **Net Library member ID** (not wallet address). Each member number can claim exactly 1 free name, ever. Transferring the Unlimited Pass NFT to another wallet doesn't help — the new wallet needs its own Net Library membership with a different member ID.

**Unlimited Pass (Base):** `0xCe559A2A6b64504bE00aa7aA85C5C31EA93a16BB`

## API

All endpoints at `hazza.name`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/available/:name` | GET | Check name availability |
| `/api/resolve/:name` | GET | Resolve name to owner + records |
| `/api/profile/:name` | GET | Full profile with text records |
| `/api/quote/:name` | GET | Get registration price. Optional: `?memberId=N` for free claim check |
| `/api/reverse/:address` | GET | Wallet to primary name |
| `/api/names/:address` | GET | All names owned by wallet |
| `/api/free-claim/:address` | GET | Check free claim eligibility (NL membership + Unlimited Pass + unclaimed) |
| `/api/collection-metadata` | GET | Collection-level metadata (contractURI) |
| `/x402/register` | POST | Register a name via x402 payment protocol |
| `/x402/text/:name` | POST | Set text record via x402 ($0.02 USDC, no API key) |
| `/x402/text/:name/batch` | POST | Batch set text records via x402 ($0.02 USDC, no API key) |
| `/api/ens-names/:address` | GET | ENS name suggestions for wallet |
| `/api/marketplace/listings` | GET | Active marketplace listings |
| `/api/marketplace/offers` | GET | Collection offers |
| `/api/marketplace/offers/:name` | GET | Offers on a specific name |
| `/api/marketplace/sales` | GET | Recent sales history |
| `/api/marketplace/fulfill` | POST | Get buy tx data (`{orderHash, buyerAddress}` → `{approvals, fulfillment}`) |
| `/api/marketplace/fulfill-offer` | POST | Get offer acceptance tx data |
| `/api/marketplace/offer` | POST | Submit an offer on a name |

### Free Claim Flow

1. Connect wallet on register page
2. Worker checks `/api/free-claim/{address}` → queries Net Library API for membership + Unlimited Pass
3. If eligible: quote shows FREE, checkout skips USDC transfer
4. Worker calls `registerDirectWithMember(... memberId)` — no payment collected
5. Contract marks `memberFreeClaimed[memberId] = true` to prevent reuse

### x402 Payment Flow (Paid Registration)

1. `POST /x402/register` with `{ name, owner }` — returns 402 with USDC amount
2. User transfers USDC to relayer address
3. `POST /x402/register` with `X-PAYMENT` header containing tx proof
4. Worker verifies payment on-chain, calls `registerDirect` via relayer

## Development

### Contract

```bash
cd contracts
forge build
forge test
```

### Worker

```bash
cd worker
npm install
npx wrangler dev     # local dev
npx wrangler deploy  # deploy to Cloudflare
```

### Deploy Contract (Base Mainnet)

```bash
cd contracts
HAZZA_TREASURY=0x62B7399B2ac7e938Efad06EF8746fDBA3B351900 \
UNLIMITED_PASS=0xCe559A2A6b64504bE00aa7aA85C5C31EA93a16BB \
RELAYER_WALLET=0xa6eB678F607bB811a25E2071A7AAe6F53E674e7d \
forge script script/Deploy.s.sol:DeployHazza --rpc-url https://mainnet.base.org --private-key $PK --broadcast
```

### Approve Relayer for USDC

After deploying, each relayer must approve the registry to spend USDC:

```bash
cast send 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "approve(address,uint256)" \
  0xD4E420201fE02F44AaF6d28D4c8d3A56fEaE0D3E \
  115792089237316195423570985008687907853269984665640564039457584007913129639935 \
  --rpc-url https://mainnet.base.org --private-key $RELAYER_PK
```

## Pages

| Path | Page |
|------|------|
| `/` | Landing page with name search |
| `/register` | Registration flow (wallet connect + x402 checkout) |
| `/manage` | Name management (text records, agent, operator, custom domain) |
| `/dashboard` | Dashboard showing all owned names |
| `/pricing` | Pricing details |
| `/pricing/protections` | Anti-squatting and name rights |
| `/pricing/details` | Full pricing breakdown |
| `/about` | About hazza |
| `/docs` | API documentation |
| `*.hazza.name` | Profile pages (wildcard subdomains) |

## Key Wallets

| Role | Address |
|------|---------|
| Owner (GEAUX) | `0x96168ACf7f3925e7A9eAA08Ddb21e59643da8097` |
| Treasury | `0x62B7399B2ac7e938Efad06EF8746fDBA3B351900` |
| Relayer | `0xa6eB678F607bB811a25E2071A7AAe6F53E674e7d` |

Powered by x402, XMTP and Net Protocol. Built on Base.
