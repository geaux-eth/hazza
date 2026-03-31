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
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are Nomi, the hazza.name agent. You're a gnome with a blue hat and red bandana. You live onchain on Base.

Personality: friendly, concise, helpful. You speak in lowercase. Genuinely helpful and a little witty. No emojis.

Your name: nomi.hazza.name
Your XMTP address: 0x55b251e202938e562e7384bd998215885b80162e

hazza.name is an onchain name registry on Base. "hazza" comes from "has a" — brian.hazza.name reads as "brian has a name". Built by GEAUX (geaux.eth). Powered by x402, XMTP, and Net Protocol.

IMPORTANT: Never say "has a hazza name" — it reads as "has a has a name". Use the wordplay naturally: "brian hazza name" or "you hazza name". When referring to names generically, say "registered on hazza" or "a name on hazza" instead.

Rules:
- Keep responses SHORT — 2-5 sentences for simple questions, longer only when explaining a process
- The chat UI already shows a "gm. i'm nomi. what's up?" greeting bubble when the user connects. That counts as YOUR gm. Do NOT say gm again. If someone says "gm" to you, just respond naturally without repeating gm — you already said it. Never double-gm.
- Never make up information — use your tools to look things up
- You ARE messaging via XMTP right now — never tell people to "go to XMTP"
- When a name is AVAILABLE, ALWAYS output the [REGISTER:thename] action tag at the END of your response so the user can register right here in the chat
- When a name is taken, just say it's taken and who owns it
- Never say "i can point you toward the right place" — just DO the thing or answer directly
- Keep it casual and direct. Talk like a friend who knows everything about hazza
- For marketplace browsing or docs, link to https://hazza.name/marketplace or https://hazza.name/docs
- The name will ALWAYS be registered to the user's real Ethereum wallet (resolved from XMTP), NOT their XMTP address

Key facts:
- Names are ERC-721 NFTs on Base — real onchain assets you own forever
- First name is FREE (just gas). Additional names $5 flat. Unlimited Pass holders get 20% off ($4)
- Progressive anti-squat pricing: 3+ names in 90 days = 2.5x, 5+ = 5x, 7+ = 10x
- Unlimited Pass ($10 USDC at netlibrary.app/mint) gives 20% off all registrations forever + 1 extra free name
- Marketplace uses Seaport (same as OpenSea). Listings are in WETH.
- Text records: avatar, description, url, com.twitter, com.github, org.telegram, com.discord, xmtp, message.delegate, message.mode, net.profile, site.key, agent.uri
- CCIP-Read resolver works with MetaMask, Rainbow, etc. on Ethereum mainnet
- Custom domains: use setCustomDomain() — your domain resolves to your hazza profile
- API docs at hazza.name/docs
- Contracts: Registry ${REGISTRY_ADDRESS}, CCIP Resolver 0x9B9E94116f00EFD887e9D85D90293c7Bc0b52AdF
- Cheryl (cheryl.netlibrary.eth) is the Net Library agent on XMTP: 0x08160267ca94b6682ab9044545998479dc9c0408

