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
const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return "https://hazza.name";
    if (origin === "https://hazza.name" || origin.endsWith(".hazza.name")) return origin;
    if (origin === "https://hazza-app.pages.dev" || origin.endsWith(".hazza-app.pages.dev")) return origin;
    return "https://hazza.name";
  },
});
// NFT metadata + images must be accessible from any marketplace/wallet/indexer
const openCorsMiddleware = cors({ origin: "*" });
app.use("/api/*", async (c, next) => {
  const path = c.req.path;
  if (path.startsWith("/api/metadata/") || path.startsWith("/api/nft-image/") || path === "/api/collection-metadata") {
    return openCorsMiddleware(c, next);
  }
  return corsMiddleware(c, next);
});
app.use("/x402/*", corsMiddleware);
// Frames must be accessible from any XMTP client
app.use("/frames/*", cors({ origin: "*" }));

// Security headers — helps corporate firewalls (Zscaler, Fortinet, etc.) classify the site
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  // Frames need to be embeddable by XMTP clients
  if (!c.req.path.startsWith("/frames/")) {
    c.res.headers.set("X-Frame-Options", "SAMEORIGIN");
  }
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
  if (name.length < 3) return false; // contract MIN_NAME_LENGTH = 3
  return /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(name);
}

function nameValidationError(name: string): string {
  if (!name) return "Name is required";
  if (name.length < 3) return "Name must be at least 3 characters";
  if (name.length > 63) return "Name must be 63 characters or less";
  if (!/^[a-z0-9]/.test(name)) return "Name must start with a letter or number";
  if (!/[a-z0-9]$/.test(name)) return "Name must end with a letter or number";
  if (/[^a-z0-9-]/.test(name)) return "Name can only contain lowercase letters, numbers, and hyphens";
  if (/--/.test(name)) return "Name cannot contain consecutive hyphens";
  return "Invalid name format";
}

// =========================================================================
//                          API ROUTES
// =========================================================================

// Check if a name is available
app.get("/api/available/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);
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
  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);
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
  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);
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
  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);
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

// Get wallet pricing context — registration count, FID-aware pass status, next name price
app.get("/api/wallet-pricing/:address", async (c) => {
  const wallet = c.req.param("address") as Address;
  if (!isAddress(wallet)) return c.json({ error: "Invalid address" }, 400);

  try {
    const client = getClient(c.env);
    const addr = registryAddress(c.env);

    // Read wallet info (totalRegistrations, pricingWindowStart, pricingWindowCount)
    const [totalRegistrations, pricingWindowStart, pricingWindowCount] = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "walletInfo", args: [wallet],
    }) as [bigint, bigint, bigint];

    // Check Unlimited Pass — FID-aware: connected wallet → FID → all verified wallets → check each
    const UNLIMITED_PASS = "0xCe559A2A6b64504bE00aa7aA85C5C31EA93a16BB" as Address;
    const BALANCE_OF_ABI = [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] }] as const;
    let hasPass = false;
    let passWallet: string | null = null;

    // Step 1: Check connected wallet directly
    try {
      const bal = await client.readContract({
        address: UNLIMITED_PASS, abi: BALANCE_OF_ABI, functionName: "balanceOf", args: [wallet],
      });
      if ((bal as bigint) > 0n) {
        hasPass = true;
        passWallet = wallet;
      }
    } catch { /* pass contract may not exist on testnet */ }

    // Step 2: If not found on connected wallet, check FID-linked wallets via Neynar
    if (!hasPass && c.env.NEYNAR_API_KEY) {
      try {
        const bulkRes = await fetch(
          `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${wallet.toLowerCase()}`,
          { headers: { accept: "application/json", "x-api-key": c.env.NEYNAR_API_KEY } }
        );
        if (bulkRes.ok) {
          const bulkData = await bulkRes.json() as Record<string, any[]>;
          const users = bulkData[wallet.toLowerCase()];
          if (users?.length > 0) {
            const allAddresses = new Set<string>();
            for (const user of users) {
              for (const a of (user.verified_addresses?.eth_addresses || [])) {
                if (a.toLowerCase() !== wallet.toLowerCase()) allAddresses.add(a.toLowerCase());
              }
              if (user.custody_address && user.custody_address.toLowerCase() !== wallet.toLowerCase()) {
                allAddresses.add(user.custody_address.toLowerCase());
              }
            }
            for (const linkedAddr of allAddresses) {
              try {
                const bal = await client.readContract({
                  address: UNLIMITED_PASS, abi: BALANCE_OF_ABI, functionName: "balanceOf",
                  args: [linkedAddr as Address],
                });
                if ((bal as bigint) > 0n) { hasPass = true; passWallet = linkedAddr; break; }
              } catch { /* skip */ }
            }
          }
        }
      } catch (e) {
        console.warn("FID lookup failed:", e);
      }
    }

    const regs = Number(totalRegistrations);
    const basePrice = 5_000_000; // $5 USDC (6 decimals)

    // Calculate next name price
    let nextPrice: number;
    if (regs === 0) {
      nextPrice = 0; // first name free
    } else {
      // Check if pricing window expired (90 days = 7776000 seconds)
      const now = Math.floor(Date.now() / 1000);
      const windowStart = Number(pricingWindowStart);
      const windowCount = (windowStart !== 0 && now - windowStart <= 7776000) ? Number(pricingWindowCount) : 0;

      // Progressive multiplier
      let adjusted: number;
      if (windowCount < 3) {
        adjusted = basePrice;
      } else if (windowCount < 5) {
        adjusted = Math.floor((basePrice * 25) / 10);
      } else if (windowCount < 7) {
        adjusted = basePrice * 5;
      } else {
        adjusted = basePrice * 10;
      }

      // 20% discount for Unlimited Pass holders
      if (hasPass) {
        adjusted = Math.floor((adjusted * 80) / 100);
      }

      nextPrice = adjusted;
    }

    // Format as dollars
    const nextPriceDollars = nextPrice / 1_000_000;

    return c.json({
      totalRegistrations: regs,
      hasUnlimitedPass: hasPass,
      ...(passWallet && passWallet.toLowerCase() !== wallet.toLowerCase() ? { passDetectedVia: "farcaster-linked-wallet" } : {}),
      nextPriceRaw: nextPrice.toString(),
      nextPriceDollars,
      nextPriceFormatted: nextPrice === 0 ? "FREE" : `$${nextPriceDollars}`,
      isFirstFree: regs === 0,
    });
  } catch (e: any) {
    console.error("Wallet pricing failed:", e?.message || e);
    return c.json({ error: "Failed to get wallet pricing" }, 500);
  }
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
  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);
  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  const [nameOwner, tokenId, registeredAt, operator, agentId, agentWallet] =
    await client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name] });

  if (nameOwner === "0x0000000000000000000000000000000000000000") {
    return c.json({ name, registered: false });
  }

  const textKeys = ["avatar", "description", "url", "com.twitter", "com.github", "org.telegram", "com.discord", "xmtp", "message.delegate", "message.mode", "site.key", "agent.uri", "agent.8004id", "agent.wallet", "agent.endpoint", "agent.model", "agent.status", "net.profile", "helixa.id", "netlibrary.member", "netlibrary.pass", "com.linkedin", "xyz.farcaster"];
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

  // Resolve agentId — prefer contract, fallback to text record
  const contractAgentId = agentId ? agentId.toString() : "0";
  const textAgentId = texts["agent.8004id"] || null;
  const resolvedAgentId = contractAgentId !== "0" ? contractAgentId : textAgentId;
  const resolvedAgentWallet = agentWallet && agentWallet !== "0x0000000000000000000000000000000000000000"
    ? agentWallet : (texts["agent.wallet"] || null);

  // Fetch 8004 metadata if we have an agentId (from either source)
  let erc8004Data: any = null;
  if (resolvedAgentId && resolvedAgentId !== "0") {
    try {
      const [tokenURI, agentOwner] = await Promise.all([
        client.readContract({ address: ERC8004_REGISTRY_ADDRESS, abi: ERC8004_ABI, functionName: "tokenURI", args: [BigInt(resolvedAgentId)] }),
        client.readContract({ address: ERC8004_REGISTRY_ADDRESS, abi: ERC8004_ABI, functionName: "ownerOf", args: [BigInt(resolvedAgentId)] }),
      ]);
      erc8004Data = {
        agentId: resolvedAgentId,
        tokenURI,
        owner: agentOwner,
        registry: ERC8004_REGISTRY_ADDRESS,
        verified: (agentOwner as string).toLowerCase() === (nameOwner as string).toLowerCase(),
      };
    } catch { /* 8004 lookup failed — non-fatal */ }
  }

  return c.json({
    name,
    registered: true,
    owner: nameOwner,
    ownerEns: ensResult.status === "fulfilled" ? ensResult.value : null,
    tokenId: tokenId.toString(),
    registeredAt: Number(registeredAt),
    operator,
    agentId: resolvedAgentId || "0",
    agentWallet: resolvedAgentWallet,
    status: "active",
    texts,
    contenthash: chash && chash !== "0x" ? (chash as string) : null,
    url: `https://${name}.hazza.name`,
    agentMeta: agentMetaResult.status === "fulfilled" ? agentMetaResult.value : null,
    erc8004: erc8004Data,
    helixaData: helixaResult.status === "fulfilled" ? helixaResult.value : null,
    exoData: exoResult.status === "fulfilled" ? exoResult.value : null,
    bankrData: bankrResult.status === "fulfilled" ? bankrResult.value : null,
  });
});

