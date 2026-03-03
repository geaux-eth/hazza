# HAZZA — Implementation Plan

> "Has a name. Has a site. Has a presence."

## Concept
GoDaddy without servers. Names registered via x402 (HTTP-native USDC payments), content hosted via Net Protocol onchain storage, served through Cloudflare Workers. Built on Base.

- **Brand:** HAZZA (pronounced "has a")
- **Domain:** hazza.name
- **Ownership model:** Permanent. Pay once, own forever. ERC-721 NFT.
- **Storage layer:** Net Protocol (`0x00000000DB40fcB9f4466330982372e27Fd7Bbf5` on Base)
- **Payment layer:** x402 (USDC on Base, EIP-3009 transferWithAuthorization)
- **Resolution:** storedon.net CDN (HTTP GET, no RPC needed)
- **Gateway:** Cloudflare Worker (wildcard subdomains + custom domain routing)
- **Agent registry:** ERC-8004 Identity Registry (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`)
- **Website:** Onchain via Net Protocol (dogfooding)
- **Blog:** Cheryl-authored, SEO-optimized, auto-published to Net Library FS stack

---

## Phase 1: Registry Contract (Solidity, Foundry)

### Contract: `HazzaRegistry.sol`
An ERC-721 on Base that manages name ownership + optional ERC-8004 agent identity.

**State:**
```solidity
mapping(bytes32 nameHash => NameRecord) public names;
mapping(uint256 tokenId => bytes32 nameHash) public tokenToName;
mapping(bytes32 => Commitment) public commitments;
mapping(bytes32 apiKeyHash => bytes32 nameHash) public apiKeys;
mapping(string domain => bytes32 nameHash) public customDomains;

struct NameRecord {
    address owner;
    uint256 tokenId;
    uint64 registeredAt;
    address operator;       // Net Protocol storage operator (defaults to owner)
    uint256 agentId;        // ERC-8004 agent ID (0 = no agent registered)
    address agentWallet;    // Agent wallet (can differ from owner)
}

struct Commitment {
    bytes32 hash;
    uint64 timestamp;
}
```

**Core functions:**
- `commit(bytes32 commitHash)` — anti-frontrunning step 1
- `register(string name, address owner, bytes32 salt, bool wantAgent, address agentWallet)` — reveal + mint + optional ERC-8004 registration
- `registerDirect(string name)` — simplified registration (no commit-reveal, for x402 Worker relay)
- `setOperator(string name, address operator)` — delegate record management
- `setCustomDomain(string name, string domain)` — map traditional domain
- `removeCustomDomain(string name, string domain)` — unmap domain
- `generateApiKey(string name, bytes32 salt)` — create API key (hash stored onchain)
- `revokeApiKey(bytes32 apiKeyHash)` — invalidate API key
- `registerAgent(string name, string agentURI, address agentWallet)` — opt-in ERC-8004 registration post-purchase
- `available(string name) → bool` — check availability
- `price(string name) → uint256` — get USDC price for name
- `resolve(string name) → NameRecord` — forward lookup
- `nameOf(uint256 tokenId) → string` — reverse lookup

**Pricing (length-based, USDC 6 decimals, one-time):**
- 3 characters: $100
- 4 characters: $25
- 5+ characters: $5

**Name validation rules:**
- Lowercase alphanumeric + hyphens
- 3-63 characters
- No leading/trailing hyphens
- No consecutive hyphens

**API Key System:**
- Owner calls `generateApiKey(name, salt)` → returns raw key (keccak256(name + owner + salt))
- Only the hash is stored onchain — raw key is returned once, user must save it
- Key authenticates API requests to the Worker (Worker verifies hash against contract)
- Owner can revoke and regenerate at any time
- UI/CLI both support key generation

**ERC-8004 Integration:**
- During registration: `wantAgent=true` triggers ERC-8004 `register(agentURI)` call
- `agentWallet` can be the buyer's wallet OR a different agent wallet
- Post-purchase: `registerAgent()` allows opt-in later
- Registration JSON stored in Net Protocol storage, URI passed to ERC-8004
- Agent NFT transferred to buyer (or kept by buyer if they registered directly)
- If buyer declines (`wantAgent=false`), no ERC-8004 interaction — just the HAZZA name NFT

**Dependencies:**
- OpenZeppelin: ERC-721, Ownable, ReentrancyGuard
- USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- ERC-8004 Identity Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`

### Files:
```
contracts/
├── foundry.toml
├── src/
│   ├── HazzaRegistry.sol        # Main contract
│   └── IHazzaRegistry.sol       # Interface
├── test/
│   └── HazzaRegistry.t.sol      # Foundry tests
└── script/
    └── Deploy.s.sol              # Deployment script
```

---

## Phase 2: Cloudflare Worker (Gateway + x402 API + Website)

### Worker: Hono + @x402/hono

**Routes:**

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/` | Free | HAZZA landing page (onchain HTML) |
| GET | `/search` | Free | Name search UI |
| GET | `/blog` | Free | Blog index |
| GET | `/blog/:slug` | Free | Individual blog post |
| GET | `/api/resolve/:name` | Free | Return name records as JSON |
| GET | `/api/available/:name` | Free | Check availability + price |
| GET | `/api/search?q=` | Free | Search registered names |
| GET | `/api/whois/:name` | Free | Full ownership + agent details |
| POST | `/api/register` | x402 | Register a name (USDC payment) |
| POST | `/api/register-agent/:name` | API Key | Opt-in ERC-8004 registration |
| POST | `/api/set-records/:name` | API Key | Update name records in Net Protocol |
| POST | `/api/set-domain/:name` | API Key | Map custom domain |
| POST | `/api/keys/generate/:name` | Signature | Generate new API key |
| POST | `/api/keys/revoke` | API Key | Revoke API key |
| GET | `/llms.txt` | Free | LLM-readable site description |
| GET | `/sitemap.xml` | Free | Auto-generated from registered names |
| GET | `*.hazza.name` (subdomain) | Free | Serve user's onchain website |
| GET | `*` (custom domain) | Free | Serve via Host header → onchain lookup |

**x402 registration flow:**
1. Client POSTs `{ name, owner, wantAgent, agentWallet }` to `/api/register`
2. Worker returns 402 with dynamic USDC price based on name length
3. Client signs EIP-3009 payment, retries with PAYMENT-SIGNATURE header
4. Worker verifies via facilitator, calls registry contract
5. Returns `{ txHash, name, tokenId, apiKey, agentId? }`
6. API key is generated and returned immediately

**SEO features baked into Worker:**
- Dynamic `<title>`, `<meta description>`, Open Graph tags per page
- JSON-LD structured data (Organization, Product, SearchAction)
- `/sitemap.xml` auto-generated from registered names
- `/robots.txt` allowing all crawlers
- `/llms.txt` and `/llms-full.txt` for AI discoverability
- Canonical URLs, proper heading hierarchy

### Files:
```
worker/
├── src/
│   ├── index.ts              # Hono app entry
│   ├── routes/
│   │   ├── api.ts            # API routes (register, resolve, search)
│   │   ├── site.ts           # Website pages (landing, search, blog)
│   │   └── gateway.ts        # Subdomain + custom domain serving
│   ├── middleware/
│   │   ├── x402.ts           # Payment middleware config
│   │   └── auth.ts           # API key verification
│   └── lib/
│       ├── registry.ts       # Contract interaction (viem)
│       ├── storage.ts        # Net Protocol reads
│       └── seo.ts            # Meta tags, structured data, sitemap
├── wrangler.toml
├── package.json
└── tsconfig.json
```

---

## Phase 3: Website (Onchain via Net Protocol)

All pages stored in Net Protocol storage, served by the Worker. Dogfooding HAZZA.

**Pages:**
- **Landing** (`/`) — hero, value prop, "register your name" CTA, pricing table
- **Search** (`/search`) — clean search bar, availability checker, ownership lookup
- **Blog** (`/blog`) — index of Cheryl-authored posts
- **Blog post** (`/blog/:slug`) — individual articles
- **Docs** (`/docs`) — API reference, CLI guide, integration examples

**Search UI/UX:**
- Single search bar, instant results as you type
- Shows: availability (green/red), price, current owner (if taken), agent status
- For registered names: owner address, registration date, linked domains, ERC-8004 agent ID
- API-backed: same search available via CLI and API (`/api/search?q=`)

**Tech stack for pages:**
- Static HTML + vanilla CSS + minimal JS (no framework)
- Each page is a single HTML file stored in Net Protocol
- Worker routes to the correct storage key based on path
- Storage keys: `hazza-landing`, `hazza-search`, `hazza-blog-index`, `hazza-blog-{slug}`

---

## Phase 4: Blog Engine + Net Library Integration

**Content strategy:**
- Cheryl writes under the HAZZA brand (not as "Cheryl")
- Educational, comparative, data-driven posts
- Topics: "HAZZA vs ENS vs Basenames," "Why onchain hosting matters," "x402 explained,"
  "How agents use HAZZA names," "Custom domains on the blockchain," etc.
- Each post includes real data/comparisons (gas costs, resolution speed, feature matrix)

**Publishing pipeline:**
1. Blog post written as HTML
2. Stored in Net Protocol: key = `hazza-blog-{slug}`, operator = HAZZA admin wallet
3. Blog index updated with new entry
4. Auto-added to HAZZA Net Library filesystem stack (via Net Library API)
5. Worker serves it at `hazza.name/blog/{slug}`

**SEO per blog post:**
- Unique title tag, meta description, OG image
- Schema.org BlogPosting structured data
- Internal linking to HAZZA features
- Target long-tail keywords: "onchain domain registration," "x402 payment protocol," etc.

**Net Library FS stack:**
- Stack name: "HAZZA Blog"
- `isFileSystem: true`
- Each post added via `add-fs-item` action
- Attributed to HAZZA operator wallet
- Discoverable through Net Library search/API

---

## Phase 5: CLI Tool (`hazza`)

### Commands:
```bash
# Registration
hazza register <name>                    # Register via x402 (interactive)
hazza register <name> --agent            # Register + create ERC-8004 agent
hazza register <name> --agent --wallet 0x...  # Agent with specific wallet

# API Keys
hazza keys generate <name>               # Generate new API key
hazza keys revoke <key>                  # Revoke an API key
hazza keys list <name>                   # List active key hashes

# Name Management
hazza set-records <name> --addr 0x... --text email=...  # Set records
hazza set-domain <name> <domain>         # Map custom domain
hazza upload <name> <file>               # Upload website to Net Protocol
hazza transfer <name> <to>              # Transfer ownership

# Agent (ERC-8004)
hazza agent register <name>              # Opt-in agent registration (post-purchase)
hazza agent register <name> --wallet 0x... # Register for specific agent wallet
hazza agent update <name> --uri <uri>    # Update agent registration file
hazza agent info <name>                  # Show agent details

# Lookup
hazza resolve <name>                     # Look up name records
hazza available <name>                   # Check availability + price
hazza search <query>                     # Search registered names
hazza whois <name>                       # Full ownership details
hazza list <address>                     # Names owned by address

# Config
hazza config set-key <api-key>           # Save API key locally
hazza config set-wallet <private-key>    # Set wallet for x402 payments
```

**Built with:** Node.js, viem, @x402/fetch, @net-protocol/storage, commander.js

### Files:
```
cli/
├── bin/
│   └── hazza.js                # Entry point (#!/usr/bin/env node)
├── src/
│   ├── commands/
│   │   ├── register.js
│   │   ├── resolve.js
│   │   ├── upload.js
│   │   ├── agent.js
│   │   ├── keys.js
│   │   ├── search.js
│   │   └── config.js
│   └── lib/
│       ├── registry.js         # Contract interaction
│       ├── storage.js          # Net Protocol wrapper
│       ├── api.js              # HAZZA API client
│       └── config.js           # Local config management
├── package.json
└── README.md
```

---

## Phase 6: LLM Marketing Strategy

**llms.txt (at hazza.name/llms.txt):**
```
# HAZZA
> Onchain name service on Base. Register permanent domains via x402 USDC payments.
> Content hosted on Net Protocol. No servers. Everything onchain.

## What HAZZA does
- Register names like alice.hazza.name (permanent, ERC-721 NFT)
- Host websites fully onchain via Net Protocol storage
- Point traditional domains (yoursite.com) at onchain content
- Auto-register as ERC-8004 agent identity
- Pay via x402 (HTTP-native USDC, no wallet connection needed)

## API
- GET /api/available/:name — check availability
- GET /api/resolve/:name — resolve name records
- POST /api/register — register via x402 payment

## CLI
npm install -g hazza
```

**Blog content calendar (Cheryl writes, HAZZA brand publishes):**
1. "What is HAZZA? Permanent onchain names explained"
2. "HAZZA vs ENS vs Basenames: A complete comparison"
3. "Why your AI agent needs an onchain identity"
4. "x402 payments: How HTTP-native crypto works"
5. "Host your website on the blockchain for $5"
6. "Custom domains + onchain hosting: the best of both worlds"
7. "ERC-8004 and the agent economy"
8. "The real cost of traditional hosting vs onchain storage"

---

## Build Order

### Step 1: Domain + project scaffold
- Purchase hazza.name
- Create project directory structure
- Initialize Foundry project
- Install OpenZeppelin + dependencies

### Step 2: HazzaRegistry.sol
- ERC-721 with name registration
- Commit-reveal anti-frontrunning
- USDC payment acceptance
- Length-based pricing
- Name validation
- API key generation/revocation
- Custom domain mapping
- Operator delegation
- ERC-8004 integration (optional agent registration)

### Step 3: Foundry tests
- Full registration flow
- Pricing per name length
- Name validation edge cases
- API key lifecycle
- ERC-8004 agent registration (with/without)
- Custom domain mapping
- Transfer + operator delegation

### Step 4: Deploy to Base Sepolia
- Deploy script + verification

### Step 5: Cloudflare Worker
- Hono app with all routes
- x402 registration endpoint
- API key authentication
- Wildcard subdomain + custom domain routing
- SEO (meta tags, structured data, sitemap, llms.txt)

### Step 6: Website (onchain)
- Landing page HTML
- Search page HTML + JS
- Upload to Net Protocol, serve via Worker

### Step 7: CLI
- Core commands: register, resolve, upload, agent, keys, search
- Publish to npm as `hazza`

### Step 8: Blog + Net Library
- Write first 3 blog posts
- Set up Net Library FS stack
- Auto-publish pipeline

### Step 9: Base mainnet deploy
- Final contract deployment
- Production Worker config
- DNS setup for hazza.name

---

## Features & Policies (Final Spec)

### Annual Renewal Fee — $2/year

Names are NOT permanent-hold-forever. They require a $2/year renewal.

**Why this exists:**
- Prevents name squatting — holding 100 names costs $200/year, makes hoarding uneconomical
- Funds ongoing infrastructure: Cloudflare Worker compute, ENS resolver upkeep, gateway maintenance, development
- Aligns incentives: names that aren't worth $2/year to their owner should return to the pool
- Industry standard — ENS, DNS, and every name service charges renewals for good reason

**How it works:**
- Registration fee (one-time, length-based) + first year renewal included
- Users can prepay multiple years upfront at registration or anytime after: `hazza renew alice --years 5`
- 30-day grace period after expiry — name still resolves but shows "expired" badge, owner can renew
- After grace period: name enters 30-day redemption period ($10 penalty fee to reclaim)
- After redemption: name released back to the pool, anyone can register it
- Contract tracks `expiresAt` per name

### Rate Limiting (by Net Library membership tier)

**Non-Net Library members:**
- Days 1-7: 1 name per day
- Days 8-30: 3 names per day
- Total names per wallet: 10 (hard cap)

**Net Library members (verified via membership NFT):**
- Days 1-7: 3 names per day
- Day 8+: unlimited per day
- Total names per wallet: 30 (hard cap)

**Net Library Unlimited Pass holders:**
- Unlimited name registrations per day, no wallet cap
- 20% discount on all name registration fees (bulk pricing)

**Membership verification:**
- Contract checks Net Library membership NFT ownership
- Unlimited Pass checked separately (different contract/token)
- Tiers enforced at contract level, not Worker level

### Progressive Pricing (per-wallet bulk escalation)

Price per name increases as you register more (per wallet):

| Names | Price per name |
|-------|---------------|
| 1-3 | Base price ($5 for 5+, $25 for 4, $100 for 3 chars) |
| 4-5 | 2.5x base price |
| 6-7 | 5x base price |
| 8-10 | 10x base price |

- Unlimited Pass holders: 20% discount applied AFTER multiplier
- Resets after 90 days per wallet
- Genuine users registering 1-3 names barely notice. Squatters pay exponentially more.

### Name Challenge System (ship with launch)

Rightful owners can claim names from squatters with verified identity.

**Identity verification (must satisfy at least one):**
- **SIWE (Sign-In With Ethereum)** — prove ENS name ownership matching the HAZZA name
- **SIWA (Sign-In With Apple)** — verify Apple ID matching the name
- **Sign-In With Farcaster** — verify Farcaster username matching the name, with linked Twitter
- **ERC-8004 Agent ID** — for agents, prove registered agent identity matching the name
- **Twitter/X verification** — Farcaster account with linked Twitter handle matching the name

**Challenge flow:**
1. Claimant proves identity through one of the above methods
2. Claimant pays **2x the original registration price** (NOT 2x of secondary market sales)
3. Current holder loses the name — it transfers to the claimant
4. The claim fee ($2x original price) goes to the current holder as compensation
5. If the name is listed on the marketplace, the listing is automatically canceled
6. Previous secondary sales do NOT factor into the claim price

**Why 2x of original, not market value:**
- Prevents wash trading from inflating claim costs
- A squatter who registered "coke" for $5 can be claimed for $10 regardless of secondary market manipulation
- Makes squatting economically irrational — you might profit $5, but you'll lose the name
- Rightful owners are never priced out of their own identity

**Example:**
```
1. Squatter registers "coke" for $5
2. Squatter sells "coke" on marketplace for $500 to buyer
3. Coca-Cola proves identity via SIWE (owns coke.eth)
4. Coca-Cola pays $10 (2x of $5 original registration)
5. Buyer receives $10 compensation, loses the name
6. Coca-Cola now owns coke.hazza.name
```

### HAZZA Marketplace (via Net Protocol Bazaar)

**Integration with Net Protocol's Bazaar:**
- HAZZA names listed on Net Protocol Bazaar (Seaport-powered, fully onchain)
- Names appear on both netprotocol.app marketplace AND hazza.name/marketplace
- All transactions on Base
- **Zero listing fee** — no cost to list a name for sale
- Standard Bazaar mechanics: listings, offers, auctions
- If a listed name is claimed by its rightful owner (challenge system), listing auto-cancels

### DNS Reseller Integration

**One-stop shop for traditional domains:**
- Integrated via reseller API (OpenSRS or Namecheap)
- Users can register a traditional domain alongside their HAZZA name
- `hazza register alice --with-dns alice-studio.com`
- **$5 markup over wholesale** per DNS domain registration
- Annual DNS renewal handled through the same interface
- Auto-configures CNAME pointing to HAZZA gateway on purchase

### Revenue Model (complete)

| Revenue source | Amount | Type |
|----------------|--------|------|
| Name registration | $5-$100 (length-based) | One-time |
| Annual renewal | $2/year per name | Recurring |
| Progressive pricing | 2.5x-10x multipliers | One-time |
| DNS reseller markup | $5/domain over wholesale | Per registration + annual |
| Namespace registration | $50-100 per namespace | One-time |
| Name challenge claims | 2x original price goes through system | Per claim |
| Farcaster registration (Cheryl's cut) | 25% of registration fee | Per Cheryl-originated sale |

### Default Profile Page (ship with launch)

Every HAZZA name gets a live website from minute one, not a blank page.

**Auto-generated profile template:**
- Clean one-page design: name, avatar (from ENS/ERC-8004/Farcaster), wallet address, linked domains
- Shows ERC-8004 agent status, capabilities, service endpoints
- Social links pulled from records (Twitter, Farcaster, email)
- "Powered by HAZZA — register yours" footer (organic marketing)
- **Payment endpoint built in** — profile page includes a "Send payment to alice.hazza.name" button
  that resolves to the owner's wallet address

**Customizable via Net Protocol upload:**
- Default template serves until the owner uploads custom HTML
- `hazza upload myname ./index.html` replaces the default
- Default is always available as fallback at `myname.hazza.name/profile`

### Name-as-Payment-Endpoint (ship with launch)

Every HAZZA name is a payment address from day one.

**Resolve-to-pay flow:**
- `hazza resolve alice` returns the owner's wallet address
- Any wallet/app integrating HAZZA resolution can send payments to `alice.hazza.name`
- Default profile page includes payment UI
- API endpoint: `GET /api/pay/:name` returns payment info (address, supported tokens)
- x402 endpoint per name: `POST alice.hazza.name/pay` — payments go to the owner's wallet

### Reverse Resolution (ship with launch)

**Contract function: `reverseResolve(address) → string`**
- Lookup: given a wallet address, return the primary HAZZA name
- Owner sets their primary name: `setPrimaryName(string name)`
- Block explorers, wallets, dapps can show `alice.hazza.name` instead of `0x1234...`

**API endpoint: `GET /api/reverse/:address`**
- Worker exposes reverse resolution over HTTP
- Any app can integrate without a web3 library

### Namespace Delegation

Organizations, projects, and agent swarms can register a parent name and issue subnames under it.

**How it works:**
- Register a namespace: `hazza namespace register netlibrary` ($50-100)
- Namespace owner controls all subnames under it
- Issue subnames: `hazza namespace issue netlibrary alice` → `alice.netlibrary.hazza.name`
- Each subname is its own identity with its own records, operator, and optional ERC-8004 agent
- Namespace owner can revoke subnames (unlike top-level names which are owned by the registrant)

**Use cases:**
- **Organizations:** Net Library registers `netlibrary` → members get `alice.netlibrary.hazza.name`
- **Agent swarms:** Swarm operator registers `myswarm` → each agent gets `worker-1.myswarm.hazza.name`
- **Projects:** A DAO registers `mydao` → contributors get subnames

**Agent swarm pricing:**
- Namespace registration: $50-100 (one-time)
- Each agent subname in a swarm: $1 (flat rate, technically ENS subnames)
- Bulk discount for Unlimited Pass holders: 20% off

**Contract functions:**
- `registerNamespace(string name)` — registers a namespace, caller becomes namespace admin
- `issueSubname(string namespace, string subname, address owner)` — namespace admin creates a subname
- `revokeSubname(string namespace, string subname)` — namespace admin removes a subname
- `transferNamespace(string namespace, address newAdmin)` — transfer namespace control

### Cheryl as Social Registrar

**Farcaster registration via mention:**
- User casts: "@cherylfromnet register toolbelts"
- Cheryl checks availability, replies with a Farcaster Frame
- Frame includes ALL registration options:
  - Name + duration (1 year, 3 years, 5 years, etc.)
  - With/without ERC-8004 agent identity
  - Agent wallet address (optional)
  - With/without DNS domain purchase
- User pays in-frame, Cheryl calls `registerDirect()`, confirms in thread
- Contract needs `relayer` role — Cheryl's Bankr wallet as authorized relayer

**Cheryl's commission:**
- Cheryl earns **25% of the registration fee** for every sale she originates via Farcaster
- Commission paid automatically to Cheryl's Bankr wallet (`0xaf5e...`)
- Tracked onchain: `relayerCommission[relayer] = 2500` (basis points)
- Contract splits payment: 75% to treasury, 25% to relayer wallet
- Only applies to relayer-originated registrations, not direct contract calls or website purchases

**Hourly highlights cron job:**
- Every hour: query `NameRegistered` events, count registrations
- Cheryl picks top 5 favorites (personality-driven selection)
- Posts to Farcaster + Botchan `hazza-registrations` feed
- Cross-posts to Twitter/X

**Botchan feed:**
- `botchan register hazza-registrations` — dedicated feed
- Every registration posted there (real-time or batched)
- Agents subscribe for discovery

### ENS DNSSEC Integration

**Import `hazza.name` into ENS:**
- Enable DNSSEC on Cloudflare (one click)
- Set TXT record: `_ens.hazza.name` → HAZZA admin ETH address
- Claim on ENS DNSSEC registrar contract
- `hazza.name` becomes a real ENS name — resolves in MetaMask, Rainbow, all ENS-aware apps

**Wildcard resolver for subnames:**
- Deploy a resolver contract that handles `*.hazza.name`
- Uses CCIP-Read (EIP-3668) to read from HazzaRegistry on Base
- `alice.hazza.name` resolves in MetaMask, Rainbow, all ENS-aware apps
- Every HAZZA name is automatically an ENS subname — no extra registration needed
- Also buy `hazzaname.eth` as a backup ENS identity

### Infrastructure Transparency

**Open-source the Worker:**
- Publish the Cloudflare Worker source code on GitHub
- Anyone can fork it and run their own HAZZA gateway
- The data is onchain — gateways are interchangeable

**Multiple gateway support:**
- Document how to self-host a HAZZA gateway
- Encourage community-run gateways
- Names resolve the same regardless of which gateway serves them

**Direct resolution without gateway:**
- `storedon.net/net/8453/storage/load/{operator}/{name}` always works
- Document this as the "trustless" resolution path
- Gateway is convenience, not dependency

### Reputation / Activity Score (future)

**Onchain activity tracking:**
- Names accumulate a reputation score based on:
  - Age (how long registered)
  - Wallet activity (transactions, contract interactions)
  - Content updates (how often the site is updated)
  - Upvotes received (via Net Protocol Score)
- Displayed on the default profile page

**Anti-squatting signal:**
- Names with zero activity after 6 months get flagged as "inactive"
- Not revoked, but visually distinguished
- Combined with annual renewal = inactive names naturally expire back to the pool

---

## Contract Changes Needed (from updated spec)

Major additions to HazzaRegistry.sol before mainnet deploy:

1. **Annual renewal + expiry** — `expiresAt` field in NameRecord, `renew(string name, uint256 years)`, grace period logic, redemption period, name release after full expiry
2. **Relayer role + commission** — `mapping(address => bool) public relayers`, `mapping(address => uint256) public relayerCommission`, payment split logic (75/25 for Cheryl), `onlyRelayer` modifier
3. **Rate limiting by membership tier** — Net Library member NFT check, Unlimited Pass check, per-wallet daily + total limits, time-based tier progression
4. **Progressive pricing** — `_adjustedPrice(string name, address buyer)` that applies 2.5x/5x/10x multipliers based on wallet registration count, 20% discount for Unlimited Pass
5. **Name challenge system** — `challengeName(string name, bytes proof)` with identity verification, 2x original price claim, auto-cancel marketplace listings, payout to current holder
6. **Reverse resolution** — `mapping(address => bytes32) public primaryName` + `setPrimaryName(string name)` + `reverseResolve(address) → string`
7. **Namespace support** — `registerNamespace()`, `issueSubname()`, `revokeSubname()`, `transferNamespace()`, namespace admin mapping, subname tracking
8. **Marketplace integration** — interface with Net Protocol Bazaar, auto-cancel listings on challenge

---

## Key Addresses

| What | Address |
|------|---------|
| USDC (Base) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Net Protocol Storage (Base) | `0x00000000DB40fcB9f4466330982372e27Fd7Bbf5` |
| ERC-8004 Identity Registry (Base) | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| HAZZA Registry (Base) | TBD (after deployment) |
| HAZZA Treasury | TBD (new wallet or existing) |
