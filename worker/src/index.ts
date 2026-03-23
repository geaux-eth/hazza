import { Hono } from "hono";
import { cors } from "hono/cors";
import { type Env, getClient, getMainnetClient, getEthMainnetClient, buildTx, registryAddress, REGISTRY_ABI, EXOSKELETON_ABI, EXOSKELETON_ADDRESS, ERC8004_REGISTRY_ADDRESS, ERC8004_ABI } from "./contract";
import { profileBotPage, spaShell, NOMI_AVATAR } from "./pages";

const NOMI_AVATAR_URI = NOMI_AVATAR;
import { handleCcipRead, handleCcipOptions } from "./ccip";
import { type Address, formatUnits, formatEther, keccak256, toBytes, isAddress, createWalletClient, http, encodeFunctionData, verifyMessage, namehash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { BazaarClient } from "@net-protocol/bazaar";
import { StorageClient } from "@net-protocol/storage";
// @ts-ignore — wasm import handled by wrangler
import resvgWasm from "../node_modules/@resvg/resvg-wasm/index_bg.wasm";

let wasmInitialized = false;
let cachedFonts: ArrayBuffer[] | null = null;

async function getFonts(): Promise<ArrayBuffer[]> {
  if (cachedFonts) return cachedFonts;
  const [boldResp, semiboldResp] = await Promise.all([
    fetch("https://fonts.gstatic.com/s/fredoka/v17/X7nP4b87HvSqjb_WIi2yDCRwoQ_k7367_B-i2yQag0-mac3OFiXMFg.ttf"),
    fetch("https://fonts.gstatic.com/s/fredoka/v17/X7nP4b87HvSqjb_WIi2yDCRwoQ_k7367_B-i2yQag0-mac3OLyXMFg.ttf"),
  ]);
  cachedFonts = [await boldResp.arrayBuffer(), await semiboldResp.arrayBuffer()];
  return cachedFonts;
}

// Unlimited Pass contract for 20% discount verification
const UNLIMITED_PASS_ADDRESS = "0xCe559A2A6b64504bE00aa7aA85C5C31EA93a16BB" as const;
const UNLIMITED_PASS_ABI = [
  { name: "hasUnlimitedPass", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bool" }] },
] as const;

type Bindings = Env;
const app = new Hono<{ Bindings: Bindings }>();

// CORS — restrict to hazza.name origins
app.use("/api/*", cors({
  origin: (origin) => {
    if (!origin) return "https://hazza.name";
    if (origin === "https://hazza.name" || origin.endsWith(".hazza.name")) return origin;
    if (origin === "https://hazza-app.pages.dev" || origin.endsWith(".hazza-app.pages.dev")) return origin;
    return "https://hazza.name";
  },
}));

// Security headers — helps corporate firewalls (Zscaler, Fortinet, etc.) classify the site
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "SAMEORIGIN");
  c.res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
});

/** Fetch with a timeout — rejects if the request takes longer than `ms` */
function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 5000): Promise<Response> {
  return Promise.race([
    fetch(url, opts),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ]);
}

/** Validate that a URL is safe to fetch (prevents SSRF) */
function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const h = parsed.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]") return false;
    if (h.startsWith("10.") || h.startsWith("192.168.") || h.startsWith("169.254.")) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    if (h.endsWith(".internal") || h.endsWith(".local")) return false;
    return true;
  } catch {
    return false;
  }
}

/** Validate name format: lowercase alphanumeric + hyphens, max 64 chars */
function isValidName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/.test(name) || /^[a-z0-9]$/.test(name);
}

// =========================================================================
//                          API ROUTES
// =========================================================================

// Check if a name is available
app.get("/api/available/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: "Invalid name format" }, 400);
  const client = getClient(c.env);
  const isAvailable = await client.readContract({
    address: registryAddress(c.env),
    abi: REGISTRY_ABI,
    functionName: "available",
    args: [name],
  });
  return c.json({ name, available: isAvailable });
});

// Resolve a name to its full record
app.get("/api/resolve/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: "Invalid name format" }, 400);
  const client = getClient(c.env);
  const [nameOwner, tokenId, registeredAt, operator, agentId, agentWallet] =
    await client.readContract({
      address: registryAddress(c.env),
      abi: REGISTRY_ABI,
      functionName: "resolve",
      args: [name],
    });

  if (nameOwner === "0x0000000000000000000000000000000000000000") {
    return c.json({ error: "Name not registered" }, 404);
  }

  return c.json({
    name,
    owner: nameOwner,
    tokenId: tokenId.toString(),
    registeredAt: Number(registeredAt),
    operator,
    agentId: agentId.toString(),
    agentWallet,
    status: "active",
    url: `https://${name}.hazza.name`,
  });
});

// Get price for a name
app.get("/api/price/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: "Invalid name format" }, 400);
  const charCount = Number(c.req.query("charCount") || "0");
  const client = getClient(c.env);
  const basePrice = await client.readContract({
    address: registryAddress(c.env),
    abi: REGISTRY_ABI,
    functionName: "price",
    args: [name, charCount],
  });

  return c.json({
    name,
    charCount: charCount || name.length,
    basePrice: formatUnits(basePrice, 6),
    basePriceRaw: basePrice.toString(),
  });
});

// Get full quote for a name (includes progressive pricing + discounts)
app.get("/api/quote/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: "Invalid name format" }, 400);
  const wallet = (c.req.query("wallet") || "0x0000000000000000000000000000000000000000") as Address;
  const charCount = Number(c.req.query("charCount") || "0");
  let ensImport = c.req.query("ensImport") === "true";
  const verifiedPass = c.req.query("verifiedPass") === "true";
  const memberIdStr = c.req.query("memberId") || "0";
  if (!/^\d+$/.test(memberIdStr)) return c.json({ error: "Invalid memberId parameter" }, 400);
  const memberId = BigInt(memberIdStr);

  // Verify ENS ownership on Ethereum mainnet when ensImport discount is claimed
  // Uses NameWrapper first (handles wrapped names), falls back to Base Registrar (unwrapped)
  if (ensImport && wallet !== "0x0000000000000000000000000000000000000000") {
    try {
      const ethClient = getEthMainnetClient(c.env);
      const ENS_NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401" as Address;
      const node = namehash(`${name}.eth`);
      let ensOwner: string;
      try {
        ensOwner = await ethClient.readContract({
          address: ENS_NAME_WRAPPER,
          abi: [{ name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ name: "", type: "address" }] }] as const,
          functionName: "ownerOf",
          args: [BigInt(node)],
        });
      } catch {
        // Fallback to Base Registrar for unwrapped names
        const ENS_BASE_REGISTRAR = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85" as Address;
        const labelHash = keccak256(toBytes(name));
        ensOwner = await ethClient.readContract({
          address: ENS_BASE_REGISTRAR,
          abi: [{ name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] }] as const,
          functionName: "ownerOf",
          args: [BigInt(labelHash)],
        });
      }
      if (ensOwner.toLowerCase() !== wallet.toLowerCase()) {
        console.warn(`ENS import rejected: wallet ${wallet} does not own ${name}.eth (owner: ${ensOwner})`);
        ensImport = false;
      }
    } catch (e) {
      console.warn(`ENS ownership check failed for ${name}.eth, disabling ensImport discount:`, e);
      ensImport = false;
    }
  }

  const client = getClient(c.env);

  // Use member-aware quote if memberId provided
  if (memberId > 0n) {
    const [totalCost, registrationFee, isFreeClaim] = await client.readContract({
      address: registryAddress(c.env),
      abi: REGISTRY_ABI,
      functionName: "quoteNameWithMember",
      args: [name, wallet, charCount, ensImport, verifiedPass, memberId],
    });

    const lineItems: { label: string; amount: string }[] = [];
    if (isFreeClaim) {
      lineItems.push({ label: "Registration", amount: "FREE" });
      lineItems.push({ label: "Unlimited Pass + Net Library", amount: "1 free name" });
    } else {
      lineItems.push({ label: "Registration", amount: formatUnits(registrationFee, 6) });
      if (verifiedPass) lineItems.push({ label: "Unlimited Pass", amount: "20% discount" });
    }
    if (ensImport) lineItems.push({ label: "ENS Import", amount: "50% discount" });

    return c.json({
      name, wallet,
      total: formatUnits(totalCost, 6),
      totalRaw: totalCost.toString(),
      registrationFee: formatUnits(registrationFee, 6),
      isFreeClaim,
      memberId: memberId.toString(),
      lineItems,
    });
  }

  const [totalCost, registrationFee] = await client.readContract({
    address: registryAddress(c.env),
    abi: REGISTRY_ABI,
    functionName: "quoteName",
    args: [name, wallet, charCount, ensImport, verifiedPass],
  });

  // Build line items for UI display
  const isFirstFree = totalCost === 0n && registrationFee === 0n;
  const lineItems: { label: string; amount: string }[] = [];
  if (isFirstFree) {
    lineItems.push({ label: "First name", amount: "FREE + gas" });
  } else {
    lineItems.push({ label: "Registration", amount: formatUnits(registrationFee, 6) });
    if (ensImport) lineItems.push({ label: "ENS Import", amount: "50% discount" });
    if (verifiedPass) lineItems.push({ label: "Unlimited Pass", amount: "20% discount" });
  }

  return c.json({
    name,
    wallet,
    total: formatUnits(totalCost, 6),
    totalRaw: totalCost.toString(),
    registrationFee: formatUnits(registrationFee, 6),
    ...(isFirstFree ? { firstRegistration: true, message: "Your first name is free — just pay gas!" } : {}),
    lineItems,
  });
});

// Check free claim eligibility — first registration free for everyone + Unlimited Pass bonus
app.get("/api/free-claim/:address", async (c) => {
  const wallet = c.req.param("address") as Address;
  if (!isAddress(wallet)) return c.json({ error: "Invalid address format" }, 400);

  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  // Step 1: Check if this wallet has never registered (first name free for everyone)
  try {
    const [totalRegistrations] = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "walletInfo", args: [wallet],
    });
    if (totalRegistrations === 0n) {
      return c.json({
        eligible: true,
        reason: "first-registration",
        message: "Your first hazza name is free — just pay gas!",
      });
    }
  } catch { /* fall through to Unlimited Pass check */ }

  // Step 2: Check Unlimited Pass + Net Library membership for bonus free name
  const nlApiUrl = c.env.NET_LIBRARY_API_URL;
  if (!nlApiUrl) {
    return c.json({ eligible: false, reason: "No free names available" });
  }

  let nlData: any;
  try {
    const resp = await fetch(`${nlApiUrl}/api/membership?address=${wallet}`);
    nlData = await resp.json();
  } catch {
    return c.json({ eligible: false, reason: "Could not verify Net Library membership" });
  }

  if (!nlData?.isMember) {
    return c.json({ eligible: false, reason: "Not eligible for additional free name" });
  }
  if (!nlData?.member?.hasUnlimitedPass) {
    return c.json({ eligible: false, reason: "No Unlimited Pass" });
  }

  const memberId = nlData.member.memberId;
  if (!memberId || memberId <= 0) {
    return c.json({ eligible: false, reason: "Invalid member ID" });
  }

  const claimed = await client.readContract({
    address: addr, abi: REGISTRY_ABI, functionName: "hasClaimedFreeName",
    args: [BigInt(memberId)],
  });

  if (claimed) {
    return c.json({ eligible: false, reason: "Free name already claimed", memberId });
  }

  return c.json({
    eligible: true,
    reason: "unlimited-pass",
    memberId,
    memberName: nlData.member.ensSubname || `Member #${memberId}`,
    message: "Unlimited Pass bonus: 1 additional free name!",
  });
});

// Reverse resolve: wallet → primary HAZZA name
app.get("/api/reverse/:address", async (c) => {
  const wallet = c.req.param("address") as Address;
  if (!isAddress(wallet)) return c.json({ error: "Invalid address format" }, 400);
  const client = getClient(c.env);
  const name = await client.readContract({
    address: registryAddress(c.env),
    abi: REGISTRY_ABI,
    functionName: "reverseResolve",
    args: [wallet],
  });

  if (!name) {
    return c.json({ error: "No primary name set" }, 404);
  }
  return c.json({ wallet, name, url: `https://${name}.hazza.name` });
});

// Full profile: resolve + text records + status
app.get("/api/profile/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: "Invalid name format" }, 400);
  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  const [nameOwner, tokenId, registeredAt, operator, agentId, agentWallet] =
    await client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name] });

  if (nameOwner === "0x0000000000000000000000000000000000000000") {
    return c.json({ name, registered: false });
  }

  const textKeys = ["avatar", "description", "url", "com.twitter", "com.github", "org.telegram", "com.discord", "xmtp", "message.delegate", "message.mode", "site.key", "agent.uri", "net.profile", "helixa.id", "netlibrary.member", "netlibrary.pass", "com.linkedin", "xyz.farcaster"];
  const [textValues, chash] = await Promise.all([
    client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "textMany", args: [name, textKeys] }),
    client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "contenthash", args: [name] }),
  ]);

  const texts: Record<string, string> = {};
  textKeys.forEach((key, i) => {
    if (textValues[i]) texts[key] = textValues[i];
  });

  // Fetch enriched data in parallel (all optional, failures silenced)
  const agentUri = texts["agent.uri"];
  const netProfileKey = texts["net.profile"];
  const helixaId = texts["helixa.id"];
  const safeHelixaId = helixaId && /^\d+$/.test(helixaId) ? helixaId : null;
  const netProfileUrl = netProfileKey
    ? (netProfileKey.startsWith("http") ? netProfileKey : `https://storedon.net/net/8453/storage/load/${nameOwner}/${encodeURIComponent(netProfileKey)}`)
    : null;

  // Wrap all enrichment fetches in a 6s global timeout so the endpoint always responds
  const enrichmentTimeout = new Promise<[PromiseSettledResult<any>, PromiseSettledResult<any>, PromiseSettledResult<any>, PromiseSettledResult<any>, PromiseSettledResult<any>]>((resolve) =>
    setTimeout(() => resolve([
      { status: "rejected", reason: "timeout" } as PromiseRejectedResult,
      { status: "rejected", reason: "timeout" } as PromiseRejectedResult,
      { status: "rejected", reason: "timeout" } as PromiseRejectedResult,
      { status: "rejected", reason: "timeout" } as PromiseRejectedResult,
      { status: "rejected", reason: "timeout" } as PromiseRejectedResult,
    ]), 6000)
  );

  const enrichmentWork = Promise.allSettled([
    agentUri && isAllowedUrl(agentUri)
      ? fetchWithTimeout(agentUri, { headers: { Accept: "application/json" } }, 4000).then(r => r.ok ? r.json() : null)
      : Promise.resolve(null),
    safeHelixaId
      ? fetchWithTimeout(`https://api.helixa.xyz/api/v2/agent/${safeHelixaId}`, {}, 4000).then(r => r.ok ? r.json() : null)
      : Promise.resolve(null),
    (async () => {
      const mainnet = getMainnetClient(c.env);
      const bal = await mainnet.readContract({
        address: EXOSKELETON_ADDRESS, abi: EXOSKELETON_ABI, functionName: "balanceOf", args: [nameOwner],
      });
      if (!bal || bal === 0n) return null;
      const tokenIdExo = await mainnet.readContract({
        address: EXOSKELETON_ADDRESS, abi: EXOSKELETON_ABI, functionName: "tokenOfOwnerByIndex", args: [nameOwner, 0n],
      });
      const uri = await mainnet.readContract({
        address: EXOSKELETON_ADDRESS, abi: EXOSKELETON_ABI, functionName: "tokenURI", args: [tokenIdExo],
      });
      if (uri && typeof uri === "string" && uri.startsWith("data:")) {
        const b64 = uri.split(",")[1];
        const json = JSON.parse(atob(b64));
        return { tokenId: tokenIdExo.toString(), ...json };
      }
      return null;
    })(),
    (async () => {
      const ethClient = getEthMainnetClient(c.env);
      const ensName = await ethClient.getEnsName({ address: nameOwner });
      return ensName || null;
    })(),
    fetchWithTimeout(`https://api.bankr.bot/agent-profiles/${(nameOwner as string).toLowerCase()}`, {
      headers: { Accept: "application/json" },
    }, 4000).then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  const [agentMetaResult, helixaResult, exoResult, ensResult, bankrResult] = await Promise.race([enrichmentWork, enrichmentTimeout]);

  return c.json({
    name,
    registered: true,
    owner: nameOwner,
    ownerEns: ensResult.status === "fulfilled" ? ensResult.value : null,
    tokenId: tokenId.toString(),
    registeredAt: Number(registeredAt),
    operator,
    agentId: agentId.toString(),
    agentWallet,
    status: "active",
    texts,
    contenthash: chash && chash !== "0x" ? (chash as string) : null,
    url: `https://${name}.hazza.name`,
    agentMeta: agentMetaResult.status === "fulfilled" ? agentMetaResult.value : null,
    helixaData: helixaResult.status === "fulfilled" ? helixaResult.value : null,
    exoData: exoResult.status === "fulfilled" ? exoResult.value : null,
    bankrData: bankrResult.status === "fulfilled" ? bankrResult.value : null,
  });
});

