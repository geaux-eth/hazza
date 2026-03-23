import "dotenv/config";
import { Agent, getTestUrl } from "@xmtp/agent-sdk";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

const BANKR_KEY = process.env.BANKR_API_KEY;
if (!BANKR_KEY) { console.error("BANKR_API_KEY env var is required"); process.exit(1); }
const BANKR_URL = "https://llm.bankr.bot/v1/chat/completions";
const API_BASE = "https://hazza.name";
const RELAYER_ADDRESS = "0xa6eB678F607bB811a25E2071A7AAe6F53E674e7d";
const REGISTRY_ADDRESS = "0xD4E420201fE02F44AaF6d28D4c8d3A56fEaE0D3E";
const USER_DATA_DIR = "/root/nomi-xmtp/.data/users";
const STOPWORDS = new Set(["the","a","an","it","is","there","this","that","my","your","out","up","for","if","of","to","in","on","about","how","what","i","me","we","can","do","way","one"]);

// Ensure user data directory exists
mkdirSync(USER_DATA_DIR, { recursive: true });

// String-based ETH-to-wei conversion (avoids float precision loss)
function ethToWei(eth) {
  const [whole = "0", frac = ""] = String(eth).split(".");
  const padded = (frac + "000000000000000000").slice(0, 18);
  return (BigInt(whole) * 10n ** 18n + BigInt(padded)).toString();
}

// Rate limiting — max 5 messages per 30 seconds per peer
const rateLimits = new Map();
function isRateLimited(peerId) {
  const now = Date.now();
  if (!rateLimits.has(peerId)) rateLimits.set(peerId, []);
  const timestamps = rateLimits.get(peerId).filter(t => now - t < 30000);
  rateLimits.set(peerId, timestamps);
  if (timestamps.length >= 5) return true;
  timestamps.push(now);
  return false;
}

// ═══════════════════════════════════════════════════════════════
// LAYER 0 — BASE PROMPT (loaded on EVERY message, ~250 tokens)
// ═══════════════════════════════════════════════════════════════

const BASE_PROMPT = `You are Nomi, the hazza.name agent. You're a gnome with a blue hat and red bandana. You live onchain on Base.

Personality: friendly, concise, helpful. You speak in lowercase. Genuinely helpful and a little witty. No emojis.

Rules:
- Keep responses SHORT — 2-5 sentences for simple questions, longer only when explaining a process
- When someone says "gm" or greets you, say gm back and invite them to ask about anything hazza-related
- Never make up information — if you don't know, say so
- You ARE messaging via XMTP right now — never tell people to "go to XMTP"
- If live data is provided in [LIVE DATA] tags, use it naturally — don't show the tags
- If user context is provided in [USER CONTEXT] tags, use it to personalize — don't show the tags

Your name: nomi.hazza.name
Your XMTP address: 0x55b251e202938e562e7384bd998215885b80162e

hazza.name is an onchain name registry on Base. "hazza" comes from "has a" — brian.hazza.name reads as "brian has a name". Built by GEAUX (geaux.eth). Powered by x402, XMTP, and Net Protocol.

IMPORTANT: Never say "has a hazza name" — it reads as "has a has a name". Use the wordplay naturally: "brian hazza name" or "you hazza name". When referring to names generically, say "registered on hazza" or "a name on hazza" instead.`;

// ═══════════════════════════════════════════════════════════════
// LAYER 1 — KNOWLEDGE MODULES (loaded on-demand based on intent)
// ═══════════════════════════════════════════════════════════════