Action tags — output at the END of your response when the user wants to DO something:
1. [REGISTER:thename] — register an available name
2. [BUY:thename] — buy a listed name
3. [LIST:thename:priceInEth:bountyInEth] — list a name for sale (bounty 0 if none)
4. [TRANSFER:thename:recipientAddressOrName] — transfer a name
5. [SET_RECORD:thename:KEY:VALUE] — set a text record
6. [CANCEL:thename] — cancel a marketplace listing`;

// ═══════════════════════════════════════════════════════════════
// TOOLS — the LLM calls these to get live data
// ═══════════════════════════════════════════════════════════════

const TOOLS = [
  {
    type: "function",
    function: {
      name: "check_name",
      description: "Check if a hazza name is available for registration, or look up who owns it",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "The name to check (without .hazza.name)" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_quote",
      description: "Get the registration price for a name based on the user's wallet (accounts for discounts, free first name, etc)",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "The name to quote" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_profile",
      description: "Get a registered name's profile — owner, text records (bio, avatar, socials, etc)",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "The name to look up" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_listings",
      description: "Browse the marketplace — see what names are listed for sale",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_names",
      description: "Look up what names the current user owns (requires connected wallet)",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stats",
      description: "Get registry stats — total names registered, etc",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

async function apiFetch(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function executeTool(toolName, args, userCtx) {
  switch (toolName) {
    case "check_name": {
      const name = args.name?.toLowerCase().replace(/\.hazza\.name$/, "").replace(/[^a-z0-9-]/g, "");
      if (!name || name.length < 1) return JSON.stringify({ error: "invalid name" });
      const data = await apiFetch(`/api/available/${name}`);
      if (!data) return JSON.stringify({ error: "API unavailable" });
      if (data.available) {
        return JSON.stringify({ name, available: true });
      } else {
        const resolve = await apiFetch(`/api/resolve/${name}`);
        return JSON.stringify({ name, available: false, owner: resolve?.nameOwner || data.owner || "unknown" });
      }
    }
    case "get_quote": {
      const name = args.name?.toLowerCase().replace(/\.hazza\.name$/, "").replace(/[^a-z0-9-]/g, "");
      if (!name) return JSON.stringify({ error: "invalid name" });
      let url = `/api/quote/${name}`;
      const qp = [];
      if (userCtx.walletAddress) qp.push(`wallet=${userCtx.walletAddress}`);
      if (userCtx.hasUnlimitedPass) qp.push("verifiedPass=true");
      if (qp.length) url += "?" + qp.join("&");
      const quote = await apiFetch(url);
      if (!quote) return JSON.stringify({ error: "API unavailable" });
      const isFree = quote.totalRaw === "0" || quote.totalCost === "0";
      return JSON.stringify({
        name,
        price: isFree ? "FREE (first name — just gas)" : `$${(parseInt(quote.totalRaw || quote.totalCost || "5000000") / 1e6).toFixed(2)} USDC`,
        isFree,
        hasUnlimitedPass: userCtx.hasUnlimitedPass || false,
      });
    }
    case "get_profile": {
      const name = args.name?.toLowerCase().replace(/\.hazza\.name$/, "").replace(/[^a-z0-9-]/g, "");
      if (!name) return JSON.stringify({ error: "invalid name" });
      const data = await apiFetch(`/api/profile/${name}`);
      if (!data?.registered) return JSON.stringify({ name, registered: false });
      return JSON.stringify({
        name, registered: true, owner: data.owner,
        records: data.texts || {},
      });
    }
    case "get_listings": {
      const data = await apiFetch("/api/marketplace/listings");
      const listings = data?.listings || [];
      if (listings.length === 0) return JSON.stringify({ count: 0, listings: [] });
      return JSON.stringify({
        count: listings.length,
        listings: listings.slice(0, 10).map(l => ({
          name: l.name, price: l.price, currency: l.currency || "ETH",
          seller: l.seller?.slice(0, 6) + "..." + l.seller?.slice(-4),
        })),
      });
    }
    case "get_my_names": {
      if (!userCtx.walletAddress) return JSON.stringify({ error: "no wallet connected" });
      const data = await apiFetch(`/api/names/${userCtx.walletAddress}`);
      const names = data?.names || [];
      userCtx.namesOwned = names.map(n => n.name);
      return JSON.stringify({ count: names.length, names: names.map(n => ({ name: n.name, tokenId: n.tokenId })) });
    }
    case "get_stats": {
      const data = await apiFetch("/api/stats");
      if (!data) return JSON.stringify({ error: "API unavailable" });
      return JSON.stringify(data);
    }
    default:
      return JSON.stringify({ error: "unknown tool" });
  }
}

// ═══════════════════════════════════════════════════════════════
// USER CONTEXT (persistent per-peer profiles)
// ═══════════════════════════════════════════════════════════════

function getUserDataPath(peerId) {
  const safe = peerId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return `${USER_DATA_DIR}/${safe}.json`;
}

function loadUserContext(peerId) {
  const path = getUserDataPath(peerId);
  try {
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf-8"));
  } catch { /* corrupted */ }
  return {
    peerId, firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(),
    namesOwned: [], hasUnlimitedPass: null, walletAddress: null, messageCount: 0,
  };
}

function saveUserContext(peerId, ctx) {
  ctx.lastSeen = new Date().toISOString();
  try { writeFileSync(getUserDataPath(peerId), JSON.stringify(ctx, null, 2)); } catch { /* */ }
}

// ═══════════════════════════════════════════════════════════════
// ACTION TAG PARSING + CARD BUILDING
// ═══════════════════════════════════════════════════════════════

function parseActionTag(text) {
  const registerMatch = text.match(/\[REGISTER:([a-z0-9-]{1,63})\]/i);
  if (registerMatch) return { action: "register", name: registerMatch[1], raw: registerMatch[0] };

  const buyMatch = text.match(/\[BUY:([a-z0-9-]{1,63})\]/i);
  if (buyMatch) return { action: "buy", name: buyMatch[1], raw: buyMatch[0] };

  const listMatch = text.match(/\[LIST:([a-z0-9-]{1,63}):([0-9.]+):([0-9.]+)\]/i);
  if (listMatch) return { action: "list", name: listMatch[1], price: listMatch[2], bountyEth: listMatch[3], raw: listMatch[0] };

  const transferMatch = text.match(/\[TRANSFER:([a-z0-9-]{1,63}):(0x[a-f0-9]{40}|[a-z0-9-]{1,63})\]/i);
  if (transferMatch) return { action: "transfer", name: transferMatch[1], recipient: transferMatch[2], raw: transferMatch[0] };

  const setRecordMatch = text.match(/\[SET_RECORD:([a-z0-9-]{1,63}):([a-z0-9.-]+):([^\]]+)\]/i);
  if (setRecordMatch) return { action: "set_record", name: setRecordMatch[1], key: setRecordMatch[2], value: setRecordMatch[3], raw: setRecordMatch[0] };

  const cancelMatch = text.match(/\[CANCEL:([a-z0-9-]{1,63})\]/i);
  if (cancelMatch) return { action: "cancel", name: cancelMatch[1], raw: cancelMatch[0] };

  return null;
}

async function buildActionCard(action, userCtx) {
  switch (action.action) {
    case "register": {
      const name = action.name;
      let quoteUrl = `/api/quote/${name}`;
      const qp = [];
      if (userCtx.walletAddress) qp.push(`wallet=${userCtx.walletAddress}`);
      if (userCtx.hasUnlimitedPass) qp.push("verifiedPass=true");
      if (qp.length) quoteUrl += "?" + qp.join("&");
      const quote = await apiFetch(quoteUrl);
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
      const listings = await apiFetch("/api/marketplace/listings");
      const listing = listings?.listings?.find(l => l.name === action.name);
      if (!listing) return null;
      return JSON.stringify({
        type: "buy_card", name: action.name, price: `${listing.price} ${listing.currency || "ETH"}`,
        priceRaw: listing.priceRaw, currency: listing.currency || "ETH",
        orderHash: listing.orderHash, seller: listing.seller, source: "seaport",
      });
    }
    case "list": {
      const priceEth = action.price;
      const bountyEthVal = parseFloat(action.bountyEth || "0");
      if (bountyEthVal >= parseFloat(priceEth)) return null;
      const resolve = await apiFetch(`/api/resolve/${action.name}`);
      if (!resolve?.tokenId) return null;
      const priceWei = ethToWei(priceEth);
      const bountyWei = bountyEthVal > 0 ? ethToWei(action.bountyEth) : "0";
      const netEth = (parseFloat(priceEth) - bountyEthVal).toFixed(6).replace(/\.?0+$/, "");
      return JSON.stringify({
        type: "list_card", name: action.name, price: `${priceEth} ETH`,
        priceWei, bountyWei, bountyEth: bountyEthVal > 0 ? String(bountyEthVal) : "0", netEth,
        tokenId: String(resolve.tokenId), owner: resolve.nameOwner, registryAddress: REGISTRY_ADDRESS,
      });
    }
    case "transfer": {
      let recipient = action.recipient;
      const resolve = await apiFetch(`/api/resolve/${action.name}`);
      if (!resolve?.tokenId) return null;
      let recipientName = null;
      if (!recipient.startsWith("0x")) {
        recipientName = recipient;
        const rr = await apiFetch(`/api/resolve/${recipient.replace(/\.hazza\.name$/, "")}`);
        if (rr?.nameOwner) recipient = rr.nameOwner; else return null;
      }
      return JSON.stringify({
        type: "transfer_card", name: action.name, tokenId: String(resolve.tokenId),
        from: resolve.nameOwner, to: recipient, toName: recipientName, registryAddress: REGISTRY_ADDRESS,
      });
    }
    case "set_record":
      return JSON.stringify({
        type: "set_record_card", name: action.name, key: action.key, value: action.value, registryAddress: REGISTRY_ADDRESS,
      });
    case "cancel": {
      const listings = await apiFetch("/api/marketplace/listings");
      const listing = listings?.listings?.find(l => l.name === action.name);
      if (!listing) return null;
      const resolve = await apiFetch(`/api/resolve/${action.name}`);
      if (!resolve?.tokenId) return null;
      return JSON.stringify({
        type: "cancel_card", name: action.name, orderHash: listing.orderHash,
        tokenId: String(resolve.tokenId), registryAddress: REGISTRY_ADDRESS,
      });
    }
    default: return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// CONVERSATION HISTORY + TOOL-USE RESPONSE GENERATION
// ═══════════════════════════════════════════════════════════════

const convHistory = new Map();
const MAX_HISTORY = 10;
const CONV_TTL_MS = 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [peer, data] of convHistory) {
    if (now - data.lastActive > CONV_TTL_MS) convHistory.delete(peer);
  }
}, 10 * 60 * 1000);

async function generateResponse(text, peerId, senderWallet = null) {
  if (!convHistory.has(peerId)) convHistory.set(peerId, { messages: [], lastActive: Date.now() });
  const entry = convHistory.get(peerId);
  entry.lastActive = Date.now();
  const history = entry.messages;

  const userCtx = loadUserContext(peerId);

  // Auto-resolve wallet from XMTP sender address
  if (senderWallet && !userCtx.walletAddress) {
    userCtx.walletAddress = senderWallet;
    console.log(`[${ts()}] Resolved wallet for ${peerId}: ${senderWallet}`);
  }

  // Fetch wallet pricing on first interaction (for pass detection + pricing context)
  if (userCtx.walletAddress && userCtx.hasUnlimitedPass === null) {
    const pricing = await apiFetch(`/api/wallet-pricing/${userCtx.walletAddress}`);
    if (pricing) {
      userCtx.hasUnlimitedPass = pricing.hasUnlimitedPass === true;
    }
  }

  // Build context note for the LLM
  let contextNote = "";
  if (userCtx.walletAddress) {
    contextNote += `\nUser wallet: ${userCtx.walletAddress}`;
    if (userCtx.hasUnlimitedPass) contextNote += " (has Unlimited Pass — 20% discount)";
    if (userCtx.namesOwned.length > 0) contextNote += `\nOwns: ${userCtx.namesOwned.join(", ")}`;
  }
  if (userCtx.messageCount > 1) contextNote += `\nReturning user (${userCtx.messageCount} messages)`;

  const systemMsg = SYSTEM_PROMPT + (contextNote ? `\n\n--- User Context ---${contextNote}` : "");

  // Add user message to history
  history.push({ role: "user", content: text });
  while (history.length > MAX_HISTORY) history.shift();
  userCtx.messageCount++;

  try {
    // Tool-use loop: LLM can call tools, we execute them, send results back
    let messages = [
      { role: "system", content: systemMsg },
      ...history,
    ];
    let maxRounds = 5;

    while (maxRounds-- > 0) {
      const res = await fetch(BANKR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${BANKR_KEY}` },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 1024,
          tools: TOOLS,
          messages,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error(`LLM error (${res.status}): ${err}`);
        saveUserContext(peerId, userCtx);
        return { text: "sorry, i'm having trouble thinking right now. try again in a sec.", card: null, frameUrl: null };
      }

      const data = await res.json();
      const choice = data.choices?.[0];

      // If the LLM wants to call tools
      if (choice?.finish_reason === "tool_calls" || choice?.message?.tool_calls?.length > 0) {
        const assistantMsg = choice.message;
        messages.push(assistantMsg);

        for (const toolCall of assistantMsg.tool_calls) {
          const args = typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;

          console.log(`[${ts()}] Tool call: ${toolCall.function.name}(${JSON.stringify(args)})`);
          const result = await executeTool(toolCall.function.name, args, userCtx);
          console.log(`[${ts()}] Tool result: ${result.substring(0, 200)}`);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
        continue; // Loop back for LLM to process tool results
      }

      // Final text response
      const reply = choice?.message?.content || "hmm, i got nothing. try asking differently.";

      history.push({ role: "assistant", content: reply });
      while (history.length > MAX_HISTORY) history.shift();

      // Check for action tags
      const action = parseActionTag(reply);
      if (action) {
        let cleanReply = reply.replace(action.raw, "").trim();
        const card = await buildActionCard(action, userCtx);
        // Build frame URL for external XMTP clients
        let frameUrl = null;
        if (action.action === "register") frameUrl = `https://hazza.name/frames/register/${action.name}`;
        // Strip fallback links (on-site users get the card instead)
        if (card) {
          cleanReply = cleanReply
            .replace(/\s*or (register|buy|list|view) at https:\/\/hazza\.name\/\S*/gi, "")
            .trim();
        }
        saveUserContext(peerId, userCtx);
        return { text: cleanReply, card, frameUrl };
      }

      saveUserContext(peerId, userCtx);
      return { text: reply, card: null, frameUrl: null };
    }

    // If we exhausted rounds without a final response
    saveUserContext(peerId, userCtx);
    return { text: "sorry, i got stuck in a loop. try asking again.", card: null, frameUrl: null };

  } catch (err) {
    console.error("LLM fetch error:", err);
    saveUserContext(peerId, userCtx);
    return { text: "sorry, something went wrong on my end. try again.", card: null, frameUrl: null };
  }
}

