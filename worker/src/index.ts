import { Hono } from "hono";
import { cors } from "hono/cors";
import { type Env, getClient, getMainnetClient, getEthMainnetClient, buildTx, registryAddress, REGISTRY_ABI, EXOSKELETON_ABI, EXOSKELETON_ADDRESS } from "./contract";
import { landingPage, profilePage, aboutPage, pricingPage, pricingProtectionsPage, pricingDetailsPage, docsPage, domainsPage, registerPage, managePage, dashboardPage } from "./pages";
import { handleCcipRead, handleCcipOptions } from "./ccip";
import { type Address, formatUnits, keccak256, toBytes, isAddress, createWalletClient, http, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
// @ts-ignore — wasm import handled by wrangler
import resvgWasm from "../node_modules/@resvg/resvg-wasm/index_bg.wasm";

let wasmInitialized = false;
let cachedFont: ArrayBuffer | null = null;

async function getFont(): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;
  // Fetch Inter Bold from Google Fonts CDN (permissive SIL license)
  const resp = await fetch("https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZhrib2Bg-4.ttf");
  cachedFont = await resp.arrayBuffer();
  return cachedFont;
}

type Bindings = Env;
const app = new Hono<{ Bindings: Bindings }>();

// CORS — restrict to hazza.name origins
app.use("/api/*", cors({
  origin: (origin) => {
    if (!origin) return "https://hazza.name";
    if (origin === "https://hazza.name" || origin.endsWith(".hazza.name")) return origin;
    return "https://hazza.name";
  },
}));

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
  const [nameOwner, tokenId, registeredAt, expiresAt, operator, agentId, agentWallet] =
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
    expiresAt: Number(expiresAt),
    operator,
    agentId: agentId.toString(),
    agentWallet,
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
  const numYears = BigInt(c.req.query("years") || "1");
  const charCount = Number(c.req.query("charCount") || "0");
  const ensImport = c.req.query("ensImport") === "true";
  const verifiedPass = c.req.query("verifiedPass") === "true";
  const memberId = BigInt(c.req.query("memberId") || "0");

  const client = getClient(c.env);

  // Use member-aware quote if memberId provided
  if (memberId > 0n) {
    const [totalCost, registrationFee, renewalFee, isFreeClaim] = await client.readContract({
      address: registryAddress(c.env),
      abi: REGISTRY_ABI,
      functionName: "quoteNameWithMember",
      args: [name, wallet, numYears, charCount, ensImport, verifiedPass, memberId],
    });

    const lineItems: { label: string; amount: string }[] = [];
    if (isFreeClaim) {
      lineItems.push({ label: "Registration (1 year included)", amount: "FREE" });
      lineItems.push({ label: "Unlimited Pass + Net Library", amount: "1 free name" });
    } else {
      lineItems.push({ label: "Registration (1 year included)", amount: formatUnits(registrationFee, 6) });
      if (verifiedPass) lineItems.push({ label: "Unlimited Pass", amount: "20% discount" });
    }
    if (ensImport) lineItems.push({ label: "ENS Import", amount: "Challenge immunity" });

    return c.json({
      name, wallet, years: Number(numYears),
      total: formatUnits(totalCost, 6),
      totalRaw: totalCost.toString(),
      registrationFee: formatUnits(registrationFee, 6),
      renewalFee: formatUnits(renewalFee, 6),
      renewalNote: "$2/yr renewal after first year",
      isFreeClaim,
      memberId: memberId.toString(),
      lineItems,
    });
  }

  const [totalCost, registrationFee, renewalFee] = await client.readContract({
    address: registryAddress(c.env),
    abi: REGISTRY_ABI,
    functionName: "quoteName",
    args: [name, wallet, numYears, charCount, ensImport, verifiedPass],
  });

  // Build line items for UI display — renewal is NOT charged at registration
  const lineItems: { label: string; amount: string }[] = [];
  lineItems.push({ label: "Registration (1 year included)", amount: formatUnits(registrationFee, 6) });
  if (ensImport) lineItems.push({ label: "ENS Import", amount: "Challenge immunity" });
  if (verifiedPass) lineItems.push({ label: "Unlimited Pass", amount: "20% discount" });

  return c.json({
    name,
    wallet,
    years: Number(numYears),
    total: formatUnits(registrationFee, 6),
    totalRaw: registrationFee.toString(),
    registrationFee: formatUnits(registrationFee, 6),
    renewalFee: formatUnits(renewalFee, 6),
    renewalNote: "$2/yr renewal after first year",
    lineItems,
  });
});