// Contact resolution — resolves delegate chain (max 1 hop)
app.get("/api/contact/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: "Invalid name format" }, 400);
  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  try {
    const [nameOwner] = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name],
    });
    if (nameOwner === "0x0000000000000000000000000000000000000000") {
      return c.json({ error: "Name not registered" }, 404);
    }

    const contactKeys = ["xmtp", "message.delegate", "message.mode"];
    const contactValues = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "textMany", args: [name, contactKeys],
    });
    const ownerXmtp = contactValues[0] || "";
    const delegate = contactValues[1] || "";
    const mode = contactValues[2] || "all";

    let delegateXmtp = "";
    let contactName = "";

    if (delegate) {
      if (delegate.startsWith("0x") && delegate.length === 42) {
        // Delegate is a raw address — use it directly as XMTP target
        delegateXmtp = delegate;
      } else {
        // Delegate is a hazza name — resolve its XMTP record (1 hop)
        contactName = delegate.toLowerCase();
        try {
          const delegateXmtpValue = await client.readContract({
            address: addr, abi: REGISTRY_ABI, functionName: "text", args: [contactName, "xmtp"],
          });
          delegateXmtp = delegateXmtpValue || "";
        } catch { /* delegate name doesn't exist or has no xmtp */ }
      }
    }

    // Determine the effective contact address based on mode
    let contactAddress = ownerXmtp;
    let senderIsAgent: boolean | null = null;
    if (delegate && delegateXmtp) {
      if (mode === "delegate-all") {
        contactAddress = delegateXmtp;
      } else if (mode === "delegate-agents") {
        // Check if sender is an agent by looking up ERC-8004 registry
        const sender = c.req.query("sender");
        if (sender && /^0x[0-9a-fA-F]{40}$/.test(sender)) {
          try {
            const mainnetClient = getMainnetClient(c.env);
            const agentBalance = await mainnetClient.readContract({
              address: ERC8004_REGISTRY_ADDRESS,
              abi: ERC8004_ABI,
              functionName: "balanceOf",
              args: [sender as `0x${string}`],
            });
            senderIsAgent = agentBalance > 0n;
            contactAddress = senderIsAgent ? delegateXmtp : ownerXmtp;
          } catch {
            // ERC-8004 lookup failed — default to owner (safe fallback)
            contactAddress = ownerXmtp;
          }
        } else {
          // No valid sender provided — default to owner
          contactAddress = ownerXmtp;
        }
      }
    }

    const xmtpUrl = contactAddress
      ? `https://xmtp.chat/production/dm/${contactAddress}`
      : "";

    return c.json({
      name,
      contactAddress,
      contactName: contactName || null,
      isDelegated: !!delegate,
      mode,
      ownerXmtp,
      delegateXmtp: delegateXmtp || null,
      senderIsAgent,
      xmtpUrl,
    });
  } catch (e: any) {
    console.error("Contact resolution failed:", e?.message || e);
    return c.json({ error: "Contact resolution failed" }, 500);
  }
});

// Single text record
app.get("/api/text/:name/:key", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: "Invalid name format" }, 400);
  const key = c.req.param("key");
  const client = getClient(c.env);
  try {
    const value = await client.readContract({
      address: registryAddress(c.env),
      abi: REGISTRY_ABI,
      functionName: "text",
      args: [name, key],
    });
    return c.json({ name, key, value: value || "" });
  } catch {
    return c.json({ name, key, value: "" });
  }
});

// OG image generator (PNG via resvg-wasm)
app.get("/api/og/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: "Invalid name format" }, 400);

  // Escape for SVG
  const svgEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Branded OG image for site-wide sharing (hazza)
  if (name === "hazza") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#F7EBBD"/>
  <rect x="0" y="0" width="1200" height="8" fill="#4870D4"/>
  <rect x="0" y="622" width="1200" height="8" fill="#CF3748"/>

  <!-- Nomi avatar -->
  <image x="60" y="120" width="380" height="380" href="${NOMI_AVATAR_URI}"/>

  <!-- hazza.name -->
  <text x="740" y="270" font-family="Fredoka, sans-serif" font-weight="700" text-anchor="middle">
    <tspan font-size="120" fill="#CF3748">hazza</tspan><tspan font-size="120" fill="#4870D4">.name</tspan>
  </text>

  <!-- Tagline -->
  <text x="740" y="350" font-family="Fredoka, sans-serif" font-size="42" fill="#131325" font-weight="600" text-anchor="middle">immediately useful names</text>

  <!-- Sub-tagline -->
  <text x="740" y="420" font-family="Fredoka, sans-serif" font-size="28" fill="#8a7d5a" font-weight="600" text-anchor="middle">pay once, available forever</text>

  <!-- Powered by -->
  <text x="740" y="520" font-family="Fredoka, sans-serif" font-size="22" fill="#4870D4" text-anchor="middle" font-weight="600">built on Base · powered by x402, XMTP and Net Protocol</text>
</svg>`;

    try {
      if (!wasmInitialized) {
        await initWasm(resvgWasm);
        wasmInitialized = true;
      }
      const fontData = await getFonts();
      const resvg = new Resvg(svg, {
        fitTo: { mode: "width", value: 1200 },
        font: {
          fontBuffers: fontData.map(f => new Uint8Array(f)),
          defaultFontFamily: "Fredoka",
        },
      });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();
      return new Response(pngBuffer, {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
      });
    } catch {
      return new Response(svg, {
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" },
      });
    }
  }

  // Per-name OG image
  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  let subtitle = "available";
  let statusColor = "#4870D4";
  let ownerText = "";

  try {
    const [nameOwner, , , , , ,] = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name],
    });
    if (nameOwner !== "0x0000000000000000000000000000000000000000") {
      subtitle = "registered";
      ownerText = nameOwner as string;
      try {
        const ensName = await getEthMainnetClient(c.env).getEnsName({ address: nameOwner as `0x${string}` });
        if (ensName) ownerText = ensName;
      } catch { /* ENS lookup optional */ }
    }
  } catch { /* name not registered or invalid */ }

  const displayName = name.length > 16 ? name.slice(0, 14) + "..." : name;
  const nameFontSize = displayName.length > 10 ? 56 : displayName.length > 6 ? 72 : 88;
  const ownerFontSize = ownerText.length > 30 ? 13 : 16;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#F7EBBD"/>
  <rect x="0" y="0" width="1200" height="8" fill="#4870D4"/>
  <rect x="0" y="622" width="1200" height="8" fill="#CF3748"/>

  <!-- Nomi avatar -->
  <image x="40" y="160" width="300" height="300" href="${NOMI_AVATAR_URI}"/>

  <!-- Logo -->
  <rect x="60" y="50" width="48" height="48" rx="10" fill="#CF3748"/>
  <text x="84" y="74" font-family="Fredoka, sans-serif" font-size="26" fill="#ffffff" font-weight="700" text-anchor="middle" dominant-baseline="central">h</text>

  <!-- Brand -->
  <text x="1140" y="84" font-family="Fredoka, sans-serif" font-size="22" font-weight="700" text-anchor="end" fill="#131325">hazza<tspan fill="#4870D4">.name</tspan></text>

  <!-- Name -->
  <text x="720" y="260" font-family="Fredoka, sans-serif" font-size="${nameFontSize}" fill="#131325" font-weight="700" text-anchor="middle">${svgEsc(displayName)}<tspan fill="#4870D4" font-size="${Math.round(nameFontSize * 0.6)}">.hazza.name</tspan></text>

  <!-- Status pill -->
  <rect x="${720 - (subtitle.length * 7 + 24)}" y="290" width="${subtitle.length * 14 + 48}" height="36" rx="18" fill="${statusColor}" opacity="0.12"/>
  <text x="720" y="314" font-family="Fredoka, sans-serif" font-size="16" fill="${statusColor}" text-anchor="middle" font-weight="600" letter-spacing="3">${subtitle.toUpperCase()}</text>

  <!-- Owner -->
  ${ownerText ? `<text x="720" y="380" font-family="Fredoka, sans-serif" font-size="${ownerFontSize}" fill="#8a7d5a" text-anchor="middle" font-weight="600">${svgEsc(ownerText)}</text>` : ""}

  <!-- Footer -->
  <text x="720" y="540" font-family="Fredoka, sans-serif" font-size="24" fill="#131325" font-weight="700" text-anchor="middle">immediately useful names</text>
  <text x="720" y="580" font-family="Fredoka, sans-serif" font-size="16" fill="#4870D4" text-anchor="middle" font-weight="600">built on Base · powered by x402, XMTP and Net Protocol</text>
</svg>`;

  // Try PNG conversion via resvg, fall back to SVG
  try {
    if (!wasmInitialized) {
      await initWasm(resvgWasm);
      wasmInitialized = true;
    }
    const fontData = await getFonts();
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      font: {
        fontBuffers: fontData.map(f => new Uint8Array(f)),
        defaultFontFamily: "Fredoka",
      },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return new Response(pngBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    // Fallback to SVG if resvg fails
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
});

// 1200x1200 icon PNG for PFP use
app.get("/api/icon", async (c) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#F7EBBD"/>
  <rect x="300" y="300" width="600" height="600" rx="64" ry="64" fill="#CF3748"/>
  <path fill="#ffffff" d="M520.1 780Q498.2 780 488.9 773.4Q479.6 766.8 477.9 756.6Q476.2 746.3 476.2 735.5V464Q476.2 452.7 478.1 442.7Q480.1 432.7 489.4 426.4Q498.6 420 520.6 420Q542.6 420 551.6 426.6Q560.7 433.2 562.6 443.2Q564.6 453.2 564.6 464.5V553.4Q571.9 546.5 584.4 539.4Q596.8 532.3 613.4 532.3Q644.7 532.3 669.6 548.7Q694.5 565.1 709.2 592.9Q723.8 620.8 723.8 655.9V736Q723.8 746.8 721.9 756.8Q719.9 766.8 710.9 773.4Q701.8 780 679.4 780Q657.9 780 648.4 773.6Q638.8 767.3 636.9 757Q634.9 746.8 634.9 735.1V655.4Q634.9 644.7 631 637.1Q627.1 629.6 619.8 625.2Q612.5 620.8 602.2 620.8Q589 620.8 577.8 629.1Q566.5 637.4 564.6 648.1V736Q564.6 746.8 562.6 757Q560.7 767.3 551.6 773.6Q542.6 780 520.1 780Z"/>
</svg>`;

  try {
    if (!wasmInitialized) {
      await initWasm(resvgWasm);
      wasmInitialized = true;
    }
    const fontData = await getFonts();
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      font: {
        fontBuffers: fontData.map(f => new Uint8Array(f)),
        defaultFontFamily: "Fredoka",
      },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return new Response(pngBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }
});

// 500x500 branded square NFT image (for wallet display, like ENS)
app.get("/api/nft-image/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: "Invalid name format" }, 400);
  const svgEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const displayName = name.length > 12 ? name.slice(0, 10) + "..." : name;
  const fontSize = displayName.length > 8 ? 44 : displayName.length > 5 ? 56 : 68;

  // Check namespace status
  let isNamespace = false;
  try {
    const client = getClient(c.env);
    const addr = registryAddress(c.env);
    const nameHash = keccak256(toBytes(name));
    const nsData = await client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "namespaces", args: [nameHash] });
    const nsAdmin = (nsData as any[])[0];
    isNamespace = !!nsAdmin && nsAdmin !== "0x0000000000000000000000000000000000000000";
  } catch {}

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1000" y2="1000" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFF8E1"/>
      <stop offset="100%" stop-color="#F7EBBD"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="1000" fill="url(#bg)"/>

  <!-- Logo icon (top left) -->
  <rect x="56" y="56" width="72" height="72" rx="12" fill="#CF3748"/>
  <text x="92" y="92" font-family="Fredoka, sans-serif" font-size="40" fill="#ffffff" font-weight="700" text-anchor="middle" dominant-baseline="central">h</text>
  ${isNamespace ? `<rect x="872" y="56" width="72" height="72" rx="12" fill="#4870D4"/><text x="908" y="92" font-family="Fredoka, sans-serif" font-size="36" fill="#ffffff" font-weight="700" text-anchor="middle" dominant-baseline="central">N</text>` : ''}

  <!-- Name -->
  <text x="500" y="460" font-family="Fredoka, sans-serif" font-size="${fontSize * 2}" fill="#4870D4" font-weight="700" text-anchor="middle">${svgEsc(displayName)}</text>

  <!-- .hazza.name suffix -->
  <text x="500" y="550" font-family="Fredoka, sans-serif" font-size="36" fill="#131325" font-weight="700" text-anchor="middle">.hazza.name</text>

  <!-- Accent line -->
  <rect x="400" y="600" width="200" height="3" rx="1.5" fill="#E8DCAB"/>

  <!-- Footer -->
  <text x="500" y="880" font-family="Fredoka, sans-serif" font-size="24" fill="#8a7d5a" text-anchor="middle" font-weight="600">immediately useful names</text>
  <text x="500" y="930" font-family="Fredoka, sans-serif" font-size="20" fill="#5981E7" text-anchor="middle" font-weight="600">powered by x402, XMTP and Net Protocol</text>
</svg>`;

  try {
    if (!wasmInitialized) {
      await initWasm(resvgWasm);
      wasmInitialized = true;
    }
    const fontData = await getFonts();
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1000 },
      font: {
        fontBuffers: fontData.map(f => new Uint8Array(f)),
        defaultFontFamily: "Fredoka",
      },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    return new Response(pngBuffer, {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300" },
    });
  }
});

