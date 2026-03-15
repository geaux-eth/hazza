# hazza — Onchain Name Registry

Onchain name registry on Base. Register `yourname.hazza.name` with USDC, get an ERC-721 NFT, ENS-compatible resolution via CCIP-Read, and an optional ERC-8004 AI agent identity. **Pay once, available forever.**

**Live:** [hazza.name](https://hazza.name)

## Architecture

- **Contract:** Solidity (Foundry), deployed on Base Sepolia
- **Worker:** Cloudflare Worker (TypeScript/Hono), serves the site + API + x402 payment protocol
- **Resolution:** CCIP-Read (ERC-3668) gateway for ENS-compatible `.hazza.name` resolution

## Contract (Base Sepolia)

**Registry:** `0xDd6672dc20820C59e026EC6751e508b3d9f13479`
**MockUSDC:** `0x06A096A051906dEDd05Ef22dCF61ca1199bb038c`

### Key Functions

| Function | Description |
|----------|-------------|
| `registerDirect(...)` | Relayer-only registration (9 params) |
| `registerDirectWithMember(...)` | Registration with Net Library member ID for free claim (10 params) |
| `quoteName(...)` | Get registration price |
| `quoteNameWithMember(...)` | Get price with free claim check |
| `hasClaimedFreeName(uint256)` | Check if member already claimed free name |
| `resolve(string)` | Resolve name to owner, token ID, expiry, agent |
| `reverseResolve(address)` | Wallet to primary name |

### Pricing

**All names: $5 flat.** Pay once, available forever — no renewals, no expiration.

**First name free** — everyone's first registration costs nothing (just pay gas).

Progressive anti-squat pricing applies to bulk registrations within a 90-day window:

| Names in window | Multiplier | Price |
|-----------------|------------|-------|
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
**Unlimited Pass (Base Sepolia):** `0xC6440c27c3c18A931241A65d237a155889a7B1c7`

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
| `/x402/register` | POST | Register a name via x402 payment protocol |
| `/api/ens-names/:address` | GET | ENS name suggestions for wallet |

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

### Deploy Contract (Base Sepolia)

```bash
# On droplet with Foundry installed
cd /root/hazza-contracts
MOCK_USDC=0x06A096A051906dEDd05Ef22dCF61ca1199bb038c \
HAZZA_TREASURY=0x27eBa4D7B8aBae95eFB0A0E0308F4F1c0d3e5B0a \
RELAYER_WALLET=0xa6eB678F607bB811a25E2071A7AAe6F53E674e7d \
forge script script/DeployMock.s.sol --rpc-url https://sepolia.base.org --private-key $PK --broadcast
```

### Deploy BatchExecutor (Optional — enables batch marketplace buys)

```bash
cd /root/hazza-contracts
forge script script/DeployBatchExecutor.s.sol --rpc-url https://sepolia.base.org --private-key $PK --broadcast
# Then set BATCH_EXECUTOR_ADDRESS in wrangler.toml to the deployed address
```

### Approve Relayer for USDC

After deploying, each relayer must approve the registry to spend USDC:

```bash
cast send 0x06A096A051906dEDd05Ef22dCF61ca1199bb038c \
  "approve(address,uint256)" \
  0xDd6672dc20820C59e026EC6751e508b3d9f13479 \
  115792089237316195423570985008687907853269984665640564039457584007913129639935 \
  --rpc-url https://sepolia.base.org --private-key $RELAYER_PK
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
| Treasury | `0x27eBa4D7B8aBae95eFB0A0E0308F4F1c0d3e5B0a` |
| Relayer | `0xa6eB678F607bB811a25E2071A7AAe6F53E674e7d` |