// Contact resolution — resolves delegate chain (max 1 hop)
app.get("/api/contact/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);
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
  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);
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
  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);

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
  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);
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
// Image proxy for Net Protocol stored content (correct MIME type)
const HAZZA_TOKEN_IMG_B64 = "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KACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9Dxeiiivzs/0sCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//R8Xooor87P9LAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0vF6KKK/Oz/SwKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9Pxeiiivzs/0sCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//U8Xooor87P9LAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/1fF6KKK/Oz/SwKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9bxeiiivzs/0sCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//X8Xooor87P9LAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0PF6KKK/Oz/SwKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACivZ/g38C/Gvxp1g2Ph2IW9hbkfar6YHyYQe3HLMeyj8cDmv1D8EfsV/Bbwva27a5YyeI9QjA8ya6kdY3b1EKMFA9Ac+5Nd+Fy6pVV47H59xZ4mZXlE/Y15OVT+WOrXrqkvvv5H4q5FJketf0Vab8Lvhro0fl6X4U0q1GMZSyhBP1O3J/Gt5vC/hlovIbSLMx4xtNvHtx6Y24r0VkMus/wPzWp9IWgn7mEbXnJL/21n83GRRX9EmrfCj4Y66mzV/Cel3WBgF7OHcB7MFBH4Gvnjx/+xL8IfFNtNN4Yt5PDOotko9u7PBn0aJyRj/dxisqmR1FrFpnq5Z495bVmo4mlKnfrpJL1tZ/cmfjFRXp/xV+EfjH4PeIj4e8WQD94C1vcxZMFwnqjEA8dwcEV5hXjTg4vlktT9swWNpYilGvQkpQlqmtmFFFFSdQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH//0fF6KKK/Oz/SwKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKtWNnNqF7BY26l5biRY1A6lmOBVWvVvgZpX9tfF/wAI6dx+81GA89PlYN/Srpx5pJHHmGKVDD1K7+ym/uVz9v8A4PfDrSvhd4A0vwrpsSo8cayXLgYMlw4Bdjknvx16CvT6KK+/hBRSij/OnG4ypiK069Z3lJtt+bCiiiqOUKKKKAPCf2ivhhYfFH4YarpUkStqFnG1zZSfxJNGCRz6N0I9K/BJlZGKOMMpwR7iv6Xp4hNBJC3SRSp/EYr+c/4gaYui+O/EOkoMLaahdRr/ALqysB+lfN57SScZo/p/6P2bzlSxGCk9I2kvK90/yRyFFFFfPn9GhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf/9Lxeiiivzs/0sCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACvfP2X4Um+O3hEPn5LtWGPVQSK8Dr6C/Za/wCS7+E/+vn+hrfC/wAWPqjwOKnbLMV/gn/6Sz94qKKK+9P88gooooAKKKKACv59/j1bLafGbxhAmMLqEp4GB82G6fjX9BFfgB+0L/yW3xl/1/t/6CteFnvwR9T9/wDo+t/X8Qv7n/tyPGqKKK+YP6tCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//0/F6KKK/Oz/SwKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAK+gv2Wv+S7+E/8Ar5/oa+fa+gv2Wv8Aku/hP/r5/oa6ML/Fj6o8Div/AJFeK/wT/wDSWfvFRRRX3h/nkFFFFABRRRQAV+AH7Qv/ACW3xl/1/t/6Ctfv/X4AftC/8lt8Zf8AX+3/AKCteHnv8OPqfv30fv8AkYYj/B/7cjxqiiivlz+rgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/9Txeiiivzs/0sCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACvoL9lr/ku/hP/AK+f6Gvn2voL9lr/AJLv4T/6+f6GujC/xY+qPA4r/wCRXiv8E/8A0ln7xUUUV94f55BRRRQAUUUUAFfgB+0L/wAlt8Zf9f7f+grX7/1+AH7Qv/JbfGX/AF/t/wCgrXh57/Dj6n799H7/AJGGI/wf+3I8aooor5c/q4KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//V8Xooor87P9LAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAr6C/Za/5Lv4T/wCvn+hr59r6C/Za/wCS7+E/+vn+hrowv8WPqjwOK/8AkV4r/BP/ANJZ+8VFFFfeH+eQUUUUAFFFFABX4AftC/8AJbfGX/X+3/oK1+/9fi/4p+CPjn4zftC+MtP8L2wSzh1A/ab2bKwQAqvU/wATeirzXi51ByjGMVd3P3LwNzChhcXiq+ImowjT1b2+JHx/FDNcSpBbxtLLIQqogLMxPQADkmvqD4ffsf8Axm8ewQ6hJYR6BYTciXUWMTlfVYVDSH2yAD61+m3wZ/Zo+HvwftY7q2t11bXSAZNQuUVnVu4hXkRr9OfU19FVhhckVr1X8j6Dirx5nzullNNW/nl19I9Pn9x+aGmf8E74TGDrfjZ/M7i2sgF/N5Ca1Zv+Cd/h0r/o/jW8VsfxWkTDP4MK/RqivRWVUP5fzPzWfi5xC5c31n/yWH/yJ+Xerf8ABPHV0gL6H4zhmlAPyXNoyKT2G5JGx/3ya8D8W/sc/HbwrFJcx6PFrcEfVtOmEzH6RsEkP4LX7gUVlUyai9tD18u8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V5mcdqVetA0z+734ceNtK+JXgLQPH+iMGsvEFlBexgHO0TIG2/VSSD9K7X2NfkH/AMEevjNN40+BWp/C/VJPMvPBN5tgy2SbO6G+MY7BW3KPYV+vlcdSNmWmfhp/wWd+DseoeEfCvxpsIv8ASNLmOmXbAf8ALKX54icejZFfhT8IPAtl8SfH2n+Br2+/s5tXEsUExGVW4CFogw9GYbT9a/ry/bc+HSfE/wDZh8eeGRF5tylg95bgDJE1r84I/DNfxx+Eddn8L+K9H8RQEpLpd5Bcrjg5hkDf0ropSvG4KKvqdN8RPhr4z+EXiiXw14us3s7uBsxuM7JVB4eNu4r6q+Avxgm8USReCvEcoOpBcWkzHBnx/wAs2J/5af3f73TrjP6gfGf4O+E/2g/htHBdQhNQa2W4067wDJFJIoZRnurcZFfz+eI/D3iP4d+KrvQdZjew1XSZ9pAJDK6HKup9DwQa48RQhiIuL36M+w4Y4mxWT4mOJwz06ro12Z+sXTg0V558KvHsPxG8FWuuPtTUbY/Zr5FwB5qjiQDqBIOcYwDn2Feh18bODi3GW6P7iyPOaOYYSnjMO/dkr+ndP0CiiipPWCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/0vF6KKK/Oz/SwKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBRK0KySr1SNyP++TX47R/NfIPWQfzr9iDG0scsa9WjkA/75NfjxFxfJns4/nX0/C6/ev5fqfy19IT/eMN/hf5n7L6IoXRtOUdBbxD/wAcFagrL0Rg2jWDDp9ni/8AQBWnX974H+DG3ZfkfwdWXvyXmy7YOEvIieBuH613S/dA9K86U4YMOxrv4JRJCsnqAa6oOxnJdSU9axtf8PaN4m0+TS9btI721lyCki7uvpnofetg15d8W/ijpXwr8LS61eESXtwGS0g4zJJjjPoo7msc0rUaVCcsT8CWpVGnOclGlufnr+0d8LfA3w31WGLw5qRN1d/vGsSNxhQ9Du7Z7CvDvAngfxL8RvFmneC/CVo1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";
app.get("/img/hazza-token", (c) => { const buf = Uint8Array.from(atob(HAZZA_TOKEN_IMG_B64), ch => ch.charCodeAt(0)); return new Response(buf, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=604800", "Access-Control-Allow-Origin": "*" } }); });

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
  let name = c.req.param("name").toLowerCase();
  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  // Support token ID lookups (e.g. /api/metadata/8) — marketplaces call tokenURI which appends the ID
  if (/^\d+$/.test(name)) {
    try {
      const resolved = await client.readContract({ address: addr, abi: REGISTRY_ABI, functionName: "nameOf", args: [BigInt(name)] }) as string;
      if (resolved) name = resolved.toLowerCase();
      else return c.json({ error: "Name not registered" }, 404);
    } catch { return c.json({ error: "Name not registered" }, 404); }
  }

  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);

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

    // Batch nameOf calls in smaller chunks to avoid RPC rate limits
    const BATCH_SIZE = 10;
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
  } catch (e: any) {
    return c.json({ error: "Failed to fetch names", _err: e?.message || String(e) }, 500);
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
      const BATCH = 10;

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
  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);

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

// =========================================================================
//              ERC-8004 AGENT REGISTRATION HELPER
// =========================================================================

// POST /api/agent/register — returns unsigned 8004 register tx + sets agent text records via relayer
// Agent flow: call this → sign & submit the 8004 tx → text records are set automatically
app.post("/api/agent/register", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.name || !body?.agentURI) {
    return c.json({ error: "Missing required fields: name, agentURI. Optional: agentWallet" }, 400);
  }

  const name = String(body.name).toLowerCase();
  const agentURI = String(body.agentURI);
  const agentWallet = body.agentWallet ? String(body.agentWallet) : null;

  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);

  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  // Verify name exists and get owner
  let nameOwner: string;
  try {
    const [ownerAddr, , , , existingAgentId] = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name],
    });
    nameOwner = (ownerAddr as string).toLowerCase();
    if (!nameOwner || nameOwner === "0x0000000000000000000000000000000000000000") {
      return c.json({ error: "Name not registered" }, 404);
    }
    // Check if already has an 8004 agent via text record
    const existingId = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "text", args: [name, "agent.8004id"],
    });
    if (existingId) {
      return c.json({ error: `Name already has agent identity (8004 #${existingId})` }, 409);
    }
  } catch (e: any) {
    if (e?.message?.includes("already has agent")) throw e;
    return c.json({ error: "Name not registered" }, 404);
  }

  // Build unsigned 8004 register tx
  const registerData = encodeFunctionData({
    abi: [{ name: "register", type: "function", stateMutability: "nonpayable", inputs: [{ name: "agentURI", type: "string" }], outputs: [{ type: "uint256" }] }],
    functionName: "register",
    args: [agentURI],
  });

  return c.json({
    name,
    nameOwner,
    agentURI,
    agentWallet: agentWallet || nameOwner,
    erc8004Registry: ERC8004_REGISTRY_ADDRESS,
    // Step 1: Agent signs and submits this tx from the name owner wallet
    registerTx: {
      to: ERC8004_REGISTRY_ADDRESS,
      data: registerData,
      description: "Register on ERC-8004 Agent Registry — mints an agent identity NFT to your wallet",
    },
    // Step 2: After tx confirms, call POST /api/agent/confirm to link the agentId to the hazza name
    confirmEndpoint: `/api/agent/confirm`,
    confirmBody: { name, agentWallet: agentWallet || nameOwner },
    instructions: [
      "1. Sign and submit registerTx from the name owner wallet",
      "2. Get the agentId from the Transfer event in the tx receipt (topics[3])",
      "3. POST /api/agent/confirm with {name, agentId, agentWallet, txHash} to link the identity",
    ],
  });
});

// POST /api/agent/confirm — verify 8004 registration and set agent text records
app.post("/api/agent/confirm", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.name || !body?.agentId || !body?.txHash) {
    return c.json({ error: "Missing required fields: name, agentId, txHash" }, 400);
  }

  const name = String(body.name).toLowerCase();
  const agentId = String(body.agentId);
  const txHash = body.txHash as `0x${string}`;
  const agentWallet = body.agentWallet ? String(body.agentWallet) : null;

  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);

  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  // Verify name exists and get owner
  let nameOwner: string;
  try {
    const [ownerAddr] = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name],
    });
    nameOwner = (ownerAddr as string).toLowerCase();
    if (!nameOwner || nameOwner === "0x0000000000000000000000000000000000000000") {
      return c.json({ error: "Name not registered" }, 404);
    }
  } catch {
    return c.json({ error: "Name not registered" }, 404);
  }

  // Verify the 8004 token exists and is owned by the name owner
  try {
    const agentOwner = await client.readContract({
      address: ERC8004_REGISTRY_ADDRESS, abi: ERC8004_ABI, functionName: "ownerOf", args: [BigInt(agentId)],
    });
    if ((agentOwner as string).toLowerCase() !== nameOwner) {
      return c.json({ error: "8004 agent token not owned by the name owner" }, 403);
    }
  } catch {
    return c.json({ error: "8004 agent token not found" }, 404);
  }

  // Set agent text records via relayer
  try {
    const chainId = Number(c.env.CHAIN_ID);
    const chain = chainId === 8453 ? base : baseSepolia;
    const account = privateKeyToAccount(c.env.RELAYER_PRIVATE_KEY as `0x${string}`);
    const keys = ["agent.8004id", "agent.wallet", "agent.status"];
    const values = [agentId, agentWallet || nameOwner, "active"];
    const txData = encodeFunctionData({
      abi: REGISTRY_ABI, functionName: "setTextsDirect", args: [name, keys, values],
    });
    const rpcs = [c.env.BASE_MAINNET_RPC, c.env.PAYMASTER_BUNDLER_RPC, c.env.RPC_URL].filter(Boolean);
    let setTxHash: `0x${string}` | undefined;
    for (const rpc of rpcs) {
      try {
        const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
        setTxHash = await walletClient.sendTransaction({ to: addr, data: txData });
        break;
      } catch (err: any) {
        if (rpc === rpcs[rpcs.length - 1]) throw err;
      }
    }
    await client.waitForTransactionReceipt({ hash: setTxHash!, timeout: 20_000 });

    return c.json({
      name,
      agentId,
      agentWallet: agentWallet || nameOwner,
      erc8004Registry: ERC8004_REGISTRY_ADDRESS,
      textRecordsTx: setTxHash,
      profileUrl: `https://${name}.hazza.name`,
      verified: true,
    });
  } catch (e: any) {
    console.error("Agent confirm failed:", e?.shortMessage || e?.message || e);
    return c.json({ error: "Failed to set agent text records" }, 500);
  }
});