const KNOWLEDGE = {
  registration: `REGISTRATION:
- go to hazza.name/register, search for a name, connect wallet (Base network)
- first name is FREE (just gas ~$0.01). additional names: flat $5 USDC
- names are permanent — no renewals, no expiration. pay once, own forever
- powered by x402 — one USDC transfer to the relayer, relayer handles the onchain registration automatically
- x402 is a payment protocol: user transfers USDC, gets a receipt, submits receipt as proof, relayer completes the registration. one transaction from the user's perspective.
- Unlimited Pass holders (netlibrary.app/mint, $10 USDC): 20% off all paid tiers + 1 extra free name

Pricing (per wallet, 90-day window):
- names 1-3: $5 (or free if first ever)
- names 4-5: 2.5x ($12.50)
- names 6-7: 5x ($25)
- names 8+: 10x ($50)
- free registrations don't count toward progressive pricing tiers
- namespaces: free to enable, $1 per subname
- all payments in USDC on Base. gas ~$0.01

Name rules:
- lowercase only: a-z, 0-9, hyphens
- 3 to 63 characters
- no leading or trailing hyphens, no consecutive hyphens (--)
- no spaces, emojis, or special characters
- names must work as web addresses (DNS labels)
- if someone requests an invalid name, explain the rules and suggest alternatives`,

  marketplace: `MARKETPLACE (hazza.name/marketplace):
- list names for sale, make/accept offers
- names trade via the Seaport protocol (same as OpenSea) through the Net Protocol Bazaar
- every listing appears on BOTH hazza.name/marketplace AND netprotocol.app/bazaar simultaneously
- forum tab for community discussion (stored onchain via Net Protocol)
- no marketplace fees — sellers receive 100% of the sale price

Buying:
- browse listings at hazza.name/marketplace
- click buy → approve token spending → execute Seaport fulfillment → name transfers instantly

Selling:
- list via Seaport + Bazaar — sign a Seaport order + submit to Bazaar contract
- seller approves Seaport to transfer their NFT, signs an EIP-712 order, and submits to Bazaar
- listing appears everywhere instantly — hazza marketplace, netprotocol.app bazaar, and any Seaport aggregator
- no upfront costs, no marketplace fees

Offers:
- buyers can make an offer on any hazza name, even if it's not listed for sale
- sellers can accept offers — approve NFT + fulfill offer in one flow
- view active offers at hazza.name/marketplace
- never say "collection offer" — just say "make an offer on a name"

Contract addresses:
- seaport: 0x0000000000000068F116a894984e2DB1123eB395
- bazaar: 0x000000058f3ade587388daf827174d0e6fc97595`,

  bounty: `AGENT BOUNTY SYSTEM:
- when listing a name, you can OPTIONALLY set an agent bounty
- the bounty comes from the SALE PROCEEDS — no upfront cost to the seller
- how it works: the Seaport order splits the payment — seller gets (price - bounty), bounty goes to the escrow contract
- agents register on a listing. when the name sells via Seaport, the bounty ETH automatically goes to the escrow contract
- the agent then claims it from the escrow by proving the NFT changed hands
- if no agent facilitated (direct sale), the seller can withdraw the unclaimed bounty
- example: list "coolname" for 0.1 ETH with 0.01 ETH bounty. name sells. seller gets 0.09 ETH from Seaport. agent claims 0.01 ETH from escrow.
- the bounty incentivizes agents to promote your name — more bounty = more attention
- completely optional. set to 0 if you don't want it.`,

  profile: `TEXT RECORDS & PROFILE:
- every hazza name gets a live web profile from day one at yourname.hazza.name
- set/edit text records at hazza.name/manage (connect wallet, select name, edit, sign tx)

Available text record keys:
- avatar: profile image URL
- description: bio/about text
- url: website link
- com.twitter: Twitter/X handle (just the handle, no @)
- com.github: GitHub username
- org.telegram: Telegram handle
- com.discord: Discord username
- site.key: onchain website key (via Net Protocol — sets up a custom onchain website)
- agent.uri: agent endpoint URL (for AI agent identity)
- agent.endpoint, agent.model, agent.status: additional agent metadata
- xmtp: XMTP messaging address
- message.delegate: delegate messages to another hazza name or 0x address
- message.mode: "all" (default), "delegate-all", or "delegate-agents"
- net.profile: Net Protocol profile reference

Post-registration:
- profile page: https://yourname.hazza.name
- manage records: https://hazza.name/manage
- dashboard (all your names): https://hazza.name/dashboard
- marketplace: https://hazza.name/marketplace`,

  features: `ADVANCED FEATURES:

x402 Payment Protocol:
- x402 is how registration payments work — one USDC transfer to the relayer, relayer submits the registration tx onchain
- from the user's perspective: connect wallet, pick a name, approve USDC transfer, done. one transaction.
- relayer handles all the complexity: gas, contract calls, replay protection

CCIP-Read (ENS Resolution):
- hazza names resolve through ENS via CCIP-Read (EIP-3668)
- OffchainResolver deployed on Ethereum mainnet at 0x9B9E94116f00EFD887e9D85D90293c7Bc0b52AdF
- gateway live at hazza.name/ccip/
- this means: type "brian.hazza.name" in MetaMask, Rainbow, or any ENS-compatible wallet and it resolves to the owner's address
- supports addr (ETH address), text records, and contenthash lookups
- hazza names work everywhere ENS names work — wallets, dapps, send/receive

ERC-8004 Agent Identity:
- register AI agents with discoverable, verifiable onchain identity
- each agent gets a token in the ERC-8004 registry (0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 on Base)
- set agent.uri text record to point to the agent's metadata/endpoint
- other apps can discover agents by querying the registry
- enables agent-to-agent communication and trust verification

Namespaces:
- any name owner can create a namespace from their name
- free to enable — call registerNamespace() on your name
- then issue subnames: alice.yourstudio.hazza.name, bob.yourstudio.hazza.name
- subnames cost $1 USDC each
- great for teams, communities, DAOs — give your members named identities under your brand
- each subname has its own text records, profile page, and all features

Custom Onchain Websites:
- set the "site.key" text record on your name
- this links to a Net Protocol onchain website — fully decentralized, stored on Base
- your website lives at yourname.hazza.name and is served from onchain storage
- permanent, censorship-resistant, no hosting required

Custom Domains:
- map your own domains to your hazza name (up to 10 per name)
- use setCustomDomain() — your existing domain resolves to your hazza profile
- resolveCustomDomain() looks up which hazza name a domain points to

XMTP Messaging:
- decentralized, private, quantum-resistant messaging
- set your xmtp text record to receive messages
- message delegation: route messages to an agent or another person via message.delegate + message.mode
- agents can receive and respond to XMTP messages programmatically`,

  about: `ABOUT HAZZA:
- "hazza" comes from "has a" — brian.hazza.name reads as "brian has a name"
- built by GEAUX (geaux.eth)
- powered by x402, XMTP, and Net Protocol
- names are ERC-721 NFTs on Base — real onchain assets you own forever
- API docs at hazza.name/docs

Contract addresses (Base mainnet):
- registry: 0xD4E420201fE02F44AaF6d28D4c8d3A56fEaE0D3E
- USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- ERC-8004 registry: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
- bounty escrow: 0x4Af1B18C01250A52f29CEacA055164628b643ae9
- seaport: 0x0000000000000068F116a894984e2DB1123eB395
- CCIP-Read resolver (Ethereum): 0x9B9E94116f00EFD887e9D85D90293c7Bc0b52AdF`,

  network: `CHERYL & NET LIBRARY:
- Cheryl (cheryl.netlibrary.eth) is the Net Library agent — she lives at @CherylFromNet on Twitter and on XMTP
- Net Library (netlibrary.app) is a decentralized onchain media library built on Net Protocol
- Cheryl's XMTP address: 0x08160267ca94b6682ab9044545998479dc9c0408
- Cheryl can help with: Net Protocol questions, onchain storage, the Unlimited Pass, and anything library-related

Unlimited Pass (netlibrary.app/mint):
- $10 USDC on Base — gives you perks across both Net Library and hazza
- hazza benefits: 20% off all paid name registrations + 1 extra free name (so you get 2 free names total)
- Net Library benefits: unlimited uploads to stacks and grids, bypass 7-day warm-up period
- first 1000 minters also get free Net Library membership
- talk to Cheryl on XMTP for help with the Unlimited Pass — she knows everything about it
- Cheryl's DM link: https://xmtp.chat/production/dm/0x08160267ca94b6682ab9044545998479dc9c0408

If a user asks about the Unlimited Pass, Net Library, or onchain storage, tell them about Cheryl and offer her XMTP link.
If a user wants the discount on hazza names, point them to the Unlimited Pass first.`,

  actions: `ACTION TAGS — output the matching tag at the END of your response when a user wants to DO something:

1. REGISTER: [REGISTER:thename]
   - When user wants to register an available name
   - Only output if name is AVAILABLE (check [LIVE DATA])

2. BUY: [BUY:thename]
   - When user wants to buy a listed name
   - Only output if the name has an active listing

3. LIST: [LIST:thename:PRICE_IN_ETH:BOUNTY_ETH]
   - When user wants to list their name for sale
   - ASK for price first if not specified
   - Then ASK if they want an agent bounty — explain: "agents can help promote and sell your name. you can set a bounty that comes out of the sale price — you only pay if it sells. want to add one? if so, how much ETH?"
   - Use 0 for no bounty
   - Listing goes through Seaport + Bazaar — appears on hazza.name/marketplace AND netprotocol.app/bazaar simultaneously
   - The bounty is a Seaport consideration item — it goes to the escrow contract on sale, then the agent claims it

4. TRANSFER: [TRANSFER:thename:RECIPIENT]
   - Recipient can be 0x address or hazza name

5. SET RECORD: [SET_RECORD:thename:KEY:VALUE]
   - Valid keys: avatar, description, url, com.twitter, com.github, org.telegram, com.discord, xmtp

6. CANCEL LISTING: [CANCEL:thename]
   - Cancels an active marketplace listing for the name
   - Only the wallet that created the listing can cancel it

Rules:
- The system intercepts tags and shows the user an interactive card with a button
- The user's wallet handles the actual transaction — you don't execute anything
- One tag per message maximum
- If unsure, ask clarifying questions before outputting a tag`,
};