// Check free claim eligibility for Unlimited Pass + Net Library members
app.get("/api/free-claim/:address", async (c) => {
  const wallet = c.req.param("address") as Address;
  if (!isAddress(wallet)) return c.json({ error: "Invalid address format" }, 400);

  // Step 1: Check Net Library membership + Unlimited Pass via NL API
  const nlApiUrl = c.env.NET_LIBRARY_API_URL;
  if (!nlApiUrl) {
    return c.json({ eligible: false, reason: "Free claim service unavailable" });
  }

  let nlData: any;
  try {
    const resp = await fetch(`${nlApiUrl}/api/membership?address=${wallet}`);
    nlData = await resp.json();
  } catch {
    // NL API down — non-fatal, fall back to not eligible
    return c.json({ eligible: false, reason: "Could not verify Net Library membership" });
  }

  if (!nlData?.isMember) {
    return c.json({ eligible: false, reason: "Not a Net Library member" });
  }
  if (!nlData?.member?.hasUnlimitedPass) {
    return c.json({ eligible: false, reason: "No Unlimited Pass" });
  }

  const memberId = nlData.member.memberId;
  if (!memberId || memberId <= 0) {
    return c.json({ eligible: false, reason: "Invalid member ID" });
  }

  // Step 2: Check if this memberId already claimed onchain
  const client = getClient(c.env);
  const claimed = await client.readContract({
    address: registryAddress(c.env),
    abi: REGISTRY_ABI,
    functionName: "hasClaimedFreeName",
    args: [BigInt(memberId)],
  });

  if (claimed) {
    return c.json({ eligible: false, reason: "Free name already claimed", memberId });
  }

  return c.json({
    eligible: true,
    memberId,
    memberName: nlData.member.ensSubname || `Member #${memberId}`,
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
  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  const [nameOwner, tokenId, registeredAt, expiresAt, operator, agentId, agentWallet] =
    await client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name] });

  if (nameOwner === "0x0000000000000000000000000000000000000000") {
    return c.json({ name, registered: false });
  }

  const textKeys = [
    "avatar", "header", "description", "url",
    "com.twitter", "com.github", "xyz.farcaster", "org.telegram", "com.discord", "com.linkedin",
    "agent.endpoint", "agent.model", "agent.status", "agent.capabilities",
  ];

  const [textValues, isActive, inGrace, inRedemption, chash] = await Promise.all([
    client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "textMany", args: [name, textKeys] }),
    client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "isActive", args: [name] }),
    client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "isInGracePeriod", args: [name] }),
    client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "isInRedemptionPeriod", args: [name] }),
    client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "contenthash", args: [name] }),
  ]);

  const texts: Record<string, string> = {};
  textKeys.forEach((k, i) => { if (textValues[i]) texts[k] = textValues[i]; });

  let status = "expired";
  if (isActive) status = "active";
  else if (inGrace) status = "grace";
  else if (inRedemption) status = "redemption";

  return c.json({
    name,
    registered: true,
    owner: nameOwner,
    tokenId: tokenId.toString(),
    registeredAt: Number(registeredAt),
    expiresAt: Number(expiresAt),
    operator,
    agentId: agentId.toString(),
    agentWallet,
    status,
    texts,
    contenthash: chash && chash !== "0x" ? chash : null,
    url: `https://${name}.hazza.name`,
  });
});

// Single text record
app.get("/api/text/:name/:key", async (c) => {
  const name = c.req.param("name").toLowerCase();
  const key = c.req.param("key");
  const client = getClient(c.env);
  const value = await client.readContract({
    address: registryAddress(c.env),
    abi: REGISTRY_ABI,
    functionName: "text",
    args: [name, key],
  });
  return c.json({ name, key, value });
});