// Helper: set agent text records after registration (fire-and-forget)
// Log failed treasury forwards to KV for retry queue 
async function logTreasuryForwardFailure(env: Env, amount: string, name: string, source: string, error: string) {
  try {
    const key = `treasury-retry:${Date.now()}:${name}`;
    const entry = JSON.stringify({ amount, name, source, error, attempts: 0, timestamp: new Date().toISOString() });
    await env.WATCHLIST_KV.put(key, entry, { expirationTtl: 30 * 86400 }); // 30 day TTL
    console.error(`Treasury forward FAILED — queued for retry: ${key} (${amount} USDC for ${name} via ${source})`);
  } catch { /* KV logging itself failed — nothing more we can do */ }
}

async function setAgentTextRecords(env: Env, name: string, agentURI?: string, agentWallet?: string) {
  if (!agentURI && !agentWallet) return;
  try {
    const chainId = Number(env.CHAIN_ID);
    const chain = chainId === 8453 ? base : baseSepolia;
    const account = privateKeyToAccount(env.RELAYER_PRIVATE_KEY as `0x${string}`);
    const addr = registryAddress(env);
    const keys: string[] = [];
    const values: string[] = [];
    if (agentURI) { keys.push("agent.uri"); values.push(agentURI); }
    if (agentWallet) { keys.push("agent.wallet"); values.push(agentWallet); }
    const txData = encodeFunctionData({
      abi: REGISTRY_ABI, functionName: "setTextsDirect", args: [name, keys, values],
    });
    const rpcs = [env.BASE_MAINNET_RPC, env.PAYMASTER_BUNDLER_RPC, env.RPC_URL].filter(Boolean);
    for (const rpc of rpcs) {
      try {
        const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
        await walletClient.sendTransaction({ to: addr, data: txData });
        return;
      } catch { if (rpc === rpcs[rpcs.length - 1]) throw new Error("All RPCs failed"); }
    }
  } catch (e) { console.warn("Agent text records failed (non-fatal):", e); }
}