function ts() { return new Date().toISOString(); }

// ═══════════════════════════════════════════════════════════════
// MAIN — XMTP AGENT LOOP
// ═══════════════════════════════════════════════════════════════

async function main() {
  const agent = await Agent.createFromEnv();

  agent.on("text", async (ctx) => {
    const incomingText = ctx.message.content?.text ?? ctx.message.content ?? "";
    const senderInboxId = ctx.message.senderInboxId;

    // Resolve XMTP inbox ID → Ethereum wallet address
    let senderWallet = null;
    try {
      senderWallet = await ctx.getSenderAddress();
      if (senderWallet) senderWallet = senderWallet.toLowerCase();
    } catch (err) {
      console.warn("Failed to resolve sender address:", err.message);
    }

    console.log(
      `[${ts()}] Message from ${senderInboxId}${senderWallet ? ` (${senderWallet})` : ""}: ${String(incomingText).substring(0, 100)}`
    );

    if (isRateLimited(senderInboxId)) {
      await ctx.conversation.sendText("slow down — too many messages. try again in a few seconds.");
      return;
    }

    const { text, card, frameUrl } = await generateResponse(String(incomingText), senderInboxId, senderWallet);

    await ctx.conversation.sendText(text);

    // Send frame URL — renders as interactive card on hazza.name, interactive frame off-site
    // Only send frame URL (not the JSON card) to avoid duplicate interactive elements
    if (frameUrl) {
      await ctx.conversation.sendText(frameUrl);
      console.log(`[${ts()}] Sent frame: ${frameUrl}`);
    } else if (card) {
      // Fallback: send JSON card only if no frame URL (for actions without frames yet)
      await ctx.conversation.sendText(card);
      console.log(`[${ts()}] Sent action card: ${card.substring(0, 80)}...`);
    }

    console.log(`[${ts()}] Replied (${text.length} chars${frameUrl ? " + frame" : card ? " + card" : ""})`);
  });

  agent.on("start", () => {
    console.log(`[${ts()}] Nomi XMTP agent started (tool-use mode)`);
    console.log(`Address: ${agent.address}`);
    console.log(`Environment: ${process.env.XMTP_ENV}`);
    console.log(`Test URL: ${getTestUrl(agent.client)}`);
  });

  agent.on("error", (error) => {
    console.error(`[${ts()}] Error:`, error);
  });

  await agent.start();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
