import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";

const app = new Hono();

// --- Config ---
const NC_USER = process.env.NC_USER || "geauxdoteth";
const NC_KEY = process.env.NC_KEY || "";
const NC_IP = process.env.NC_IP || "143.198.226.238";
const PROXY_SECRET = process.env.PROXY_SECRET || "";
const NC_SANDBOX = process.env.NC_SANDBOX === "true";
const NC_BASE = NC_SANDBOX
  ? "https://api.sandbox.namecheap.com/xml.response"
  : "https://api.namecheap.com/xml.response";
const PORT = Number(process.env.PORT) || 3456;

// --- Auth middleware ---
function auth(c, next) {
  const secret = c.req.header("X-Proxy-Secret");
  if (!PROXY_SECRET) {
    return c.json({ error: "PROXY_SECRET not configured" }, 500);
  }
  if (secret !== PROXY_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
}

app.use("/*", cors());
app.use("/domains/*", auth);

// --- Helpers ---
function ncParams(command, extra = {}) {
  const params = new URLSearchParams({
    ApiUser: NC_USER,
    ApiKey: NC_KEY,
    UserName: NC_USER,
    ClientIp: NC_IP,
    Command: command,
    ...extra,
  });
  return `${NC_BASE}?${params.toString()}`;
}

// Simple XML value extractor (avoids xml2js dependency)
function xmlVal(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function xmlAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*?\\s${attr}="([^"]*)"`, "i");
  const m = xml.match(re);
  return m ? m[1] : null;
}

function xmlAll(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*?\\/>|<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi");
  return xml.match(re) || [];
}

