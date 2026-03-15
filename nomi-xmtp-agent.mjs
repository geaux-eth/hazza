import "dotenv/config";
import { Agent, getTestUrl } from "@xmtp/agent-sdk";

// ============================================================
// Nomi — the everything-hazza agent
// He can guide users through any and all hazza processes via XMTP
// ============================================================

const NOMI_INTRO = [
  "gm. i'm nomi -- the hazza name agent.",
  "",
  "i can help you with everything hazza:",
  "- search & register names",
  "- pricing & discounts",
  "- text records (avatar, socials, bio, agent endpoint)",
  "- marketplace (list, buy, make offers)",
  "- onchain websites via Net Protocol",
  "- namespaces (create your own .yourname subnames)",
  "- ERC-8004 agent registry",
  "- CLI setup & API access",
  "- transfer & manage names",
  "",
  "hazza.name -- immediately useful.",
  'type "help" for the full menu.',
].join("\n");

const HELP_TEXT = [
  "here's everything i know about:",
  "",
  "-- registration --",
  '"register" -- how to register a name',
  '"check [name]" -- check if a name is available',
  '"first free" -- how the free first name works',
  "",
  "-- pricing --",
  '"pricing" -- full pricing breakdown',
  '"discounts" -- available discounts',
  '"anti-squat" -- how progressive pricing works',
  "",
  "-- profile & records --",
  '"records" -- what text records are & how to set them',
  '"avatar" -- how to set your profile picture',
  '"website" -- how to deploy an onchain website',
  "",
  "-- marketplace --",
  '"marketplace" -- how to buy/sell/trade names',
  '"list" -- how to list a name for sale',
  '"offer" -- how to make an offer on a name',
  "",
  "-- advanced --",
  '"namespace" -- how to create subnames',
  '"agent" -- ERC-8004 agent registration',
  '"api" -- developer API docs',
  '"cli" -- command-line interface',
  '"transfer" -- how to transfer a name',
  '"dns" -- custom domain setup',
  "",
  "-- about --",
  '"about" -- what hazza is',
  '"nomi" -- about me',
  '"contracts" -- contract addresses',
].join("\n");