// 1200x1200 square share image for Farcaster Mini App embed
app.get("/api/share", async (c) => {
  // Serve from CF edge cache if available
  const cacheKey = new Request("https://hazza.name/api/share?v=2", { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#F7EBBD"/>

  <!-- Icon logo (vertically centered with text group) -->
  <rect x="548" y="425" width="104" height="104" rx="18" fill="#CF3748"/>
  <text x="600" y="477" font-family="Fredoka, sans-serif" font-size="58" fill="#ffffff" font-weight="700" text-anchor="middle" dominant-baseline="central">h</text>

  <!-- hazza.name large centered -->
  <text x="600" y="695" font-family="Fredoka, sans-serif" font-weight="700" text-anchor="middle">
    <tspan font-size="148" fill="#131325">hazza</tspan><tspan font-size="148" fill="#4870D4">.name</tspan>
  </text>

  <!-- immediately useful -->
  <text x="600" y="780" font-family="Fredoka, sans-serif" font-size="56" fill="#131325" font-weight="600" text-anchor="middle" opacity="0.70">immediately useful</text>
</svg>`;

  try {
    if (!wasmInitialized) {
      await initWasm(resvgWasm);
      wasmInitialized = true;
    }
    const fontData = await getFonts();
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      font: {
        fontBuffers: fontData.map(f => new Uint8Array(f)),
        defaultFontFamily: "Fredoka",
      },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    const resp = new Response(pngBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
    c.executionCtx.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  } catch {
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }
});

// NFTs owned by address (for avatar picker) — uses Alchemy NFT API on mainnet
app.get("/api/nfts/:address", async (c) => {
  const address = c.req.param("address") as `0x${string}`;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return c.json({ error: "Invalid address" }, 400);

  const nfts: { collection: string; contract: string; tokenId: string; name: string; image: string }[] = [];

  // Try Alchemy NFT API (works on mainnet where BASE_MAINNET_RPC is an Alchemy URL)
  const rpcUrl = c.env.BASE_MAINNET_RPC || "";
  const alchemyMatch = rpcUrl.match(/g\.alchemy\.com\/v2\/(.+)$/);
  if (alchemyMatch) {
    const apiKey = alchemyMatch[1];
    const alchemyBase = `https://base-mainnet.g.alchemy.com/nft/v3/${apiKey}`;
    try {
      const res = await fetchWithTimeout(
        `${alchemyBase}/getNFTsForOwner?owner=${address}&withMetadata=true&pageSize=50&excludeFilters[]=SPAM`,
      );
      if (res.ok) {
        const data = await res.json() as {
          ownedNfts: {
            contract: { address: string; name?: string; openSeaMetadata?: { collectionName?: string } };
            tokenId: string;
            name?: string;
            image?: { cachedUrl?: string; thumbnailUrl?: string; pngUrl?: string; originalUrl?: string };
          }[];
        };
        for (const nft of data.ownedNfts || []) {
          const img = nft.image?.thumbnailUrl || nft.image?.cachedUrl || nft.image?.pngUrl || nft.image?.originalUrl || "";
          if (!img) continue;
          nfts.push({
            collection: nft.contract.openSeaMetadata?.collectionName || nft.contract.name || "Unknown",
            contract: nft.contract.address,
            tokenId: nft.tokenId,
            name: nft.name || `#${nft.tokenId}`,
            image: img,
          });
        }
        return c.json({ nfts, source: "alchemy" }, 200, { "Cache-Control": "public, max-age=300" });
      }
    } catch { /* fall through to on-chain method */ }
  }

  // Fallback: on-chain enumeration for known collections (works on any chain)
  const mainnet = getMainnetClient(c.env);
  const collections = [
    { name: "Exoskeleton", address: EXOSKELETON_ADDRESS },
  ];
  const normalizeImage = (url: string): string => {
    if (!url) return "";
    if (url.startsWith("ipfs://")) return "https://ipfs.io/ipfs/" + url.slice(7);
    if (url.startsWith("ar://")) return "https://arweave.net/" + url.slice(5);
    return url;
  };
  for (const col of collections) {
    try {
      const bal = await mainnet.readContract({
        address: col.address, abi: EXOSKELETON_ABI, functionName: "balanceOf", args: [address],
      }) as bigint;
      const count = Math.min(Number(bal), 20);
      for (let i = 0; i < count; i++) {
        try {
          const tokenId = await mainnet.readContract({
            address: col.address, abi: EXOSKELETON_ABI, functionName: "tokenOfOwnerByIndex", args: [address, BigInt(i)],
          }) as bigint;
          const uri = await mainnet.readContract({
            address: col.address, abi: EXOSKELETON_ABI, functionName: "tokenURI", args: [tokenId],
          }) as string;
          let image = "", nftName = "";
          if (uri && uri.startsWith("data:")) {
            try { const json = JSON.parse(atob(uri.split(",")[1])); image = normalizeImage(json.image || ""); nftName = json.name || ""; } catch {}
          } else if (uri) {
            try { const r = await fetchWithTimeout(normalizeImage(uri)); if (r.ok) { const j = await r.json() as any; image = normalizeImage(j.image || ""); nftName = j.name || ""; } } catch {}
          }
          if (image) nfts.push({ collection: col.name, contract: col.address, tokenId: tokenId.toString(), name: nftName, image });
        } catch {}
      }
    } catch {}
  }

  return c.json({ nfts, source: "onchain" }, 200, { "Cache-Control": "public, max-age=300" });
});

// ERC-721 metadata (served by tokenURI base URL)
app.get("/api/metadata/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: "Invalid name format" }, 400);
  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  const [nameOwner, tokenId, registeredAt, , agentId] =
    await client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name] });

  if (nameOwner === "0x0000000000000000000000000000000000000000") {
    return c.json({ error: "Name not registered" }, 404);
  }

  const nameHash = keccak256(toBytes(name));
  let isNamespace = false;
  try {
    const nsData = await client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "namespaces", args: [nameHash] });
    const nsAdmin = (nsData as any[])[0];
    isNamespace = !!nsAdmin && nsAdmin !== "0x0000000000000000000000000000000000000000";
  } catch {}

  const attributes: { trait_type: string; value: string }[] = [
    { trait_type: "Length", value: name.length.toString() },
    { trait_type: "Registered", value: new Date(Number(registeredAt) * 1000).toISOString().split("T")[0] },
    { trait_type: "Namespace", value: isNamespace ? "Yes" : "No" },
  ];
  if (agentId > 0n) attributes.push({ trait_type: "Agent ID", value: `#${agentId}` });

  // Fetch agent + identity text records for ERC-8004 compliance
  const agentKeys = ["agent.uri", "agent.endpoint", "agent.model", "agent.status", "avatar", "description", "url", "xmtp", "com.twitter", "com.github", "org.telegram", "com.discord", "site.key", "net.profile"];
  let texts: Record<string, string> = {};
  try {
    const values = await client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "textMany", args: [name, agentKeys] }) as string[];
    agentKeys.forEach((key, i) => { if (values[i]) texts[key] = values[i]; });
  } catch {}

  // Add non-empty text records as attributes
  for (const [key, val] of Object.entries(texts)) {
    if (key.startsWith("agent.")) {
      attributes.push({ trait_type: key, value: val });
    }
  }

  // Fetch agent metadata from agent.uri if present
  let agentMeta: Record<string, unknown> | null = null;
  if (texts["agent.uri"]) {
    try {
      const r = await fetch(texts["agent.uri"], { signal: AbortSignal.timeout(4000) });
      if (r.ok) agentMeta = await r.json();
    } catch {}
  }

  // ERC-8004 agent token metadata (if registered as agent)
  let erc8004: Record<string, unknown> | null = null;
  if (agentId > 0n) {
    try {
      const [tokenURI, agentOwner] = await Promise.all([
        client.readContract({ address: ERC8004_REGISTRY_ADDRESS, abi: ERC8004_ABI, functionName: "tokenURI", args: [agentId] }),
        client.readContract({ address: ERC8004_REGISTRY_ADDRESS, abi: ERC8004_ABI, functionName: "ownerOf", args: [agentId] }),
      ]);
      erc8004 = { agentId: Number(agentId), tokenURI, owner: agentOwner, registry: ERC8004_REGISTRY_ADDRESS };
    } catch {}
  }

  const metadata: Record<string, unknown> = {
    name: `${name}.hazza.name`,
    description: texts.description || `${name}.hazza.name — an onchain name on Base`,
    image: texts.avatar || `https://hazza.name/api/nft-image/${name}`,
    external_url: `https://${name}.hazza.name`,
    attributes,
    // Identity fields
    owner: nameOwner,
    texts,
  };

  // Agent fields (ERC-8004)
  if (agentId > 0n || texts["agent.uri"]) {
    metadata.agent = {
      id: agentId > 0n ? Number(agentId) : null,
      uri: texts["agent.uri"] || null,
      endpoint: texts["agent.endpoint"] || null,
      model: texts["agent.model"] || null,
      status: texts["agent.status"] || null,
      meta: agentMeta,
      erc8004,
    };
  }

  return c.json(metadata);
});

// Collection-level metadata for marketplaces (contractURI)
app.get("/api/collection-metadata", (c) => {
  return c.json({
    name: "hazza.name",
    description: "Immediately useful names on Base. Powered by x402, XMTP and Net Protocol.",
    image: "https://hazza.name/api/icon",
    banner_image: "https://hazza.name/api/share",
    external_link: "https://hazza.name",
    seller_fee_basis_points: 0,
    fee_recipient: "0x62B7399B2ac7e938Efad06EF8746fDBA3B351900",
  });
});

// List names owned by a wallet
app.get("/api/names/:address", async (c) => {
  const wallet = c.req.param("address") as Address;
  if (!isAddress(wallet)) return c.json({ error: "Invalid address format" }, 400);
  if (wallet === "0x0000000000000000000000000000000000000000") return c.json({ wallet, names: [], total: 0 });
  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  try {
    const [balance, total] = await Promise.all([
      client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "balanceOf", args: [wallet] }),
      client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "totalRegistered" }),
    ]);
    const count = Number(balance);
    if (count === 0) return c.json({ wallet, names: [], total: 0 });
    const totalCount = Number(total);

    // Batch nameOf calls in chunks to find which tokens exist
    const BATCH_SIZE = 50;
    const MAX_TOKENS_TO_CHECK = 10000;
    const names: { name: string; tokenId: string; url: string; status: string; isNamespace: boolean }[] = [];

    for (let start = 1; start <= Math.min(totalCount, MAX_TOKENS_TO_CHECK) && names.length < count; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE - 1, totalCount);
      const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);

      // Batch: get name for each token ID
      const nameResults = await Promise.all(
        ids.map(id =>
          client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "nameOf", args: [BigInt(id)] })
            .catch(() => "")
        )
      );

      // For tokens with names, batch resolve to check ownership
      const validIds: { id: number; name: string }[] = [];
      nameResults.forEach((name, i) => {
        if (name) validIds.push({ id: ids[i], name: name as string });
      });

      if (validIds.length === 0) continue;

      const resolveResults = await Promise.all(
        validIds.map(({ name }) =>
          client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name] })
            .catch(() => null)
        )
      );

      // Filter to names owned by this wallet
      const owned: { id: number; name: string }[] = [];
      resolveResults.forEach((result, i) => {
        if (!result) return;
        const [nameOwner] = result as [string, bigint, bigint, string, bigint, string];
        if (nameOwner.toLowerCase() === wallet.toLowerCase()) {
          owned.push({ id: validIds[i].id, name: validIds[i].name });
        }
      });

      if (owned.length === 0) continue;

      // Batch namespace checks for owned names
      const nsResults = await Promise.all(
        owned.map(({ name }) => {
          const nameHash = keccak256(toBytes(name));
          return client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "namespaces", args: [nameHash] }).catch(() => [null]);
        })
      );

      nsResults.forEach((nsData, i) => {
        const nsAdmin = (nsData as any[])?.[0];
        const isNamespace = !!nsAdmin && nsAdmin !== "0x0000000000000000000000000000000000000000";
        names.push({
          name: owned[i].name,
          tokenId: String(owned[i].id),
          url: `https://${owned[i].name}.hazza.name`,
          image: `https://hazza.name/api/nft-image/${encodeURIComponent(owned[i].name)}`,
          status: "active",
          isNamespace,
        });
      });
    }
    return c.json({ wallet, names, total: names.length });
  } catch {
    return c.json({ error: "Failed to fetch names" }, 500);
  }
});

// Stats
app.get("/api/stats", async (c) => {
  const client = getClient(c.env);
  const total = await client.readContract({
    address: registryAddress(c.env),
    abi: REGISTRY_ABI,
    functionName: "totalRegistered",
  });
  return c.json({
    totalRegistered: total.toString(),
    contract: registryAddress(c.env),
    chain: c.env.CHAIN_ID,
  });
});

// Directory — paginated list of all registered names with owners
app.get("/api/directory", async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") || "20")));
  const search = (c.req.query("q") || "").toLowerCase().trim();
  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  try {
    const total = Number(await client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "totalRegistered" }));
    if (total === 0) return c.json({ entries: [], total: 0, page, pages: 0 });

    // If searching, scan all tokens; otherwise paginate
    if (search) {
      // Search by name prefix or exact wallet
      const isWalletSearch = /^0x[0-9a-f]{4,40}$/i.test(search);
      const entries: { name: string; owner: string; tokenId: number }[] = [];
      const BATCH = 50;

      for (let start = 1; start <= total && entries.length < limit; start += BATCH) {
        const end = Math.min(start + BATCH - 1, total);
        const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);

        const nameResults = await Promise.all(
          ids.map(id => client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "nameOf", args: [BigInt(id)] }).catch(() => ""))
        );

        const validIds: { id: number; name: string }[] = [];
        nameResults.forEach((n, i) => { if (n) validIds.push({ id: ids[i], name: n as string }); });
        if (validIds.length === 0) continue;

        const resolveResults = await Promise.all(
          validIds.map(({ name }) => client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name] }).catch(() => null))
        );

        resolveResults.forEach((result, i) => {
          if (!result) return;
          const [owner] = result as [string, ...unknown[]];
          if (owner === "0x0000000000000000000000000000000000000000") return;
          const n = validIds[i].name;
          const o = (owner as string).toLowerCase();
          if (isWalletSearch ? o.includes(search) : n.includes(search)) {
            entries.push({ name: n, owner: owner as string, tokenId: validIds[i].id });
          }
        });
      }

      return c.json({ entries: entries.slice(0, limit), total: entries.length, page: 1, pages: 1, search });
    }

    // Paginated (no search)
    const pages = Math.ceil(total / limit);
    const startToken = (page - 1) * limit + 1;
    const endToken = Math.min(startToken + limit - 1, total);
    const ids = Array.from({ length: endToken - startToken + 1 }, (_, i) => startToken + i);

    const nameResults = await Promise.all(
      ids.map(id => client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "nameOf", args: [BigInt(id)] }).catch(() => ""))
    );

    const validIds: { id: number; name: string }[] = [];
    nameResults.forEach((n, i) => { if (n) validIds.push({ id: ids[i], name: n as string }); });

    const resolveResults = await Promise.all(
      validIds.map(({ name }) => client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name] }).catch(() => null))
    );

    const entries: { name: string; owner: string; tokenId: number }[] = [];
    resolveResults.forEach((result, i) => {
      if (!result) return;
      const [owner] = result as [string, ...unknown[]];
      if (owner !== "0x0000000000000000000000000000000000000000") {
        entries.push({ name: validIds[i].name, owner: owner as string, tokenId: validIds[i].id });
      }
    });

    return c.json({ entries, total, page, pages });
  } catch (e: any) {
    console.error("Directory error:", e?.message || e);
    return c.json({ error: "Directory lookup failed" }, 500);
  }
});

// ENS name suggestions — look up wallet's ENS name and check HAZZA availability
app.get("/api/ens-names/:address", async (c) => {
  const wallet = c.req.param("address") as Address;
  if (!isAddress(wallet)) return c.json({ error: "Invalid address format" }, 400);

  try {
    const ethClient = getEthMainnetClient(c.env);
    const ensName = await ethClient.getEnsName({ address: wallet });
    if (!ensName) return c.json({ wallet, ensNames: [], suggestions: [] });

    // Extract base name (e.g., "alice.eth" → "alice")
    const baseName = ensName.replace(/\.eth$/, "").toLowerCase();

    // Check availability on HAZZA
    const client = getClient(c.env);
    const available = await client.readContract({
      address: registryAddress(c.env),
      abi: REGISTRY_ABI,
      functionName: "available",
      args: [baseName],
    });

    return c.json({
      wallet,
      ensNames: [ensName],
      suggestions: [{ name: baseName, ensSource: ensName, available }],
    });
  } catch {
    return c.json({ wallet, ensNames: [], suggestions: [] });
  }
});

// =========================================================================
//                     API KEY GENERATION (OFF-CHAIN, KV-BACKED)
// =========================================================================

// Generate API key: user signs a message proving ownership, worker generates key and stores hash in KV
app.post("/api/keys/:name", async (c) => {
  const name = c.req.param("name")?.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
  if (!name) return c.json({ error: "Missing name parameter" }, 400);

  const body = await c.req.json();
  const { address, signature, timestamp } = body;
  if (!address || !signature || !timestamp) {
    return c.json({ error: "Missing address, signature, or timestamp" }, 400);
  }

  // Check timestamp window (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) {
    return c.json({ error: "Signature expired. Try again." }, 400);
  }

  // Verify signature
  const message = `generate-api-key:${name}:${timestamp}`;
  try {
    const valid = await verifyMessage({
      address: address as Address,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) return c.json({ error: "Invalid signature" }, 401);
  } catch {
    return c.json({ error: "Signature verification failed" }, 400);
  }

  // Verify signer owns the name
  const client = getClient(c.env);
  try {
    const result = await client.readContract({
      address: registryAddress(c.env),
      abi: REGISTRY_ABI,
      functionName: "resolve",
      args: [name],
    }) as [string, bigint, bigint, string, bigint, string];
    const nameOwner = result[0];
    if (nameOwner.toLowerCase() !== address.toLowerCase()) {
      return c.json({ error: "You do not own this name" }, 403);
    }
  } catch {
    return c.json({ error: "Name not found" }, 404);
  }

  // Generate key: keccak256(name + owner + random salt + timestamp)
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const saltHex = "0x" + Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const rawKey = keccak256(toBytes(`${name}${address.toLowerCase()}${saltHex}${timestamp}`));

  // Store hash(rawKey) → nameHash in KV (never expires)
  const keyHash = keccak256(toBytes(rawKey));
  const nameHash = keccak256(toBytes(name));
  await c.env.WATCHLIST_KV.put(`apikey:${keyHash}`, nameHash);

  return c.json({ key: rawKey, name });
});

// Revoke API key: user signs a message proving ownership
app.post("/api/keys/:name/revoke", async (c) => {
  const name = c.req.param("name")?.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
  if (!name) return c.json({ error: "Missing name parameter" }, 400);

  const body = await c.req.json();
  const { address, signature, timestamp, apiKey } = body;
  if (!address || !signature || !timestamp || !apiKey) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) {
    return c.json({ error: "Signature expired. Try again." }, 400);
  }

  const message = `revoke-api-key:${name}:${timestamp}`;
  try {
    const valid = await verifyMessage({
      address: address as Address,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) return c.json({ error: "Invalid signature" }, 401);
  } catch {
    return c.json({ error: "Signature verification failed" }, 400);
  }

  // Verify ownership
  const client = getClient(c.env);
  try {
    const result = await client.readContract({
      address: registryAddress(c.env),
      abi: REGISTRY_ABI,
      functionName: "resolve",
      args: [name],
    }) as [string, bigint, bigint, string, bigint, string];
    if (result[0].toLowerCase() !== address.toLowerCase()) {
      return c.json({ error: "You do not own this name" }, 403);
    }
  } catch {
    return c.json({ error: "Name not found" }, 404);
  }

  const keyHash = keccak256(toBytes(apiKey));
  await c.env.WATCHLIST_KV.delete(`apikey:${keyHash}`);
  return c.json({ revoked: true });
});

// =========================================================================
//                     WRITE API (API-KEY AUTHENTICATED)
// =========================================================================