app.post("/x402/register", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.name || !body.owner) {
    return c.json({ error: "Missing required fields: name, owner" }, 400);
  }

  const name = String(body.name).toLowerCase();
  const owner = body.owner as Address;

  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);
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

  // Verify Unlimited Pass ownership — FID-aware (checks all Farcaster-linked wallets)
  let verifiedPass = false;
  if (body.hasPass) {
    // Step 1: Direct on-chain check
    try {
      const ownsPass = await client.readContract({
        address: UNLIMITED_PASS_ADDRESS,
        abi: UNLIMITED_PASS_ABI,
        functionName: "hasUnlimitedPass",
        args: [owner],
      });
      verifiedPass = !!ownsPass;
    } catch { /* non-fatal */ }

    // Step 2: If not found, check FID-linked wallets via Neynar
    if (!verifiedPass && c.env.NEYNAR_API_KEY) {
      try {
        const bulkRes = await fetch(
          `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${owner.toLowerCase()}`,
          { headers: { accept: "application/json", "x-api-key": c.env.NEYNAR_API_KEY } }
        );
        if (bulkRes.ok) {
          const bulkData = await bulkRes.json() as Record<string, any[]>;
          const users = bulkData[owner.toLowerCase()];
          if (users?.length > 0) {
            const BALANCE_OF_ABI = [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] }] as const;
            const PASS_ADDR = "0xCe559A2A6b64504bE00aa7aA85C5C31EA93a16BB" as Address;
            for (const user of users) {
              const addrs = [...(user.verified_addresses?.eth_addresses || [])];
              if (user.custody_address) addrs.push(user.custody_address);
              for (const a of addrs) {
                if (a.toLowerCase() === owner.toLowerCase()) continue;
                try {
                  const bal = await client.readContract({
                    address: PASS_ADDR, abi: BALANCE_OF_ABI, functionName: "balanceOf",
                    args: [a as Address],
                  });
                  if ((bal as bigint) > 0n) { verifiedPass = true; break; }
                } catch { /* skip */ }
              }
              if (verifiedPass) break;
            }
          }
        }
      } catch (e) {
        console.warn("FID pass lookup failed in registration:", e);
      }
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
      const rpcs = [c.env.BASE_MAINNET_RPC, c.env.PAYMASTER_BUNDLER_RPC, c.env.RPC_URL].filter(Boolean);
      for (const rpc of rpcs) {
        try {
          const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
          regTxHash = await walletClient.sendTransaction({ to: addr, data: txData });
          break;
        } catch (err: any) {
          console.warn(`RPC failed (${rpc?.slice(0, 30)}...):`, err?.message);
          if (rpc === rpcs[rpcs.length - 1]) throw err;
        }
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

      // Set agent text records if provided (fire-and-forget)
      if (body.agentURI || body.agentWallet) {
        setAgentTextRecords(c.env, name, body.agentURI, body.agentWallet);
      }

      return c.json({
        name, owner, tokenId,
        registrationTx: regTxHash,
        profileUrl: `https://${name}.hazza.name`,
        firstRegistration: true,
        agentNote: body.agentURI || body.agentWallet
          ? "Agent text records set. Register on ERC-8004 directly (0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) to get an agent identity, then set agent.8004id text record."
          : undefined,
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
      const rpcs = [c.env.BASE_MAINNET_RPC, c.env.PAYMASTER_BUNDLER_RPC, c.env.RPC_URL].filter(Boolean);
      for (const rpc of rpcs) {
        try {
          const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
          regTxHash = await walletClient.sendTransaction({ to: addr, data: txData });
          break;
        } catch (err: any) {
          console.warn(`RPC failed (${rpc?.slice(0, 30)}...):`, err?.message);
          if (rpc === rpcs[rpcs.length - 1]) throw err;
        }
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

      // Set agent text records if provided (fire-and-forget)
      if (body.agentURI || body.agentWallet) {
        setAgentTextRecords(c.env, name, body.agentURI, body.agentWallet);
      }

      return c.json({
        name, owner, tokenId,
        registrationTx: regTxHash,
        profileUrl: `https://${name}.hazza.name`,
        freeClaim: true,
        memberId: freeClaimMemberId,
        agentNote: body.agentURI || body.agentWallet
          ? "Agent text records set. Register on ERC-8004 directly (0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) to get an agent identity, then set agent.8004id text record."
          : undefined,
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

    // Try paid RPCs first (Alchemy → Coinbase → public fallback)
    const rpcs = [c.env.BASE_MAINNET_RPC, c.env.PAYMASTER_BUNDLER_RPC, c.env.RPC_URL].filter(Boolean);
    for (const rpc of rpcs) {
      try {
        const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
        regTxHash = await walletClient.sendTransaction({ to: addr, data: txData });
        break;
      } catch (err: any) {
        console.warn(`RPC failed (${rpc?.slice(0, 30)}...):`, err?.message);
        if (rpc === rpcs[rpcs.length - 1]) throw err;
      }
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

    // Forward USDC payment from relayer to treasury (fire-and-forget, don't block response)
    const treasuryAddr = c.env.HAZZA_TREASURY as Address;
    if (treasuryAddr && totalCost > 0n) {
      (async () => {
        try {
          const transferData = encodeFunctionData({
            abi: [{ name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }] as const,
            functionName: "transfer",
            args: [treasuryAddr, totalCost],
          });
          const fwdClient = createWalletClient({ account, chain, transport: http(rpcs[0]) });
          const fwdTx = await fwdClient.sendTransaction({ to: c.env.USDC_ADDRESS as Address, data: transferData });
          console.log(`Treasury forward: ${totalCost.toString()} USDC (${fwdTx}) for ${name}`);
        } catch (err: any) {
          await logTreasuryForwardFailure(c.env, totalCost.toString(), name, "x402-register", err?.shortMessage || err?.message);
        }
      })();
    }

    const paidIp = c.req.header("cf-connecting-ip") || "unknown";
    await incrementGlobalDailyCap(c.env);
    await logRegistration(c.env, { name, owner, ip: paidIp, type: "paid", txHash: regTxHash, timestamp: Date.now() });

    // Set agent text records if provided (fire-and-forget)
    if (body.agentURI || body.agentWallet) {
      setAgentTextRecords(c.env, name, body.agentURI, body.agentWallet);
    }

    return new Response(JSON.stringify({
      name,
      owner,
      tokenId,
      registrationTx: regTxHash,
      profileUrl: `https://${name}.hazza.name`,
      agentNote: body.agentURI || body.agentWallet
        ? "Agent text records set. Register on ERC-8004 directly (0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) to get an agent identity, then set agent.8004id text record."
        : undefined,
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
//                    x402 TEXT RECORD UPDATE
// =========================================================================

const TEXT_RECORD_PRICE_USDC = 20000n; // $0.02 USDC (6 decimals)

app.post("/x402/text/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);

  const body = await c.req.json().catch(() => null);
  if (!body || !body.key || typeof body.key !== "string") {
    return c.json({ error: "Missing 'key' in request body" }, 400);
  }
  if (typeof body.value !== "string") {
    return c.json({ error: "Missing 'value' in request body" }, 400);
  }

  const { key, value } = body;
  const client = getClient(c.env);
  const addr = registryAddress(c.env);
  const relayerAddr = c.env.RELAYER_ADDRESS as Address;

  // Verify name exists and get owner
  let nameOwner: string;
  try {
    const [ownerAddr] = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name],
    });
    nameOwner = (ownerAddr as string).toLowerCase();
    if (!nameOwner || nameOwner === "0x0000000000000000000000000000000000000000") {
      return c.json({ error: "Name not registered" }, 404);
    }
  } catch {
    return c.json({ error: "Name not registered" }, 404);
  }

  const paymentHeader = c.req.header("X-PAYMENT");

  // --- No payment → return 402 ---
  if (!paymentHeader) {
    const requirements = {
      x402Version: "1",
      accepts: [{
        scheme: "exact",
        network: Number(c.env.CHAIN_ID) === 8453 ? "base" : "base-sepolia",
        maxAmountRequired: TEXT_RECORD_PRICE_USDC.toString(),
        asset: c.env.USDC_ADDRESS,
        payTo: relayerAddr,
        resource: `/x402/text/${name}`,
      }],
      name,
      key,
      price: "0.02",
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

  // --- Payment provided → validate and execute ---
  let payment: any;
  try {
    payment = JSON.parse(atob(paymentHeader));
  } catch {
    return c.json({ error: "Invalid X-PAYMENT header (expected base64 JSON)" }, 400);
  }

  if (payment.scheme !== "exact") {
    return c.json({ error: `Unsupported payment scheme: ${payment.scheme}. Use "exact".` }, 400);
  }

  const txHash = payment.txHash as `0x${string}`;
  if (!txHash || !txHash.startsWith("0x") || txHash.length !== 66) {
    return c.json({ error: "Invalid txHash in payment" }, 400);
  }

  // Verify payer owns the name
  const payerAddr = (payment.from || "").toLowerCase();
  if (!payerAddr || payerAddr !== nameOwner) {
    return c.json({ error: "Payment sender does not own this name" }, 403);
  }

  // Replay protection
  if (await isPaymentUsed(c.env, txHash)) {
    return c.json({ error: "Payment already used" }, 400);
  }
  await markPaymentUsed(c.env, txHash);

  // Verify tx on-chain
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch {
    await unmarkPayment(c.env, txHash);
    return c.json({ error: "Transaction not found or not confirmed. Please try again." }, 400);
  }

  if (receipt.status !== "success") {
    await unmarkPayment(c.env, txHash);
    return c.json({ error: "Transaction failed" }, 400);
  }

  // Verify USDC transfer to relayer with sufficient amount
  const usdcAddr = c.env.USDC_ADDRESS.toLowerCase();
  const transferTopic = keccak256(toBytes("Transfer(address,address,uint256)"));
  let verified = false;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdcAddr) continue;
    if (log.topics[0] !== transferTopic) continue;
    const fromAddr = ("0x" + (log.topics[1] || "").slice(26)).toLowerCase();
    const toAddr = ("0x" + (log.topics[2] || "").slice(26)).toLowerCase();
    if (toAddr !== relayerAddr.toLowerCase()) continue;
    if (fromAddr !== payerAddr) continue;
    const transferAmount = BigInt(log.data);
    if (transferAmount >= TEXT_RECORD_PRICE_USDC) {
      verified = true;
      break;
    }
  }

  if (!verified) {
    await unmarkPayment(c.env, txHash);
    return c.json({ error: "Payment verification failed: no matching USDC transfer to relayer" }, 400);
  }

  // --- Payment verified — set text record via relayer using setTextsDirect ---
  try {
    const chainId = Number(c.env.CHAIN_ID);
    const chain = chainId === 8453 ? base : baseSepolia;
    const account = privateKeyToAccount(c.env.RELAYER_PRIVATE_KEY as `0x${string}`);

    const txData = encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: "setTextsDirect",
      args: [name, [key], [value]],
    });

    let setTxHash: `0x${string}`;
    const rpcs = [c.env.BASE_MAINNET_RPC, c.env.PAYMASTER_BUNDLER_RPC, c.env.RPC_URL].filter(Boolean);
    for (const rpc of rpcs) {
      try {
        const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
        setTxHash = await walletClient.sendTransaction({ to: addr, data: txData });
        break;
      } catch (err: any) {
        console.warn(`RPC failed (${rpc?.slice(0, 30)}...):`, err?.message);
        if (rpc === rpcs[rpcs.length - 1]) throw err;
      }
    }

    const setReceipt = await client.waitForTransactionReceipt({ hash: setTxHash!, timeout: 20_000 });
    if (setReceipt.status !== "success") {
      await unmarkPayment(c.env, payment.txHash);
      return c.json({ error: "setText transaction reverted on-chain. Payment released — you can retry.", tx: setTxHash! }, 500);
    }

    // Forward USDC to treasury (fire-and-forget)
    const treasuryAddr = c.env.HAZZA_TREASURY as Address;
    if (treasuryAddr) {
      (async () => {
        try {
          const transferData = encodeFunctionData({
            abi: [{ name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }] as const,
            functionName: "transfer",
            args: [treasuryAddr, TEXT_RECORD_PRICE_USDC],
          });
          const walletClient = createWalletClient({ account, chain, transport: http(c.env.BASE_MAINNET_RPC || c.env.RPC_URL) });
          await walletClient.sendTransaction({ to: c.env.USDC_ADDRESS as Address, data: transferData });
        } catch (e: any) { await logTreasuryForwardFailure(c.env, TEXT_RECORD_PRICE_USDC.toString(), name, "x402-text", e?.message || String(e)); }
      })();
    }

    return c.json({
      name, key, value,
      tx: setTxHash!,
      profileUrl: `https://${name}.hazza.name`,
    });
  } catch (e: any) {
    console.error("setText via x402 failed:", e?.shortMessage || e?.message || e);
    await unmarkPayment(c.env, payment.txHash);
    return c.json({ error: "Text record update failed. Payment released — you can retry." }, 500);
  }
});

// x402 batch text records — $0.02 for up to 10 records in one tx
app.post("/x402/text/:name/batch", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);

  const body = await c.req.json().catch(() => null);
  if (!body || !body.records || !Array.isArray(body.records) || body.records.length === 0) {
    return c.json({ error: "Missing 'records' array in request body (each: {key, value})" }, 400);
  }
  for (const r of body.records) {
    if (!r.key || typeof r.key !== "string" || typeof r.value !== "string") {
      return c.json({ error: "Each record must have 'key' (string) and 'value' (string)" }, 400);
    }
  }

  const keys = body.records.map((r: any) => r.key);
  const values = body.records.map((r: any) => r.value);
  const client = getClient(c.env);
  const addr = registryAddress(c.env);
  const relayerAddr = c.env.RELAYER_ADDRESS as Address;

  // Verify name exists and get owner
  let nameOwner: string;
  try {
    const [ownerAddr] = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name],
    });
    nameOwner = (ownerAddr as string).toLowerCase();
    if (!nameOwner || nameOwner === "0x0000000000000000000000000000000000000000") {
      return c.json({ error: "Name not registered" }, 404);
    }
  } catch {
    return c.json({ error: "Name not registered" }, 404);
  }

  const paymentHeader = c.req.header("X-PAYMENT");

  if (!paymentHeader) {
    const requirements = {
      x402Version: "1",
      accepts: [{
        scheme: "exact",
        network: Number(c.env.CHAIN_ID) === 8453 ? "base" : "base-sepolia",
        maxAmountRequired: TEXT_RECORD_PRICE_USDC.toString(),
        asset: c.env.USDC_ADDRESS,
        payTo: relayerAddr,
        resource: `/x402/text/${name}/batch`,
      }],
      name,
      recordCount: body.records.length,
      price: "0.02",
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

  let payment: any;
  try {
    payment = JSON.parse(atob(paymentHeader));
  } catch {
    return c.json({ error: "Invalid X-PAYMENT header (expected base64 JSON)" }, 400);
  }

  if (payment.scheme !== "exact") {
    return c.json({ error: `Unsupported payment scheme: ${payment.scheme}. Use "exact".` }, 400);
  }

  const txHash = payment.txHash as `0x${string}`;
  if (!txHash || !txHash.startsWith("0x") || txHash.length !== 66) {
    return c.json({ error: "Invalid txHash in payment" }, 400);
  }

  const payerAddr = (payment.from || "").toLowerCase();
  if (!payerAddr || payerAddr !== nameOwner) {
    return c.json({ error: "Payment sender does not own this name" }, 403);
  }

  if (await isPaymentUsed(c.env, txHash)) {
    return c.json({ error: "Payment already used" }, 400);
  }
  await markPaymentUsed(c.env, txHash);

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch {
    await unmarkPayment(c.env, txHash);
    return c.json({ error: "Transaction not found or not confirmed. Please try again." }, 400);
  }

  if (receipt.status !== "success") {
    await unmarkPayment(c.env, txHash);
    return c.json({ error: "Transaction failed" }, 400);
  }

  const usdcAddr = c.env.USDC_ADDRESS.toLowerCase();
  const transferTopic = keccak256(toBytes("Transfer(address,address,uint256)"));
  let verified = false;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdcAddr) continue;
    if (log.topics[0] !== transferTopic) continue;
    const fromAddr = ("0x" + (log.topics[1] || "").slice(26)).toLowerCase();
    const toAddr = ("0x" + (log.topics[2] || "").slice(26)).toLowerCase();
    if (toAddr !== relayerAddr.toLowerCase()) continue;
    if (fromAddr !== payerAddr) continue;
    const transferAmount = BigInt(log.data);
    if (transferAmount >= TEXT_RECORD_PRICE_USDC) {
      verified = true;
      break;
    }
  }

  if (!verified) {
    await unmarkPayment(c.env, txHash);
    return c.json({ error: "Payment verification failed: no matching USDC transfer to relayer" }, 400);
  }

  try {
    const chainId = Number(c.env.CHAIN_ID);
    const chain = chainId === 8453 ? base : baseSepolia;
    const account = privateKeyToAccount(c.env.RELAYER_PRIVATE_KEY as `0x${string}`);

    const txData = encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: "setTextsDirect",
      args: [name, keys, values],
    });

    let setTxHash: `0x${string}`;
    const rpcs = [c.env.BASE_MAINNET_RPC, c.env.PAYMASTER_BUNDLER_RPC, c.env.RPC_URL].filter(Boolean);
    for (const rpc of rpcs) {
      try {
        const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
        setTxHash = await walletClient.sendTransaction({ to: addr, data: txData });
        break;
      } catch (err: any) {
        console.warn(`RPC failed (${rpc?.slice(0, 30)}...):`, err?.message);
        if (rpc === rpcs[rpcs.length - 1]) throw err;
      }
    }

    const setReceipt = await client.waitForTransactionReceipt({ hash: setTxHash!, timeout: 20_000 });
    if (setReceipt.status !== "success") {
      await unmarkPayment(c.env, payment.txHash);
      return c.json({ error: "setTexts transaction reverted on-chain. Payment released — you can retry.", tx: setTxHash! }, 500);
    }

    const treasuryAddr = c.env.HAZZA_TREASURY as Address;
    if (treasuryAddr) {
      (async () => {
        try {
          const transferData = encodeFunctionData({
            abi: [{ name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }] as const,
            functionName: "transfer",
            args: [treasuryAddr, TEXT_RECORD_PRICE_USDC],
          });
          const walletClient = createWalletClient({ account, chain, transport: http(c.env.BASE_MAINNET_RPC || c.env.RPC_URL) });
          await walletClient.sendTransaction({ to: c.env.USDC_ADDRESS as Address, data: transferData });
        } catch (e: any) { await logTreasuryForwardFailure(c.env, TEXT_RECORD_PRICE_USDC.toString(), name, "x402-text-batch", e?.message || String(e)); }
      })();
    }

    return c.json({
      name,
      records: body.records,
      tx: setTxHash!,
      profileUrl: `https://${name}.hazza.name`,
    });
  } catch (e: any) {
    console.error("setTexts via x402 failed:", e?.shortMessage || e?.message || e);
    await unmarkPayment(c.env, payment.txHash);
    return c.json({ error: "Batch text record update failed. Payment released — you can retry." }, 500);
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
  return new BazaarClient({ chainId, rpcUrl: env.BASE_MAINNET_RPC || env.RPC_URL });
}

