# The Complete hazza User's Guide

Everything you need to know about hazza.name — what it is, what it does, how it works under the hood, and why it was built this way.

---

## What is hazza?

hazza is an onchain name registry on Base. You register a name like `yourname.hazza.name` and get an ERC-721 NFT that functions as your identity, your website, your messaging address, your AI agent endpoint, and your marketplace asset — all at once.

The tagline is "immediately useful" and that's not marketing. Every name comes with five things working from the moment it's registered:

1. **A live website** at `yourname.hazza.name`
2. **DNS resolution** — your name works as a real URL in any browser
3. **x402 payments** — programmatic registration for agents and CLIs
4. **ERC-8004 agent identity** — every name can be an AI agent
5. **XMTP messaging** — encrypted, decentralized DMs

**Your first name is free.** Just pay gas (about $0.01 on Base). After that, names start at $5 USDC. Pay once, own forever — no renewals, no expiration.

---

## Getting Started

### Register Your First Name

1. Go to [hazza.name](https://hazza.name)
2. Type a name in the search bar
3. If it's available, click **Register**
4. Connect your wallet (MetaMask, Coinbase Wallet, Rainbow, WalletConnect — anything that supports Base)
5. If it's your first name, you'll see **FREE** — just sign the transaction
6. If it's a paid name, approve the USDC transfer, then sign the registration transaction
7. Done. Your profile is live at `yourname.hazza.name`

**First visit?** Nomi (hazza's AI assistant) pops up to offer a quick walkthrough of the site. Nomi is a Nibble — more on that later.

### Name Rules

Names must work as DNS labels (because they're also web addresses):

- **Characters:** Lowercase letters (a-z), numbers (0-9), and hyphens (-)
- **Length:** 1 to 64 characters
- **No leading or trailing hyphens**, no consecutive hyphens (--)
- **No spaces, no emojis, no uppercase** in the base name
- **ENSIP-15** unicode and emoji support is available through the text record system

If you try to register a name with invalid characters, hazza will explain why — your name is also your URL, so it needs to work as a web address.

### ENS Suggestions

When you search for a name and connect your wallet, hazza checks if you own any ENS names. If you do, it suggests registering the matching hazza name — e.g., if you own `alice.eth`, it'll suggest registering `alice.hazza.name`. This makes it easy to claim your existing identity across both systems.

---

## Pricing

hazza uses a flat pricing model with progressive anti-squat protection.

### Base Pricing

| Situation | Price |
|-----------|-------|
| **First name per wallet** | **FREE** (gas only, ~$0.01) |
| **Unlimited Pass holder — bonus free name** | **FREE** (gas only) |
| Names 1-3 (paid, per wallet, 90-day window) | $5 USDC |
| Names 4-5 | $12.50 USDC (2.5x) |
| Names 6-7 | $25 USDC (5x) |
| Names 8+ | $50 USDC (10x) |

### How Progressive Pricing Works

The anti-squat mechanism is simple: the more names you register within a 90-day window, the more expensive each additional name becomes. This deters bulk registration while keeping prices low for normal users.

**Important details:**

- Free names (first-free and Unlimited Pass free) do **not** count toward your pricing window
- The 90-day window resets automatically — after 90 days of not registering, your counter drops back
- Progressive pricing is per-wallet, not per-person — switching wallets resets the count, but you lose your first-free on the new wallet
- **Unlimited Pass holders** get 20% off all paid tiers

### Payment

All payments are in **USDC on Base**. Gas costs are minimal (~$0.01 per transaction). There are no ongoing fees — names never expire, never require renewal.

### Unlimited Pass

The [Unlimited Pass](https://netlibrary.app) is a $10 NFT from Net Library (`0xCe559A2A6b64504bE00aa7aA85C5C31EA93a16BB` on Base). It gives you:

- **1 additional free hazza name** (on top of everyone's first-free)
- **20% discount** on all paid registrations
- Unlimited uploads to Net Library stacks and grids
- Bypass Net Library's 7-day warm-up period

The free claim is tracked by Net Library member ID (not wallet address), so transferring the pass to a new wallet doesn't create a second free claim.

---

## Your Profile Page

Every registered name gets a live profile page at `yourname.hazza.name`. Here's what shows up:

### Basic Profile

- **Avatar** — any image URL, displayed as a circle at the top
- **Bio** — free-text description
- **Status** — shows whether the name is "registered" or has special status
- **Social links** — Twitter/X, Farcaster, GitHub, Telegram, Discord, LinkedIn, and custom website URL
- **Badges** — Net Library membership number, Unlimited Pass holder status

### Onchain Identity

If the name has an ERC-8004 agent registration, the profile displays:

- **AI Agent section** — agent name, description, capabilities, services, and metadata pulled from the agent's URI stored on Net Protocol
- **Helixa AgentDNA** — if the agent's wallet holds a Helixa token, shows cred score, ethos score, personality, and aura
- **Exoskeleton** — if the agent's wallet holds an Exoskeleton NFT, shows the fully onchain artwork and attributes
- **Bankr Profile** — if the agent is registered on Bankr, shows project name, token, market cap, and revenue

All of this is rendered dynamically from onchain data. Nothing is hardcoded — if a new metadata field appears in an agent's URI, the profile page renders it automatically.

### XMTP Messaging

If the name has an `xmtp` text record set, visitors see a **Send DM** button. Clicking it opens a chat panel right on the profile page — no app to install, no redirect. Messages are end-to-end encrypted through the XMTP network.

### Custom Sites

Any name can host a full website. Set the `site.key` text record to point to content stored on Net Protocol, and visitors to `yourname.hazza.name` see your custom site instead of the default profile. You can also link up to **10 custom domains** that point to your hazza name.

---

## Managing Your Name

Go to [hazza.name/manage](https://hazza.name/manage), connect your wallet, and select a name you own. Everything is editable:

### Text Records

Set any ENS-standard text record. The common ones:

| Key | What it does |
|-----|--------------|
| `avatar` | Profile picture URL |
| `description` | Bio text |
| `url` | Website link |
| `com.twitter` | Twitter/X handle |
| `com.github` | GitHub username |
| `org.telegram` | Telegram handle |
| `com.discord` | Discord username |
| `xmtp` | XMTP messaging address |
| `agent.uri` | ERC-8004 agent metadata URI |
| `site.key` | Net Protocol content key for custom site hosting |
| `net.profile` | Net Protocol profile link |
| `message.delegate` | Message delegation target (hazza name or 0x address) |
| `message.mode` | Delegation mode: `all`, `delegate-all`, or `delegate-agents` |

You can set multiple records in a single transaction using `setTexts()`.

### Agent Registration

Register an ERC-8004 AI agent identity directly from the manage page. This creates an entry in the ERC-8004 Agent Registry on Base, linked to your name. Set the agent's wallet address and metadata URI (typically hosted on Net Protocol).

### Operator

Set an operator address — another wallet that can manage your name's records without owning the NFT. Useful for teams or for letting an agent manage your profile.

### Custom Domains

Link up to 10 custom domains to your name. Each domain gets DNS routing to your hazza profile or custom site.

### Namespaces

Turn your name into a namespace and issue subnames. For example, if you own `myproject.hazza.name`, you can create `alice.myproject`, `bot.myproject`, etc. Enabling a namespace is free. Each subname costs $1.

### Transfer

Transfer your name to any address. The manage page includes a built-in transfer UI — enter the recipient address, sign the transaction, done.

---

## The Dashboard

[hazza.name/dashboard](https://hazza.name/dashboard) is your home base. Connect your wallet and see:

- **All your names** — displayed as cards with avatar, description, and quick links
- **Primary name** — set which name is your primary (used for reverse resolution)
- **Per-name settings** — message delegation mode and delegate address
- **Quick actions** — manage, view profile, or message from each name card

---

## The Marketplace

[hazza.name/marketplace](https://hazza.name/marketplace) is a full-featured name marketplace built on Seaport and the Net Protocol Bazaar.

### Browsing Listings

The Browse tab shows all active listings with:

- Name and avatar
- Price (in ETH)
- Seller address (with ENS resolution where available)
- Listing expiry date
- Agent bounty amount (if set)

Click any listing to see details, and buy directly. Listings are sorted by recency.

### Buying a Name

1. Find a listing you want
2. Click **Buy**
3. If the listing requires WETH approval, sign the approval transaction first
4. Sign the Seaport fulfillment transaction
5. The name transfers to your wallet immediately

The marketplace uses Seaport (`0x0000000000000068F116a894984e2DB1123eB395` on Base) for all trades. This is the same protocol behind OpenSea — battle-tested, audited, non-custodial.

### Listing a Name for Sale

1. Go to the **Sell** tab
2. Select a name you own
3. Set a price in ETH
4. Optionally set an **agent bounty** — a portion of the sale price that goes to whatever agent facilitates the sale
5. Set listing duration (7, 14, 30, or 90 days)
6. Approve Seaport to transfer your NFT (one-time `setApprovalForAll`)
7. Sign the EIP-712 Seaport order
8. Submit to the Bazaar — your listing is now live on hazza.name *and* netprotocol.app/bazaar

### Agent Bounties

When listing a name, you can attach a bounty from the sale proceeds. Here's how it works:

1. You list "coolname" for 0.1 ETH with a 0.01 ETH bounty
2. The Seaport order splits the buyer's payment: 0.09 ETH to you, 0.01 ETH to the Bounty Escrow contract
3. An agent registers on the escrow for your name
4. The name sells via Seaport — ETH splits automatically
5. The agent claims the bounty by proving the NFT changed hands
6. If no agent facilitated the sale, you withdraw the unclaimed bounty

The Bounty Escrow contract (`0x4Af1B18C01250A52f29CEacA055164628b643ae9` on Base) is completely open:

- **Open bounties:** Any agent can register, first-come first-served, no replacement
- **Approved bounties:** Seller specifies a single agent address — only that agent can register
- **Seller controls:** Cancel anytime before sale, withdraw unclaimed bounties after sale

### Making and Accepting Offers

The **Offers** tab shows collection-level offers in WETH. You can:

- **Make an offer** on any name — specify the name, amount in WETH, and expiry
- **Accept an offer** — if someone has made an offer on your name, you'll see it in the Sell tab with an Accept button

### The Community Forum

The **Board** tab is a flat message board where the hazza community discusses names, shares listings, and connects. Every post shows the author's hazza name. If the author has XMTP configured, you can DM them directly from their post.

---

## Messaging

hazza uses **XMTP** (Extensible Message Transport Protocol) for all messaging. XMTP is:

- **End-to-end encrypted** — only sender and recipient can read messages
- **Decentralized** — messages go through the XMTP network, not hazza's servers
- **Quantum-resistant** — uses modern key exchange protocols
- **Protocol-native** — works across any app that supports XMTP

### How to Set Up Messaging

1. Go to [hazza.name/manage](https://hazza.name/manage)
2. Set your `xmtp` text record to your XMTP address
3. That's it — your profile now shows a "Send DM" button

Your XMTP address is typically derived from your wallet. When you first interact with the XMTP network, it generates a keypair associated with your wallet.

### The Chat Panel

hazza's chat panel is a slide-out XMTP client that appears throughout the site:

- **On profile pages** — click "Send DM" to message anyone with XMTP set up
- **On marketplace listings** — message a seller about their listing
- **On forum posts** — DM the author of a post
- **Nomi** — the floating Nomi button in the corner opens a chat with hazza's AI agent

The chat panel supports **action cards** — structured messages for marketplace operations. When Nomi or another agent wants to help you buy, sell, list, or transfer a name, it sends a card with all the details. You review the details and click to execute. No manual transaction construction needed.

### Message Delegation

For teams and organizations, hazza supports message delegation:

| Mode | Behavior |
|------|----------|
| `all` | All messages go directly to you (default) |
| `delegate-all` | All messages route to your delegate |
| `delegate-agents` | Agent messages go to delegate, human messages go to you |

Set your delegate in the Dashboard or Manage page. The delegate can be another hazza name or a raw 0x address.

---

## Nomi — hazza's AI Agent

Nomi is hazza's resident AI agent. Nomi is **Nibble #4240** — a character from the Nibbles NFT collection on Base (8,888 pixel characters, fully onchain).

### What Nomi Can Do

Message Nomi through the chat button on hazza.name, or directly via XMTP at `0x55B251E202938E562E7384bD998215885b80162e`. Nomi can:

- **Check name availability** — "is geaux available?"
- **Get pricing quotes** — "how much is geaux?"
- **Look up profiles** — "who owns geaux?"
- **Browse marketplace listings** — "what's for sale?"
- **Help you buy a name** — sends an action card with the Seaport fulfillment details
- **Help you list a name** — walks you through pricing and listing
- **Help you transfer a name** — generates a transfer action card
- **Set text records** — "set my description to Builder on Base"
- **Check bounties** — "does geaux have a bounty?"
- **General questions** — pricing, features, how things work

### How Nomi Works

Nomi runs 24/7 on a dedicated server as an XMTP agent. Under the hood:

- **XMTP Agent SDK** — listens for incoming DMs on the XMTP network
- **Bankr LLM Gateway** — processes messages through Claude for natural language understanding
- **hazza API** — fetches live data (availability, pricing, profiles, listings) for every conversation
- **Action cards** — generates structured buy/sell/transfer/list cards that users can execute directly from the chat
- **Conversation memory** — remembers context within a conversation (with automatic cleanup for privacy)
- **Rate limiting** — prevents abuse without blocking legitimate use

Nomi has its own wallet and its own ERC-8004 agent identity. It's not a chatbot sitting on top of a website — it's a registered onchain agent that can be discovered, messaged, and interacted with by any XMTP client.

### The Nibbles

The Nibbles are an NFT collection on Base — 8,888 pixel characters. Nomi is #4240. The Nibbles aren't a hazza product; they're a separate collection that Nomi happens to be from. Think of Nomi as a character with a backstory — a Nibble who found their calling in helping people find names.

---

## For Developers

### The API

All endpoints are at `https://hazza.name`. No API key required for read operations.

#### Read Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/available/:name` | Check if a name is available |
| `GET /api/resolve/:name` | Resolve name to owner, tokenId, agent info |
| `GET /api/profile/:name` | Full profile with text records, agent metadata, badges |
| `GET /api/reverse/:address` | Reverse resolve wallet to primary name |
| `GET /api/names/:address` | All names owned by a wallet |
| `GET /api/quote/:name?wallet=ADDR` | Get exact price for a specific wallet |
| `GET /api/free-claim/:address` | Check free claim eligibility |
| `GET /api/contact/:name` | Resolve message delegate chain |
| `GET /api/stats` | Registry statistics |
| `GET /api/collection-metadata` | Collection-level metadata (contractURI) |
| `GET /api/marketplace/listings` | Active marketplace listings |
| `GET /api/marketplace/offers` | Collection offers |
| `GET /api/marketplace/offers/:name` | Offers on a specific name |
| `GET /api/marketplace/sales` | Recent sales history |
| `GET /api/bounty/:tokenId` | Check bounty status for a name |

#### Write Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /x402/register` | Register a name (x402 payment flow) |
| `POST /api/text/:name` | Set a text record (requires auth) |
| `POST /api/marketplace/fulfill` | Get buy transaction data |
| `POST /api/marketplace/fulfill-offer` | Get offer acceptance transaction data |
| `POST /api/marketplace/offer` | Submit an offer |
| `POST /api/board` | Post to the community forum |

### x402 Registration Flow

The x402 protocol enables programmatic registration without a wallet extension:

```
1. POST /x402/register {"name": "myname", "owner": "0x..."}
2. Server returns 402 with USDC payment instructions
3. Client transfers USDC to the relayer address on Base
4. POST /x402/register with X-PAYMENT header containing payment proof
5. Server verifies payment, calls registerDirect on the contract
6. Returns {name, tokenId, profileUrl, registrationTx}
```

If the name is free (first registration or Unlimited Pass claim), step 2-4 are skipped.

### The CLI

hazza has a CLI tool for terminal-based interaction:

```bash
# Install
cd cli && npm install && npm link

# Search for a name
hazza search <name>

# Register a name
hazza register <name>

# Look up a profile
hazza whois <name>

# Marketplace
hazza market ls                    # browse listings
hazza market buy <orderHash>       # buy a listed name
hazza market sell <name> <price>   # list for sale
hazza market offer <name> <price>  # make an offer
hazza market board                 # read forum
hazza market board-post "<text>"   # post to forum

# Contact resolution
hazza contact <name>               # resolve messaging delegate

# Records
hazza records set <name> <key> <value>
```

The CLI uses Foundry's `cast` for transaction signing. Configure your wallet and RPC in `~/.config/hazza/config.json`.

### CCIP-Read (ERC-3668)

hazza supports CCIP-Read for ENS-compatible offchain resolution. This means ENS-aware applications can resolve `.hazza.name` names through the standard ENS resolution flow, with the hazza worker acting as the CCIP-Read gateway.

---

## The Tech Stack

### Smart Contracts

- **Language:** Solidity 0.8.24
- **Framework:** Foundry (forge, cast)
- **Network:** Base mainnet (Chain ID 8453)
- **Registry contract:** `0xD4E420201fE02F44AaF6d28D4c8d3A56fEaE0D3E`
- **Bounty Escrow:** `0x4Af1B18C01250A52f29CEacA055164628b643ae9`
- **Validation library:** `0xde304655b96ed7f8a42Bd82D640e252bc76a3Bc1`
- **ERC-721** with full enumeration (balanceOf, tokenOfOwnerByIndex)
- **Optimizer:** 10 runs with via-IR (minimizes contract size — EIP-170 limit)
- **Non-upgradeable** — the contract is immutable once deployed

### Backend

- **Runtime:** Cloudflare Workers (edge computing, globally distributed)
- **Framework:** Hono (lightweight TypeScript web framework)
- **Blockchain client:** Viem (TypeScript Ethereum library)
- **Marketplace:** Seaport protocol + Net Protocol Bazaar SDK
- **Storage:** Cloudflare KV (watchlists, rate limiting, replay protection)
- **Content hosting:** Net Protocol (onchain storage)
- **RPC:** Paid Base mainnet RPC (stored as CF Worker secret)

### Frontend

- **Framework:** React 19 with TypeScript
- **Routing:** React Router v7
- **Build tool:** Vite
- **Wallet connection:** wagmi + viem + RainbowKit
- **Messaging:** @xmtp/browser-sdk
- **Styling:** CSS (custom, no framework — Fredoka font, cream/red/blue/navy colorway)

### Messaging

- **Protocol:** XMTP (Extensible Message Transport Protocol)
- **Agent SDK:** @xmtp/agent-sdk (for Nomi)
- **Browser SDK:** @xmtp/browser-sdk (for the chat panel)
- **Encryption:** End-to-end, forward secrecy, quantum-resistant key exchange

### Agent Infrastructure

- **Agent registry:** ERC-8004 (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` on Base)
- **Agent metadata:** Stored on Net Protocol, linked via `agent.uri` text record
- **Nomi runtime:** Node.js process on dedicated server, XMTP Agent SDK
- **LLM:** Claude via Bankr LLM Gateway

### Protocols and Standards

| Standard | How hazza uses it |
|----------|------------------|
| **ERC-721** | Names are NFTs — ownable, transferable, composable |
| **ERC-8004** | AI agent identity registration linked to names |
| **ERC-3668** | CCIP-Read for ENS-compatible offchain resolution |
| **EIP-712** | Typed data signing for Seaport marketplace orders |
| **ENSIP-7** | Content hosting via contenthash |
| **ENSIP-9/11** | Multi-chain address resolution |
| **ENSIP-15** | Unicode and emoji support |
| **x402** | HTTP-native payment protocol for registration |
| **XMTP** | Decentralized encrypted messaging |
| **Seaport** | Non-custodial marketplace protocol (same as OpenSea) |

---

## Key Addresses

| Item | Address | Network |
|------|---------|---------|
| Registry | `0xD4E420201fE02F44AaF6d28D4c8d3A56fEaE0D3E` | Base Mainnet |
| Bounty Escrow | `0x4Af1B18C01250A52f29CEacA055164628b643ae9` | Base Mainnet |
| Seaport | `0x0000000000000068F116a894984e2DB1123eB395` | Base Mainnet |
| Bazaar | `0x000000058f3ade587388daf827174d0e6fc97595` | Base Mainnet |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Base Mainnet |
| Unlimited Pass | `0xCe559A2A6b64504bE00aa7aA85C5C31EA93a16BB` | Base Mainnet |
| Nomi (XMTP) | `0x55B251E202938E562E7384bD998215885b80162e` | XMTP Network |

---

## Design and Brand

hazza uses the **Moonlit B** colorway:

- **Cream** `#F7EBBD` — backgrounds
- **Red** `#CF3748` — accents, CTAs, section titles
- **Blue** `#4870D4` — primary actions, name highlights, borders
- **Navy** `#131325` — text, dark backgrounds

**Font:** Fredoka (Bold 700, SemiBold 600, Regular 400) — rounded, friendly, readable.

**Mascot:** Nomi (Nibble #4240) — appears throughout the site as a guide, in the welcome walkthrough, the floating chat button, and the About page. Nomi complements the brand but isn't the brand itself.

---

## Frequently Asked Questions

**Do names expire?**
No. Pay once, own forever. No renewals, no annual fees.

**Can I transfer my name?**
Yes. Names are standard ERC-721 NFTs. Transfer via the hazza dashboard, any NFT marketplace, or directly through the contract.

**What happens if I lose access to my wallet?**
Your name is an NFT in your wallet. If you lose access to the wallet, you lose access to the name. hazza has no admin recovery mechanism — the contract is non-upgradeable and the team cannot reassign names.

**Can I sell my name?**
Yes. List it on the hazza marketplace (Seaport/Bazaar) or any NFT marketplace that supports Base.

**What's the difference between hazza and ENS?**
ENS names require annual renewal, cost variable amounts based on character length, and need separate services for profiles, messaging, and content hosting. hazza names are permanent ($5 flat, first free), come with a working profile page immediately, include XMTP messaging, and support ERC-8004 agent registration natively. hazza also supports CCIP-Read for ENS compatibility.

**What's the difference between hazza and Unstoppable Domains?**
Unstoppable Domains requires their browser extension or gateway for resolution. hazza names resolve in any browser because they're real DNS subdomains. hazza also has native messaging, AI agent identity, and a built-in marketplace with agent bounties.

**Can AI agents register names?**
Yes. The x402 API enables fully programmatic registration. An agent makes an HTTP request, pays USDC, and receives a registered name. No wallet extension needed.

**What are agent bounties?**
When listing a name for sale, you can attach a bounty — a portion of the sale price that rewards whatever agent helps facilitate the sale. This creates an incentive for AI agents to actively market and sell names.

**Is the contract upgradeable?**
No. The registry contract is non-upgradeable. Once deployed, the code cannot be changed. The contract owner can update the treasury address and manage relayer permissions, but cannot modify registration logic, pricing formulas, or name ownership.

**What chain is hazza on?**
Base (Ethereum L2, Chain ID 8453). Base was chosen for low gas costs (~$0.01 per transaction) and Ethereum security.

**Where is the code?**
Open source at [github.com/geaux-eth/hazza](https://github.com/geaux-eth/hazza).

---

*hazza.name — immediately useful onchain names on Base.*

*Built with Solidity, Cloudflare Workers, React, Viem, XMTP, Seaport, and Net Protocol. Your first name is free.*
