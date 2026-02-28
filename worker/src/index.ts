import { Hono } from "hono";
import { cors } from "hono/cors";
import { type Env, getClient, getMainnetClient, getEthMainnetClient, buildTx, registryAddress, REGISTRY_ABI, EXOSKELETON_ABI, EXOSKELETON_ADDRESS } from "./contract";
import { landingPage, profilePage, aboutPage, pricingPage, pricingProtectionsPage, pricingDetailsPage, docsPage, domainsPage, domainsManagePage, registerPage, managePage } from "./pages";
import { type Address, formatUnits, keccak256, toBytes, isAddress, createWalletClient, http, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";

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

  const client = getClient(c.env);
  const [totalCost, registrationFee, renewalFee] = await client.readContract({
    address: registryAddress(c.env),
    abi: REGISTRY_ABI,
    functionName: "quoteName",
    args: [name, wallet, numYears, charCount, ensImport, verifiedPass],
  });

  // Build line items for UI display
  const lineItems: { label: string; amount: string }[] = [];
  lineItems.push({ label: "Registration", amount: formatUnits(registrationFee, 6) });
  lineItems.push({ label: `Renewal (${numYears} yr${numYears > 1n ? "s" : ""})`, amount: formatUnits(renewalFee, 6) });
  if (ensImport) lineItems.push({ label: "ENS Import Discount", amount: "-50%" });
  if (verifiedPass) lineItems.push({ label: "Unlimited Pass Discount", amount: "-20%" });

  return c.json({
    name,
    wallet,
    years: Number(numYears),
    total: formatUnits(totalCost, 6),
    totalRaw: totalCost.toString(),
    registrationFee: formatUnits(registrationFee, 6),
    renewalFee: formatUnits(renewalFee, 6),
    lineItems,
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
  const client = getClient(c.env);
  const addr = registryAddress(c.env);
  const balance = await client.readContract({
    address: addr, abi: REGISTRY_ABI, functionName: "balanceOf", args: [wallet],
  });
  const count = Number(balance);
  if (count === 0) return c.json({ wallet, names: [] });

  // Fetch up to 50 names
  const limit = Math.min(count, 50);
  const names: { name: string; tokenId: string; url: string }[] = [];
  for (let i = 0; i < limit; i++) {
    const tokenId = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "tokenOfOwnerByIndex", args: [wallet, BigInt(i)],
    });
    const name = await client.readContract({
      address: addr, abi: REGISTRY_ABI, functionName: "nameOf", args: [tokenId],
    });
    if (name) names.push({ name: name as string, tokenId: tokenId.toString(), url: `https://${name}.hazza.name` });
  }
  return c.json({ wallet, names, total: count });
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
//                     DOMAIN PROXY PASSTHROUGH
// =========================================================================

// Helper: proxy a request to the domain proxy on the droplet
async function domainProxy(c: any, path: string, method: string = "GET", body?: any): Promise<Response> {
  const url = c.env.DOMAIN_PROXY_URL + path;
  const headers: Record<string, string> = {
    "X-Proxy-Secret": c.env.DOMAIN_PROXY_SECRET,
  };
  const opts: RequestInit = { method, headers };
  if (body) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, opts);
    const data = await res.json();
    return c.json(data, res.status);
  } catch (e: any) {
    return c.json({ error: "Domain proxy unavailable" }, 502);
  }
}

// Validate SLD/TLD format
const SLD_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;
const TLD_RE = /^[a-z]{2,}$/i;

// List DNS records for a domain (for linking your own domain)
app.get("/api/domains/dns/:sld/:tld", async (c) => {
  const sld = c.req.param("sld");
  const tld = c.req.param("tld");
  if (!SLD_RE.test(sld) || !TLD_RE.test(tld)) return c.json({ error: "Invalid domain format" }, 400);
  return domainProxy(c, `/domains/dns/${sld}/${tld}`);
});

// Set DNS records for a domain (for linking your own domain)
app.post("/api/domains/dns/:sld/:tld", async (c) => {
  const sld = c.req.param("sld");
  const tld = c.req.param("tld");
  if (!SLD_RE.test(sld) || !TLD_RE.test(tld)) return c.json({ error: "Invalid domain format" }, 400);
  const body = await c.req.json();
  return domainProxy(c, `/domains/dns/${sld}/${tld}`, "POST", body);
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

  // Get quote
  const [totalCost] = await client.readContract({
    address: addr, abi: REGISTRY_ABI, functionName: "quoteName",
    args: [name, owner, BigInt(years), 0, false, false],
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
        0,      // charCount (ASCII, use byte length)
        false,  // wantAgent
        "0x0000000000000000000000000000000000000000" as Address, // agentWallet
        "",     // agentURI
        false,  // ensImport
        false,  // verifiedPass
      ],
    });

    // Use standard RPC for EOA transactions (paymaster is for ERC-4337 only)
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(c.env.RPC_URL),
    });

    regTxHash = await walletClient.sendTransaction({
      to: addr,
      data: txData,
    });

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
    if (path === "/domains/manage") {
      return c.html(domainsManagePage());
    }
    if (path === "/register") {
      return c.html(registerPage(c.env.REGISTRY_ADDRESS, c.env.USDC_ADDRESS, c.env.CHAIN_ID));
    }
    if (path === "/manage") {
      return c.html(managePage(c.env.REGISTRY_ADDRESS, c.env.USDC_ADDRESS, c.env.CHAIN_ID));
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