// Helper: create StorageClient for Net Protocol
function getStorageClient(env: Env) {
  const chainId = Number(env.CHAIN_ID);
  return new StorageClient({ chainId, overrides: { rpcUrls: [env.BASE_MAINNET_RPC || env.RPC_URL] } });
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

    // Fetch bounty info for this token
    let bounty: any = null;
    try {
      const [bSeller, bAmount, bAgent, bAgentActive, bSellerAssigned, bActive] = await client.readContract({
        address: BOUNTY_ESCROW_ADDRESS as `0x${string}`,
        abi: BOUNTY_ESCROW_ABI,
        functionName: "getBounty",
        args: [BigInt(tokenId)],
      });
      if (bActive) {
        const zeroAddr = "0x0000000000000000000000000000000000000000";
        bounty = {
          amount: formatEther(bAmount),
          amountWei: bAmount.toString(),
          agent: bAgent === zeroAddr ? null : bAgent,
          agentActive: bAgentActive,
          sellerAssigned: bSellerAssigned,
        };
      }
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
      image: `https://hazza.name/api/nft-image/${name}`,
      bounty,
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
      { name: "amount", type: "uint256" },
      { name: "agent", type: "address" },
      { name: "agentActive", type: "bool" },
      { name: "sellerAssigned", type: "bool" },
      { name: "active", type: "bool" },
    ],
  },
  { name: "isAgentActive", type: "function", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  { name: "pendingWithdrawals", type: "function", stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  { name: "registerBounty", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "bountyAmount", type: "uint256" }, { name: "agent", type: "address" }],
    outputs: [],
  },
  { name: "registerBounty", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "bountyAmount", type: "uint256" }],
    outputs: [],
  },
  { name: "registerAgent", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  { name: "claimBounty", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  { name: "cancelBounty", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  { name: "assignAgent", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "agent", type: "address" }],
    outputs: [],
  },
  { name: "removeAgent", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  { name: "withdrawBounty", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  { name: "withdrawPayout", type: "function", stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

const BOUNTY_ESCROW_ADDRESS = "0x95a29AD7f23c1039A03de365c23D275Fc5386f90";

// GET /api/bounty/:tokenId — read bounty details
app.get("/api/bounty/:tokenId", async (c) => {
  const tokenIdParam = c.req.param("tokenId");
  if (!/^\d+$/.test(tokenIdParam) || tokenIdParam === "0") {
    return c.json({ error: "Invalid tokenId: must be a positive integer" }, 400);
  }
  try {
    const client = getClient(c.env);
    const [seller, amount, agent, agentActive, sellerAssigned, active] = await client.readContract({
      address: BOUNTY_ESCROW_ADDRESS as `0x${string}`,
      abi: BOUNTY_ESCROW_ABI,
      functionName: "getBounty",
      args: [BigInt(tokenIdParam)],
    });
    if (!active) {
      return c.json({ active: false });
    }
    const zeroAddr = "0x0000000000000000000000000000000000000000";
    return c.json({
      active: true,
      seller,
      amount: formatEther(amount),
      amountWei: amount.toString(),
      agent: agent === zeroAddr ? null : agent,
      agentActive,
      sellerAssigned,
      escrowAddress: BOUNTY_ESCROW_ADDRESS,
    });
  } catch (e: any) {
    console.error("Bounty lookup failed:", e?.message || e);
    return c.json({ active: false, error: "Bounty lookup failed" });
  }
});

// GET /api/bounty/pending/:address — check pending withdrawals for an address
app.get("/api/bounty/pending/:address", async (c) => {
  const addr = c.req.param("address");
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    return c.json({ error: "Invalid address" }, 400);
  }
  try {
    const client = getClient(c.env);
    const pending = await client.readContract({
      address: BOUNTY_ESCROW_ADDRESS as `0x${string}`,
      abi: BOUNTY_ESCROW_ABI,
      functionName: "pendingWithdrawals",
      args: [addr as `0x${string}`],
    });
    return c.json({ address: addr, pending: formatEther(pending), pendingWei: pending.toString() });
  } catch (e: any) {
    return c.json({ error: "Lookup failed" }, 500);
  }
});

// POST /api/bounty/register — return unsigned tx to register bounty metadata (no ETH — bounty comes from Seaport consideration)
app.post("/api/bounty/register", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.tokenId) return c.json({ error: "Missing tokenId" }, 400);
  if (!body?.amountWei) return c.json({ error: "Missing amountWei (bounty amount in wei)" }, 400);
  const { tokenId, amountWei, agent } = body;

  const data = agent
    ? encodeFunctionData({ abi: BOUNTY_ESCROW_ABI, functionName: "registerBounty", args: [BigInt(tokenId), BigInt(amountWei), agent] })
    : encodeFunctionData({ abi: BOUNTY_ESCROW_ABI, functionName: "registerBounty", args: [BigInt(tokenId), BigInt(amountWei)] });
  return c.json({
    tx: { to: BOUNTY_ESCROW_ADDRESS, data, value: "0" },
    description: agent ? `Register bounty for token ${tokenId} with agent ${agent}` : `Register open bounty for token ${tokenId}`,
  });
});

// POST /api/bounty/register-agent — return unsigned tx for agent to self-register
app.post("/api/bounty/register-agent", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.tokenId) return c.json({ error: "Missing tokenId" }, 400);

  const data = encodeFunctionData({ abi: BOUNTY_ESCROW_ABI, functionName: "registerAgent", args: [BigInt(body.tokenId)] });
  return c.json({
    tx: { to: BOUNTY_ESCROW_ADDRESS, data, value: "0" },
    description: `Register as agent on bounty for token ${body.tokenId}`,
  });
});

// POST /api/bounty/claim — return unsigned tx for agent to claim bounty after sale
app.post("/api/bounty/claim", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.tokenId) return c.json({ error: "Missing tokenId" }, 400);

  const data = encodeFunctionData({ abi: BOUNTY_ESCROW_ABI, functionName: "claimBounty", args: [BigInt(body.tokenId)] });
  return c.json({
    tx: { to: BOUNTY_ESCROW_ADDRESS, data, value: "0" },
    description: `Claim bounty for token ${body.tokenId}`,
  });
});

// POST /api/bounty/cancel — return unsigned tx for seller to cancel bounty (refund)
app.post("/api/bounty/cancel", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.tokenId) return c.json({ error: "Missing tokenId" }, 400);

  const data = encodeFunctionData({ abi: BOUNTY_ESCROW_ABI, functionName: "cancelBounty", args: [BigInt(body.tokenId)] });
  return c.json({
    tx: { to: BOUNTY_ESCROW_ADDRESS, data, value: "0" },
    description: `Cancel bounty for token ${body.tokenId}`,
  });
});

// POST /api/bounty/assign-agent — return unsigned tx for seller to assign/switch agent
app.post("/api/bounty/assign-agent", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.tokenId || !body?.agent) return c.json({ error: "Missing tokenId or agent" }, 400);

  const data = encodeFunctionData({ abi: BOUNTY_ESCROW_ABI, functionName: "assignAgent", args: [BigInt(body.tokenId), body.agent] });
  return c.json({
    tx: { to: BOUNTY_ESCROW_ADDRESS, data, value: "0" },
    description: `Assign agent ${body.agent} to bounty for token ${body.tokenId}`,
  });
});

// POST /api/bounty/remove-agent — return unsigned tx for seller to remove agent
app.post("/api/bounty/remove-agent", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.tokenId) return c.json({ error: "Missing tokenId" }, 400);

  const data = encodeFunctionData({ abi: BOUNTY_ESCROW_ABI, functionName: "removeAgent", args: [BigInt(body.tokenId)] });
  return c.json({
    tx: { to: BOUNTY_ESCROW_ADDRESS, data, value: "0" },
    description: `Remove agent from bounty for token ${body.tokenId}`,
  });
});

// POST /api/bounty/withdraw — return unsigned tx to withdraw earned payouts
app.post("/api/bounty/withdraw", async (c) => {

  const data = encodeFunctionData({ abi: BOUNTY_ESCROW_ABI, functionName: "withdrawPayout", args: [] });
  return c.json({
    tx: { to: BOUNTY_ESCROW_ADDRESS, data, value: "0" },
    description: "Withdraw pending bounty payouts",
  });
});

// POST /api/bounty/withdraw-bounty — return unsigned tx for seller to reclaim after direct sale
app.post("/api/bounty/withdraw-bounty", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.tokenId) return c.json({ error: "Missing tokenId" }, 400);

  const data = encodeFunctionData({ abi: BOUNTY_ESCROW_ABI, functionName: "withdrawBounty", args: [BigInt(body.tokenId)] });
  return c.json({
    tx: { to: BOUNTY_ESCROW_ADDRESS, data, value: "0" },
    description: `Seller withdraw bounty for token ${body.tokenId} (no agent facilitated)`,
  });
});

// =========================================================================
//                     XMTP OPEN FRAMES (register, buy)
// =========================================================================

/** Build Open Frame HTML with XMTP support */
function frameHtml(opts: {
  title: string; image: string; buttons: { label: string; action: "tx" | "post" | "link"; target: string; postUrl?: string }[];
  state?: string; aspectRatio?: string;
}): string {
  let meta = `
<meta property="of:version" content="vNext" />
<meta property="of:accepts:xmtp" content="2024-02-09" />
<meta property="of:image" content="${opts.image}" />
<meta property="og:image" content="${opts.image}" />
<meta property="og:title" content="${opts.title}" />`;
  if (opts.aspectRatio) meta += `\n<meta property="of:image:aspect_ratio" content="${opts.aspectRatio}" />`;
  if (opts.state) meta += `\n<meta property="of:state" content="${opts.state.replace(/"/g, '&quot;')}" />`;
  opts.buttons.forEach((b, i) => {
    const n = i + 1;
    meta += `\n<meta property="of:button:${n}" content="${b.label}" />`;
    meta += `\n<meta property="of:button:${n}:action" content="${b.action}" />`;
    meta += `\n<meta property="of:button:${n}:target" content="${b.target}" />`;
    if (b.postUrl) meta += `\n<meta property="of:button:${n}:post_url" content="${b.postUrl}" />`;
  });
  return `<!DOCTYPE html><html><head>${meta}\n<title>${opts.title}</title></head><body><h1>${opts.title}</h1></body></html>`;
}

/** Generate a dynamic SVG frame image */
function frameImageSvg(name: string, price: string, status?: string): string {
  const bgColor = status === "success" ? "#10b981" : status === "error" ? "#ef4444" : "#131325";
  const statusText = status === "success" ? "Registered!" : status === "error" ? "Failed" : price;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628" viewBox="0 0 1200 628">
  <rect width="1200" height="628" fill="${bgColor}" rx="24"/>
  <text x="600" y="240" text-anchor="middle" fill="white" font-family="sans-serif" font-size="72" font-weight="bold">${name}.hazza.name</text>
  <text x="600" y="340" text-anchor="middle" fill="#a5b4fc" font-family="sans-serif" font-size="48">${statusText}</text>
  <text x="600" y="520" text-anchor="middle" fill="#6b7280" font-family="sans-serif" font-size="28">hazza.name — onchain names on Base</text>
</svg>`;
}

// GET /frames/register/:name — Frame HTML for name registration
app.get("/frames/register/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.text("Invalid name", 400);
  const baseUrl = "https://hazza.name";

  const client = getClient(c.env);
  const addr = registryAddress(c.env);

  const available = await client.readContract({
    address: addr, abi: REGISTRY_ABI, functionName: "available", args: [name],
  });

  if (!available) {
    // Name is taken — show info frame
    const html = frameHtml({
      title: `${name}.hazza.name — Taken`,
      image: `${baseUrl}/frames/register/${name}/image?status=taken`,
      buttons: [{ label: "View Profile", action: "link", target: `https://${name}.hazza.name` }],
      aspectRatio: "1.91:1",
    });
    return c.html(html);
  }

  // Name is available — the frame needs the user's address to quote accurately.
  // Use a tx button: the /tx endpoint will get the user's address and return the right transaction.
  const html = frameHtml({
    title: `Register ${name}.hazza.name`,
    image: `${baseUrl}/frames/register/${name}/image`,
    buttons: [{
      label: "Register",
      action: "tx",
      target: `${baseUrl}/frames/register/${name}/tx`,
      postUrl: `${baseUrl}/frames/register/${name}/callback`,
    }],
    aspectRatio: "1.91:1",
  });
  return c.html(html);
});