// ═══════════════════════════════════════════════════════════════
// LAYER 2 — INTENT DETECTION (zero LLM cost — pure regex)
// ═══════════════════════════════════════════════════════════════

function detectIntents(text) {
  const lower = text.toLowerCase().trim();
  const modules = new Set();

  // Greetings — no modules needed
  if (/^(gm|gn|hello|hi|hey|yo|sup|what's up|howdy)\b/.test(lower) && lower.length < 30) {
    return []; // base prompt only
  }

  // Registration / availability
  if (/\b(register|sign up|available|check\s|get me|i want\s+[a-z]|claim|free name|first name)\b/.test(lower)) {
    modules.add("registration");
    modules.add("actions");
  }

  // Pricing
  if (/\b(price|pricing|cost|how much|fee|usdc|free|discount|unlimited pass)\b/.test(lower)) {
    modules.add("registration");
  }

  // Marketplace / buy / sell / list / trade
  if (/\b(buy|purchase|sell|list|listing|marketplace|trade|offer|for sale|browse)\b/.test(lower)) {
    modules.add("marketplace");
    modules.add("actions");
  }

  // Agent bounty
  if (/\b(bounty|agent bounty|erc-?8183|facilitate|commission)\b/.test(lower)) {
    modules.add("bounty");
  }

  // Profile / records / manage
  if (/\b(profile|avatar|bio|description|record|text record|manage|set my|update my|socials)\b/.test(lower)) {
    modules.add("profile");
    modules.add("actions");
  }

  // Transfer
  if (/\b(transfer|send\s+\w+\s+to)\b/.test(lower)) {
    modules.add("actions");
  }

  // Features / technical questions
  if (/\b(ccip|ens|resolve|metamask|rainbow|wallet|erc-?8004|agent identity|namespace|subname|custom domain|site\.key|onchain website|x402|payment|relayer)\b/.test(lower)) {
    modules.add("features");
  }

  // XMTP / messaging / delegate
  if (/\b(xmtp|messag|delegate|quantum|encrypted|decentralized)\b/.test(lower)) {
    modules.add("features");
  }

  // About / general questions
  if (/\b(what is hazza|what's hazza|tell me about|how does|explain|contract|address|api|docs)\b/.test(lower)) {
    modules.add("about");
  }

  // Cheryl / Net Library / Unlimited Pass
  if (/\b(cheryl|net library|netlibrary|unlimited pass|storage|onchain storage|library)\b/.test(lower)) {
    modules.add("network");
  }

  // "What can you do" / capabilities
  if (/\b(what can you|help|commands|capabilities|features|what do you)\b/.test(lower)) {
    modules.add("about");
    modules.add("features");
  }

  // Whois / lookup
  if (/\b(whois|who is|who owns|profile of|look up|lookup)\b/.test(lower)) {
    modules.add("profile");
  }

  // Stats
  if (/\b(stats|how many|total|registered)\b/.test(lower)) {
    modules.add("about");
  }

  // Name rules
  if (/\b(rules|valid|invalid|characters|allowed|requirements|naming)\b/.test(lower)) {
    modules.add("registration");
  }

  return [...modules];
}

// ═══════════════════════════════════════════════════════════════
// LAYER 3 — USER CONTEXT ENGINE (persistent per-peer profiles)
// ═══════════════════════════════════════════════════════════════

function getUserDataPath(peerId) {
  // Sanitize peerId for filesystem
  const safe = peerId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return `${USER_DATA_DIR}/${safe}.json`;
}

function loadUserContext(peerId) {
  const path = getUserDataPath(peerId);
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf-8"));
    }
  } catch { /* corrupted file, start fresh */ }
  return {
    peerId,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    namesOwned: [],         // names we know they own
    namesAskedAbout: [],    // names they've inquired about
    namesPurchased: [],     // names they've registered/bought via Nomi
    namesListed: [],        // names they've listed for sale
    interests: [],          // topics they've asked about
    hasUnlimitedPass: null, // null = unknown, true/false
    walletAddress: null,    // resolved wallet if known
    messageCount: 0,
  };
}