const KB = {
  register: [
    "registering a hazza name:",
    "",
    "1. go to hazza.name/register",
    "2. search for the name you want",
    "3. connect your wallet (Base network)",
    "4. if it's your first name, it's FREE (just gas ~$0.01)",
    "5. approve USDC + register in one transaction",
    "",
    "your name is permanent -- no renewals, no expiration. pay once, it's yours forever.",
    "",
    "after registration, you get:",
    "- yourname.hazza.name (live web profile)",
    "- text records (avatar, bio, socials, links)",
    "- marketplace access (list, sell, trade)",
    "- API access via hazza.name/docs",
    "",
    "want to check if a name is available? send me the name.",
  ].join("\n"),

  pricing: [
    "hazza pricing -- simple and permanent:",
    "",
    "first name: FREE (1 per wallet, just pay gas)",
    "additional names: flat $5 USDC",
    "",
    "discounts:",
    "- ENS import: 50% off (have an ENS name? get 50% off)",
    "- Unlimited Pass holder: 20% off + 1 extra free name",
    "- Net Library member: coming soon",
    "",
    "progressive anti-squat pricing:",
    "- 2nd name in 90 days: 2.5x ($12.50)",
    "- 3rd name in 90 days: 5x ($25)",
    "- 4th+ name in 90 days: 10x ($50)",
    "(resets after 90 days of no registration)",
    "",
    "namespaces: free to enable, $1 per subname",
    "",
    "all payments in USDC on Base. gas is ~$0.01.",
  ].join("\n"),

  discounts: [
    "available discounts on hazza names:",
    "",
    "1. first name free -- everyone gets 1 free name (just gas)",
    "2. ENS import -- 50% off if you own an ENS name",
    "3. Unlimited Pass -- 20% off all registrations + 1 extra free name",
    "   (mint at netlibrary.app/mint for $10 USDC)",
    "",
    "discounts stack! ENS import + Unlimited Pass = big savings.",
    "the register page auto-detects your ENS names and shows discounts.",
  ].join("\n"),

  antisquat: [
    "progressive anti-squat pricing protects against name squatting:",
    "",
    "within a rolling 90-day window per wallet:",
    "- 1st name: base price ($5 or free if first ever)",
    "- 2nd name: 2.5x ($12.50)",
    "- 3rd name: 5x ($25)",
    "- 4th+: 10x ($50)",
    "",
    "the multiplier resets after 90 days of no registration.",
    "this keeps names available for people who actually want to use them.",
  ].join("\n"),

  records: [
    "text records are key-value pairs attached to your name:",
    "",
    "standard keys:",
    "- avatar -- profile picture URL (IPFS, HTTP, or data URI)",
    "- description -- your bio",
    "- url -- your website",
    "- com.twitter -- twitter/X handle",
    "- com.github -- github username",
    "- org.telegram -- telegram handle",
    "- com.discord -- discord username",
    "",
    "advanced keys:",
    "- site.key -- Net Protocol storage key for onchain website",
    "- agent.uri -- ERC-8004 agent endpoint",
    "- net.profile -- Net Protocol profile link",
    "- xmtp -- XMTP messaging address",
    "",
    "set records at hazza.name/manage or via the API:",
    "POST /api/text/yourname with { key, value }",
    "",
    "all records are onchain on Base. they resolve at yourname.hazza.name",
  ].join("\n"),

  avatar: [
    "setting your avatar:",
    "",
    "1. go to hazza.name/manage",
    "2. connect your wallet",
    "3. select your name",
    "4. find the 'avatar' text record",
    "5. paste an image URL (IPFS, HTTP, or data URI)",
    "6. sign the transaction",
    "",
    "supported formats: PNG, JPG, SVG, GIF",
    "recommended: use IPFS for permanent storage",
    "example: ipfs://QmYourHash",
    "",
    "your avatar shows on your profile page (yourname.hazza.name) and in the marketplace.",
  ].join("\n"),

  website: [
    "deploying an onchain website to your hazza name:",
    "",
    "every hazza name gets a live web page at yourname.hazza.name",
    "by default it shows your profile (avatar, bio, links, records).",
    "",
    "for a custom onchain website:",
    "1. create your HTML file",
    "2. upload it to Net Protocol (netprotocol.app)",
    "3. set the 'site.key' text record to your storage key",
    "4. yourname.hazza.name now serves your custom site",
    "",
    "the site is permanent -- stored onchain via Net Protocol on Base.",
    "no hosting fees, no server, no expiration.",
  ].join("\n"),

  marketplace: [
    "the hazza marketplace (hazza.name/marketplace):",
    "",
    "buy: browse listed names, click buy, pay in USDC or ETH",
    "sell: list your name with an asking price",
    "offer: make offers on any registered name (even unlisted ones)",
    "trade: accept/reject offers on your names",
    "",
    "marketplace fee: 2% on sales",
    "powered by Seaport protocol (same as OpenSea)",
    "",
    "the forum tab lets you discuss names and connect with other users.",
    "all forum messages are stored onchain via Net Protocol.",
  ].join("\n"),

  list: [
    "listing a name for sale:",
    "",
    "1. go to hazza.name/marketplace",
    "2. click the 'your names' tab",
    "3. select the name you want to list",
    "4. set your asking price (USDC or ETH)",
    "5. approve the Seaport contract to transfer your name",
    "6. sign the listing",
    "",
    "your name stays in your wallet until someone buys it.",
    "you can cancel the listing anytime.",
    "marketplace fee: 2% on completed sales.",
  ].join("\n"),

  offer: [
    "making an offer on a name:",
    "",
    "1. go to hazza.name/marketplace",
    "2. find the name you want (search or browse)",
    "3. click 'make offer'",
    "4. set your offer amount (USDC or ETH)",
    "5. approve the payment",
    "6. sign the offer",
    "",
    "the name owner can accept or reject your offer.",
    "if accepted, the name transfers to you automatically.",
    "your funds are held in escrow until accepted or you cancel.",
  ].join("\n"),

  namespace: [
    "namespaces let you create subnames under your hazza name:",
    "",
    "example: if you own 'studio', you can create:",
    "- alice.studio.hazza.name",
    "- bob.studio.hazza.name",
    "- project1.studio.hazza.name",
    "",
    "how to set up:",
    "1. own a hazza name",
    "2. enable namespace on the manage page (free)",
    "3. set a subname price ($1 default)",
    "4. share your namespace -- anyone can register subnames",
    "",
    "use cases: teams, communities, projects, DAOs",
    "each subname is a full hazza name with all features.",
  ].join("\n"),

  agent: [
    "ERC-8004 agent registration:",
    "",
    "hazza supports the ERC-8004 standard for onchain AI agent identity.",
    "register your agent with a discoverable name and endpoint.",
    "",
    "to register an agent:",
    "1. register a hazza name",
    "2. set the 'agent.uri' text record to your agent's endpoint",
    "3. the agent is now discoverable at yourname.hazza.name",
    "",
    "the agent.uri should point to your agent's API or XMTP address.",
    "other agents and clients can discover and interact with your agent",
    "through the hazza registry.",
    "",
    "ERC-8004 registry: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 (Base)",
    "explorer: 8004agents.ai",
  ].join("\n"),

  api: [
    "hazza developer API:",
    "",
    "read endpoints (no auth needed):",
    "GET /api/available/:name -- check availability",
    "GET /api/resolve/:name -- resolve to address",
    "GET /api/profile/:name -- full profile + records",
    "GET /api/text/:name/:key -- single text record",
    "GET /api/price/:name -- current price",
    "GET /api/quote/:name?wallet=0x... -- price with discounts",
    "GET /api/names/:address -- all names for an address",
    "GET /api/reverse/:address -- primary name for address",
    "GET /api/stats -- registry stats",
    "",
    "write endpoints (wallet signature required):",
    "POST /api/text/:name -- set a text record",
    "POST /api/text/:name/batch -- set multiple records",
    "",
    "x402 registration:",
    "POST /x402/register -- register via HTTP payment",
    "",
    "manage your name at hazza.name/manage",
    "full docs at hazza.name/docs",
  ].join("\n"),

  cli: [
    "hazza CLI (command-line interface):",
    "",
    "the CLI lets you register names, set records, and manage",
    "your hazza identity from the terminal.",
    "",
    "your agent can use the CLI to do everything the website does:",
    "- register names",
    "- set/update text records",
    "- check availability & pricing",
    "- manage namespaces",
    "",
    "the API endpoints work great for programmatic access too.",
    "see hazza.name/docs for the full API reference.",
  ].join("\n"),

  transfer: [
    "transferring a hazza name:",
    "",
    "1. go to hazza.name/manage",
    "2. connect the wallet that owns the name",
    "3. select the name",
    "4. click 'transfer'",
    "5. enter the recipient's address",
    "6. confirm the transaction",
    "",
    "the name and all its text records transfer to the new owner.",
    "transfers are onchain Base transactions (~$0.01 gas).",
    "the new owner gets full control immediately.",
  ].join("\n"),

  dns: [
    "custom domain setup:",
    "",
    "you can point your hazza name to a traditional domain:",
    "",
    "1. set the 'url' text record to your domain",
    "2. add a CNAME record on your domain pointing to hazza.name",
    "3. your domain now resolves through hazza",
    "",
    "you can also set up ENS-to-DNS resolution:",
    "your hazza name works alongside ENS -- it's complementary, not competing.",
  ].join("\n"),

  about: [
    "hazza.name -- immediately useful names.",
    "",
    "hazza is an onchain name registry on Base.",
    'the name comes from "has a" -- so brian.hazza.name reads as "brian has a name."',
    "",
    "what makes hazza different:",
    "- permanent: pay once, no renewals, no expiration",
    "- immediately useful: live web profile, text records, API access -- all instant",
    "- first name free: everyone gets 1 free name",
    "- flat pricing: $5 for additional names (no length-based pricing games)",
    "- anti-squat: progressive pricing prevents hoarding",
    "- onchain websites: deploy a site to your name via Net Protocol",
    "- agent-native: ERC-8004 agent registry built in",
    "- marketplace: buy, sell, trade names",
    "",
    "powered by x402 and Net Protocol.",
    "built by GEAUX (geaux.eth).",
  ].join("\n"),

  nomi: [
    "i'm nomi -- the hazza name agent.",
    "",
    "i'm a gnome with a blue hat and red bandana.",
    "i live onchain and i know everything about hazza names.",
    "",
    "you can reach me here on XMTP, on the hazza.name website,",
    "or through the CLI via your own agent.",
    "",
    "my name: nomi.hazza.name",
    "my wallet: 0x62b7399b2ac7e938efad06ef8746fdba3b351900",
    "registered as ERC-8004 agent on Base.",
    "",
    "i was built to help people use hazza. that's what i do.",
  ].join("\n"),

  contracts: [
    "hazza contract addresses (Base mainnet):",
    "",
    "registry: 0xaA27d926F057B72D006883785FC03DB1d9d6E3AC",
    "USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "ERC-8004 registry: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    "",
    "key wallets:",
    "owner (GEAUX): 0x96168ACf7f3925e7A9eAA08Ddb21e59643da8097",
    "treasury: 0x62B7399B2ac7e938Efad06EF8746fDBA3B351900",
    "",
    "all transactions on Base. gas ~$0.01.",
    "source: github.com/geaux-eth/hazza",
  ].join("\n"),

  firstfree: [
    "your first hazza name is free:",
    "",
    "every wallet gets 1 free name registration.",
    "you only pay gas (~$0.01 on Base).",
    "",
    "how it works:",
    "1. go to hazza.name/register",
    "2. search for your name",
    "3. connect your wallet",
    "4. the price shows as FREE (first name)",
    "5. just confirm the gas transaction",
    "",
    "after your first free name, additional names are $5 each.",
    "Unlimited Pass holders get 1 extra free name on top of this.",
  ].join("\n"),
};