// GET /frames/register/:name/image — Dynamic SVG image
app.get("/frames/register/:name/image", async (c) => {
  const name = c.req.param("name").toLowerCase();
  const status = c.req.query("status");

  if (status === "taken") {
    return c.body(frameImageSvg(name, "Already Registered"), 200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=60" });
  }
  if (status === "success") {
    return c.body(frameImageSvg(name, "", "success"), 200, { "Content-Type": "image/svg+xml", "Cache-Control": "no-cache" });
  }
  if (status === "error") {
    const msg = c.req.query("msg") || "Failed";
    return c.body(frameImageSvg(name, msg, "error"), 200, { "Content-Type": "image/svg+xml", "Cache-Control": "no-cache" });
  }

  // Default: show price. We don't know the user's wallet here, so show base price.
  const client = getClient(c.env);
  const addr = registryAddress(c.env);
  let price = "$5 USDC";
  try {
    const available = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "available", args: [name],
    });
    if (!available) {
      return c.body(frameImageSvg(name, "Already Registered"), 200, { "Content-Type": "image/svg+xml" });
    }
    // Can't know wallet-specific price without the user's address — show "from FREE"
    price = "from FREE";
  } catch { /* fallback */ }

  return c.body(frameImageSvg(name, price), 200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=30" });
});