// Helper: verify API key and return the name it's bound to
async function verifyKey(c: any): Promise<{ name: string; nameHash: string } | Response> {
  const auth = c.req.header("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return c.json({ error: "Missing Authorization: Bearer <api-key>" }, 401);
  }
  const rawKey = auth.slice(7).trim();
  if (!rawKey.startsWith("0x") || rawKey.length !== 66) {
    return c.json({ error: "Invalid API key format (expected bytes32 hex)" }, 401);
  }

  const requestedName = c.req.param("name")?.toLowerCase();
  if (!requestedName) {
    return c.json({ error: "Missing name parameter" }, 400);
  }

  // Check KV for the key hash
  const keyHash = keccak256(toBytes(rawKey));
  const storedNameHash = await c.env.WATCHLIST_KV.get(`apikey:${keyHash}`);

  if (!storedNameHash) {
    return c.json({ error: "Invalid or revoked API key" }, 401);
  }

  // Verify the key's nameHash matches the requested name
  const expectedHash = keccak256(toBytes(requestedName));
  if (storedNameHash !== expectedHash) {
    return c.json({ error: "API key is not authorized for this name" }, 403);
  }

  return { name: requestedName, nameHash: storedNameHash };
}

// Set a text record — returns unsigned tx
app.post("/api/text/:name", async (c) => {
  const result = await verifyKey(c);
  if (result instanceof Response) return result;

  const body = await c.req.json();
  const { key, value } = body;
  if (!key || typeof key !== "string") {
    return c.json({ error: "Missing 'key' in request body" }, 400);
  }
  if (typeof value !== "string") {
    return c.json({ error: "Missing 'value' in request body" }, 400);
  }

  const tx = buildTx(c.env, "setText", [result.name, key, value]);
  return c.json({ name: result.name, key, value, tx });
});

// Batch set text records — returns array of unsigned txs
app.post("/api/text/:name/batch", async (c) => {
  const result = await verifyKey(c);
  if (result instanceof Response) return result;

  const body = await c.req.json();
  const { records } = body;
  if (!records || !Array.isArray(records)) {
    return c.json({ error: "Missing 'records' array in request body (each: {key, value})" }, 400);
  }
  if (records.length > 50) {
    return c.json({ error: "Maximum 50 records per batch" }, 400);
  }

  // Validate each record has valid key and value
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (!rec || typeof rec.key !== "string" || rec.key.trim().length === 0) {
      return c.json({ error: `Invalid record at index ${i}: 'key' must be a non-empty string` }, 400);
    }
    if (typeof rec.value !== "string") {
      return c.json({ error: `Invalid record at index ${i}: 'value' must be a string` }, 400);
    }
  }

  const txs = records.map(({ key, value }: { key: string; value: string }) =>
    ({ key, value, tx: buildTx(c.env, "setText", [result.name, key, value]) })
  );
  return c.json({ name: result.name, txs });
});

// Set custom domain — returns unsigned tx
app.post("/api/domain/:name", async (c) => {
  const result = await verifyKey(c);
  if (result instanceof Response) return result;

  const body = await c.req.json();
  const { domain } = body;
  if (!domain || typeof domain !== "string") {
    return c.json({ error: "Missing 'domain' in request body" }, 400);
  }

  const tx = buildTx(c.env, "setCustomDomain", [result.name, domain]);
  return c.json({ name: result.name, domain, tx });
});

// =========================================================================
//                     DNS / DOMAIN MANAGEMENT ENDPOINTS
// =========================================================================

// NOTE: DNS routes MUST come before /api/domains/:name to avoid
// Hono matching "dns" as a :name parameter.

// Check DNS records for a domain (DNS-over-HTTPS via Cloudflare)
app.get("/api/domains/dns/:domain{.+}", async (c) => {
  const domain = c.req.param("domain").toLowerCase();

  // Validate full domain format (e.g. example.com, sub.example.com)
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(\.[a-z]{2,})+$/.test(domain)) {
    return c.json({ error: "Invalid domain format" }, 400);
  }

  const dnsUrl = "https://cloudflare-dns.com/dns-query";
  const headers = { "Accept": "application/dns-json" };

  try {
    // Query CNAME, A, and TXT records in parallel
    const [cnameResp, aResp, txtResp] = await Promise.all([
      fetchWithTimeout(`${dnsUrl}?name=${encodeURIComponent(domain)}&type=CNAME`, { headers }, 5000)
        .then(r => r.json()).catch(() => ({ Answer: [] })),
      fetchWithTimeout(`${dnsUrl}?name=${encodeURIComponent(domain)}&type=A`, { headers }, 5000)
        .then(r => r.json()).catch(() => ({ Answer: [] })),
      fetchWithTimeout(`${dnsUrl}?name=${encodeURIComponent(domain)}&type=TXT`, { headers }, 5000)
        .then(r => r.json()).catch(() => ({ Answer: [] })),
    ]);

    const cname = ((cnameResp as any).Answer || [])
      .filter((r: any) => r.type === 5)
      .map((r: any) => r.data?.replace(/\.$/, "") || r.data);
    const a = ((aResp as any).Answer || [])
      .filter((r: any) => r.type === 1)
      .map((r: any) => r.data);
    const txt = ((txtResp as any).Answer || [])
      .filter((r: any) => r.type === 16)
      .map((r: any) => r.data?.replace(/^"|"$/g, "") || r.data);

    return c.json({
      domain,
      records: { cname, a, txt },
    });
  } catch (e) {
    return c.json({ error: "DNS lookup failed" }, 502);
  }
});

// Verify DNS setup for a domain (check CNAME points to hazza.name)
app.post("/api/domains/dns/:domain{.+}", async (c) => {
  const domain = c.req.param("domain").toLowerCase();

  // Validate full domain format (e.g. example.com, sub.example.com)
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(\.[a-z]{2,})+$/.test(domain)) {
    return c.json({ error: "Invalid domain format" }, 400);
  }

  const dnsUrl = "https://cloudflare-dns.com/dns-query";
  const headers = { "Accept": "application/dns-json" };

  try {
    const cnameResp: any = await fetchWithTimeout(
      `${dnsUrl}?name=${encodeURIComponent(domain)}&type=CNAME`,
      { headers },
      5000,
    ).then(r => r.json()).catch(() => ({ Answer: [] }));

    const cnameRecords = (cnameResp.Answer || [])
      .filter((r: any) => r.type === 5)
      .map((r: any) => (r.data || "").replace(/\.$/, "").toLowerCase());

    const pointsToHazza = cnameRecords.some((cname: string) => cname === "hazza.name");

    return c.json({
      domain,
      verified: pointsToHazza,
      cname: cnameRecords.length > 0 ? cnameRecords[0] : null,
      expected: "hazza.name",
    });
  } catch (e) {
    return c.json({ error: "DNS verification failed" }, 502);
  }
});

// List custom domains for a name (via contract event logs)
// This route MUST come after /api/domains/dns/* to avoid route conflicts
app.get("/api/domains/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: "Invalid name format" }, 400);

  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  // Verify name exists
  const [nameOwner] = await client.readContract({
    address: addr,
    abi: REGISTRY_ABI,
    functionName: "resolve",
    args: [name],
  });

  if (nameOwner === "0x0000000000000000000000000000000000000000") {
    return c.json({ error: "Name not registered" }, 404);
  }

  // Get custom domains from event logs
  // CustomDomainSet(string name, string domain)
  // CustomDomainRemoved(string name, string domain)
  try {
    const setLogs = await client.getContractEvents({
      address: addr,
      abi: [
        { type: "event", name: "CustomDomainSet", inputs: [{ name: "name", type: "string", indexed: false }, { name: "domain", type: "string", indexed: false }] },
      ] as const,
      eventName: "CustomDomainSet",
      fromBlock: 25000000n,
    });

    const removedLogs = await client.getContractEvents({
      address: addr,
      abi: [
        { type: "event", name: "CustomDomainRemoved", inputs: [{ name: "name", type: "string", indexed: false }, { name: "domain", type: "string", indexed: false }] },
      ] as const,
      eventName: "CustomDomainRemoved",
      fromBlock: 25000000n,
    });

    // Merge and sort chronologically to handle set→remove→re-set correctly
    const allEvents = [
      ...setLogs.map(log => ({ type: 'set' as const, block: log.blockNumber, logIndex: log.logIndex, args: log.args })),
      ...removedLogs.map(log => ({ type: 'removed' as const, block: log.blockNumber, logIndex: log.logIndex, args: log.args })),
    ].sort((a, b) => {
      if (a.block !== b.block) return Number(a.block - b.block);
      return (a.logIndex ?? 0) - (b.logIndex ?? 0);
    });

    const domains = new Set<string>();
    for (const ev of allEvents) {
      if (ev.args.name !== name) continue;
      if (ev.type === 'set') {
        domains.add(ev.args.domain as string);
      } else {
        domains.delete(ev.args.domain as string);
      }
    }

    return c.json({ name, domains: Array.from(domains) });
  } catch (e) {
    // Fallback: event log query may fail on some providers
    return c.json({ name, domains: [], note: "Event log query not supported by RPC provider" });
  }
});

// Set operator — returns unsigned tx
app.post("/api/operator/:name", async (c) => {
  const result = await verifyKey(c);
  if (result instanceof Response) return result;

  const body = await c.req.json();
  const { address: operatorAddr } = body;
  if (!operatorAddr || typeof operatorAddr !== "string") {
    return c.json({ error: "Missing 'address' in request body" }, 400);
  }

  const tx = buildTx(c.env, "setOperator", [result.name, operatorAddr]);
  return c.json({ name: result.name, operator: operatorAddr, tx });
});

// Set primary name — returns unsigned tx (user must sign, setPrimaryName requires msg.sender = owner)
app.post("/api/primary/:name", async (c) => {
  const auth = await verifyKey(c);
  if (auth instanceof Response) return auth;
  const name = c.req.param("name");
  const tx = buildTx(c.env, "setPrimaryName", [name]);
  return c.json({ name, tx });
});


// Export all records for a name as a JSON backup
app.get("/api/export/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: "Invalid name" }, 400);
  const client = getClient(c.env);
  const addr = registryAddress(c.env);
  try {
    const [nameOwner, tokenId, registeredAt, operator, agentId, agentWallet] =
      await client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name] });
    if (nameOwner === "0x0000000000000000000000000000000000000000") {
      return c.json({ error: "Name not registered" }, 404);
    }

    const textKeys = ["avatar", "description", "url", "com.twitter", "com.github", "org.telegram", "com.discord", "xyz.farcaster", "com.linkedin", "site.key", "agent.uri", "agent.endpoint", "agent.model", "agent.status", "net.profile", "xmtp", "helixa.id", "netlibrary.member", "netlibrary.pass", "message.delegate", "message.mode"];
    const [textValues, chash] = await Promise.all([
      client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "textMany", args: [name, textKeys] }),
      client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "contenthash", args: [name] }),
    ]);

    const texts: Record<string, string> = {};
    textKeys.forEach((key, i) => {
      if (textValues[i]) texts[key] = textValues[i];
    });

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      name,
      owner: nameOwner,
      tokenId: tokenId.toString(),
      registeredAt: Number(registeredAt),
      operator,
      agentId: agentId.toString(),
      agentWallet,
      contenthash: chash && chash !== "0x" ? chash : null,
      texts,
    };

    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${name}.hazza.json"`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e: any) {
    console.error("Export failed:", e?.message || e);
    return c.json({ error: "Export failed" }, 500);
  }
});

// Event activity for a name — recent registrations, transfers, text record changes
app.get("/api/events/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: "Invalid name" }, 400);
  const client = getClient(c.env);
  const addr = registryAddress(c.env);
  try {
    // Resolve name to get tokenId
    const [nameOwner, tokenId] = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name],
    });
    if (nameOwner === "0x0000000000000000000000000000000000000000") {
      return c.json({ name, events: [] });
    }

    // Query Transfer events for this tokenId (last 10000 blocks)
    const currentBlock = await client.getBlockNumber();
    const fromBlock = currentBlock > 10000n ? currentBlock - 10000n : 0n;

    const transferLogs = await client.getLogs({
      address: addr,
      event: {
        type: "event",
        name: "Transfer",
        inputs: [
          { type: "address", indexed: true, name: "from" },
          { type: "address", indexed: true, name: "to" },
          { type: "uint256", indexed: true, name: "tokenId" },
        ],
      },
      args: { tokenId },
      fromBlock,
    });

    const events = transferLogs.map((log: any) => ({
      type: log.args.from === "0x0000000000000000000000000000000000000000" ? "registration" : "transfer",
      from: log.args.from,
      to: log.args.to,
      tokenId: log.args.tokenId?.toString(),
      blockNumber: log.blockNumber?.toString(),
      txHash: log.transactionHash,
    }));

    return c.json({ name, events });
  } catch (e: any) {
    console.error("Failed to fetch events:", e?.message || e);
    return c.json({ error: "Failed to fetch events" }, 500);
  }
});

// Preview a site URL before publishing
app.get("/api/site/preview", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.json({ error: "Missing ?url= parameter" }, 400);

  // Rate limit: 10 preview requests per IP per minute
  const previewIp = c.req.header("cf-connecting-ip") || "unknown";
  const previewRateKey = `preview-rate:${previewIp}`;
  const previewRateVal = await c.env.WATCHLIST_KV.get(previewRateKey);
  const previewCount = previewRateVal ? parseInt(previewRateVal) : 0;
  if (previewCount >= 10) {
    return c.json({ error: "Rate limit exceeded. Try again in a minute." }, 429);
  }
  await c.env.WATCHLIST_KV.put(previewRateKey, String(previewCount + 1), { expirationTtl: 60 });

  try {
    if (!isAllowedUrl(url)) return c.json({ error: "URL not allowed" }, 400);
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return c.json({ error: `Failed to fetch: ${resp.status}` }, 502);
    const html = await resp.text();
    const banner = `<div style="position:fixed;top:0;left:0;right:0;background:#131325;border-bottom:2px solid #4870D4;padding:0.5rem 1rem;z-index:99999;display:flex;justify-content:space-between;align-items:center;font-family:sans-serif"><span style="color:#CF3748;font-size:0.85rem;font-weight:700">PREVIEW MODE</span><span style="color:#E8DCAB;font-size:0.75rem">This is how your site will look. Changes are not saved yet.</span></div><div style="padding-top:40px">`;
    const wrapped = html.replace(/<body([^>]*)>/i, `<body$1>${banner}`).replace(/<\/body>/i, `</div></body>`);
    return new Response(wrapped, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e: any) {
    console.error("Preview failed:", e?.message || e);
    return c.json({ error: "Preview failed" }, 500);
  }
});

// =========================================================================
//                         x402 PAYMENT PROTOCOL
// =========================================================================

// KV-based replay protection (persists across isolates)
async function isPaymentUsed(env: Env, txHash: string): Promise<boolean> {
  const val = await env.WATCHLIST_KV.get(`payment:${txHash}`);
  return val !== null;
}
async function markPaymentUsed(env: Env, txHash: string): Promise<void> {
  await env.WATCHLIST_KV.put(`payment:${txHash}`, "1", { expirationTtl: 86400 * 30 }); // 30 day TTL
}
async function unmarkPayment(env: Env, txHash: string): Promise<void> {
  await env.WATCHLIST_KV.delete(`payment:${txHash}`);
}

// ---------------------------------------------------------------------------
// Rate limiting for free registrations
//   - 5 free registrations per IP address, PERMANENT (no auto-reset)
//   - Only resets if GEAUX manually overrides via admin API
// ---------------------------------------------------------------------------
const MAX_FREE_PER_IP = 5;

async function checkFreeRegRateLimit(env: Env, ip: string, _owner?: string): Promise<{ allowed: boolean; reason?: string }> {
  if (ip === "unknown") return { allowed: false, reason: "Cannot identify IP address" };
  const key = `freeip:${ip}`;
  const val = await env.WATCHLIST_KV.get(key);
  const count = val ? parseInt(val) : 0;
  if (count >= MAX_FREE_PER_IP) {
    return { allowed: false, reason: `Free registration limit reached for this IP (${MAX_FREE_PER_IP} max). Purchase additional names for $5.` };
  }
  return { allowed: true };
}

async function incrementFreeRegRate(env: Env, ip: string, _owner?: string): Promise<void> {
  if (ip === "unknown") return;
  const key = `freeip:${ip}`;
  const val = await env.WATCHLIST_KV.get(key);
  const count = val ? parseInt(val) + 1 : 1;
  // No expirationTtl — permanent until manual admin reset
  await env.WATCHLIST_KV.put(key, String(count));
}

// ---------------------------------------------------------------------------
// Global daily registration cap (all types: free + paid + pass claims)
//   - Resets at midnight UTC each day
//   - Sends notification when cap is reached
// ---------------------------------------------------------------------------
const GLOBAL_DAILY_CAP = 1000;