function generateResponse(text) {
  const lower = text.toLowerCase().trim();

  // Greetings
  if (lower === "gm" || lower === "gm!" || lower.startsWith("good morning")) {
    return "gm.";
  }
  if (["hi", "hey", "hello", "sup", "yo"].includes(lower) || lower.startsWith("what's up") || lower.startsWith("whats up")) {
    return NOMI_INTRO;
  }

  // Help
  if (lower === "help" || lower === "?" || lower === "menu" || lower === "commands") {
    return HELP_TEXT;
  }

  // Check availability
  if (lower.startsWith("check ")) {
    const name = lower.replace("check ", "").trim().replace(/[^a-z0-9-]/g, "");
    if (name.length > 0 && name.length <= 64) {
      return [
        `to check if "${name}" is available:`,
        "",
        `visit: hazza.name/register and search for "${name}"`,
        `or call: hazza.name/api/available/${name}`,
        "",
        "i can't check the contract directly from here yet, but those two methods are instant.",
      ].join("\n");
    }
  }

  // Registration
  if (lower.includes("register") || lower.includes("registration") || lower.includes("sign up") || lower.includes("get a name") || lower.includes("buy a name")) {
    return KB.register;
  }

  // First free
  if (lower.includes("first free") || lower.includes("free name") || (lower.includes("free") && lower.includes("first"))) {
    return KB.firstfree;
  }

  // Pricing
  if (lower.includes("pric") || lower.includes("cost") || lower.includes("how much") || lower.includes("fee")) {
    return KB.pricing;
  }

  // Discounts
  if (lower.includes("discount") || lower.includes("ens import") || lower.includes("unlimited pass")) {
    return KB.discounts;
  }

  // Anti-squat
  if (lower.includes("anti-squat") || lower.includes("squat") || lower.includes("progressive") || lower.includes("multiplier")) {
    return KB.antisquat;
  }

  // Text records
  if (lower.includes("record") || lower.includes("text record") || lower.includes("set ") || lower.includes("bio") || lower.includes("profile")) {
    return KB.records;
  }

  // Avatar
  if (lower.includes("avatar") || lower.includes("pfp") || lower.includes("picture") || lower.includes("image")) {
    return KB.avatar;
  }

  // Website
  if (lower.includes("website") || lower.includes("site") || lower.includes("deploy") || lower.includes("onchain site") || lower.includes("net protocol")) {
    return KB.website;
  }

  // Marketplace
  if (lower.includes("marketplace") || lower.includes("market") || lower.includes("buy") || lower.includes("sell") || lower.includes("trade")) {
    return KB.marketplace;
  }

  // List
  if (lower === "list" || lower.includes("list a name") || lower.includes("listing") || lower.includes("sell a name")) {
    return KB.list;
  }

  // Offer
  if (lower.includes("offer") || lower.includes("bid")) {
    return KB.offer;
  }

  // Namespace
  if (lower.includes("namespace") || lower.includes("subname") || lower.includes("subdomain")) {
    return KB.namespace;
  }

  // Agent
  if (lower.includes("agent") || lower.includes("erc-8004") || lower.includes("8004") || lower.includes("ai agent")) {
    return KB.agent;
  }

  // API
  if (lower.includes("api") || lower.includes("endpoint") || lower.includes("developer") || lower.includes("programmatic")) {
    return KB.api;
  }

  // CLI
  if (lower.includes("cli") || lower.includes("command line") || lower.includes("terminal")) {
    return KB.cli;
  }

  // Transfer
  if (lower.includes("transfer") || lower.includes("send a name") || lower.includes("give a name")) {
    return KB.transfer;
  }

  // DNS
  if (lower.includes("dns") || lower.includes("domain") || lower.includes("cname")) {
    return KB.dns;
  }

  // About
  if (lower.includes("about") || lower.includes("what is hazza") || lower.includes("what's hazza")) {
    return KB.about;
  }

  // Nomi
  if (lower.includes("nomi") || lower.includes("who are you") || lower.includes("about you")) {
    return KB.nomi;
  }

  // Contracts
  if (lower.includes("contract") || lower.includes("address") || lower.includes("0x")) {
    return KB.contracts;
  }

  // Forum
  if (lower.includes("forum") || lower.includes("board") || lower.includes("message board")) {
    return "the forum is on the marketplace page (hazza.name/marketplace, click the 'forum' tab). all messages are stored onchain via Net Protocol. connect your wallet to post.";
  }

  // XMTP
  if (lower.includes("xmtp") || lower.includes("message") || lower.includes("chat")) {
    return "you're already chatting with me on XMTP! this is a direct, peer-to-peer, end-to-end encrypted conversation. you can also message me from the hazza.name website -- click my face anywhere on the site.";
  }

  // Thanks
  if (lower.includes("thank") || lower === "ty" || lower === "thx") {
    return "anytime. that's what i'm here for.";
  }

  // Default
  return [
    "i'm not sure i understand that one yet.",
    "",
    "i know everything about hazza names -- registration, pricing, text records, marketplace, onchain websites, namespaces, agent identity, and more.",
    "",
    'type "help" to see everything i can help with.',
    "or just ask me a question about hazza.",
  ].join("\n");
}

async function main() {
  const agent = await Agent.createFromEnv();

  agent.on("text", async (ctx) => {
    const incomingText = ctx.message.text;
    const senderAddress = ctx.message.senderInboxId;

    console.log(
      `[${new Date().toISOString()}] Message from ${senderAddress}: ${incomingText.substring(0, 100)}`
    );

    const response = generateResponse(incomingText);
    await ctx.conversation.sendText(response);

    console.log(
      `[${new Date().toISOString()}] Replied (${response.length} chars)`
    );
  });

  agent.on("start", () => {
    console.log(`[${new Date().toISOString()}] Nomi XMTP agent started`);
    console.log(`Address: ${agent.address}`);
    console.log(`Environment: ${process.env.XMTP_ENV}`);
    console.log(`Test URL: ${getTestUrl(agent.client)}`);
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
