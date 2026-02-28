import { Hono } from "hono";
import { cors } from "hono/cors";
import { type Env, getClient, registryAddress, REGISTRY_ABI } from "./contract";
import { landingPage } from "./pages";
import { profilePage } from "./pages";
import { type Address, formatUnits } from "viem";

type Bindings = Env;
const app = new Hono<{ Bindings: Bindings }>();

// CORS for API routes
app.use("/api/*", cors());

// =========================================================================
//                          API ROUTES
// =========================================================================

// Check if a name is available
app.get("/api/available/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();
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
    // Serve API docs, etc. at apex paths in the future
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

    return c.html(
      profilePage(name, {
        owner: nameOwner,
        tokenId: tokenId.toString(),
        registeredAt: Number(registeredAt),
        expiresAt: Number(expiresAt),
        operator,
        agentId: agentId.toString(),
        agentWallet,
        status,
        texts,
        contenthash: chash && chash !== "0x" ? (chash as string) : null,
      })
    );
  } catch {
    return c.html(profilePage(name, null));
  }
});

export default app;
