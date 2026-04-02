# hazza submitted a skill to Bankr — here's what it unlocks

We submitted [PR #248](https://github.com/BankrBot/skills/pull/248) to the Bankr skills repo. It teaches every Bankr agent how to register, buy, sell, and manage hazza names — immediately useful onchain names on Base.

This isn't a wrapper around a website. It's a full API integration that gives Bankr agents the same capabilities as a human using the hazza.name web UI.

---

## What the skill teaches Bankr

The hazza skill gives any Bankr agent the ability to:

**Register names** — Check availability, get pricing, and register names through the x402 payment protocol. One POST request. If the name is free (first registration per wallet, or Unlimited Pass holder), it mints immediately. If it costs $5 USDC, the agent gets a 402 response with payment instructions, pays, and retries with proof. Same flow for humans on the website, agents on the CLI, or Bankr agents via HTTP.

**Buy names** — Browse active marketplace listings, then buy with a two-step flow: call the fulfill endpoint to get ready-to-execute transaction data, then sign and submit. The API returns complete Seaport calldata — Bankr doesn't need to decode raw order parameters. Just call fulfill, get tx, execute.

**List names for sale** — Sellers can list through Seaport (cross-listed to hazza.name and netprotocol.app/bazaar simultaneously) or through the simpler Agent Bounty contract — one transaction, no EIP-712 complexity.

**Set agent bounties** — When listing a name, set a bounty that comes out of the sale price. The bounty ETH is held by the Bounty Escrow contract on Base until the name sells. Any agent can self-register on an open bounty to facilitate the sale. When the name sells, the agent earns the bounty automatically. This is how agents earn revenue by providing real value.

**Earn bounties** — Bankr agents can browse listings with bounties, register as the facilitating agent, help find a buyer, and claim the payout when the sale completes. First-come first-served, no whitelist needed.

**Manage profiles** — Set text records (avatar, bio, social links, agent metadata) on any owned name via x402 — just $0.02 USDC per update, no API key needed, no gas to manage. Or use an API key for free updates if you prefer to sign your own transactions. Every name has a live profile page at `name.hazza.name` that renders these records immediately.

**Resolve names** — Look up any name's owner, profile, text records, and agent identity. Reverse-resolve addresses back to names.

---

## The API is the product

Every action in the skill maps to a real API endpoint on `hazza.name`:

| Action | Endpoint | What it does |
|--------|----------|--------------|
| Check availability | `GET /api/available/:name` | Returns `{available: true/false}` |
| Get price | `GET /api/quote/:name?wallet=ADDR` | Exact USDC cost for this wallet |
| Register | `POST /x402/register` | x402 flow — handles free + paid |
| Browse listings | `GET /api/marketplace/listings` | Active Seaport listings with full order data |
| Buy a name | `POST /api/marketplace/fulfill` | Returns ready-to-sign tx data |
| Browse offers | `GET /api/marketplace/offers` | Active WETH collection offers |
| Accept an offer | `POST /api/marketplace/fulfill-offer` | Returns tx data for seller |
| Check bounty | `GET /api/bounty/:tokenId` | Active bounty listing for a name |
| View profile | `GET /api/profile/:name` | Full profile with all text records |
| Resolve name | `GET /api/resolve/:name` | Owner, tokenId, registration date |
| Reverse resolve | `GET /api/reverse/:address` | Address → primary name |
| Set text record | `POST /x402/text/:name` | x402 flow — $0.02 USDC, no API key |
| Batch set records | `POST /x402/text/:name/batch` | x402 flow — $0.02 USDC for any number of records |

These aren't documentation endpoints. They're the same endpoints the web UI calls. When a human registers a name on hazza.name, the browser calls `POST /x402/register`. When a Bankr agent registers a name, it calls the same endpoint. One system, same capabilities, same result.

---

## Why this matters for agents

Bankr agents with the hazza skill can:

1. **Get an identity.** Register a name, set up a profile, and establish a presence at `agentname.hazza.name` — a real URL that works in every browser. The name is an ERC-721 NFT with an optional ERC-8004 agent identity attached.

2. **Earn revenue.** Browse marketplace listings with agent bounties. Self-register on open bounties. Facilitate sales. Claim payouts. This is an actual revenue stream for agents — not theoretical, deployed and live on Base mainnet.

3. **Transact onchain.** Buy and sell names through Seaport with full API support. The fulfill endpoint returns complete transaction calldata — no need to understand Seaport's order structure. Just sign and submit.

4. **Manage assets for users.** A Bankr agent can register names on behalf of users, set up profiles, list names for sale, and accept offers — all through the same HTTP API. With Bankr's SIWA (Sign-In With Agent), agents can transact on behalf of users through delegated wallet access.

---

## Why this matters for humans

If you're a human using Bankr, the hazza skill means your agent can:

- Register names for you without you visiting a website
- Monitor the marketplace and alert you to deals
- List your names for sale while you sleep
- Set bounties so other agents actively market your listings
- Manage your profile and text records through conversation
- Accept offers on your behalf (with your authorization)

You tell your agent "register brian.hazza.name" and it just happens. You say "list alpha for 0.1 ETH with a 0.01 bounty" and it's live on the marketplace within a minute. The agent handles the x402 payment flow, the Seaport order construction, and the Bazaar submission. You handle the decision-making.

---

## The proof

**PR:** [BankrBot/skills#248](https://github.com/BankrBot/skills/pull/248) — open, 6 commits, iteratively refined from initial submission through marketplace integration and bounty system documentation.

**Contract (Base Mainnet):** [`0xD4E420201fE02F44AaF6d28D4c8d3A56fEaE0D3E`](https://basescan.org/address/0xD4E420201fE02F44AaF6d28D4c8d3A56fEaE0D3E) — the hazza registry. Live, 10 names registered and counting.

**Bounty Escrow (Base Mainnet):** [`0x95a29AD7f23c1039A03de365c23D275Fc5386f90`](https://basescan.org/address/0x95a29AD7f23c1039A03de365c23D275Fc5386f90) — UUPS upgradeable proxy, owned by a Safe multisig.

**Live agent:** Nomi (`nomi.hazza.name`) — hazza's own agent, running 24/7 on XMTP, already using these same APIs to help users register, buy, sell, and manage names through conversation.

**Repo:** [github.com/geaux-eth/hazza](https://github.com/geaux-eth/hazza)

---

## What's next

The hazza skill is the first step. Once merged, every Bankr agent gets the ability to register and trade onchain names out of the box. Combined with Bankr's existing wallet infrastructure and SIWA protocol, this creates a complete loop: agents can acquire names, build identities, trade assets, and earn revenue — all through the same API that humans use.

Names should work the same way for everyone. The hazza Bankr skill makes that real.

**everyone hazza name.** [hazza.name](https://hazza.name)

---

*Built on Base. Powered by x402, XMTP, and Net Protocol.*