// POST /frames/register/:name/tx — Return transaction data for the user to sign
app.post("/frames/register/:name/tx", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.json({ error: "Invalid name" }, 400);

  const body = await c.req.json().catch(() => null);
  const userAddress = (body?.untrustedData?.address || body?.untrustedData?.walletAddress || "") as Address;
  if (!userAddress || !isAddress(userAddress)) {
    return c.json({ error: "No wallet address provided" }, 400);
  }

  const client = getClient(c.env);
  const addr = registryAddress(c.env);
  const relayerAddr = c.env.RELAYER_ADDRESS as Address;

  // Check availability
  const available = await client.readContract({
    address: addr, abi: REGISTRY_ABI, functionName: "available", args: [name],
  });
  if (!available) return c.json({ error: "Name no longer available" }, 409);

  // FID-aware Unlimited Pass detection (same as x402/register)
  let verifiedPass = false;
  try {
    const ownsPass = await client.readContract({
      address: UNLIMITED_PASS_ADDRESS, abi: UNLIMITED_PASS_ABI,
      functionName: "hasUnlimitedPass", args: [userAddress],
    });
    verifiedPass = !!ownsPass;
  } catch { /* non-fatal */ }
  if (!verifiedPass && c.env.NEYNAR_API_KEY) {
    try {
      const bulkRes = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${userAddress.toLowerCase()}`,
        { headers: { accept: "application/json", "x-api-key": c.env.NEYNAR_API_KEY } }
      );
      if (bulkRes.ok) {
        const bulkData = await bulkRes.json() as Record<string, any[]>;
        const users = bulkData[userAddress.toLowerCase()];
        if (users?.length > 0) {
          const BALANCE_OF_ABI = [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] }] as const;
          const PASS_ADDR = "0xCe559A2A6b64504bE00aa7aA85C5C31EA93a16BB" as Address;
          for (const user of users) {
            const addrs = [...(user.verified_addresses?.eth_addresses || [])];
            if (user.custody_address) addrs.push(user.custody_address);
            for (const a of addrs) {
              if (a.toLowerCase() === userAddress.toLowerCase()) continue;
              try {
                const bal = await client.readContract({ address: PASS_ADDR, abi: BALANCE_OF_ABI, functionName: "balanceOf", args: [a as Address] });
                if ((bal as bigint) > 0n) { verifiedPass = true; break; }
              } catch { /* skip */ }
            }
            if (verifiedPass) break;
          }
        }
      }
    } catch { /* non-fatal */ }
  }

  // Get quote for this specific wallet (with pass detection)
  const [totalCost] = await client.readContract({
    address: addr, abi: REGISTRY_ABI, functionName: "quoteName",
    args: [name, userAddress, 0, false, verifiedPass],
  });

  if (totalCost === 0n) {
    // FREE registration — return a 0-value tx to our callback URL as a "claim" intent.
    // We use a minimal ETH transfer (0 value) to the relayer just to get the signed tx hash
    // proving the user wants this registration. The callback handles the actual registerDirect call.
    return c.json({
      chainId: "eip155:8453",
      method: "eth_sendTransaction",
      params: {
        to: relayerAddr,
        value: "0",
        data: "0x",
      },
    });
  }

  // PAID registration — return USDC transfer tx
  const usdcAddress = c.env.USDC_ADDRESS as Address;
  // ERC-20 transfer(address,uint256) selector = 0xa9059cbb
  const amountHex = totalCost.toString(16).padStart(64, "0");
  const toHex = relayerAddr.slice(2).toLowerCase().padStart(64, "0");
  const data = `0xa9059cbb${toHex}${amountHex}` as `0x${string}`;

  return c.json({
    chainId: "eip155:8453",
    method: "eth_sendTransaction",
    params: {
      to: usdcAddress,
      data,
      value: "0",
    },
  });
});

// POST /frames/register/:name/callback — After tx signed, complete registration
app.post("/frames/register/:name/callback", async (c) => {
  const name = c.req.param("name").toLowerCase();
  if (!isValidName(name)) return c.html(frameHtml({
    title: "Error", image: `https://hazza.name/frames/register/${name}/image?status=error&msg=Invalid+name`,
    buttons: [], aspectRatio: "1.91:1",
  }));

  const body = await c.req.json().catch(() => null);
  const userAddress = (body?.untrustedData?.address || body?.untrustedData?.walletAddress || "") as Address;
  const txHash = (body?.untrustedData?.transactionId || "") as `0x${string}`;

  if (!userAddress || !isAddress(userAddress)) {
    return c.html(frameHtml({
      title: "Error", image: `https://hazza.name/frames/register/${name}/image?status=error&msg=No+wallet`,
      buttons: [{ label: "Try Again", action: "link", target: `https://hazza.name/register?name=${name}` }],
      aspectRatio: "1.91:1",
    }));
  }

  const client = getClient(c.env);
  const addr = registryAddress(c.env);
  const relayerAddr = c.env.RELAYER_ADDRESS as Address;

  // Re-check availability
  const available = await client.readContract({
    address: addr, abi: REGISTRY_ABI, functionName: "available", args: [name],
  });
  if (!available) {
    return c.html(frameHtml({
      title: `${name} — Already Taken`,
      image: `https://hazza.name/frames/register/${name}/image?status=error&msg=Already+taken`,
      buttons: [{ label: "Browse Names", action: "link", target: "https://hazza.name/register" }],
      aspectRatio: "1.91:1",
    }));
  }

  // Get quote
  const [totalCost] = await client.readContract({
    address: addr, abi: REGISTRY_ABI, functionName: "quoteName",
    args: [name, userAddress, 0, false, false],
  });

  // For PAID registrations, verify the USDC transfer
  if (totalCost > 0n) {
    if (!txHash || !txHash.startsWith("0x") || txHash.length !== 66) {
      return c.html(frameHtml({
        title: "Payment Error",
        image: `https://hazza.name/frames/register/${name}/image?status=error&msg=No+payment+tx`,
        buttons: [{ label: "Try Again", action: "link", target: `https://hazza.name/register?name=${name}` }],
        aspectRatio: "1.91:1",
      }));
    }

    // Replay protection
    if (await isPaymentUsed(c.env, txHash)) {
      return c.html(frameHtml({
        title: "Payment Already Used",
        image: `https://hazza.name/frames/register/${name}/image?status=error&msg=Payment+already+used`,
        buttons: [{ label: "Try Again", action: "link", target: `https://hazza.name/register?name=${name}` }],
        aspectRatio: "1.91:1",
      }));
    }

    await markPaymentUsed(c.env, txHash);

    // Verify tx on-chain
    let receipt;
    try {
      receipt = await client.getTransactionReceipt({ hash: txHash });
    } catch {
      await unmarkPayment(c.env, txHash);
      return c.html(frameHtml({
        title: "Payment Not Found",
        image: `https://hazza.name/frames/register/${name}/image?status=error&msg=Tx+not+confirmed`,
        buttons: [{ label: "Try Again", action: "link", target: `https://hazza.name/register?name=${name}` }],
        aspectRatio: "1.91:1",
      }));
    }

    if (receipt.status !== "success") {
      await unmarkPayment(c.env, txHash);
      return c.html(frameHtml({
        title: "Payment Failed",
        image: `https://hazza.name/frames/register/${name}/image?status=error&msg=Tx+failed`,
        buttons: [{ label: "Try Again", action: "link", target: `https://hazza.name/register?name=${name}` }],
        aspectRatio: "1.91:1",
      }));
    }

    // Verify USDC transfer
    const usdcAddr = c.env.USDC_ADDRESS.toLowerCase();
    const transferTopic = keccak256(toBytes("Transfer(address,address,uint256)"));
    let verified = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdcAddr) continue;
      if (log.topics[0] !== transferTopic) continue;
      const toAddr = ("0x" + (log.topics[2] || "").slice(26)).toLowerCase();
      const fromAddr = ("0x" + (log.topics[1] || "").slice(26)).toLowerCase();
      if (toAddr !== relayerAddr.toLowerCase()) continue;
      if (fromAddr !== userAddress.toLowerCase()) continue;
      const transferAmount = BigInt(log.data);
      if (transferAmount >= totalCost) { verified = true; break; }
    }

    if (!verified) {
      await unmarkPayment(c.env, txHash);
      return c.html(frameHtml({
        title: "Payment Verification Failed",
        image: `https://hazza.name/frames/register/${name}/image?status=error&msg=Payment+not+verified`,
        buttons: [{ label: "Try Again", action: "link", target: `https://hazza.name/register?name=${name}` }],
        aspectRatio: "1.91:1",
      }));
    }
  }

  // --- Execute registration via relayer ---
  try {
    const chainId = Number(c.env.CHAIN_ID);
    const chain = chainId === 8453 ? base : baseSepolia;
    const account = privateKeyToAccount(c.env.RELAYER_PRIVATE_KEY as `0x${string}`);

    const txData = encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: "registerDirect",
      args: [name, userAddress, 0, false, "0x0000000000000000000000000000000000000000" as Address, "", false, false],
    });

    let regTxHash: `0x${string}` = "0x" as `0x${string}`;
    const rpcs = [c.env.BASE_MAINNET_RPC, c.env.PAYMASTER_BUNDLER_RPC, c.env.RPC_URL].filter(Boolean);
    for (const rpc of rpcs) {
      try {
        const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
        regTxHash = await walletClient.sendTransaction({ to: addr, data: txData });
        break;
      } catch (err: any) {
        console.warn(`Frame reg RPC failed (${rpc?.slice(0, 30)}...):`, err?.message);
        if (rpc === rpcs[rpcs.length - 1]) throw err;
      }
    }

    const regReceipt = await client.waitForTransactionReceipt({ hash: regTxHash, timeout: 20_000 });
    if (regReceipt.status !== "success") {
      return c.html(frameHtml({
        title: "Registration Failed",
        image: `https://hazza.name/frames/register/${name}/image?status=error&msg=Tx+reverted`,
        buttons: [{ label: "Try Again", action: "link", target: `https://hazza.name/register?name=${name}` }],
        aspectRatio: "1.91:1",
      }));
    }

    // Forward USDC payment from relayer to treasury
    const treasuryAddr = c.env.HAZZA_TREASURY as Address;
    if (treasuryAddr && totalCost > 0n) {
      (async () => {
        try {
          const transferData = encodeFunctionData({
            abi: [{ name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }] as const,
            functionName: "transfer",
            args: [treasuryAddr, totalCost],
          });
          const fwdClient = createWalletClient({ account, chain, transport: http(rpcs[0]) });
          const fwdTx = await fwdClient.sendTransaction({ to: c.env.USDC_ADDRESS as Address, data: transferData });
          console.log(`Treasury forward: ${totalCost.toString()} USDC (${fwdTx}) for ${name}`);
        } catch (err: any) {
          await logTreasuryForwardFailure(c.env, totalCost.toString(), name, "frame-register", err?.shortMessage || err?.message);
        }
      })();
    }

    const clientIp = c.req.header("cf-connecting-ip") || "frame";
    await incrementGlobalDailyCap(c.env);
    await logRegistration(c.env, { name, owner: userAddress, ip: clientIp, type: totalCost === 0n ? "frame_free" : "frame_paid", txHash: regTxHash, timestamp: Date.now() });

    return c.html(frameHtml({
      title: `${name}.hazza.name — Registered!`,
      image: `https://hazza.name/frames/register/${name}/image?status=success`,
      buttons: [{ label: "View Profile", action: "link", target: `https://${name}.hazza.name` }],
      aspectRatio: "1.91:1",
    }));

  } catch (e: any) {
    console.error("Frame registration failed:", e?.shortMessage || e?.message || e);
    return c.html(frameHtml({
      title: "Registration Error",
      image: `https://hazza.name/frames/register/${name}/image?status=error&msg=Server+error`,
      buttons: [{ label: "Try Again", action: "link", target: `https://hazza.name/register?name=${name}` }],
      aspectRatio: "1.91:1",
    }));
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
    const rpcUrl = c.env.BASE_MAINNET_RPC || c.env.PAYMASTER_BUNDLER_RPC || c.env.RPC_URL;
    const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

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

// POST /api/marketplace/submit-listing — relay a signed Seaport order to Bazaar
// Eliminates the second wallet interaction: user signs EIP-712, we submit to Bazaar via relayer
app.post("/api/marketplace/submit-listing", async (c) => {
  try {
    const body = await c.req.json();
    const { order } = body; // { parameters, counter, signature }
    if (!order?.parameters || !order?.signature) {
      return c.json({ error: "Missing order parameters or signature" }, 400);
    }

    const chainId = Number(c.env.CHAIN_ID);
    const chain = chainId === 8453 ? base : baseSepolia;
    const account = privateKeyToAccount(c.env.RELAYER_PRIVATE_KEY as `0x${string}`);
    const bazaarAddr = c.env.BAZAAR_ADDRESS as Address;

    // Encode the Bazaar submit call
    const BAZAAR_SUBMIT_ABI_WORKER = [{
      name: 'submit', type: 'function', stateMutability: 'nonpayable',
      inputs: [{ name: 'submission', type: 'tuple', components: [
        { name: 'parameters', type: 'tuple', components: [
          { name: 'offerer', type: 'address' }, { name: 'zone', type: 'address' },
          { name: 'offer', type: 'tuple[]', components: [{ name: 'itemType', type: 'uint8' }, { name: 'token', type: 'address' }, { name: 'identifierOrCriteria', type: 'uint256' }, { name: 'startAmount', type: 'uint256' }, { name: 'endAmount', type: 'uint256' }] },
          { name: 'consideration', type: 'tuple[]', components: [{ name: 'itemType', type: 'uint8' }, { name: 'token', type: 'address' }, { name: 'identifierOrCriteria', type: 'uint256' }, { name: 'startAmount', type: 'uint256' }, { name: 'endAmount', type: 'uint256' }, { name: 'recipient', type: 'address' }] },
          { name: 'orderType', type: 'uint8' }, { name: 'startTime', type: 'uint256' }, { name: 'endTime', type: 'uint256' },
          { name: 'zoneHash', type: 'bytes32' }, { name: 'salt', type: 'uint256' }, { name: 'conduitKey', type: 'bytes32' }, { name: 'totalOriginalConsiderationItems', type: 'uint256' }
        ]},
        { name: 'counter', type: 'uint256' },
        { name: 'signature', type: 'bytes' }
      ]}], outputs: []
    }] as const;

    const p = order.parameters;
    const txData = encodeFunctionData({
      abi: BAZAAR_SUBMIT_ABI_WORKER,
      functionName: "submit",
      args: [{
        parameters: {
          offerer: p.offerer as Address,
          zone: p.zone as Address,
          offer: p.offer.map((o: any) => ({
            itemType: o.itemType,
            token: o.token as Address,
            identifierOrCriteria: BigInt(o.identifierOrCriteria),
            startAmount: BigInt(o.startAmount),
            endAmount: BigInt(o.endAmount),
          })),
          consideration: p.consideration.map((c2: any) => ({
            itemType: c2.itemType,
            token: c2.token as Address,
            identifierOrCriteria: BigInt(c2.identifierOrCriteria),
            startAmount: BigInt(c2.startAmount),
            endAmount: BigInt(c2.endAmount),
            recipient: c2.recipient as Address,
          })),
          orderType: p.orderType,
          startTime: BigInt(p.startTime),
          endTime: BigInt(p.endTime),
          zoneHash: p.zoneHash as `0x${string}`,
          salt: BigInt(p.salt),
          conduitKey: p.conduitKey as `0x${string}`,
          totalOriginalConsiderationItems: BigInt(p.totalOriginalConsiderationItems),
        },
        counter: BigInt(order.counter),
        signature: order.signature as `0x${string}`,
      }],
    });

    // Use paid RPC (Alchemy) first, then Coinbase, then public fallback
    const rpcs = [c.env.BASE_MAINNET_RPC, c.env.PAYMASTER_BUNDLER_RPC, c.env.RPC_URL].filter(Boolean);
    let txHash: `0x${string}` | undefined;

    for (const rpc of rpcs) {
      try {
        const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
        txHash = await walletClient.sendTransaction({ to: bazaarAddr, data: txData });
        break;
      } catch (err: any) {
        console.warn(`RPC failed (${rpc?.slice(0, 30)}...):`, err?.message);
        if (rpc === rpcs[rpcs.length - 1]) throw err;
      }
    }
    if (!txHash) throw new Error("All RPCs failed");

    return c.json({ success: true, txHash });
  } catch (e: any) {
    console.error("Submit listing relay failed:", e?.message || e);
    return c.json({ error: e?.message || "Failed to submit listing" }, 500);
  }
});

// GET /api/marketplace/listings — active HAZZA name listings
app.get("/api/marketplace/listings", async (c) => {
  try {
    const bazaar = getBazaarClient(c.env);
    const nftAddress = registryAddress(c.env);
    const rawListings = await bazaar.getListings({ nftAddress });
    if (!rawListings || rawListings.length === 0) {
      return c.json({ listings: [], total: 0 });
    }

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
    console.error("Marketplace listings failed:", e?.message || e, e?.stack);
    return c.json({ listings: [], total: 0, error: `Failed to fetch listings: ${e?.message || e}` });
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

// POST /api/marketplace/list-helper — build Seaport order for agent listing
// Returns EIP-712 typed data to sign + Bazaar submit calldata to execute
app.post("/api/marketplace/list-helper", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.name || !body?.price || !body?.seller) {
    return c.json({ error: "Missing required fields: name, price (ETH string), seller (address)" }, 400);
  }

  const name = String(body.name).toLowerCase();
  const seller = body.seller as Address;
  const duration = body.duration ? parseInt(body.duration) : 0;
  const bountyEth = body.bountyAmount ? String(body.bountyAmount) : null;

  if (!isValidName(name)) return c.json({ error: nameValidationError(name) }, 400);
  if (!isAddress(seller)) return c.json({ error: "Invalid seller address" }, 400);

  const client = getClient(c.env);
  const addr = registryAddress(c.env);
  const seaportAddr = c.env.SEAPORT_ADDRESS as Address;
  const bazaarAddr = c.env.BAZAAR_ADDRESS as Address;
  const treasuryAddr = c.env.HAZZA_TREASURY as Address;
  const feeBps = parseInt(c.env.MARKETPLACE_FEE_BPS || "0");

  try {
    // Resolve name → tokenId + verify ownership
    const [nameOwner, tokenId] = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "resolve", args: [name],
    });
    if (!nameOwner || (nameOwner as string).toLowerCase() === "0x0000000000000000000000000000000000000000") {
      return c.json({ error: "Name not registered" }, 404);
    }
    if ((nameOwner as string).toLowerCase() !== seller.toLowerCase()) {
      return c.json({ error: "Seller does not own this name" }, 403);
    }

    // Check if Seaport is approved
    const ERC721_APPROVAL_ABI = [{ name: "isApprovedForAll", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "operator", type: "address" }], outputs: [{ type: "bool" }] }] as const;
    const isApproved = await client.readContract({
      address: addr, abi: ERC721_APPROVAL_ABI, functionName: "isApprovedForAll", args: [seller, seaportAddr],
    });

    // Get Seaport counter
    const SEAPORT_COUNTER_ABI = [{ name: "getCounter", type: "function", stateMutability: "view", inputs: [{ name: "offerer", type: "address" }], outputs: [{ type: "uint256" }] }] as const;
    const counter = await client.readContract({
      address: seaportAddr, abi: SEAPORT_COUNTER_ABI, functionName: "getCounter", args: [seller],
    });

    // Parse price
    const priceParts = String(body.price).split(".");
    const whole = BigInt(priceParts[0] || "0") * 1000000000000000000n;
    const frac = priceParts[1] ? BigInt((priceParts[1] + "000000000000000000").slice(0, 18)) : 0n;
    const priceWei = whole + frac;
    if (priceWei <= 0n) return c.json({ error: "Price must be greater than 0" }, 400);

    const feeAmount = feeBps > 0 ? (priceWei * BigInt(feeBps)) / 10000n : 0n;

    let bountyWei = 0n;
    if (bountyEth) {
      const bParts = bountyEth.split(".");
      const bWhole = BigInt(bParts[0] || "0") * 1000000000000000000n;
      const bFrac = bParts[1] ? BigInt((bParts[1] + "000000000000000000").slice(0, 18)) : 0n;
      bountyWei = bWhole + bFrac;
    }

    if (bountyWei + feeAmount >= priceWei) {
      return c.json({ error: "Bounty + fee cannot exceed listing price" }, 400);
    }
    const sellerAmount = priceWei - feeAmount - bountyWei;

    const endTime = duration === 0
      ? BigInt(Math.floor(Date.now() / 1000) + 315360000) // 10 years
      : BigInt(Math.floor(Date.now() / 1000) + duration);

    // Generate salt
    const saltArray = new Uint8Array(32);
    crypto.getRandomValues(saltArray);
    const salt = BigInt("0x" + Array.from(saltArray).map(b => b.toString(16).padStart(2, "0")).join(""));

    const zeroAddr = "0x0000000000000000000000000000000000000000" as Address;
    const zeroBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
    const zonePublic = "0x000000007F8c58fbf215bF91Bda7421A806cf3ae" as Address;

    // Build offer (the NFT)
    const offer = [{
      itemType: 2, token: addr,
      identifierOrCriteria: (tokenId as bigint).toString(),
      startAmount: "1", endAmount: "1",
    }];

    // Build consideration (ETH splits)
    const consideration: any[] = [{
      itemType: 0, token: zeroAddr,
      identifierOrCriteria: "0",
      startAmount: sellerAmount.toString(), endAmount: sellerAmount.toString(),
      recipient: seller,
    }];
    if (feeAmount > 0n) {
      consideration.push({
        itemType: 0, token: zeroAddr,
        identifierOrCriteria: "0",
        startAmount: feeAmount.toString(), endAmount: feeAmount.toString(),
        recipient: treasuryAddr,
      });
    }
    if (bountyWei > 0n) {
      consideration.push({
        itemType: 0, token: zeroAddr,
        identifierOrCriteria: "0",
        startAmount: bountyWei.toString(), endAmount: bountyWei.toString(),
        recipient: BOUNTY_ESCROW_ADDRESS,
      });
    }

    // EIP-712 typed data for signing
    const typedData = {
      types: {
        OrderComponents: [
          { name: "offerer", type: "address" },
          { name: "zone", type: "address" },
          { name: "offer", type: "OfferItem[]" },
          { name: "consideration", type: "ConsiderationItem[]" },
          { name: "orderType", type: "uint8" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "zoneHash", type: "bytes32" },
          { name: "salt", type: "uint256" },
          { name: "conduitKey", type: "bytes32" },
          { name: "counter", type: "uint256" },
        ],
        OfferItem: [
          { name: "itemType", type: "uint8" },
          { name: "token", type: "address" },
          { name: "identifierOrCriteria", type: "uint256" },
          { name: "startAmount", type: "uint256" },
          { name: "endAmount", type: "uint256" },
        ],
        ConsiderationItem: [
          { name: "itemType", type: "uint8" },
          { name: "token", type: "address" },
          { name: "identifierOrCriteria", type: "uint256" },
          { name: "startAmount", type: "uint256" },
          { name: "endAmount", type: "uint256" },
          { name: "recipient", type: "address" },
        ],
      },
      primaryType: "OrderComponents" as const,
      domain: {
        name: "Seaport",
        version: "1.6",
        chainId: Number(c.env.CHAIN_ID),
        verifyingContract: seaportAddr,
      },
      message: {
        offerer: seller,
        zone: zonePublic,
        offer,
        consideration,
        orderType: 2,
        startTime: "0",
        endTime: endTime.toString(),
        zoneHash: zeroBytes32,
        salt: salt.toString(),
        conduitKey: zeroBytes32,
        counter: (counter as bigint).toString(),
      },
    };

    // Bazaar submit calldata — agent signs the EIP-712, then calls Bazaar.submit() with order + signature
    // We return the order parameters so the agent can construct the submit call after signing
    const orderParameters = {
      offerer: seller,
      zone: zonePublic,
      offer: offer.map(o => ({ ...o, itemType: Number(o.itemType) })),
      consideration: consideration.map((c2: any) => ({ ...c2, itemType: Number(c2.itemType) })),
      orderType: 2,
      startTime: "0",
      endTime: endTime.toString(),
      zoneHash: zeroBytes32,
      salt: salt.toString(),
      conduitKey: zeroBytes32,
      totalOriginalConsiderationItems: consideration.length,
    };

    return c.json({
      name,
      tokenId: (tokenId as bigint).toString(),
      seller,
      price: body.price,
      priceWei: priceWei.toString(),
      currency: "ETH",
      duration,
      endTime: endTime.toString(),
      bountyAmount: bountyEth || null,
      bountyWei: bountyWei > 0n ? bountyWei.toString() : null,
      seaportApproved: !!isApproved,
      // If not approved, agent must call setApprovalForAll(seaport, true) on the registry first
      approvalNeeded: !isApproved ? {
        to: addr,
        functionName: "setApprovalForAll",
        args: [seaportAddr, true],
      } : null,
      // EIP-712 typed data — agent signs this with their wallet
      typedData,
      // After signing, agent calls Bazaar.submit() with these parameters + signature
      bazaarSubmit: {
        to: bazaarAddr,
        functionName: "submit",
        orderParameters,
        counter: (counter as bigint).toString(),
        // Agent fills in signature after signing typedData
      },
      // Bounty registration — if bounty was set, agent calls registerBounty after listing
      bountyRegistration: bountyWei > 0n ? {
        to: BOUNTY_ESCROW_ADDRESS,
        functionName: "registerBounty",
        args: [(tokenId as bigint).toString(), bountyWei.toString()],
      } : null,
    });
  } catch (e: any) {
    console.error("List helper failed:", e?.shortMessage || e?.message || e);
    return c.json({ error: "Failed to build listing data" }, 500);
  }
});