function dailyCapKey(): string {
  const d = new Date();
  return `dailycap:${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function checkGlobalDailyCap(env: Env): Promise<{ allowed: boolean; count: number }> {
  const val = await env.WATCHLIST_KV.get(dailyCapKey());
  const count = val ? parseInt(val) : 0;
  return { allowed: count < GLOBAL_DAILY_CAP, count };
}

async function incrementGlobalDailyCap(env: Env): Promise<number> {
  const key = dailyCapKey();
  const val = await env.WATCHLIST_KV.get(key);
  const count = val ? parseInt(val) + 1 : 1;
  // TTL 48 hours — auto-cleans after the day passes
  await env.WATCHLIST_KV.put(key, String(count), { expirationTtl: 172800 });
  return count;
}

// ---------------------------------------------------------------------------
// Registration analytics — logs every registration for tracking
// ---------------------------------------------------------------------------
async function logRegistration(env: Env, data: {
  name: string; owner: string; ip: string; type: "free" | "paid" | "pass_claim";
  txHash: string; timestamp: number;
}): Promise<void> {
  // Per-registration log entry (30-day TTL)
  const entryKey = `reglog:${data.timestamp}:${data.name}`;
  await env.WATCHLIST_KV.put(entryKey, JSON.stringify(data), { expirationTtl: 86400 * 30 });

  // Append to daily summary list (keeps last entry key for listing)
  const dateStr = new Date(data.timestamp).toISOString().slice(0, 10);
  const listKey = `reglist:${dateStr}`;
  const existing = await env.WATCHLIST_KV.get(listKey);
  const entries: string[] = existing ? JSON.parse(existing) : [];
  entries.push(entryKey);
  await env.WATCHLIST_KV.put(listKey, JSON.stringify(entries), { expirationTtl: 86400 * 30 });

  // Per-wallet lifetime counter
  const walletKey = `regcount:wallet:${data.owner.toLowerCase()}`;
  const wVal = await env.WATCHLIST_KV.get(walletKey);
  const wCount = wVal ? parseInt(wVal) + 1 : 1;
  await env.WATCHLIST_KV.put(walletKey, String(wCount));

  // Per-IP lifetime counter (all registration types, not just free)
  const ipKey = `regcount:ip:${data.ip}`;
  const iVal = await env.WATCHLIST_KV.get(ipKey);
  const iCount = iVal ? parseInt(iVal) + 1 : 1;
  await env.WATCHLIST_KV.put(ipKey, String(iCount));
}

// ---------------------------------------------------------------------------
// Notification helper — sends alerts via webhook (Telegram or Discord)
// ---------------------------------------------------------------------------
async function sendNotification(env: Env, message: string): Promise<void> {
  if (!env.NOTIFICATION_WEBHOOK) return;
  try {
    const url = env.NOTIFICATION_WEBHOOK;
    // Support both Telegram Bot API and Discord webhook formats
    if (url.includes("api.telegram.org")) {
      // Telegram: expects ?chat_id=XXX at the end of the webhook URL
      await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message, parse_mode: "HTML" }),
      });
    } else {
      // Discord / generic webhook
      await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
    }
  } catch {
    // Notification failure is non-fatal
  }
}

// Minimal USDC ABI for transfer event verification
const USDC_TRANSFER_ABI = [
  {
    name: "Transfer",
    type: "event",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

app.post("/x402/register", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.name || !body.owner) {
    return c.json({ error: "Missing required fields: name, owner" }, 400);
  }

  const name = String(body.name).toLowerCase();
  const owner = body.owner as Address;

  if (!isValidName(name)) return c.json({ error: "Invalid name format" }, 400);
  if (!isAddress(owner)) return c.json({ error: "Invalid owner address" }, 400);

  // Global daily registration cap
  const { allowed: dailyAllowed, count: dailyCount } = await checkGlobalDailyCap(c.env);
  if (!dailyAllowed) {
    await sendNotification(c.env, `🚨 <b>hazza daily registration cap reached</b>\n${GLOBAL_DAILY_CAP} registrations today. New registrations blocked until midnight UTC.`);
    return c.json({ error: "Daily registration limit reached. Please try again tomorrow." }, 429);
  }

  const client = getClient(c.env);
  const addr = registryAddress(c.env);
  const relayerAddr = c.env.RELAYER_ADDRESS as Address;

  // Check availability
  const available = await client.readContract({
    address: addr, abi: REGISTRY_ABI, functionName: "available", args: [name],
  });
  if (!available) return c.json({ error: "Name not available" }, 409);

  // Verify Unlimited Pass ownership on-chain if claimed
  let verifiedPass = false;
  if (body.hasPass) {
    try {
      const ownsPass = await client.readContract({
        address: UNLIMITED_PASS_ADDRESS,
        abi: UNLIMITED_PASS_ABI,
        functionName: "hasUnlimitedPass",
        args: [owner],
      });
      verifiedPass = !!ownsPass;
    } catch {
      // Pass check failure is non-fatal — proceed without discount
    }
  }

  // Get quote — for first-time wallets, _adjustedPrice() returns 0 (first name free)
  const [totalCost] = await client.readContract({
    address: addr, abi: REGISTRY_ABI, functionName: "quoteName",
    args: [name, owner, 0, false, verifiedPass],
  });

  // --- First registration free: contract returns $0 for first-time wallets ---
  if (totalCost === 0n) {
    // Rate limit free registrations by IP + wallet (2/hour each to prevent sybil farming)
    const clientIp = c.req.header("cf-connecting-ip") || "unknown";
    const rateCheck = await checkFreeRegRateLimit(c.env, clientIp, owner);
    if (!rateCheck.allowed) {
      return c.json({ error: rateCheck.reason || "Rate limited — too many free registrations. Try again later." }, 429);
    }
    try {
      const chainId = Number(c.env.CHAIN_ID);
      const chain = chainId === 8453 ? base : baseSepolia;
      const account = privateKeyToAccount(c.env.RELAYER_PRIVATE_KEY as `0x${string}`);

      const txData = encodeFunctionData({
        abi: REGISTRY_ABI,
        functionName: "registerDirect",
        args: [name, owner, 0, false, "0x0000000000000000000000000000000000000000" as Address, "", false, false],
      });

      let regTxHash: `0x${string}`;
      const primaryRpc = c.env.PAYMASTER_BUNDLER_RPC || c.env.RPC_URL;
      try {
        const walletClient = createWalletClient({ account, chain, transport: http(primaryRpc) });
        regTxHash = await walletClient.sendTransaction({ to: addr, data: txData });
      } catch {
        const walletClient = createWalletClient({ account, chain, transport: http(c.env.RPC_URL) });
        regTxHash = await walletClient.sendTransaction({ to: addr, data: txData });
      }

      const regReceipt = await client.waitForTransactionReceipt({ hash: regTxHash, timeout: 20_000 });
      if (regReceipt.status !== "success") {
        return c.json({ error: "Free registration reverted on-chain", tx: regTxHash }, 500);
      }

      let tokenId = "0";
      try {
        const [, tid] = await client.readContract({
          address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name],
        });
        tokenId = tid.toString();
      } catch { /* non-critical */ }

      await incrementFreeRegRate(c.env, clientIp, owner);
      const newDailyCount = await incrementGlobalDailyCap(c.env);
      await logRegistration(c.env, { name, owner, ip: clientIp, type: "free", txHash: regTxHash, timestamp: Date.now() });

      // Alert at 80% and 95% of daily cap
      if (newDailyCount === Math.floor(GLOBAL_DAILY_CAP * 0.8)) {
        await sendNotification(c.env, `⚠️ <b>hazza registrations at 80%</b>\n${newDailyCount}/${GLOBAL_DAILY_CAP} today.`);
      } else if (newDailyCount === Math.floor(GLOBAL_DAILY_CAP * 0.95)) {
        await sendNotification(c.env, `🔴 <b>hazza registrations at 95%</b>\n${newDailyCount}/${GLOBAL_DAILY_CAP} today.`);
      }

      return c.json({
        name, owner, tokenId,
        registrationTx: regTxHash,
        profileUrl: `https://${name}.hazza.name`,
        firstRegistration: true,
      });
    } catch (e: any) {
      console.error("Free registration failed:", e?.shortMessage || e?.message || e);
      return c.json({ error: "Registration failed. Please try again." }, 500);
    }
  }

  // --- Check Unlimited Pass free claim eligibility via Net Library API ---
  let freeClaimMemberId = 0;
  const nlApiUrl = c.env.NET_LIBRARY_API_URL;
  if (nlApiUrl) {
    try {
      const nlResp = await fetchWithTimeout(`${nlApiUrl}/api/membership?address=${owner}`);
      const nlData: any = await nlResp.json();
      if (nlData?.isMember && nlData?.member?.hasUnlimitedPass && nlData.member.memberId > 0) {
        const claimed = await client.readContract({
          address: addr, abi: REGISTRY_ABI, functionName: "hasClaimedFreeName",
          args: [BigInt(nlData.member.memberId)],
        });
        if (!claimed) {
          freeClaimMemberId = nlData.member.memberId;
        }
      }
    } catch {
      // NL API failure is non-fatal — fall through to normal paid flow
    }
  }

  // --- Unlimited Pass free claim path ---
  if (freeClaimMemberId > 0) {
    try {
      const chainId = Number(c.env.CHAIN_ID);
      const chain = chainId === 8453 ? base : baseSepolia;
      const account = privateKeyToAccount(c.env.RELAYER_PRIVATE_KEY as `0x${string}`);

      const txData = encodeFunctionData({
        abi: REGISTRY_ABI,
        functionName: "registerDirectWithMember",
        args: [
          name, owner, 0,
          false, "0x0000000000000000000000000000000000000000" as Address, "",
          false, true, BigInt(freeClaimMemberId),
        ],
      });

      let regTxHash: `0x${string}`;
      const primaryRpc = c.env.PAYMASTER_BUNDLER_RPC || c.env.RPC_URL;
      try {
        const walletClient = createWalletClient({ account, chain, transport: http(primaryRpc) });
        regTxHash = await walletClient.sendTransaction({ to: addr, data: txData });
      } catch {
        const walletClient = createWalletClient({ account, chain, transport: http(c.env.RPC_URL) });
        regTxHash = await walletClient.sendTransaction({ to: addr, data: txData });
      }

      const regReceipt = await client.waitForTransactionReceipt({ hash: regTxHash, timeout: 20_000 });
      if (regReceipt.status !== "success") {
        return c.json({ error: "Free claim registration reverted on-chain", tx: regTxHash }, 500);
      }

      let tokenId = "0";
      try {
        const [, tid] = await client.readContract({
          address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name],
        });
        tokenId = tid.toString();
      } catch { /* non-critical */ }

      const passIp = c.req.header("cf-connecting-ip") || "unknown";
      await incrementGlobalDailyCap(c.env);
      await logRegistration(c.env, { name, owner, ip: passIp, type: "pass_claim", txHash: regTxHash, timestamp: Date.now() });

      return c.json({
        name, owner, tokenId,
        registrationTx: regTxHash,
        profileUrl: `https://${name}.hazza.name`,
        freeClaim: true,
        memberId: freeClaimMemberId,
      });
    } catch (e: any) {
      console.error("Free claim registration failed:", e?.shortMessage || e?.message || e);
      return c.json({ error: "Registration failed. Please try again." }, 500);
    }
  }

  const paymentHeader = c.req.header("X-PAYMENT");

  // --- No payment → return 402 with requirements ---
  if (!paymentHeader) {
    const requirements = {
      x402Version: "1",
      accepts: [{
        scheme: "exact",
        network: Number(c.env.CHAIN_ID) === 8453 ? "base" : "base-sepolia",
        maxAmountRequired: totalCost.toString(),
        asset: c.env.USDC_ADDRESS,
        payTo: relayerAddr,
        resource: "/x402/register",
      }],
      name,
      price: formatUnits(totalCost, 6),
      currency: "USDC",
    };

    return new Response(JSON.stringify({
      error: "Payment required",
      ...requirements,
    }), {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-REQUIRED": btoa(JSON.stringify(requirements)),
      },
    });
  }

  // --- Payment provided → validate and register ---
  let payment: any;
  try {
    payment = JSON.parse(atob(paymentHeader));
  } catch {
    return c.json({ error: "Invalid X-PAYMENT header (expected base64 JSON)" }, 400);
  }

  if (payment.scheme === "exact") {
    // Verify the USDC transfer tx
    const txHash = payment.txHash as `0x${string}`;
    if (!txHash || !txHash.startsWith("0x") || txHash.length !== 66) {
      return c.json({ error: "Invalid txHash in payment" }, 400);
    }

    // Replay protection (KV-backed, persists across isolates)
    if (await isPaymentUsed(c.env, txHash)) {
      return c.json({ error: "Payment already used" }, 400);
    }

    // Mark immediately to prevent TOCTOU race — unmark if verification fails
    await markPaymentUsed(c.env, txHash);

    // Verify tx on-chain
    let receipt;
    try {
      receipt = await client.getTransactionReceipt({ hash: txHash });
    } catch {
      // RPC failure or tx not yet indexed — unmark payment so user can retry
      await unmarkPayment(c.env, txHash);
      return c.json({ error: "Transaction not found or not confirmed. Please try again." }, 400);
    }

    if (receipt.status !== "success") {
      return c.json({ error: "Transaction failed" }, 400);
    }

    // Verify it's a USDC transfer to the relayer with sufficient amount
    const usdcAddr = c.env.USDC_ADDRESS.toLowerCase();
    const transferTopic = keccak256(toBytes("Transfer(address,address,uint256)"));
    let verified = false;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdcAddr) continue;
      if (log.topics[0] !== transferTopic) continue;

      // topics[1] = "from" address, topics[2] = "to" address (padded to 32 bytes)
      const fromAddr = ("0x" + (log.topics[1] || "").slice(26)).toLowerCase();
      const toAddr = ("0x" + (log.topics[2] || "").slice(26)).toLowerCase();
      if (toAddr !== relayerAddr.toLowerCase()) continue;
      if (fromAddr !== owner.toLowerCase()) continue; // Verify sender is the registrant

      // Decode transfer amount from data
      const transferAmount = BigInt(log.data);
      if (transferAmount >= totalCost) {
        verified = true;
        break;
      }
    }

    if (!verified) {
      await unmarkPayment(c.env, txHash);
      return c.json({ error: "Payment verification failed: no matching USDC transfer to relayer" }, 400);
    }

    // Payment already marked as used above (mark-before-verify pattern)

  } else {
    return c.json({ error: `Unsupported payment scheme: ${payment.scheme}. Use "exact".` }, 400);
  }

  // --- Payment verified — register the name via relayer ---
  try {
    const chainId = Number(c.env.CHAIN_ID);
    const chain = chainId === 8453 ? base : baseSepolia;
    const account = privateKeyToAccount(c.env.RELAYER_PRIVATE_KEY as `0x${string}`);

    // Try paymaster first, fall back to direct
    let regTxHash: `0x${string}`;
    const txData = encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: "registerDirect",
      args: [
        name,
        owner,
        0,      // charCount — 0 means use byte length
        false,  // wantAgent
        "0x0000000000000000000000000000000000000000" as Address, // agentWallet
        "",     // agentURI
        false,  // ensImport
        verifiedPass,  // verifiedPass — 20% discount if Unlimited Pass holder
      ],
    });

    // Try Coinbase RPC first (faster, validated for mainnet), fall back to public RPC
    const primaryRpc = c.env.PAYMASTER_BUNDLER_RPC || c.env.RPC_URL;
    const fallbackRpc = c.env.RPC_URL;

    try {
      const walletClient = createWalletClient({
        account, chain, transport: http(primaryRpc),
      });
      regTxHash = await walletClient.sendTransaction({ to: addr, data: txData });
    } catch {
      // Fallback to public RPC
      const walletClient = createWalletClient({
        account, chain, transport: http(fallbackRpc),
      });
      regTxHash = await walletClient.sendTransaction({ to: addr, data: txData });
    }

    // Wait for confirmation
    const regReceipt = await client.waitForTransactionReceipt({ hash: regTxHash, timeout: 20_000 });

    if (regReceipt.status !== "success") {
      // Un-consume payment so user can retry
      await unmarkPayment(c.env, payment.txHash);
      return c.json({ error: "Registration transaction reverted on-chain. Payment released — you can retry.", tx: regTxHash }, 500);
    }

    // Fetch the new token ID from the resolve
    let tokenId = "0";
    try {
      const [, tid] = await client.readContract({
        address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name],
      });
      tokenId = tid.toString();
    } catch { /* non-critical */ }

    const paidIp = c.req.header("cf-connecting-ip") || "unknown";
    await incrementGlobalDailyCap(c.env);
    await logRegistration(c.env, { name, owner, ip: paidIp, type: "paid", txHash: regTxHash, timestamp: Date.now() });

    return new Response(JSON.stringify({
      name,
      owner,
      tokenId,
      registrationTx: regTxHash,
      profileUrl: `https://${name}.hazza.name`,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-PAYMENT-RESPONSE": regTxHash,
      },
    });

  } catch (e: any) {
    console.error("Registration failed:", e?.shortMessage || e?.message || e);
    // Un-consume payment so user can retry (sendTransaction failed before on-chain execution)
    await unmarkPayment(c.env, payment.txHash);
    return c.json({ error: "Registration failed. Please try again." }, 500);
  }
});