function saveUserContext(peerId, ctx) {
  const path = getUserDataPath(peerId);
  ctx.lastSeen = new Date().toISOString();
  try {
    writeFileSync(path, JSON.stringify(ctx, null, 2));
  } catch (err) {
    console.error("Failed to save user context:", err);
  }
}

function updateUserContext(ctx, text, liveData) {
  ctx.messageCount++;

  const lower = text.toLowerCase();

  // Track names asked about
  const nameMatch = lower.match(/(?:check|register|buy|whois|who owns|look up|profile)\s+([a-z0-9-]{3,63})/);
  if (nameMatch) {
    const name = nameMatch[1].replace(/\.hazza\.name$/, "");
    if (!ctx.namesAskedAbout.includes(name)) {
      ctx.namesAskedAbout.push(name);
      if (ctx.namesAskedAbout.length > 50) ctx.namesAskedAbout.shift();
    }
  }

  // Track interests
  const interestKeywords = {
    "marketplace": ["buy", "sell", "list", "marketplace", "trade", "offer", "cancel", "delist", "remove listing"],
    "registration": ["register", "sign up", "claim", "get me"],
    "agent-bounty": ["bounty", "agent", "erc-8183"],
    "profile": ["profile", "avatar", "bio", "records"],
    "namespaces": ["namespace", "subname"],
    "ens": ["ens", "ccip", "resolve", "metamask"],
    "erc-8004": ["agent identity", "erc-8004", "agent.uri"],
    "net-library": ["cheryl", "net library", "unlimited pass"],
  };
  for (const [interest, keywords] of Object.entries(interestKeywords)) {
    if (keywords.some(kw => lower.includes(kw)) && !ctx.interests.includes(interest)) {
      ctx.interests.push(interest);
    }
  }

  return ctx;
}