// OG image generator (PNG via resvg-wasm)
app.get("/api/og/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  let subtitle = "available";
  let statusColor = "#00e676";
  let ownerText = "";
  let description = "";
  let memberBadge = "";

  try {
    const [nameOwner, , , , , ,] = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name],
    });
    if (nameOwner !== "0x0000000000000000000000000000000000000000") {
      subtitle = "registered";
      ownerText = `${(nameOwner as string).slice(0, 6)}...${(nameOwner as string).slice(-4)}`;
      // Try to get description and member badge
      try {
        const textValues = await client.readContract({
          address: addr, abi: REGISTRY_ABI, functionName: "textMany",
          args: [name, ["description", "netlibrary.member"]],
        });
        if (textValues[0]) description = String(textValues[0]).slice(0, 80);
        if (textValues[1]) memberBadge = `Net Library #${textValues[1]}`;
      } catch { /* non-critical */ }
    }
  } catch { /* name not registered or invalid */ }

  const displayName = name.length > 16 ? name.slice(0, 14) + "..." : name;
  const nameFontSize = displayName.length > 10 ? 56 : displayName.length > 6 ? 72 : 88;

  // Escape for SVG
  const svgEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#050a05"/>
      <stop offset="100%" stop-color="#0a1a0a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1200" y2="0">
      <stop offset="0%" stop-color="#00e676"/>
      <stop offset="100%" stop-color="#00c853"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="5" fill="url(#accent)"/>
  <rect x="0" y="625" width="1200" height="5" fill="url(#accent)" opacity="0.3"/>

  <!-- Grid pattern -->
  <g opacity="0.04">
    ${Array.from({length: 12}, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="630" stroke="#00e676" stroke-width="1"/>`).join("")}
    ${Array.from({length: 7}, (_, i) => `<line x1="0" y1="${i * 90}" x2="1200" y2="${i * 90}" stroke="#00e676" stroke-width="1"/>`).join("")}
  </g>

  <!-- Logo mark -->
  <text x="80" y="80" font-family="Inter, sans-serif" font-size="40" fill="#00e676" font-weight="900" opacity="0.8">h</text>
  <text x="1120" y="80" font-family="Inter, sans-serif" font-size="16" fill="#333" text-anchor="end">hazza.name</text>

  <!-- Name -->
  <text x="600" y="${description ? "250" : "280"}" font-family="Inter, sans-serif" font-size="${nameFontSize}" fill="#ffffff" font-weight="900" text-anchor="middle">${svgEsc(displayName)}<tspan fill="${statusColor}">.hazza</tspan></text>

  <!-- Status pill -->
  <rect x="${600 - (subtitle.length * 6 + 20)}" y="${description ? "268" : "298"}" width="${subtitle.length * 12 + 40}" height="30" rx="15" fill="${statusColor}" opacity="0.15"/>
  <text x="600" y="${description ? "289" : "319"}" font-family="Inter, sans-serif" font-size="14" fill="${statusColor}" text-anchor="middle" font-weight="700" letter-spacing="2">${subtitle.toUpperCase()}</text>

  <!-- Owner -->
  ${ownerText ? `<text x="600" y="${description ? "330" : "360"}" font-family="Inter, sans-serif" font-size="16" fill="#445544" text-anchor="middle">${ownerText}</text>` : ""}

  <!-- Description -->
  ${description ? `<text x="600" y="370" font-family="Inter, sans-serif" font-size="18" fill="#6b8f6b" text-anchor="middle">${svgEsc(description)}</text>` : ""}

  <!-- Member badge -->
  ${memberBadge ? `<text x="600" y="410" font-family="Inter, sans-serif" font-size="14" fill="#4a6b4a" text-anchor="middle">${svgEsc(memberBadge)}</text>` : ""}

  <!-- Footer -->
  <text x="600" y="568" font-family="Inter, sans-serif" font-size="18" fill="#2a3a2a" text-anchor="middle">onchain names on Base</text>
  <text x="600" y="598" font-family="Inter, sans-serif" font-size="13" fill="#1a2a1a" text-anchor="middle">powered by x402 and Net Protocol</text>
</svg>`;

  // Try PNG conversion via resvg, fall back to SVG
  try {
    if (!wasmInitialized) {
      await initWasm(resvgWasm);
      wasmInitialized = true;
    }
    const fontData = await getFont();
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      font: {
        fontBuffers: [new Uint8Array(fontData)],
        defaultFontFamily: "Inter",
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

// ERC-721 metadata (served by tokenURI base URL)
app.get("/api/metadata/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  const [nameOwner, tokenId, registeredAt, expiresAt, , agentId] =
    await client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name] });

  if (nameOwner === "0x0000000000000000000000000000000000000000") {
    return c.json({ error: "Name not registered" }, 404);
  }

  const textKeys = ["avatar", "description", "url", "com.twitter", "xyz.farcaster"];
  const textValues = await client.readContract({
    address: addr, abi: REGISTRY_ABI, functionName: "textMany", args: [name, textKeys],
  });

  const attributes: { trait_type: string; value: string }[] = [
    { trait_type: "Length", value: name.length.toString() },
    { trait_type: "Registered", value: new Date(Number(registeredAt) * 1000).toISOString().split("T")[0] },
    { trait_type: "Expires", value: new Date(Number(expiresAt) * 1000).toISOString().split("T")[0] },
  ];
  if (agentId > 0n) attributes.push({ trait_type: "Agent", value: `#${agentId}` });
  if (textValues[3]) attributes.push({ trait_type: "Twitter", value: textValues[3] });
  if (textValues[4]) attributes.push({ trait_type: "Farcaster", value: textValues[4] });

  return c.json({
    name: `${name}.hazza.name`,
    description: textValues[1] || `${name}.hazza.name — an onchain name on Base`,
    image: textValues[0] || `https://hazza.name/api/og/${name}`,
    external_url: `https://${name}.hazza.name`,
    attributes,
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
    const balance = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "balanceOf", args: [wallet],
    });
    const count = Number(balance);
    if (count === 0) return c.json({ wallet, names: [], total: 0 });

    // Iterate all tokens and filter by owner (no ERC721Enumerable)
    const total = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "totalRegistered",
    });
    const totalCount = Number(total);
    const names: { name: string; tokenId: string; url: string; expiresAt: number; status: string }[] = [];

    for (let id = 1; id <= totalCount && names.length < count; id++) {
      try {
        const name = await client.readContract({
          address: addr, abi: REGISTRY_ABI, functionName: "nameOf", args: [BigInt(id)],
        });
        if (!name) continue;
        const [owner, , , expiresAt] = await client.readContract({
          address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name as string],
        });
        if ((owner as string).toLowerCase() === wallet.toLowerCase()) {
          // Determine status
          const [isActive, inGrace, inRedemption] = await Promise.all([
            client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "isActive", args: [name as string] }),
            client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "isInGracePeriod", args: [name as string] }),
            client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "isInRedemptionPeriod", args: [name as string] }),
          ]);
          const status = isActive ? "active" : inGrace ? "grace" : inRedemption ? "redemption" : "expired";
          names.push({
            name: name as string,
            tokenId: id.toString(),
            url: `https://${name}.hazza.name`,
            expiresAt: Number(expiresAt),
            status,
          });
        }
      } catch { continue; }
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

  const client = getClient(c.env);
  try {
    const nameHash = await client.readContract({
      address: registryAddress(c.env),
      abi: REGISTRY_ABI,
      functionName: "verifyApiKey",
      args: [rawKey as `0x${string}`],
    });
    if (!nameHash || nameHash === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      return c.json({ error: "Invalid or revoked API key" }, 401);
    }

    // Resolve nameHash to name string via the name param
    const requestedName = c.req.param("name")?.toLowerCase();
    if (!requestedName) {
      return c.json({ error: "Missing name parameter" }, 400);
    }

    // Verify the key's nameHash matches the requested name
    const expectedHash = keccak256(toBytes(requestedName));
    if (nameHash !== expectedHash) {
      return c.json({ error: "API key is not authorized for this name" }, 403);
    }

    return { name: requestedName, nameHash: nameHash as string };
  } catch (e: any) {
    return c.json({ error: "API key verification failed" }, 401);
  }
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