// =========================================================================
//                         REFUND API
// =========================================================================

// Rate limit: 3 refund requests per IP per hour
async function checkRefundRateLimit(env: Env, ip: string): Promise<boolean> {
  if (ip === "unknown") return false;
  const key = `refund-rl:${ip}`;
  const val = await env.WATCHLIST_KV.get(key);
  const count = val ? parseInt(val) : 0;
  return count < 3;
}

async function incrementRefundRateLimit(env: Env, ip: string): Promise<void> {
  if (ip === "unknown") return;
  const key = `refund-rl:${ip}`;
  const val = await env.WATCHLIST_KV.get(key);
  const count = val ? parseInt(val) + 1 : 1;
  await env.WATCHLIST_KV.put(key, String(count), { expirationTtl: 3600 }); // 1 hour TTL
}

// USDC transfer function ABI for sending refunds
const USDC_TRANSFER_FUNC_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

app.post("/api/refund", async (c) => {
  const clientIp = c.req.header("cf-connecting-ip") || "unknown";

  // Rate limit
  if (!(await checkRefundRateLimit(c.env, clientIp))) {
    return c.json({ error: "Too many refund requests. Try again later." }, 429);
  }

  const body = await c.req.json().catch(() => null);
  if (!body || !body.txHash || !body.wallet) {
    return c.json({ error: "Missing required fields: txHash, wallet" }, 400);
  }

  const txHash = body.txHash as string;
  const wallet = body.wallet as string;

  // Validate formats
  if (!txHash.startsWith("0x") || txHash.length !== 66) {
    return c.json({ error: "Invalid transaction hash format" }, 400);
  }
  if (!isAddress(wallet)) {
    return c.json({ error: "Invalid wallet address" }, 400);
  }

  // Check for double refund
  const refundKey = `refund:${txHash}`;
  const alreadyRefunded = await c.env.WATCHLIST_KV.get(refundKey);
  if (alreadyRefunded) {
    return c.json({ error: "Refund already processed for this transaction" }, 400);
  }

  // If payment is marked as used, registration succeeded — no refund
  if (await isPaymentUsed(c.env, txHash)) {
    return c.json({ error: "This payment was used for a successful registration. No refund available." }, 400);
  }

  // Verify the USDC transfer on-chain
  const client = getClient(c.env);
  const relayerAddr = c.env.RELAYER_ADDRESS as Address;

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
  } catch {
    return c.json({ error: "Transaction not found on-chain" }, 400);
  }

  if (receipt.status !== "success") {
    return c.json({ error: "Original transaction failed on-chain — no USDC was transferred" }, 400);
  }

  // Find the USDC transfer to relayer from this wallet
  const usdcAddr = c.env.USDC_ADDRESS.toLowerCase();
  const transferTopic = keccak256(toBytes("Transfer(address,address,uint256)"));
  let refundAmount = 0n;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdcAddr) continue;
    if (log.topics[0] !== transferTopic) continue;

    const fromAddr = ("0x" + (log.topics[1] || "").slice(26)).toLowerCase();
    const toAddr = ("0x" + (log.topics[2] || "").slice(26)).toLowerCase();

    if (fromAddr !== wallet.toLowerCase()) continue;
    if (toAddr !== relayerAddr.toLowerCase()) continue;

    refundAmount = BigInt(log.data);
    break;
  }

  if (refundAmount === 0n) {
    return c.json({ error: "No matching USDC transfer found from your wallet to the relayer" }, 400);
  }

  await incrementRefundRateLimit(c.env, clientIp);

  // Mark as pending refund and notify admin (treasury is a Bankr/SIWA wallet — no auto-send)
  await c.env.WATCHLIST_KV.put(refundKey, JSON.stringify({
    originalTx: txHash,
    wallet,
    amount: refundAmount.toString(),
    status: "pending",
    timestamp: Date.now(),
  }), { expirationTtl: 86400 * 90 }); // 90 day TTL

  await sendNotification(c.env,
    `💸 <b>hazza refund requested</b>\nWallet: <code>${wallet}</code>\nAmount: ${formatUnits(refundAmount, 6)} USDC\nOriginal tx: <code>${txHash}</code>\n\nSend ${formatUnits(refundAmount, 6)} USDC from treasury to the wallet above.`
  );

  return c.json({
    message: "Refund request validated and submitted. You will receive your USDC shortly.",
    amount: formatUnits(refundAmount, 6),
    currency: "USDC",
  });
});

// =========================================================================
//                         MARKETPLACE API (Bazaar)
// =========================================================================

// Helper: create BazaarClient for current chain
function getBazaarClient(env: Env) {
  const chainId = Number(env.CHAIN_ID);
  return new BazaarClient({ chainId, rpcUrl: env.RPC_URL });
}

// Helper: create StorageClient for Net Protocol
function getStorageClient(env: Env) {
  const chainId = Number(env.CHAIN_ID);
  return new StorageClient({ chainId, overrides: { rpcUrls: [env.RPC_URL] } });
}

// Enrich a listing with name data from the registry
async function enrichListing(listing: any, client: any, addr: Address) {
  const tokenId = listing.tokenId;
  try {
    const name = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "nameOf", args: [BigInt(tokenId)],
    });
    if (!name) return null;

    // Detect currency from consideration items
    let currency = "ETH";
    let price = listing.price;
    let priceRaw = listing.priceWei?.toString() || "0";
    if (listing.orderComponents?.consideration?.[0]?.itemType === 1) {
      currency = "USDC";
      // USDC has 6 decimals, but Bazaar SDK formats with 18
      const rawWei = listing.priceWei || 0n;
      price = Number(formatUnits(rawWei, 6));
      priceRaw = rawWei.toString();
    }

    // Fetch avatar + namespace status
    let avatar = "";
    let isNamespace = false;
    try {
      avatar = await client.readContract({
        address: addr, abi: REGISTRY_ABI, functionName: "text", args: [name as string, "avatar"],
      }) as string;
    } catch {}
    try {
      const nameHash = keccak256(toBytes(name as string));
      const nsData = await client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "namespaces", args: [nameHash] });
      const nsAdmin = (nsData as any[])[0];
      isNamespace = !!nsAdmin && nsAdmin !== "0x0000000000000000000000000000000000000000";
    } catch {}

    return {
      name: name as string,
      tokenId: tokenId.toString(),
      seller: listing.maker,
      price,
      priceRaw,
      currency,
      listingExpiry: listing.expirationDate,
      orderHash: listing.orderHash,
      nameStatus: "active",
      isNamespace,
      avatar: avatar || null,
      profileUrl: `https://${name}.hazza.name`,
      messageData: listing.messageData || null,
      orderComponents: listing.orderComponents ? {
        offerer: listing.orderComponents.offerer,
        zone: listing.orderComponents.zone,
        offer: listing.orderComponents.offer?.map((o: any) => ({
          itemType: Number(o.itemType),
          token: o.token,
          identifierOrCriteria: o.identifierOrCriteria?.toString() || "0",
          startAmount: o.startAmount?.toString() || "1",
          endAmount: o.endAmount?.toString() || "1",
        })),
        consideration: listing.orderComponents.consideration?.map((c: any) => ({
          itemType: Number(c.itemType),
          token: c.token,
          identifierOrCriteria: c.identifierOrCriteria?.toString() || "0",
          startAmount: c.startAmount?.toString() || "0",
          endAmount: c.endAmount?.toString() || "0",
          recipient: c.recipient,
        })),
        orderType: Number(listing.orderComponents.orderType),
        startTime: listing.orderComponents.startTime?.toString() || "0",
        endTime: listing.orderComponents.endTime?.toString() || "0",
        zoneHash: listing.orderComponents.zoneHash,
        salt: listing.orderComponents.salt?.toString() || "0",
        conduitKey: listing.orderComponents.conduitKey,
        counter: listing.orderComponents.counter?.toString() || "0",
        totalOriginalConsiderationItems: listing.orderComponents.totalOriginalConsiderationItems?.toString() || "0",
      } : null,
    };
  } catch {
    return null;
  }
}

// =========================================================================
//                        MESSAGE BOARD
// =========================================================================

const FORUM_STORAGE_KEY = "hazza-forum";
const FORUM_MAX_MESSAGES = 200;
const FORUM_MAX_LENGTH = 500;
const FORUM_RATE_LIMIT_TTL = 60; // 1 post per minute per IP

// GET /api/bounty/:tokenId — check for active agent bounty on escrow contract
const BOUNTY_ESCROW_ABI = [
  { name: "getBounty", type: "function", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "seller", type: "address" },
      { name: "bountyAmount", type: "uint256" },
      { name: "agent", type: "address" },
      { name: "claimed", type: "bool" },
      { name: "active", type: "bool" },
    ],
  },
] as const;

const BOUNTY_ESCROW_ADDRESS = "0x4Af1B18C01250A52f29CEacA055164628b643ae9";

app.get("/api/bounty/:tokenId", async (c) => {
  const tokenIdParam = c.req.param("tokenId");
  if (!/^\d+$/.test(tokenIdParam) || tokenIdParam === "0") {
    return c.json({ error: "Invalid tokenId: must be a positive integer" }, 400);
  }
  try {
    const client = getClient(c.env);
    const [seller, bountyAmount, agent, claimed, active] = await client.readContract({
      address: BOUNTY_ESCROW_ADDRESS as `0x${string}`,
      abi: BOUNTY_ESCROW_ABI,
      functionName: "getBounty",
      args: [BigInt(tokenIdParam)],
    });
    if (!active) {
      return c.json({ active: false });
    }
    return c.json({
      active: true,
      seller,
      bountyAmount: formatEther(bountyAmount),
      bountyAmountWei: bountyAmount.toString(),
      agent: agent === "0x0000000000000000000000000000000000000000" ? null : agent,
      claimed,
    });
  } catch (e: any) {
    console.error("Bounty lookup failed:", e?.message || e);
    return c.json({ active: false, error: "Bounty lookup failed" });
  }
});

// GET /api/board — fetch forum messages from Net Protocol storage
app.get("/api/board", async (c) => {
  try {
    const storage = getStorageClient(c.env);
    const relayerAddr = c.env.RELAYER_ADDRESS as `0x${string}`;
    const result = await storage.get({ key: FORUM_STORAGE_KEY, operator: relayerAddr });
    if (result && result.value) {
      try {
        const messages = JSON.parse(result.value);
        return c.json({ messages: Array.isArray(messages) ? messages : [] });
      } catch {
        return c.json({ messages: [] });
      }
    }
    return c.json({ messages: [] });
  } catch (e: any) {
    // Fallback: try KV for any legacy messages during migration
    try {
      const data = await c.env.WATCHLIST_KV.get("board:messages", "json") as any[] | null;
      if (data && data.length > 0) return c.json({ messages: data });
    } catch {}
    console.error("Board fetch failed:", e?.message || e);
    return c.json({ messages: [], error: "Failed to load messages" });
  }
});

// POST /api/board — post a forum message, stored onchain via Net Protocol
app.post("/api/board", async (c) => {
  try {
    const body = await c.req.json();
    const { text, author, signature } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return c.json({ error: "Message text required" }, 400);
    }
    if (text.length > FORUM_MAX_LENGTH) {
      return c.json({ error: `Message too long (max ${FORUM_MAX_LENGTH} chars)` }, 400);
    }
    if (!author || !isAddress(author)) {
      return c.json({ error: "Valid wallet address required" }, 400);
    }
    if (!signature) {
      return c.json({ error: "Signature required" }, 400);
    }

    // Rate limit by IP (still use KV for ephemeral rate data)
    const ip = c.req.header("cf-connecting-ip") || "unknown";
    const rateKey = `forum-rate:${ip}`;
    const lastPost = await c.env.WATCHLIST_KV.get(rateKey);
    if (lastPost) {
      return c.json({ error: "Please wait before posting again" }, 429);
    }

    // Rate limit by wallet address
    const walletRateKey = `board-rate:${author.toLowerCase()}`;
    const walletRateVal = await c.env.WATCHLIST_KV.get(walletRateKey);
    if (walletRateVal) {
      return c.json({ error: "Rate limit: 1 post per minute per wallet" }, 429);
    }

    // Verify signature
    const expectedMessage = "hazza board post: " + text.trim();
    const valid = await verifyMessage({
      address: author as Address,
      message: expectedMessage,
      signature: signature as `0x${string}`,
    });
    if (!valid) {
      return c.json({ error: "Invalid signature" }, 401);
    }

    // Resolve hazza name for the author
    let authorName: string | null = null;
    try {
      const client = getClient(c.env);
      const addr = registryAddress(c.env);
      const name = await client.readContract({
        address: addr,
        abi: REGISTRY_ABI,
        functionName: "reverseResolve",
        args: [author],
      }) as string;
      if (name) authorName = name;
    } catch {}

    // Load existing messages from Net Protocol
    const storage = getStorageClient(c.env);
    const relayerAddr = c.env.RELAYER_ADDRESS as `0x${string}`;
    let messages: any[] = [];
    try {
      const result = await storage.get({ key: FORUM_STORAGE_KEY, operator: relayerAddr });
      if (result && result.value) {
        const parsed = JSON.parse(result.value);
        if (Array.isArray(parsed)) messages = parsed;
      }
    } catch {}

    // Add new message at the top
    messages.unshift({
      text: text.trim(),
      author,
      authorName,
      timestamp: Date.now(),
    });

    // Cap at max
    if (messages.length > FORUM_MAX_MESSAGES) {
      messages.length = FORUM_MAX_MESSAGES;
    }

    // Write to Net Protocol via relayer wallet
    const txConfig = storage.preparePut({
      key: FORUM_STORAGE_KEY,
      text: "hazza forum messages",
      value: JSON.stringify(messages),
    });

    const chainId = Number(c.env.CHAIN_ID);
    const chain = chainId === 8453 ? base : baseSepolia;
    const account = privateKeyToAccount(c.env.RELAYER_PRIVATE_KEY as `0x${string}`);
    const walletClient = createWalletClient({ account, chain, transport: http(c.env.RPC_URL) });

    await walletClient.writeContract({
      address: txConfig.to as `0x${string}`,
      abi: txConfig.abi,
      functionName: txConfig.functionName,
      args: txConfig.args as any[],
    });

    // Set rate limit (ephemeral, KV is fine for this)
    await c.env.WATCHLIST_KV.put(rateKey, "1", { expirationTtl: FORUM_RATE_LIMIT_TTL });
    await c.env.WATCHLIST_KV.put(walletRateKey, "1", { expirationTtl: 60 });

    return c.json({ ok: true });
  } catch (e: any) {
    console.error("Board post failed:", e?.message || e);
    return c.json({ error: "Failed to post message" }, 500);
  }
});

// GET /api/marketplace/listings — active HAZZA name listings
app.get("/api/marketplace/listings", async (c) => {
  try {
    const bazaar = getBazaarClient(c.env);
    const nftAddress = registryAddress(c.env);
    const rawListings = await bazaar.getListings({ nftAddress });

    const client = getClient(c.env);
    const addr = registryAddress(c.env);

    const enriched = await Promise.all(
      rawListings.map((l: any) => enrichListing(l, client, addr))
    );

    return c.json({
      listings: enriched.filter(Boolean),
      total: enriched.filter(Boolean).length,
    });
  } catch (e: any) {
    console.error("Marketplace listings failed:", e?.message || e);
    return c.json({ listings: [], total: 0, error: "Failed to fetch listings" });
  }
});

// GET /api/marketplace/offers — active collection offers
app.get("/api/marketplace/offers", async (c) => {
  try {
    const bazaar = getBazaarClient(c.env);
    const nftAddress = registryAddress(c.env);
    const rawOffers = await bazaar.getCollectionOffers({ nftAddress });

    return c.json({
      offers: rawOffers.map((o: any) => ({
        offerer: o.maker,
        price: o.price,
        priceRaw: o.priceWei?.toString() || "0",
        currency: o.currency || "ETH",
        expirationDate: o.expirationDate,
        orderHash: o.orderHash,
      })),
      total: rawOffers.length,
    });
  } catch (e: any) {
    console.error("Marketplace offers failed:", e?.message || e);
    return c.json({ offers: [], total: 0, error: "Failed to fetch offers" });
  }
});