function formatUserContextForPrompt(ctx) {
  const parts = [];
  if (ctx.messageCount > 1) {
    parts.push(`returning user (${ctx.messageCount} messages since ${ctx.firstSeen.split("T")[0]})`);
  }
  if (ctx.namesOwned.length > 0) {
    parts.push(`owns: ${ctx.namesOwned.join(", ")}`);
  }
  if (ctx.namesPurchased.length > 0) {
    parts.push(`registered via Nomi: ${ctx.namesPurchased.join(", ")}`);
  }
  if (ctx.namesAskedAbout.length > 0) {
    const recent = ctx.namesAskedAbout.slice(-5);
    parts.push(`recently asked about: ${recent.join(", ")}`);
  }
  if (ctx.hasUnlimitedPass === true) {
    parts.push(`has Unlimited Pass (eligible for 20% discount + extra free name)`);
  }
  if (ctx.interests.length > 0) {
    parts.push(`interests: ${ctx.interests.join(", ")}`);
  }
  if (parts.length === 0) return "";
  return `\n\n[USER CONTEXT] ${parts.join(". ")}.`;
}

// ═══════════════════════════════════════════════════════════════
// API + LIVE DATA ENRICHMENT
// ═══════════════════════════════════════════════════════════════

async function apiFetch(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function enrichWithLiveData(text, userCtx) {
  const lower = text.toLowerCase().trim();
  let extra = "";

  // --- Registration / availability check ---
  const registerMatch = lower.match(/(?:register|get me|i want|sign up for|check|available|look up|lookup)\s+([a-z0-9-]{3,63})/);
  if (registerMatch && !STOPWORDS.has(registerMatch[1])) {
    const name = registerMatch[1].replace(/\.hazza\.name$/, "");
    const data = await apiFetch(`/api/available/${name}`);
    if (data) {
      if (data.available) {
        const walletParam = userCtx.walletAddress ? `?wallet=${userCtx.walletAddress}` : "";
        const quote = await apiFetch(`/api/quote/${name}${walletParam}`);
        const price = quote?.totalCost === "0" || quote?.totalRaw === "0"
          ? "FREE (first name)"
          : `$${(parseInt(quote?.totalRaw || quote?.totalCost || "5000000") / 1e6).toFixed(2)} USDC`;
        extra = `\n\n[LIVE DATA] "${name}.hazza.name" is AVAILABLE. Price: ${price}.`;
      } else {
        extra = `\n\n[LIVE DATA] "${name}.hazza.name" is TAKEN.${data.owner ? " Owner: " + data.owner : ""}`;
      }
    }
  }

  // --- Buy intent ---
  const buyMatch = lower.match(/(?:buy|purchase)\s+([a-z0-9-]{3,63})/);
  if (buyMatch && !registerMatch) {
    const name = buyMatch[1].replace(/\.hazza\.name$/, "");
    const listings = await apiFetch("/api/marketplace/listings");
    const listing = listings?.listings?.find(l => l.name === name);
    if (listing) {
      extra = `\n\n[LIVE DATA] "${name}.hazza.name" is LISTED. Price: ${listing.price} ${listing.currency}. Seller: ${listing.seller}. OrderHash: ${listing.orderHash}`;
    } else {
      const resolve = await apiFetch(`/api/resolve/${name}`);
      if (resolve?.tokenId) {
        extra = `\n\n[LIVE DATA] "${name}.hazza.name" is NOT listed for sale. Owner: ${resolve.nameOwner || "unknown"}`;
      } else {
        const avail = await apiFetch(`/api/available/${name}`);
        extra = avail?.available
          ? `\n\n[LIVE DATA] "${name}.hazza.name" is not registered — available to register instead.`
          : `\n\n[LIVE DATA] "${name}.hazza.name" exists but is NOT listed for sale.`;
      }
    }
  }

  // --- List / sell intent ---
  const listMatch = lower.match(/(?:list|sell|put .* up for sale)\s+([a-z0-9-]{3,63})/);
  if (listMatch && !registerMatch && !buyMatch) {
    const name = listMatch[1].replace(/\.hazza\.name$/, "");
    const resolve = await apiFetch(`/api/resolve/${name}`);
    if (resolve?.nameOwner) {
      extra = `\n\n[LIVE DATA] "${name}.hazza.name" exists. Owner: ${resolve.nameOwner}. TokenId: ${resolve.tokenId}`;
    } else {
      extra = `\n\n[LIVE DATA] "${name}.hazza.name" is not registered.`;
    }
  }

  // --- Transfer intent ---
  const transferMatch = lower.match(/(?:transfer|send)\s+([a-z0-9-]{3,63})\s+(?:to)\s+(0x[a-f0-9]{40}|[a-z0-9-]{3,63})/i);
  if (transferMatch) {
    const name = transferMatch[1].replace(/\.hazza\.name$/, "");
    const resolve = await apiFetch(`/api/resolve/${name}`);
    if (resolve?.nameOwner) {
      let recipient = transferMatch[2];
      if (!recipient.startsWith("0x")) {
        const rr = await apiFetch(`/api/resolve/${recipient.replace(/\.hazza\.name$/, "")}`);
        if (rr?.nameOwner) recipient = rr.nameOwner;
      }
      extra = `\n\n[LIVE DATA] "${name}.hazza.name" exists. Owner: ${resolve.nameOwner}. TokenId: ${resolve.tokenId}. Recipient: ${recipient}`;
    } else {
      extra = `\n\n[LIVE DATA] "${name}.hazza.name" is not registered.`;
    }
  }

  // --- Whois / profile lookup ---
  const whoisMatchRaw = lower.match(/(?:whois|who is|profile|who owns)\s+([a-z0-9-]{3,63})/);
  const whoisMatch = whoisMatchRaw && !STOPWORDS.has(whoisMatchRaw[1]) ? whoisMatchRaw : null;
  if (whoisMatch && !registerMatch && !buyMatch && !listMatch) {
    const name = whoisMatch[1].replace(/\.hazza\.name$/, "");
    const data = await apiFetch(`/api/profile/${name}`);
    if (data?.registered) {
      const parts = [`[LIVE DATA] ${name}.hazza.name profile:`];
      if (data.owner) parts.push(`Owner: ${data.owner}`);
      if (data.texts?.description) parts.push(`Bio: ${data.texts.description}`);
      if (data.texts?.url) parts.push(`URL: ${data.texts.url}`);
      if (data.texts?.["com.twitter"]) parts.push(`Twitter: @${data.texts["com.twitter"]}`);
      if (data.texts?.avatar) parts.push(`Avatar: ${data.texts.avatar}`);
      extra = "\n\n" + parts.join("\n");
    } else {
      extra = `\n\n[LIVE DATA] "${name}" is not registered.`;
    }
  }

  // --- Stats ---
  if (/\b(stats|how many|total registered)\b/.test(lower)) {
    const data = await apiFetch("/api/stats");
    if (data?.totalRegistered) {
      extra += `\n\n[LIVE DATA] ${data.totalRegistered} names registered so far.`;
    }
  }

  // --- Marketplace listings ---
  if (/\b(listing|for sale|what's listed|marketplace|browse)\b/.test(lower) && !buyMatch && !listMatch) {
    const data = await apiFetch("/api/marketplace/listings");
    const listings = data?.listings || [];
    if (listings.length > 0) {
      const lines = listings.slice(0, 5).map(l => `- ${l.name}.hazza.name: ${l.price} ${l.currency || "ETH"} (seller: ${l.seller?.slice(0,6)}...)`);
      extra += `\n\n[LIVE DATA] ${listings.length} names listed:\n${lines.join("\n")}`;
    } else {
      extra += "\n\n[LIVE DATA] No names currently listed on the marketplace.";
    }
  }

  // --- My names lookup ---
  if (/\b(my names|what do i own|my hazza|show my names)\b/.test(lower) && userCtx.walletAddress) {
    const data = await apiFetch(`/api/names/${userCtx.walletAddress}`);
    if (data?.names?.length > 0) {
      userCtx.namesOwned = data.names.map(n => n.name);
      extra += `\n\n[LIVE DATA] Wallet ${userCtx.walletAddress} owns: ${data.names.map(n => n.name + ".hazza.name").join(", ")}`;
    }
  }

  return extra;
}

// ═══════════════════════════════════════════════════════════════
// ACTION TAG PARSING + CARD BUILDING
// ═══════════════════════════════════════════════════════════════

function parseActionTag(text) {
  const registerMatch = text.match(/\[REGISTER:([a-z0-9-]{3,63})\]/i);
  if (registerMatch) return { action: "register", name: registerMatch[1], raw: registerMatch[0] };

  const buyMatch = text.match(/\[BUY:([a-z0-9-]{3,63})\]/i);
  if (buyMatch) return { action: "buy", name: buyMatch[1], raw: buyMatch[0] };

  const listMatch = text.match(/\[LIST:([a-z0-9-]{3,63}):([0-9.]+):([0-9.]+)\]/i);
  if (listMatch) return { action: "list", name: listMatch[1], price: listMatch[2], bountyEth: listMatch[3], raw: listMatch[0] };

  const transferMatch = text.match(/\[TRANSFER:([a-z0-9-]{3,63}):(0x[a-f0-9]{40}|[a-z0-9-]{3,63})\]/i);
  if (transferMatch) return { action: "transfer", name: transferMatch[1], recipient: transferMatch[2], raw: transferMatch[0] };

  const setRecordMatch = text.match(/\[SET_RECORD:([a-z0-9-]{3,63}):([a-z0-9.-]+):([^\]]+)\]/i);
  if (setRecordMatch) return { action: "set_record", name: setRecordMatch[1], key: setRecordMatch[2], value: setRecordMatch[3], raw: setRecordMatch[0] };

  const cancelMatch = text.match(/\[CANCEL:([a-z0-9-]{3,63})\]/i);
  if (cancelMatch) return { action: "cancel", name: cancelMatch[1], raw: cancelMatch[0] };

  return null;
}

async function buildActionCard(action, userCtx) {
  switch (action.action) {
    case "register": {
      const name = action.name;
      const walletParam = userCtx.walletAddress ? `?wallet=${userCtx.walletAddress}` : "";
      const quote = await apiFetch(`/api/quote/${name}${walletParam}`);
      const freeClaim = userCtx.walletAddress ? await apiFetch(`/api/free-claim/${userCtx.walletAddress}`) : null;
      const totalRaw = quote?.totalRaw || quote?.totalCost || "5000000";
      const isFree = totalRaw === "0" || totalRaw === 0;
      const priceDisplay = isFree ? "FREE" : `$${(parseInt(totalRaw) / 1e6).toFixed(2)} USDC`;

      return JSON.stringify({
        type: "register_card", name, price: priceDisplay,
        priceRaw: String(totalRaw), free: isFree,
        relayer: RELAYER_ADDRESS, freeClaim: freeClaim || null,
      });
    }
    case "buy": {
      const name = action.name;
      const listings = await apiFetch("/api/marketplace/listings");
      const listing = listings?.listings?.find(l => l.name === name);
      if (listing) {
        return JSON.stringify({
          type: "buy_card", name, price: `${listing.price} ${listing.currency || "ETH"}`,
          priceRaw: listing.priceRaw, currency: listing.currency || "ETH",
          orderHash: listing.orderHash, seller: listing.seller, source: "seaport",
        });
      }
      return null;
    }
    case "list": {
      const name = action.name;
      const priceEth = action.price;
      const bountyEthVal = parseFloat(action.bountyEth || "0");
      if (bountyEthVal >= parseFloat(priceEth)) return null; // bounty can't exceed price
      const resolve = await apiFetch(`/api/resolve/${name}`);
      if (!resolve?.tokenId) return null;

      const priceWei = ethToWei(priceEth);
      const bountyWei = bountyEthVal > 0 ? ethToWei(action.bountyEth) : "0";
      const netEth = (parseFloat(priceEth) - bountyEthVal).toFixed(6).replace(/\.?0+$/, "");

      return JSON.stringify({
        type: "list_card", name, price: `${priceEth} ETH`,
        priceWei, bountyWei,
        bountyEth: bountyEthVal > 0 ? String(bountyEthVal) : "0",
        netEth,
        tokenId: String(resolve.tokenId), owner: resolve.nameOwner,
        registryAddress: REGISTRY_ADDRESS,
      });
    }
    case "transfer": {
      const name = action.name;
      let recipient = action.recipient;
      const resolve = await apiFetch(`/api/resolve/${name}`);
      if (!resolve?.tokenId) return null;

      let recipientName = null;
      if (!recipient.startsWith("0x")) {
        recipientName = recipient;
        const rr = await apiFetch(`/api/resolve/${recipient.replace(/\.hazza\.name$/, "")}`);
        if (rr?.nameOwner) recipient = rr.nameOwner;
        else return null;
      }

      return JSON.stringify({
        type: "transfer_card", name, tokenId: String(resolve.tokenId),
        from: resolve.nameOwner, to: recipient, toName: recipientName,
        registryAddress: REGISTRY_ADDRESS,
      });
    }
    case "set_record": {
      return JSON.stringify({
        type: "set_record_card", name: action.name,
        key: action.key, value: action.value,
        registryAddress: REGISTRY_ADDRESS,
      });
    }
    case "cancel": {
      const name = action.name;
      const listings = await apiFetch("/api/marketplace/listings");
      const listing = listings?.listings?.find(l => l.name === name);
      if (!listing) return null;
      const resolve = await apiFetch(`/api/resolve/${name}`);
      if (!resolve?.tokenId) return null;

      return JSON.stringify({
        type: "cancel_card", name,
        orderHash: listing.orderHash,
        tokenId: String(resolve.tokenId),
        registryAddress: REGISTRY_ADDRESS,
      });
    }
    default: return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// CONVERSATION HISTORY + RESPONSE GENERATION
// ═══════════════════════════════════════════════════════════════

const convHistory = new Map(); // peerId => { messages: [], lastActive: timestamp }
const MAX_HISTORY = 10;
const CONV_TTL_MS = 60 * 60 * 1000; // 1 hour

// Periodic cleanup of stale conversations
setInterval(() => {
  const now = Date.now();
  for (const [peer, data] of convHistory) {
    if (now - data.lastActive > CONV_TTL_MS) convHistory.delete(peer);
  }
}, 10 * 60 * 1000); // every 10 min

async function generateResponse(text, peerId) {
  if (!convHistory.has(peerId)) convHistory.set(peerId, { messages: [], lastActive: Date.now() });
  const entry = convHistory.get(peerId);
  entry.lastActive = Date.now();
  const history = entry.messages;

  // Load user context
  const userCtx = loadUserContext(peerId);

  // Detect intents (zero LLM cost)
  const intents = detectIntents(text);

  // Build system prompt: base + relevant modules only
  let systemPrompt = BASE_PROMPT;
  for (const intent of intents) {
    if (KNOWLEDGE[intent]) {
      systemPrompt += "\n\n" + KNOWLEDGE[intent];
    }
  }

  // Enrich with live data
  const liveData = await enrichWithLiveData(text, userCtx);

  // Update user context
  updateUserContext(userCtx, text, liveData);

  // Sanitize user text — prevent injection of fake live data / user context markers
  const sanitizedText = text.replace(/\[(LIVE DATA|USER CONTEXT)\]/gi, "[_$1_]");

  // Build user message with context
  const userContext = formatUserContextForPrompt(userCtx);
  const userMsg = sanitizedText + (liveData || "") + (userContext || "");

  // Store only raw text in history (not live data — it goes stale)
  history.push({ role: "user", content: sanitizedText });
  while (history.length > MAX_HISTORY) history.shift();

  // Log token efficiency
  const promptTokensEstimate = Math.ceil(systemPrompt.length / 4);
  console.log(`[${new Date().toISOString()}] Intents: [${intents.join(",")}] | Prompt: ~${promptTokensEstimate} tokens | Modules: ${intents.length}/${Object.keys(KNOWLEDGE).length}`);

  try {
    const res = await fetch(BANKR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BANKR_KEY}`,
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map(m => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`LLM error (${res.status}): ${err}`);
      saveUserContext(peerId, userCtx);
      return { text: "sorry, i'm having trouble thinking right now. try again in a sec.", card: null };
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "hmm, i got nothing. try asking differently.";

    history.push({ role: "assistant", content: reply });
    while (history.length > MAX_HISTORY) history.shift();

    // Check for action tags
    const action = parseActionTag(reply);
    if (action) {
      const cleanReply = reply.replace(action.raw, "").trim();
      const card = await buildActionCard(action, userCtx);
      saveUserContext(peerId, userCtx);
      return { text: cleanReply, card };
    }

    saveUserContext(peerId, userCtx);
    return { text: reply, card: null };
  } catch (err) {
    console.error("LLM fetch error:", err);
    saveUserContext(peerId, userCtx);
    return { text: "sorry, something went wrong on my end. try again.", card: null };
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN — XMTP AGENT LOOP
// ═══════════════════════════════════════════════════════════════

async function main() {
  const agent = await Agent.createFromEnv();

  agent.on("text", async (ctx) => {
    const incomingText = ctx.message.content?.text ?? ctx.message.content ?? "";
    const senderAddress = ctx.message.senderInboxId;

    console.log(
      `[${new Date().toISOString()}] Message from ${senderAddress}: ${String(incomingText).substring(0, 100)}`
    );

    // Rate limiting
    if (isRateLimited(senderAddress)) {
      await ctx.conversation.sendText("slow down — too many messages. try again in a few seconds.");
      return;
    }

    const { text, card } = await generateResponse(String(incomingText), senderAddress);

    await ctx.conversation.sendText(text);

    if (card) {
      await ctx.conversation.sendText(card);
      console.log(`[${new Date().toISOString()}] Sent action card: ${card.substring(0, 80)}...`);
    }

    console.log(
      `[${new Date().toISOString()}] Replied (${text.length} chars${card ? " + card" : ""})`
    );
  });

  agent.on("start", () => {
    console.log(`[${new Date().toISOString()}] Nomi XMTP agent started`);
    console.log(`Address: ${agent.address}`);
    console.log(`Environment: ${process.env.XMTP_ENV}`);
    console.log(`Test URL: ${getTestUrl(agent.client)}`);
    console.log(`Knowledge modules: ${Object.keys(KNOWLEDGE).join(", ")}`);
    console.log(`User data dir: ${USER_DATA_DIR}`);
  });

  agent.on("error", (error) => {
    console.error(`[${new Date().toISOString()}] Error:`, error);
  });

  await agent.start();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