// =========================================================================
//                         x402 PAYMENT PROTOCOL
// =========================================================================

// In-memory replay protection (per-isolate)
const usedPaymentTxHashes = new Set<string>();

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
  const years = Number(body.years) || 1;

  if (!isValidName(name)) return c.json({ error: "Invalid name format" }, 400);
  if (!isAddress(owner)) return c.json({ error: "Invalid owner address" }, 400);
  if (years < 1 || years > 10) return c.json({ error: "Years must be 1-10" }, 400);

  const client = getClient(c.env);
  const addr = registryAddress(c.env);
  const relayerAddr = c.env.RELAYER_ADDRESS as Address;

  // Check availability
  const available = await client.readContract({
    address: addr, abi: REGISTRY_ABI, functionName: "available", args: [name],
  });
  if (!available) return c.json({ error: "Name not available" }, 409);

  // --- Check free claim eligibility via Net Library API ---
  let freeClaimMemberId = 0;
  const nlApiUrl = c.env.NET_LIBRARY_API_URL;
  if (nlApiUrl) {
    try {
      const nlResp = await fetch(`${nlApiUrl}/api/membership?address=${owner}`);
      const nlData: any = await nlResp.json();
      if (nlData?.isMember && nlData?.member?.hasUnlimitedPass && nlData.member.memberId > 0) {
        // Check if already claimed onchain
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

  // --- Free claim path: skip payment entirely ---
  if (freeClaimMemberId > 0) {
    try {
      const chainId = Number(c.env.CHAIN_ID);
      const chain = chainId === 8453 ? base : baseSepolia;
      const account = privateKeyToAccount(c.env.RELAYER_PRIVATE_KEY as `0x${string}`);

      const txData = encodeFunctionData({
        abi: REGISTRY_ABI,
        functionName: "registerDirectWithMember",
        args: [
          name, owner, BigInt(years), 5,
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

      return c.json({
        name, owner, tokenId,
        registrationTx: regTxHash,
        profileUrl: `https://${name}.hazza.name`,
        expiresAt: Math.floor(Date.now() / 1000) + (years * 365 * 86400),
        freeClaim: true,
        memberId: freeClaimMemberId,
      });
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || "Unknown error";
      return c.json({ error: "Free claim registration failed", detail: msg }, 500);
    }
  }

  // Get quote — contract charges registration fee only (renewal paid separately)
  const [totalCost] = await client.readContract({
    address: addr, abi: REGISTRY_ABI, functionName: "quoteName",
    args: [name, owner, BigInt(years), 5, false, false],
  });

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

    // Replay protection
    if (usedPaymentTxHashes.has(txHash)) {
      return c.json({ error: "Payment already used" }, 400);
    }

    // Verify tx on-chain
    let receipt;
    try {
      receipt = await client.getTransactionReceipt({ hash: txHash });
    } catch {
      return c.json({ error: "Transaction not found or not confirmed" }, 400);
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

      // topics[2] = "to" address (padded to 32 bytes)
      const toAddr = ("0x" + (log.topics[2] || "").slice(26)).toLowerCase();
      if (toAddr !== relayerAddr.toLowerCase()) continue;

      // Decode transfer amount from data
      const transferAmount = BigInt(log.data);
      if (transferAmount >= totalCost) {
        verified = true;
        break;
      }
    }

    if (!verified) {
      return c.json({ error: "Payment verification failed: no matching USDC transfer to relayer" }, 400);
    }

    // Mark tx as used
    usedPaymentTxHashes.add(txHash);

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
        BigInt(years),
        5,      // charCount — flat $5 pricing for all names
        false,  // wantAgent
        "0x0000000000000000000000000000000000000000" as Address, // agentWallet
        "",     // agentURI
        false,  // ensImport
        false,  // verifiedPass
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
      return c.json({ error: "Registration transaction reverted on-chain", tx: regTxHash }, 500);
    }

    // Fetch the new token ID from the resolve
    let tokenId = "0";
    try {
      const [, tid] = await client.readContract({
        address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name],
      });
      tokenId = tid.toString();
    } catch { /* non-critical */ }

    return new Response(JSON.stringify({
      name,
      owner,
      tokenId,
      registrationTx: regTxHash,
      profileUrl: `https://${name}.hazza.name`,
      expiresAt: Math.floor(Date.now() / 1000) + (years * 365 * 86400),
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-PAYMENT-RESPONSE": regTxHash,
      },
    });

  } catch (e: any) {
    const msg = e?.shortMessage || e?.message || "Unknown error";
    return c.json({ error: "Registration failed", detail: msg }, 500);
  }
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
    if (path === "/" || path === "") {
      return c.html(landingPage());
    }
    if (path === "/about") {
      return c.html(aboutPage());
    }
    if (path === "/pricing") {
      return c.html(pricingPage());
    }
    if (path === "/pricing/protections") {
      return c.html(pricingProtectionsPage());
    }
    if (path === "/pricing/details") {
      return c.html(pricingDetailsPage());
    }
    if (path === "/docs") {
      return c.html(docsPage());
    }
    if (path === "/domains") {
      return c.html(domainsPage());
    }
    if (path === "/register") {
      return c.html(registerPage(c.env.REGISTRY_ADDRESS, c.env.USDC_ADDRESS, c.env.CHAIN_ID));
    }
    if (path === "/manage") {
      return c.html(managePage(c.env.REGISTRY_ADDRESS, c.env.USDC_ADDRESS, c.env.CHAIN_ID));
    }
    if (path === "/dashboard") {
      return c.html(dashboardPage(c.env.REGISTRY_ADDRESS, c.env.USDC_ADDRESS, c.env.CHAIN_ID));
    }
    return c.json({ error: "Not found" }, 404);
  }

  // Subdomain routing: alice.hazza.name → resolve "alice"
  const subdomain = host.replace(/\.hazza\.name$/, "");
  if (!subdomain || subdomain === host) {
    return c.json({ error: "Invalid subdomain" }, 400);
  }

  const name = subdomain.toLowerCase();
  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  try {
    const [nameOwner, tokenId, registeredAt, expiresAt, operator, agentId, agentWallet] =
      await client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name] });

    if (nameOwner === "0x0000000000000000000000000000000000000000") {
      return c.html(profilePage(name, null));
    }

    // Fetch text records + status in parallel
    const textKeys = [
      "avatar", "header", "description", "url",
      "com.twitter", "com.github", "xyz.farcaster", "org.telegram", "com.discord", "com.linkedin",
      "agent.endpoint", "agent.model", "agent.status", "agent.capabilities",
      "agent.uri", "net.profile", "helixa.id", "netlibrary.member", "netlibrary.pass",
      "site.key",
    ];

    const [textValues, isActive, inGrace, inRedemption, chash] = await Promise.all([
      client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "textMany", args: [name, textKeys] }),
      client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "isActive", args: [name] }),
      client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "isInGracePeriod", args: [name] }),
      client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "isInRedemptionPeriod", args: [name] }),
      client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "contenthash", args: [name] }),
    ]);

    const texts: Record<string, string> = {};
    textKeys.forEach((k, i) => { if (textValues[i]) texts[k] = textValues[i]; });

    let status: "active" | "grace" | "redemption" | "expired" = "expired";
    if (isActive) status = "active";
    else if (inGrace) status = "grace";
    else if (inRedemption) status = "redemption";

    // Serve custom site from Net Protocol if site.key is set and requesting root
    const siteKey = texts["site.key"];
    if (siteKey && (path === "/" || path === "")) {
      try {
        const ownerAddr = (nameOwner as string).toLowerCase();
        const cdnUrl = `https://storedon.net/net/8453/storage/load/${ownerAddr}/${encodeURIComponent(siteKey)}`;
        if (isAllowedUrl(cdnUrl)) {
          const siteResp = await fetch(cdnUrl);
          if (siteResp.ok) {
            const html = await siteResp.text();
            return new Response(html, {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          }
        }
      } catch {
        // Fall through to normal profile page
      }
    }

    // Fetch external identity data in parallel (all optional, failures silenced)
    const agentUri = texts["agent.uri"];
    const netProfileKey = texts["net.profile"];

    // Validate helixa.id is a numeric token ID
    const helixaId = texts["helixa.id"];
    const safeHelixaId = helixaId && /^\d+$/.test(helixaId) ? helixaId : null;

    // Build safe net profile URL
    const netProfileUrl = netProfileKey
      ? (netProfileKey.startsWith("http") ? netProfileKey : `https://storedon.net/net/8453/storage/load/${nameOwner}/${encodeURIComponent(netProfileKey)}`)
      : null;

    const [agentMetaResult, netProfileResult, helixaResult, exoResult, ensResult] = await Promise.allSettled([
      // ERC-8004 agent metadata (SSRF-checked)
      agentUri && isAllowedUrl(agentUri)
        ? fetch(agentUri, { headers: { Accept: "application/json" } }).then(r => r.ok ? r.json() : null)
        : Promise.resolve(null),
      // Net Protocol profile (SSRF-checked)
      netProfileUrl && isAllowedUrl(netProfileUrl)
        ? fetch(netProfileUrl, { headers: { Accept: "application/json" } }).then(r => r.ok ? r.json() : null)
        : Promise.resolve(null),
      // Helixa AgentDNA (validated numeric token ID)
      safeHelixaId
        ? fetch(`https://api.helixa.xyz/api/v2/agent/${safeHelixaId}`)
            .then(r => r.ok ? r.json() : null)
        : Promise.resolve(null),
      // Exoskeleton NFT
      (async () => {
        const mainnet = getMainnetClient(c.env);
        const bal = await mainnet.readContract({
          address: EXOSKELETON_ADDRESS,
          abi: EXOSKELETON_ABI,
          functionName: "balanceOf",
          args: [nameOwner],
        });
        if (!bal || bal === 0n) return null;
        const tokenIdExo = await mainnet.readContract({
          address: EXOSKELETON_ADDRESS,
          abi: EXOSKELETON_ABI,
          functionName: "tokenOfOwnerByIndex",
          args: [nameOwner, 0n],
        });
        const uri = await mainnet.readContract({
          address: EXOSKELETON_ADDRESS,
          abi: EXOSKELETON_ABI,
          functionName: "tokenURI",
          args: [tokenIdExo],
        });
        // tokenURI is data:application/json;base64,...
        if (uri && typeof uri === "string" && uri.startsWith("data:")) {
          const b64 = uri.split(",")[1];
          const json = JSON.parse(atob(b64));
          return { tokenId: tokenIdExo.toString(), ...json };
        }
        return null;
      })(),
      // ENS reverse resolution (owner address → .eth name)
      (async () => {
        const ethClient = getEthMainnetClient(c.env);
        const ensName = await ethClient.getEnsName({ address: nameOwner });
        return ensName || null;
      })(),
    ]);

    const agentMeta = agentMetaResult.status === "fulfilled" ? agentMetaResult.value : null;
    const netProfile = netProfileResult.status === "fulfilled" ? netProfileResult.value : null;
    const helixaData = helixaResult.status === "fulfilled" ? helixaResult.value : null;
    const exoData = exoResult.status === "fulfilled" ? exoResult.value : null;
    const ownerEns = ensResult.status === "fulfilled" ? ensResult.value : null;

    return c.html(
      profilePage(name, {
        owner: nameOwner,
        ownerEns,
        tokenId: tokenId.toString(),
        registeredAt: Number(registeredAt),
        expiresAt: Number(expiresAt),
        operator,
        agentId: agentId.toString(),
        agentWallet,
        status,
        texts,
        contenthash: chash && chash !== "0x" ? (chash as string) : null,
        agentMeta,
        netProfile,
        helixaData,
        exoData,
      })
    );
  } catch {
    return c.html(profilePage(name, null));
  }
});

export default app;