// GET /api/marketplace/sales — recent sales
app.get("/api/marketplace/sales", async (c) => {
  try {
    const bazaar = getBazaarClient(c.env);
    const nftAddress = registryAddress(c.env);
    const rawSales = await bazaar.getSales({ nftAddress });

    const client = getClient(c.env);
    const addr = registryAddress(c.env);

    const enrichedSales = await Promise.all(
      rawSales.slice(0, 50).map(async (s: any) => {
        let name = "";
        try {
          name = await client.readContract({
            address: addr, abi: REGISTRY_ABI, functionName: "nameOf", args: [BigInt(s.tokenId)],
          }) as string;
        } catch {}

        let currency = "ETH";
        let price = s.price;
        if (s.itemType === 1) {
          currency = "USDC";
          price = Number(formatUnits(s.priceWei || 0n, 6));
        }

        return {
          name: name || `Token #${s.tokenId}`,
          tokenId: s.tokenId,
          seller: s.seller,
          buyer: s.buyer,
          price,
          priceRaw: s.priceWei?.toString() || "0",
          currency,
          timestamp: s.timestamp,
          orderHash: s.orderHash,
        };
      })
    );

    return c.json({ sales: enrichedSales, total: enrichedSales.length });
  } catch (e: any) {
    console.error("Marketplace sales failed:", e?.message || e);
    return c.json({ sales: [], total: 0, error: "Failed to fetch sales" });
  }
});

// Watchlist endpoints (Worker KV)
app.get("/api/marketplace/watch/:orderHash", async (c) => {
  const orderHash = c.req.param("orderHash");
  try {
    const data = await c.env.WATCHLIST_KV.get(`watch:${orderHash}`, "json") as string[] | null;
    return c.json({ orderHash, count: data ? data.length : 0 });
  } catch {
    return c.json({ orderHash, count: 0 });
  }
});

app.post("/api/marketplace/watch", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.orderHash || !body?.address) {
    return c.json({ error: "Missing orderHash and address" }, 400);
  }
  if (!isAddress(body.address)) {
    return c.json({ error: "Invalid address" }, 400);
  }
  // Rate limit: 20 watch actions per IP per hour
  const watchIp = c.req.header("cf-connecting-ip") || "unknown";
  const watchRateKey = `watchrate:${watchIp}`;
  const watchCount = parseInt(await c.env.WATCHLIST_KV.get(watchRateKey) || "0");
  if (watchCount >= 20) {
    return c.json({ error: "Rate limited — too many watch actions" }, 429);
  }
  await c.env.WATCHLIST_KV.put(watchRateKey, String(watchCount + 1), { expirationTtl: 3600 });

  const key = `watch:${body.orderHash}`;
  try {
    const existing = (await c.env.WATCHLIST_KV.get(key, "json") as string[] | null) || [];
    const addr = body.address.toLowerCase();
    if (!existing.includes(addr)) {
      existing.push(addr);
      await c.env.WATCHLIST_KV.put(key, JSON.stringify(existing), { expirationTtl: 86400 * 90 });
    }
    return c.json({ orderHash: body.orderHash, count: existing.length });
  } catch (e: any) {
    console.error("Watch add failed:", e?.message || e);
    return c.json({ error: "Failed to update watchlist" }, 500);
  }
});

app.delete("/api/marketplace/watch", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.orderHash || !body?.address) {
    return c.json({ error: "Missing orderHash and address" }, 400);
  }
  const key = `watch:${body.orderHash}`;
  try {
    const existing = (await c.env.WATCHLIST_KV.get(key, "json") as string[] | null) || [];
    const addr = body.address.toLowerCase();
    const filtered = existing.filter((a: string) => a !== addr);
    if (filtered.length === 0) {
      await c.env.WATCHLIST_KV.delete(key);
    } else {
      await c.env.WATCHLIST_KV.put(key, JSON.stringify(filtered), { expirationTtl: 86400 * 90 });
    }
    return c.json({ orderHash: body.orderHash, count: filtered.length });
  } catch (e: any) {
    console.error("Watch remove failed:", e?.message || e);
    return c.json({ error: "Failed to update watchlist" }, 500);
  }
});

// POST /api/marketplace/fulfill — prepare buy transaction via SDK
app.post("/api/marketplace/fulfill", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.orderHash || !body?.buyerAddress) {
    return c.json({ error: "Missing orderHash and buyerAddress" }, 400);
  }
  try {
    const bazaar = getBazaarClient(c.env);
    const nftAddress = registryAddress(c.env);
    const rawListings = await bazaar.getListings({ nftAddress });
    const listing = rawListings.find((l: any) => l.orderHash === body.orderHash);
    if (!listing) return c.json({ error: "Listing not found or no longer active" }, 404);

    // Check order hasn't expired (Seaport would reject anyway, but give a better error)
    const orderEndTime = listing.endTime || listing.orderComponents?.endTime;
    if (orderEndTime) {
      const endTimeSec = Number(orderEndTime);
      if (endTimeSec > 0 && endTimeSec < Math.floor(Date.now() / 1000)) {
        return c.json({ error: "This listing has expired" }, 410);
      }
    }

    const prepared = await bazaar.prepareFulfillListing(listing, body.buyerAddress as `0x${string}`);
    // Return approval txs + fulfillment tx as serialized calldata
    // Parse approve(address,uint256) calldata to extract spender + amount for batch executor
    const parseApproval = (a: any) => {
      const data = a.data || "";
      let spender = "", amount = "0";
      if (data.startsWith("0x095ea7b3") && data.length >= 138) {
        spender = "0x" + data.slice(34, 74);
        amount = BigInt("0x" + data.slice(74, 138)).toString();
      }
      return { to: a.to, data, value: a.value?.toString() || "0", spender, amount };
    };
    // Include order metadata so the frontend can verify what the buyer is paying
    const orderMeta = {
      seller: listing.offerer || listing.seller || null,
      price: listing.price || null,
      currency: listing.currency || "ETH",
      name: listing.name || null,
      tokenId: listing.tokenId?.toString() || null,
      seaportAddress: prepared.fulfillment.to, // should always be Seaport
    };

    return c.json({
      approvals: prepared.approvals.map(parseApproval),
      fulfillment: {
        to: prepared.fulfillment.to,
        data: prepared.fulfillment.data,
        value: prepared.fulfillment.value?.toString() || "0",
      },
      orderMeta,
    });
  } catch (e: any) {
    console.error("Fulfill listing failed:", e?.message || e);
    return c.json({ error: "Failed to prepare fulfillment" }, 500);
  }
});

// POST /api/marketplace/fulfill-offer — prepare offer acceptance transaction via SDK
app.post("/api/marketplace/fulfill-offer", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.orderHash || !body?.tokenId || !body?.sellerAddress) {
    return c.json({ error: "Missing orderHash, tokenId, and sellerAddress" }, 400);
  }
  try {
    const bazaar = getBazaarClient(c.env);
    const nftAddress = registryAddress(c.env);
    const rawOffers = await bazaar.getCollectionOffers({ nftAddress });
    const offer = rawOffers.find((o: any) => o.orderHash === body.orderHash);
    if (!offer) return c.json({ error: "Offer not found or no longer active" }, 404);

    const prepared = await bazaar.prepareFulfillCollectionOffer(offer, body.tokenId, body.sellerAddress as `0x${string}`);
    const parseApproval2 = (a: any) => {
      const data = a.data || "";
      let spender = "", amount = "0";
      if (data.startsWith("0x095ea7b3") && data.length >= 138) {
        spender = "0x" + data.slice(34, 74);
        amount = BigInt("0x" + data.slice(74, 138)).toString();
      }
      return { to: a.to, data, value: a.value?.toString() || "0", spender, amount };
    };
    return c.json({
      approvals: prepared.approvals.map(parseApproval2),
      fulfillment: {
        to: prepared.fulfillment.to,
        data: prepared.fulfillment.data,
        value: prepared.fulfillment.value?.toString() || "0",
      },
    });
  } catch (e: any) {
    console.error("Fulfill offer failed:", e?.message || e);
    return c.json({ error: "Failed to prepare offer fulfillment" }, 500);
  }
});

// =========================================================================
//                    OTC OFFERS (Individual Name Offers)
// =========================================================================

const ALLOWED_OFFER_CURRENCIES = ["ETH", "WETH", "USDC"];
const MAX_OFFERS_PER_NAME = 50;
const MAX_OFFER_DURATION_SECS = 30 * 86400; // 30 days max
const ALLOWED_BROKERS: Record<string, number> = {
  // hazza agent (TBD) — 1% broker fee, 1% platform fee
  "0xa6eb678f607bb811a25e2071a7aae6f53e674e7d": 100,
};

// POST /api/marketplace/offer — submit a signed offer for a specific name
// Stores Seaport order data in KV. Supports broker fee split (e.g. agent 1% + hazza 1%).
app.post("/api/marketplace/offer", async (c) => {
  // Rate limit: 10 offers per IP per hour
  const offerIp = c.req.header("cf-connecting-ip") || "unknown";
  const offerIpKey = `offerrate:${offerIp}`;
  const offerIpCount = parseInt(await c.env.WATCHLIST_KV.get(offerIpKey) || "0");
  if (offerIpCount >= 10) {
    return c.json({ error: "Rate limited — too many offers. Try again later." }, 429);
  }

  const body = await c.req.json().catch(() => null);
  if (!body?.name || !body?.offerer || !body?.price || !body?.signature || !body?.orderComponents) {
    return c.json({ error: "Missing required fields: name, offerer, price, signature, orderComponents" }, 400);
  }

  const name = body.name.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
  if (!name) return c.json({ error: "Invalid name" }, 400);
  if (!isAddress(body.offerer)) return c.json({ error: "Invalid offerer address" }, 400);

  // Validate price is a positive number
  const priceNum = parseFloat(body.price);
  if (isNaN(priceNum) || priceNum <= 0 || priceNum > 1e12) {
    return c.json({ error: "Invalid price" }, 400);
  }
  const priceStr = priceNum.toString();

  // Validate currency
  const currency = ALLOWED_OFFER_CURRENCIES.includes(body.currency) ? body.currency : "WETH";

  // Validate broker — must be on allowlist
  let broker: string | null = null;
  let brokerFeeBps = 0;
  let platformFeeBps = parseInt(c.env.MARKETPLACE_FEE_BPS) || 0;
  if (body.broker && isAddress(body.broker)) {
    const brokerAddr = body.broker.toLowerCase();
    if (ALLOWED_BROKERS[brokerAddr] !== undefined) {
      broker = brokerAddr;
      brokerFeeBps = ALLOWED_BROKERS[brokerAddr];
      platformFeeBps = Math.max(0, platformFeeBps - brokerFeeBps); // split: e.g. 200 total → 100 platform + 100 broker
    }
    // Unapproved brokers are silently ignored — full fee goes to platform
  }

  // Validate expiresAt — cap at 30 days
  const now = Math.floor(Date.now() / 1000);
  let expiresAt = Math.floor(Number(body.expiresAt) || 0);
  if (expiresAt <= now || expiresAt > now + MAX_OFFER_DURATION_SECS) {
    expiresAt = now + 7 * 86400; // default 7 days
  }

  // Validate orderComponents size (prevent KV bloat)
  const ocStr = JSON.stringify(body.orderComponents);
  if (ocStr.length > 10240) {
    return c.json({ error: "Order components too large" }, 400);
  }

  // Validate orderComponents structure — prevent malicious consideration items
  const oc = body.orderComponents;
  if (!oc || !Array.isArray(oc.offer) || !Array.isArray(oc.consideration)) {
    return c.json({ error: "Invalid orderComponents: missing offer or consideration arrays" }, 400);
  }
  if (oc.offerer?.toLowerCase() !== body.offerer.toLowerCase()) {
    return c.json({ error: "orderComponents.offerer does not match claimed offerer" }, 400);
  }
  // Verify the WETH offer amount matches the claimed price
  const WETH_ADDR = "0x4200000000000000000000000000000000000006".toLowerCase();
  const offerWeth = oc.offer.filter((o: any) => o.token?.toLowerCase() === WETH_ADDR && (o.itemType === 1 || o.itemType === "1"));
  if (offerWeth.length === 0) {
    return c.json({ error: "orderComponents.offer must include WETH" }, 400);
  }
  const totalOfferWei = offerWeth.reduce((sum: bigint, o: any) => sum + BigInt(o.startAmount || "0"), 0n);
  const claimedWei = BigInt(Math.floor(priceNum * 1e18));
  const tolerance = claimedWei / 1000n; // 0.1% tolerance for rounding
  if (totalOfferWei < claimedWei - tolerance || totalOfferWei > claimedWei + tolerance) {
    return c.json({ error: "orderComponents WETH amount does not match claimed price" }, 400);
  }

  // Verify the name exists and get tokenId
  const client = getClient(c.env);
  const addr = registryAddress(c.env);
  try {
    const [nameOwner, tokenId] = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name],
    }) as [string, bigint, bigint, bigint, string, bigint, string];
    if (nameOwner === "0x0000000000000000000000000000000000000000") {
      return c.json({ error: "Name not registered" }, 404);
    }

    // Validate consideration recipients — must only target the name owner, treasury, or known addresses
    const nftAddr = addr.toLowerCase();
    const treasuryAddr = (c.env.HAZZA_TREASURY || "").toLowerCase();
    const bountyEscrowAddr = "0xb2e8181fc2d3417ea0e2df494a9f6152d37a1a27";
    const allowedRecipients = new Set([
      (nameOwner as string).toLowerCase(), // seller
      body.offerer.toLowerCase(),          // offerer (gets NFT back in consideration)
      treasuryAddr,                        // marketplace fee
      bountyEscrowAddr,                    // bounty escrow
    ].filter(Boolean));
    for (const item of oc.consideration) {
      const recipient = (item.recipient || "").toLowerCase();
      // ERC-721 items (type 2) going to the offerer are expected
      if (item.itemType === 2 || item.itemType === "2") continue;
      if (!allowedRecipients.has(recipient)) {
        return c.json({ error: `Unexpected consideration recipient: ${recipient}` }, 400);
      }
    }

    const offer = {
      id: `offer:${name}:${body.offerer.toLowerCase()}:${Date.now()}`,
      name,
      tokenId: tokenId.toString(),
      offerer: body.offerer.toLowerCase(),
      price: priceStr,
      currency,
      broker,
      brokerFeeBps,
      platformFeeBps,
      orderComponents: body.orderComponents,
      signature: body.signature,
      expiresAt,
      createdAt: now,
      owner: nameOwner.toLowerCase(),
    };

    // Store in KV: per-name list
    const nameKey = `offers:${name}`;
    const existing = (await c.env.WATCHLIST_KV.get(nameKey, "json") as any[] | null) || [];

    // Filter expired first
    const active = existing.filter((o: any) => o.expiresAt > now);

    // Cap offers per name
    const idx = active.findIndex((o: any) => o.offerer === offer.offerer);
    if (idx >= 0) {
      active[idx] = offer; // replace existing from same offerer
    } else if (active.length >= MAX_OFFERS_PER_NAME) {
      return c.json({ error: "Too many offers on this name. Try again later." }, 429);
    } else {
      active.push(offer);
    }

    // Set TTL to the latest expiration in the array
    const maxExpiry = Math.max(...active.map((o: any) => o.expiresAt));
    const ttl = Math.min(maxExpiry - now + 86400, MAX_OFFER_DURATION_SECS + 86400); // +1 day buffer
    await c.env.WATCHLIST_KV.put(nameKey, JSON.stringify(active), {
      expirationTtl: Math.max(ttl, 60),
    });

    // Increment rate limit counter
    await c.env.WATCHLIST_KV.put(offerIpKey, String(offerIpCount + 1), { expirationTtl: 3600 });

    return c.json({ success: true, offer: { id: offer.id, name, price: offer.price, expiresAt: offer.expiresAt } });
  } catch (e: any) {
    return c.json({ error: "Failed to submit offer" }, 500);
  }
});

// GET /api/marketplace/offers/:name — get all offers for a specific name
app.get("/api/marketplace/offers/:name", async (c) => {
  const name = c.req.param("name").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
  if (!name) return c.json({ offers: [] });
  try {
    const nameKey = `offers:${name}`;
    const offers = (await c.env.WATCHLIST_KV.get(nameKey, "json") as any[] | null) || [];
    // Filter expired
    const now = Math.floor(Date.now() / 1000);
    const active = offers.filter((o: any) => o.expiresAt > now);
    // Clean up expired (only rewrite if something was removed)
    if (active.length !== offers.length) {
      const maxExpiry = active.length > 0 ? Math.max(...active.map((o: any) => o.expiresAt)) : now;
      const ttl = Math.min(maxExpiry - now + 86400, MAX_OFFER_DURATION_SECS + 86400);
      await c.env.WATCHLIST_KV.put(nameKey, JSON.stringify(active), { expirationTtl: Math.max(ttl, 60) });
    }
    return c.json({ offers: active, total: active.length });
  } catch (e: any) {
    return c.json({ offers: [] });
  }
});