function parseAttrs(element) {
  const attrs = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(element)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

async function ncFetch(url) {
  const res = await fetch(url);
  const xml = await res.text();
  const status = xmlAttr(xml, "ApiResponse", "Status");
  if (status !== "OK") {
    const errMsg =
      xmlVal(xml, "Message") || xmlVal(xml, "Error") || "Unknown Namecheap error";
    const errNum = xmlVal(xml, "Number") || xmlAttr(xml, "Error", "Number") || "?";
    return { ok: false, error: errMsg, code: errNum, xml };
  }
  return { ok: true, xml };
}

// --- Health ---
app.get("/", (c) => c.json({ service: "hazza-domains", status: "ok", sandbox: NC_SANDBOX }));

// --- Domain availability check ---
app.get("/domains/check", async (c) => {
  const domain = c.req.query("domain");
  if (!domain) return c.json({ error: "Missing ?domain= parameter" }, 400);

  // Namecheap supports checking multiple domains at once
  const domains = domain.includes(",") ? domain : domain;
  const url = ncParams("namecheap.domains.check", { DomainList: domains });
  const result = await ncFetch(url);
  if (!result.ok) return c.json({ error: result.error, code: result.code }, 502);

  const entries = xmlAll(result.xml, "DomainCheckResult");
  const results = entries.map((el) => {
    const attrs = parseAttrs(el);
    return {
      domain: attrs.Domain,
      available: attrs.Available === "true",
      premium: attrs.IsPremiumName === "true",
      price: attrs.PremiumRegistrationPrice || null,
    };
  });

  return c.json({ results });
});

// --- Domain pricing ---
app.get("/domains/pricing", async (c) => {
  const tld = c.req.query("tld") || "com";
  const url = ncParams("namecheap.users.getPricing", {
    ProductType: "DOMAIN",
    ProductCategory: "REGISTER",
    ProductName: tld,
  });
  const result = await ncFetch(url);
  if (!result.ok) return c.json({ error: result.error, code: result.code }, 502);

  // Extract price from the XML
  const priceEntries = xmlAll(result.xml, "Price");
  const prices = priceEntries.map((el) => parseAttrs(el));

  return c.json({ tld, prices });
});

// --- Domain registration ---
app.post("/domains/register", async (c) => {
  const body = await c.req.json();
  const { domain, years = 1, nameservers, contact } = body;

  if (!domain) return c.json({ error: "Missing domain" }, 400);

  const [sld, tld] = splitDomain(domain);
  if (!sld || !tld) return c.json({ error: "Invalid domain format" }, 400);

  // Default contact info (required by Namecheap)
  const ct = contact || {};
  const contactParams = {};
  for (const prefix of [
    "Registrant",
    "Tech",
    "Admin",
    "AuxBilling",
  ]) {
    contactParams[`${prefix}FirstName`] = ct.firstName || "HAZZA";
    contactParams[`${prefix}LastName`] = ct.lastName || "Names";
    contactParams[`${prefix}Address1`] = ct.address1 || "1 Main St";
    contactParams[`${prefix}City`] = ct.city || "San Francisco";
    contactParams[`${prefix}StateProvince`] = ct.state || "CA";
    contactParams[`${prefix}PostalCode`] = ct.zip || "94105";
    contactParams[`${prefix}Country`] = ct.country || "US";
    contactParams[`${prefix}Phone`] = ct.phone || "+1.5555555555";
    contactParams[`${prefix}EmailAddress`] = ct.email || "domains@hazza.name";
  }

  const extra = {
    DomainName: domain,
    Years: String(years),
    ...contactParams,
  };

  // Custom nameservers
  if (nameservers && nameservers.length > 0) {
    extra.Nameservers = nameservers.join(",");
  }

  const url = ncParams("namecheap.domains.create", extra);
  const result = await ncFetch(url);
  if (!result.ok) return c.json({ error: result.error, code: result.code }, 502);

  const registered = xmlAttr(result.xml, "DomainCreateResult", "Registered") === "true";
  const orderId = xmlAttr(result.xml, "DomainCreateResult", "OrderID");
  const txId = xmlAttr(result.xml, "DomainCreateResult", "TransactionID");

  return c.json({ domain, registered, orderId, transactionId: txId });
});

// --- List DNS records ---
app.get("/domains/dns/:sld/:tld", async (c) => {
  const { sld, tld } = c.req.param();
  const url = ncParams("namecheap.domains.dns.getHosts", { SLD: sld, TLD: tld });
  const result = await ncFetch(url);
  if (!result.ok) return c.json({ error: result.error, code: result.code }, 502);

  const hosts = xmlAll(result.xml, "host");
  const records = hosts.map((el) => {
    const attrs = parseAttrs(el);
    return {
      id: attrs.HostId,
      name: attrs.Name,
      type: attrs.Type,
      address: attrs.Address,
      ttl: attrs.TTL,
      mxPref: attrs.MXPref || null,
    };
  });

  return c.json({ sld, tld, records });
});

// --- Set DNS records (replaces ALL records) ---
app.post("/domains/dns/:sld/:tld", async (c) => {
  const { sld, tld } = c.req.param();
  const body = await c.req.json();
  const { records } = body;

  if (!records || !Array.isArray(records)) {
    return c.json({ error: "Missing records array" }, 400);
  }

  const extra = { SLD: sld, TLD: tld };
  records.forEach((r, i) => {
    const n = i + 1;
    extra[`HostName${n}`] = r.name || "@";
    extra[`RecordType${n}`] = r.type || "A";
    extra[`Address${n}`] = r.address;
    extra[`TTL${n}`] = String(r.ttl || 1800);
    if (r.mxPref) extra[`MXPref${n}`] = String(r.mxPref);
  });

  const url = ncParams("namecheap.domains.dns.setHosts", extra);
  const result = await ncFetch(url);
  if (!result.ok) return c.json({ error: result.error, code: result.code }, 502);

  const success =
    xmlAttr(result.xml, "DomainDNSSetHostsResult", "IsSuccess") === "true";
  return c.json({ sld, tld, success, recordCount: records.length });
});

// --- Helpers ---
function splitDomain(domain) {
  const parts = domain.split(".");
  if (parts.length < 2) return [null, null];
  const tld = parts.pop();
  const sld = parts.join(".");
  return [sld, tld];
}

// --- Start ---
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(
    `hazza-domains proxy running on port ${info.port} (sandbox: ${NC_SANDBOX})`
  );
});