// POST /api/marketplace/cancel — prepare cancel transaction for a listing
// Used by Bankr (SIWA delegate) and CLI. Returns unsigned Seaport cancel tx.
app.post("/api/marketplace/cancel", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.orderHash) {
    return c.json({ error: "Missing orderHash" }, 400);
  }
  try {
    const bazaar = getBazaarClient(c.env);
    const nftAddress = registryAddress(c.env);
    const rawListings = await bazaar.getListings({ nftAddress });
    const listing = rawListings.find((l: any) => l.orderHash === body.orderHash);
    if (!listing) return c.json({ error: "Listing not found or no longer active" }, 404);

    const cancelTx: any = bazaar.prepareCancelListing(listing);
    const l: any = listing;
    return c.json({
      cancel: {
        to: cancelTx.to || cancelTx.address,
        data: cancelTx.data,
        value: "0",
      },
      listing: {
        orderHash: body.orderHash,
        name: l.name || null,
        tokenId: l.tokenId?.toString() || null,
        offerer: l.offerer || l.seller || null,
      },
    });
  } catch (e: any) {
    console.error("Cancel listing failed:", e?.message || e);
    return c.json({ error: "Failed to prepare cancel transaction" }, 500);
  }
});

// POST /api/marketplace/edit — cancel existing listing + prepare new one
// Edit = cancel old order + create replacement. Returns both transactions.
app.post("/api/marketplace/edit", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.orderHash || !body?.sellerAddress) {
    return c.json({ error: "Missing orderHash and sellerAddress" }, 400);
  }
  // At least one change required
  if (!body.newPriceWei && !body.newDuration && body.newBounty === undefined) {
    return c.json({ error: "No changes specified. Provide newPriceWei, newDuration, or newBounty." }, 400);
  }
  try {
    const bazaar = getBazaarClient(c.env);
    const nftAddress = registryAddress(c.env);
    const rawListings = await bazaar.getListings({ nftAddress });
    const listing = rawListings.find((l: any) => l.orderHash === body.orderHash);
    if (!listing) return c.json({ error: "Listing not found or no longer active" }, 404);

    // Verify the caller is the seller
    const l: any = listing;
    const offerer = (l.offerer || l.seller || "").toLowerCase();
    if (offerer !== body.sellerAddress.toLowerCase()) {
      return c.json({ error: "Only the listing seller can edit" }, 403);
    }

    // Step 1: Prepare cancel for old listing
    const cancelTx: any = bazaar.prepareCancelListing(listing);

    // Step 2: Prepare new listing with updated parameters
    const tokenId: string = l.tokenId?.toString() || l.orderComponents?.offer?.[0]?.identifierOrCriteria?.toString() || "0";
    const currentPriceWei = l.priceWei || 0n;
    const newPriceWei = body.newPriceWei ? BigInt(body.newPriceWei) : currentPriceWei;

    const prepared = await bazaar.prepareCreateListing({
      nftAddress,
      tokenId,
      priceWei: newPriceWei,
      offerer: body.sellerAddress as `0x${string}`,
      ...(body.newDuration ? { durationSeconds: Number(body.newDuration) } : {}),
    });

    return c.json({
      cancel: {
        to: cancelTx.to || cancelTx.address,
        data: cancelTx.data,
        value: "0",
      },
      newListing: {
        eip712: prepared.eip712,
        approvals: prepared.approvals.map((a: any) => ({
          to: a.to,
          data: a.data,
          value: a.value?.toString() || "0",
        })),
      },
      meta: {
        orderHash: body.orderHash,
        name: l.name || null,
        tokenId,
        oldPriceWei: currentPriceWei.toString(),
        newPriceWei: newPriceWei.toString(),
      },
    });
  } catch (e: any) {
    console.error("Edit listing failed:", e?.message || e);
    return c.json({ error: "Failed to prepare edit transaction" }, 500);
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

// GET /api/admin/treasury-failures — list pending treasury forward retries
app.get("/api/admin/treasury-failures", async (c) => {
  try {
    const list = await c.env.WATCHLIST_KV.list({ prefix: "treasury-retry:" });
    const failures = await Promise.all(
      list.keys.map(async (k: any) => {
        const val = await c.env.WATCHLIST_KV.get(k.name);
        try { return { key: k.name, ...JSON.parse(val || "{}") }; } catch { return { raw: val, key: k.name }; }
      })
    );
    return c.json({ pending: failures, count: failures.length });
  } catch (e: any) {
    return c.json({ error: e?.message || "Failed to list failures" }, 500);
  }
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

// =========================================================================
//                    SCHEDULED: Treasury Forward Retry Queue
// =========================================================================
// Runs every 15 minutes via cron trigger. Reads failed treasury forwards
// from KV, retries them, and removes successes. Gives up after 10 attempts.

async function handleScheduled(env: Env) {
  const list = await env.WATCHLIST_KV.list({ prefix: "treasury-retry:" });
  if (list.keys.length === 0) return;

  const chainId = Number(env.CHAIN_ID);
  const chain = chainId === 8453 ? base : baseSepolia;
  const account = privateKeyToAccount(env.RELAYER_PRIVATE_KEY as `0x${string}`);
  const treasuryAddr = env.HAZZA_TREASURY as Address;
  if (!treasuryAddr) return;

  const rpcs = [env.BASE_MAINNET_RPC, env.PAYMASTER_BUNDLER_RPC, env.RPC_URL].filter(Boolean);

  for (const k of list.keys) {
    const raw = await env.WATCHLIST_KV.get(k.name);
    if (!raw) continue;

    let entry: any;
    try { entry = JSON.parse(raw); } catch { continue; }

    const attempts = (entry.attempts || 0) + 1;
    if (attempts > 10) {
      // Give up — move to dead letter and alert
      await env.WATCHLIST_KV.put(
        k.name.replace("treasury-retry:", "treasury-dead:"),
        JSON.stringify({ ...entry, attempts, gaveUpAt: new Date().toISOString() }),
        { expirationTtl: 90 * 86400 },
      );
      await env.WATCHLIST_KV.delete(k.name);
      console.error(`Treasury retry gave up after 10 attempts: ${entry.name} ${entry.amount}`);
      await sendNotification(env, `🚨 <b>Treasury forward FAILED permanently</b>\n\n${entry.amount} USDC stuck in relayer\nName: ${entry.name}\nSource: ${entry.source}\nLast error: ${entry.lastError || entry.error}\n\n10 retry attempts exhausted. Manual intervention required.`);
      continue;
    }

    try {
      const amount = BigInt(entry.amount);
      const transferData = encodeFunctionData({
        abi: [{ name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }] as const,
        functionName: "transfer",
        args: [treasuryAddr, amount],
      });

      let txHash: string | undefined;
      for (const rpc of rpcs) {
        try {
          const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
          txHash = await walletClient.sendTransaction({ to: env.USDC_ADDRESS as Address, data: transferData });
          break;
        } catch { if (rpc === rpcs[rpcs.length - 1]) throw new Error("All RPCs failed"); }
      }

      // Success — remove from retry queue
      await env.WATCHLIST_KV.delete(k.name);
      console.log(`Treasury retry SUCCESS: ${entry.amount} USDC for ${entry.name} → ${txHash}`);
    } catch (e: any) {
      // Update attempt count
      await env.WATCHLIST_KV.put(k.name, JSON.stringify({ ...entry, attempts, lastRetry: new Date().toISOString(), lastError: e?.message || String(e) }), { expirationTtl: 30 * 86400 });
      console.warn(`Treasury retry attempt ${attempts} failed for ${entry.name}: ${e?.message}`);
    }
  }
}

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(env));
  },
};