// GET /api/marketplace/all-offers — get all active offers across all names (for the offers tab)
app.get("/api/marketplace/all-offers", async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query("limit") || "100"), 200);
    const keys = await c.env.WATCHLIST_KV.list({ prefix: "offers:", limit: 100 });
    const allOffers: any[] = [];
    const now = Math.floor(Date.now() / 1000);
    // Parallel KV reads instead of sequential
    const results = await Promise.all(
      keys.keys.map((key) => c.env.WATCHLIST_KV.get(key.name, "json").catch(() => null))
    );
    for (const offers of results) {
      if (!Array.isArray(offers)) continue;
      for (const o of offers) {
        if (o.expiresAt > now) allOffers.push(o);
        if (allOffers.length >= limit) break;
      }
      if (allOffers.length >= limit) break;
    }
    // Sort by newest first
    allOffers.sort((a: any, b: any) => b.createdAt - a.createdAt);
    return c.json({ offers: allOffers.slice(0, limit), total: allOffers.length });
  } catch (e: any) {
    return c.json({ offers: [], total: 0 });
  }
});

// DELETE /api/marketplace/offer — cancel an offer
// Requires a signed message from the offerer to prove ownership
app.delete("/api/marketplace/offer", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.name || !body?.offerer || !body?.signature) {
    return c.json({ error: "Missing name, offerer, and signature" }, 400);
  }
  if (!isAddress(body.offerer)) return c.json({ error: "Invalid offerer address" }, 400);

  // Verify the signature proves the caller controls the offerer address
  // Message format: "cancel-offer:{name}:{offerer}:{timestamp}"
  const timestamp = Math.floor(Number(body.timestamp) || 0);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) { // 5 minute window
    return c.json({ error: "Signature expired. Try again." }, 400);
  }

  try {
    const message = `cancel-offer:${body.name.toLowerCase()}:${body.offerer.toLowerCase()}:${timestamp}`;
    const valid = await verifyMessage({
      address: body.offerer as `0x${string}`,
      message,
      signature: body.signature as `0x${string}`,
    });
    if (!valid) {
      return c.json({ error: "Invalid signature — you can only cancel your own offers" }, 403);
    }
  } catch {
    return c.json({ error: "Signature verification failed" }, 400);
  }

  const name = body.name.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
  try {
    const nameKey = `offers:${name}`;
    const existing = (await c.env.WATCHLIST_KV.get(nameKey, "json") as any[] | null) || [];
    const filtered = existing.filter((o: any) => o.offerer !== body.offerer.toLowerCase());
    if (filtered.length > 0) {
      const maxExpiry = Math.max(...filtered.map((o: any) => o.expiresAt));
      const ttl = Math.min(maxExpiry - now + 86400, MAX_OFFER_DURATION_SECS + 86400);
      await c.env.WATCHLIST_KV.put(nameKey, JSON.stringify(filtered), { expirationTtl: Math.max(ttl, 60) });
    } else {
      await c.env.WATCHLIST_KV.delete(nameKey);
    }
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: "Failed to cancel offer" }, 500);
  }
});

// =========================================================================
//                       ADMIN API (analytics + overrides)
// =========================================================================

function isAdminAuthed(c: any): boolean {
  const key = c.req.header("x-admin-key") || "";
  return !!c.env.ADMIN_API_KEY && key === c.env.ADMIN_API_KEY;
}

// Admin brute-force protection middleware — rate limit failed auth attempts
app.use("/api/admin/*", async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  const adminRateKey = `admin-rate:${ip}`;
  const adminAttempts = parseInt(await c.env.WATCHLIST_KV.get(adminRateKey) || "0");
  if (adminAttempts >= 5) {
    return c.json({ error: "Too many attempts" }, 429);
  }
  if (!isAdminAuthed(c)) {
    await c.env.WATCHLIST_KV.put(adminRateKey, String(adminAttempts + 1), { expirationTtl: 300 });
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

// GET /api/admin/stats — daily registration stats
app.get("/api/admin/stats", async (c) => {

  const today = new Date().toISOString().slice(0, 10);
  const dateParam = c.req.query("date") || today;

  // Daily count
  const capKey = `dailycap:${dateParam}`;
  const capVal = await c.env.WATCHLIST_KV.get(capKey);
  const dailyCount = capVal ? parseInt(capVal) : 0;

  // Daily registration list
  const listKey = `reglist:${dateParam}`;
  const listVal = await c.env.WATCHLIST_KV.get(listKey);
  const entryKeys: string[] = listVal ? JSON.parse(listVal) : [];

  // Fetch all entries (up to 100 most recent)
  const recentKeys = entryKeys.slice(-100);
  const entries = await Promise.all(
    recentKeys.map(async (k) => {
      const v = await c.env.WATCHLIST_KV.get(k);
      return v ? JSON.parse(v) : null;
    })
  );

  // Aggregate by type, IP, wallet
  const byType: Record<string, number> = {};
  const byIp: Record<string, number> = {};
  const byWallet: Record<string, number> = {};
  for (const e of entries) {
    if (!e) continue;
    byType[e.type] = (byType[e.type] || 0) + 1;
    byIp[e.ip] = (byIp[e.ip] || 0) + 1;
    byWallet[e.owner?.toLowerCase()] = (byWallet[e.owner?.toLowerCase()] || 0) + 1;
  }

  return c.json({
    date: dateParam,
    totalRegistrations: dailyCount,
    dailyCap: GLOBAL_DAILY_CAP,
    remaining: GLOBAL_DAILY_CAP - dailyCount,
    breakdown: byType,
    topIps: Object.entries(byIp).sort((a, b) => b[1] - a[1]).slice(0, 20),
    topWallets: Object.entries(byWallet).sort((a, b) => b[1] - a[1]).slice(0, 20),
    recentRegistrations: entries.filter(Boolean).slice(-20).reverse(),
  });
});

// GET /api/admin/ip/:ip — stats for a specific IP
app.get("/api/admin/ip/:ip", async (c) => {

  const ip = c.req.param("ip");

  const freeCount = await c.env.WATCHLIST_KV.get(`freeip:${ip}`);
  const totalCount = await c.env.WATCHLIST_KV.get(`regcount:ip:${ip}`);

  return c.json({
    ip,
    freeRegistrations: freeCount ? parseInt(freeCount) : 0,
    freeLimit: MAX_FREE_PER_IP,
    totalRegistrations: totalCount ? parseInt(totalCount) : 0,
  });
});

// GET /api/admin/wallet/:address — stats for a specific wallet
app.get("/api/admin/wallet/:address", async (c) => {

  const addr = c.req.param("address").toLowerCase();

  const totalCount = await c.env.WATCHLIST_KV.get(`regcount:wallet:${addr}`);

  return c.json({
    wallet: addr,
    totalRegistrations: totalCount ? parseInt(totalCount) : 0,
  });
});

// POST /api/admin/reset-ip — reset free registration count for an IP (GEAUX override)
app.post("/api/admin/reset-ip", async (c) => {

  const body = await c.req.json().catch(() => null);
  if (!body?.ip) return c.json({ error: "Missing ip field" }, 400);

  const ip = body.ip;
  const key = `freeip:${ip}`;
  const oldVal = await c.env.WATCHLIST_KV.get(key);
  await c.env.WATCHLIST_KV.delete(key);

  return c.json({
    ip,
    previousFreeCount: oldVal ? parseInt(oldVal) : 0,
    newFreeCount: 0,
    message: `Free registration limit reset for IP ${ip}`,
  });
});

// POST /api/admin/set-daily-cap — override daily cap (temporary, for current day only)
app.post("/api/admin/set-daily-cap", async (c) => {

  const body = await c.req.json().catch(() => null);
  if (!body?.count || typeof body.count !== "number") return c.json({ error: "Missing count (number)" }, 400);

  // Reset the daily counter to allow more registrations
  const key = dailyCapKey();
  await c.env.WATCHLIST_KV.put(key, String(body.count), { expirationTtl: 172800 });

  return c.json({
    message: `Daily counter set to ${body.count}. Cap is ${GLOBAL_DAILY_CAP}, so ${GLOBAL_DAILY_CAP - body.count} more registrations allowed today.`,
  });
});

// =========================================================================
//                         CCIP-READ GATEWAY (ERC-3668)
// =========================================================================

// CORS preflight for CCIP routes (wallets call from any origin)
app.options("/ccip/*", () => handleCcipOptions());

// CCIP-Read gateway — ENS wallets query this to resolve .hazza.name addresses
app.get("/ccip/:sender/:data", handleCcipRead);

// =========================================================================
//                    WILDCARD SUBDOMAIN ROUTING
// =========================================================================

app.get("*", async (c) => {
  const host = c.req.header("host") || "";
  const path = new URL(c.req.url).pathname;

  // Apex domain → landing page
  if (host === "hazza.name" || host === "www.hazza.name" || host.includes("localhost")) {
    // SPA routes — serve HTML shell with SEO meta, React assets served same-origin via Worker static assets
    const spaRoutes = ["/", "/register", "/dashboard", "/manage", "/marketplace", "/messages", "/pricing", "/pricing/protections", "/pricing/details", "/about", "/docs", "/nomi", "/domains"];
    if (spaRoutes.includes(path) || path === "") {
      return c.html(spaShell(path || "/"));
    }
    if (path === "/admin/set-base-uri") {
      const registry = c.env.REGISTRY_ADDRESS;
      return c.html(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Set Base URI</title></head>
<body style="font-family:sans-serif;max-width:500px;margin:2rem auto;padding:1rem">
<h2>Set Base URI</h2>
<p style="color:#666;margin:1rem 0">Sets tokenURI base to <code>https://hazza.name/api/metadata/</code></p>
<p style="color:#888;font-size:0.85rem">Open this page in your wallet's built-in browser (Rainbow → Browser tab → paste URL)</p>
<button id="btn" style="padding:0.75rem 1.5rem;background:#CF3748;color:#fff;border:none;border-radius:8px;font-size:1rem;cursor:pointer;margin-top:1rem">Connect & Send</button>
<pre id="status" style="margin-top:1rem;color:#333;white-space:pre-wrap;word-break:break-all"></pre>
<script>
document.getElementById('btn').onclick = async function() {
  var s = document.getElementById('status');
  var p = window.ethereum || (window.__hazza_provider);
  if (!p) { s.textContent = 'No wallet detected. Open this page in Rainbow wallet browser.'; return; }
  try {
    s.textContent = 'Connecting...';
    var accounts = await p.request({ method: 'eth_requestAccounts' });
    var from = accounts[0];
    s.textContent = 'Connected: ' + from + '\\nSending setBaseURI tx...';
    var txHash = await p.request({
      method: 'eth_sendTransaction',
      params: [{ from: from, to: '${registry}', data: '0x55f804b30000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002068747470733a2f2f68617a7a612e6e616d652f6170692f6d657461646174612f', value: '0x0' }]
    });
    s.textContent = 'Tx sent: ' + txHash + '\\n\\nWaiting for confirmation...';
    for (var i = 0; i < 60; i++) {
      await new Promise(function(r) { setTimeout(r, 3000); });
      try {
        var receipt = await p.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
        if (receipt && receipt.blockNumber) { s.textContent = 'Done! Block: ' + parseInt(receipt.blockNumber,16) + '\\nTx: ' + txHash; return; }
      } catch(e2) {}
    }
    s.textContent = 'Tx sent but not confirmed yet: ' + txHash;
  } catch(e) { s.textContent = 'Error: ' + (e.message || e); }
};
</script></body></html>`);
    }
    if (path === "/favicon.ico" || path === "/favicon.svg") {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="16" fill="#CF3748"/><text x="50" y="50" font-family="sans-serif" font-size="55" fill="#fff" font-weight="700" text-anchor="middle" dominant-baseline="central">h</text></svg>`;
      return new Response(svg, {
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
      });
    }
    if (path === "/robots.txt") {
      return new Response("User-agent: *\nAllow: /\nSitemap: https://hazza.name/sitemap.xml\n", {
        headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=86400" },
      });
    }
    if (path === "/sitemap.xml") {
      const pages = ["/", "/about", "/register", "/dashboard", "/manage", "/marketplace", "/messages", "/docs", "/domains"];
      const urls = pages.map(p => `<url><loc>https://hazza.name${p}</loc></url>`).join("\n");
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
      return new Response(xml, {
        headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
      });
    }
    if (path === "/.well-known/farcaster.json") {
      return c.json({
        accountAssociation: {
          header: "eyJmaWQiOjI4MjUyMCwidHlwZSI6ImF1dGgiLCJrZXkiOiIweDE4QTQzMkQwMDhhMGU1RTFENjExZWFlMTk0RUUzYmRjN0ZEM2YzRkEifQ",
          payload: "eyJkb21haW4iOiJoYXp6YS5uYW1lIn0",
          signature: "nqc8sk/3P2Fopj86Xodvi3C8a/HqnpRDlTIHhBj++NV6rxGfKfGdE4NNpkLGjAj5R/OYL1VNIj0XUHohJfsy+Bw=",
        },
        miniapp: {
          version: "1",
          name: "hazza",
          subtitle: "immediately useful",
          description: "register and trade onchain names on Base, powered by x402, XMTP and Net Protocol",
          homeUrl: "https://hazza.name",
          iconUrl: "https://hazza.name/api/icon",
          splashImageUrl: "https://hazza.name/api/icon",
          splashBackgroundColor: "#F7EBBD",
          primaryCategory: "utility",
          tags: ["names", "identity", "onchain", "base"],
          requiredChains: [`eip155:${c.env.CHAIN_ID || "8453"}`],
          requiredCapabilities: ["wallet.getEthereumProvider"],
        },
      });
    }
    return c.json({ error: "Not found" }, 404);
  }

  // Subdomain routing: alice.hazza.name → resolve "alice"
  // Also supports custom domains via resolveCustomDomain
  let name: string;
  const subdomain = host.replace(/\.hazza\.name$/, "");
  if (subdomain && subdomain !== host) {
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return c.text("Invalid name", 400);
    }
    name = subdomain.toLowerCase();
  } else {
    // Not a hazza.name subdomain — try custom domain resolution
    const client = getClient(c.env);
    const addr = registryAddress(c.env);
    try {
      const resolved = await client.readContract({
        address: addr, abi: REGISTRY_ABI, functionName: "resolveCustomDomain", args: [host],
      });
      if (resolved && resolved !== "") {
        name = (resolved as string).toLowerCase();
      } else {
        return c.json({ error: "Unknown domain" }, 404);
      }
    } catch {
      return c.json({ error: "Unknown domain" }, 404);
    }
  }

  // Check for custom site (site.key) — always serve these directly
  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  try {
    const [nameOwner, tokenId, registeredAt, operator, agentId, agentWallet] =
      await client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name] });

    // Custom site check — must happen before bot/SPA routing
    if (nameOwner !== "0x0000000000000000000000000000000000000000") {
      const siteKeyResult = await client.readContract({
        address: addr, abi: REGISTRY_ABI, functionName: "text", args: [name, "site.key"],
      });
      const siteKey = siteKeyResult as string;
      if (siteKey) {
        try {
          const cdnUrl = siteKey.startsWith("https://")
            ? siteKey
            : `https://storedon.net/net/8453/storage/load/${(nameOwner as string).toLowerCase()}/${encodeURIComponent(siteKey)}`;
          if (isAllowedUrl(cdnUrl)) {
            const siteResp = await fetchWithTimeout(cdnUrl);
            if (siteResp.ok) {
              const html = await siteResp.text();
              return new Response(html, {
                headers: {
                  "Content-Type": "text/html; charset=utf-8",
                  "Content-Security-Policy": "default-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' https:; img-src * data:; font-src *; connect-src *;",
                  "X-Frame-Options": "DENY",
                  "X-Content-Type-Options": "nosniff",
                  "Cross-Origin-Opener-Policy": "same-origin",
                  "Cross-Origin-Resource-Policy": "same-origin",
                },
              });
            }
          }
        } catch {
          // Fall through to profile
        }
      }
    }

    // Bot detection — serve lightweight OG-only page for crawlers
    const ua = (c.req.header("user-agent") || "").toLowerCase();
    const isBot = /twitterbot|facebookexternalhit|discordbot|linkedinbot|slackbot|telegrambot|whatsapp|googlebot|bingbot|yandex|baiduspider|duckduckbot|applebot|ia_archiver|embedly|quora|pinterest|redditbot|mastodon/i.test(ua);

    if (isBot) {
      // Bots get a lightweight page with OG meta tags only
      if (nameOwner === "0x0000000000000000000000000000000000000000") {
        return c.html(profileBotPage(name, null));
      }
      const textKeys = ["avatar", "description"];
      const textValues = await client.readContract({
        address: addr, abi: REGISTRY_ABI, functionName: "textMany", args: [name, textKeys],
      });
      const texts: Record<string, string> = {};
      textKeys.forEach((key, i) => { if (textValues[i]) texts[key] = textValues[i]; });
      return c.html(profileBotPage(name, {
        owner: nameOwner,
        description: texts["description"] || "",
        avatar: texts["avatar"] || "",
      }));
    }

    // Real users get the React SPA shell — React detects subdomain and renders Profile
    return c.html(spaShell("/__profile__", name));
  } catch (err) {
    console.error(`Profile page error for ${name}:`, err);
    return c.html(spaShell("/__profile__", name));
  }
});

export default app;
