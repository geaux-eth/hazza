// HTML templates for the hazza Worker
// Palette: Moonlit B — cream background, bandana red accent, hat blue secondary
// Font: DM Sans for body, Fredoka for headings/names/Nomi voice
//
// All legacy SSR page functions have been moved to pages-legacy-reference.ts.
// The worker now exclusively uses the SPA shell for page rendering.
// Legacy functions preserved for reference only.

/** Nomi avatar as inline data URI (used on multiple pages) */
export const NOMI_AVATAR = "data:image/png;base64,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";

/** Escape user-controlled values for safe HTML interpolation */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Validate URL is safe for href attributes (prevents javascript: etc) */
function safeHref(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return esc(url);
  } catch {}
  return '#';
}

// =========================================================================
//                      SPA SHELL (React app loader)
// =========================================================================
//
// All legacy SSR page functions have been moved to pages-legacy-reference.ts.
// The worker now exclusively uses the SPA shell for page rendering.
// Legacy functions preserved for reference only: landingPage, registerPage,
// dashboardPage, managePage, marketplacePage, aboutPage, nomiPage,
// pricingPage, pricingProtectionsPage, pricingDetailsPage, docsPage,
// domainsPage, domainsManagePage, profilePage.

const SPA_ASSET_BASE = "";

interface SpaRoute {
  title: string;
  description: string;
  ogUrl?: string;
}

const SPA_ROUTES: Record<string, SpaRoute> = {
  "/": {
    title: "hazza \u2014 immediately useful names",
    description: "Online meets onchain. A name, a website, a verified onchain identity, and agent registration \u2014 built on Base with Net Protocol.",
  },
  "/register": {
    title: "Register a hazza name",
    description: "Claim your onchain name on Base. First registration is free. Pay $5 USDC for additional names.",
    ogUrl: "https://hazza.name/register",
  },
  "/dashboard": {
    title: "Dashboard \u2014 hazza",
    description: "Manage your hazza names, text records, and onchain identity.",
    ogUrl: "https://hazza.name/dashboard",
  },
  "/manage": {
    title: "Manage Name \u2014 hazza",
    description: "Set text records, transfer names, and manage your onchain identity.",
    ogUrl: "https://hazza.name/manage",
  },
  "/marketplace": {
    title: "Marketplace \u2014 hazza",
    description: "Buy, sell, and trade hazza names. Powered by Seaport protocol on Base.",
    ogUrl: "https://hazza.name/marketplace",
  },
  "/about": {
    title: "About & Pricing \u2014 hazza",
    description: "Learn about hazza names, pricing, and the onchain identity stack built on Base. First name free, additional names start at $5.",
    ogUrl: "https://hazza.name/about",
  },
  "/docs": {
    title: "Docs \u2014 hazza",
    description: "Developer documentation for hazza names. Contract addresses, text records, CLI, and API reference.",
    ogUrl: "https://hazza.name/docs",
  },
  "/messages": {
    title: "Messages \u2014 hazza",
    description: "Message anyone on hazza via XMTP. Chat with Nomi, DM name owners, and manage your inbox.",
    ogUrl: "https://hazza.name/messages",
  },
  "/domains": {
    title: "Custom Domains \u2014 hazza",
    description: "Link your own domain to your hazza name. Point any domain to your onchain profile.",
    ogUrl: "https://hazza.name/domains",
  },
};

export function spaShell(path: string, profileName?: string): string {
  let route;
  let ogUrl: string;
  let ogImage: string;

  if (path === "/__profile__" && profileName) {
    route = {
      title: `${profileName}.hazza.name`,
      description: `${profileName}'s onchain identity on hazza`,
    };
    ogUrl = `https://${profileName}.hazza.name`;
    ogImage = `https://hazza.name/api/og/${encodeURIComponent(profileName)}`;
  } else {
    route = SPA_ROUTES[path] || SPA_ROUTES["/"];
    ogUrl = route.ogUrl || "https://hazza.name";
    ogImage = "https://hazza.name/api/og/hazza";
  }

  // Inject profile name for React to pick up
  const profileScript = profileName
    ? `\n  <script>window.__HAZZA_PROFILE_NAME__=${JSON.stringify(profileName)};</script>`
    : "";

  // SSR the landing page so users see real content instantly (no "loading..." flash)
  const isLanding = path === "/";
  const ssrContent = isLanding ? `<div class="nav-bar"><nav><a class="logo" href="/"><span class="logo-icon">h</span></a><button class="hamburger" aria-label="Menu">&#9776;</button><div class="links"><a href="/register">register</a><a href="/marketplace">marketplace</a><a href="/dashboard">dashboard</a><a href="/messages">messages</a><a href="/about">about</a><a href="/docs">docs</a><button class="nav-wallet-btn">connect</button></div></nav></div><div class="page-content"><div class="header"><h1>hazza<span>.name</span></h1><p>immediately useful</p></div><div style="max-width:480px;margin:0 auto 1rem"><div class="search-box"><input type="text" id="name-input" placeholder="find something awesome!" autocomplete="off" spellcheck="false"><button id="search-btn">Search</button></div></div><div class="result" id="result"></div><div id="landing-features" style="margin-top:1.5rem;max-width:640px;margin-left:auto;margin-right:auto;display:grid;grid-template-columns:repeat(5,1fr);gap:1rem">${[
    { title: 'onchain', desc: 'permanent name + website on Net Protocol' },
    { title: 'DNS + ENS', desc: 'resolves like a real domain' },
    { title: 'x402', desc: 'one-click registration, no wallet popups' },
    { title: 'ERC-8004', desc: 'identity endpoint for AI agents' },
    { title: 'XMTP', desc: 'encrypted messaging built in' },
  ].map(c => `<div style="background:#fff;border:2px solid #4870D4;border-radius:10px;padding:0.85rem 0.6rem;text-align:center;box-shadow:0 2px 6px rgba(19,19,37,0.06)"><div style="font-family:'Fredoka',sans-serif;font-weight:700;color:#4870D4;font-size:0.85rem;white-space:nowrap;margin-bottom:0.35rem">${c.title}</div><div style="color:#131325;font-size:0.72rem;line-height:1.4">${c.desc}</div></div>`).join('')}</div></div>` : 'loading...';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>${esc(route.title)}</title>
  <meta name="description" content="${esc(route.description)}">
  <meta property="og:title" content="${esc(route.title)}">
  <meta property="og:description" content="${esc(route.description)}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${ogUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(route.title)}">
  <meta name="twitter:description" content="${esc(route.description)}">
  <meta name="twitter:image" content="${ogImage}">

  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"hazza","url":"https://hazza.name","description":"Onchain name registry on Base. Register short, immediately useful names — profile pages, text records, marketplace, and messaging.","applicationCategory":"BlockchainApplication","operatingSystem":"Web","offers":{"@type":"Offer","price":"0","priceCurrency":"USD","description":"First name free, additional names from $5 USDC"}}</script>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${SPA_ASSET_BASE}/assets/index-B2esDReL.css">
  <link rel="modulepreload" href="${SPA_ASSET_BASE}/assets/xmtp-CzGTnMUH.js">${profileScript}
</head>
<body>
  <div id="root">${ssrContent}</div>
  <script>window.onerror=function(m,s,l,c,e){if(s&&s.includes('extension'))return true;document.getElementById('root').innerHTML='<pre style="color:red;padding:2rem">'+m+'\\n'+s+':'+l+'\\n'+(e&&e.stack||'')+'</pre>';}</script>
  <script type="module" src="${SPA_ASSET_BASE}/assets/index-D_eSg2iE.js"></script>
</body>
</html>`;
}

export function profileBotPage(name: string, data: { owner: string; description: string; avatar: string } | null): string {
  const title = data ? `${name}.hazza.name` : `${name}.hazza.name \u2014 Available`;
  const description = data?.description || (data ? `${name}'s onchain identity on hazza` : `${name}.hazza.name is available`);
  const ogImage = `https://hazza.name/api/og/${encodeURIComponent(name)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:type" content="profile">
  <meta property="og:url" content="https://${esc(name)}.hazza.name">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${ogImage}">
</head>
<body>
  <h1>${esc(name)}.hazza.name</h1>
  ${data ? `<p>${esc(description)}</p><p>Owner: ${esc(data.owner)}</p>` : `<p>This name is available. <a href="https://hazza.name/register?name=${encodeURIComponent(name)}">Register it</a></p>`}
</body>
</html>`;
}

// =========================================================================
//               LEGACY SSR STUB EXPORTS (backward compatibility)
// =========================================================================
// These functions are imported by index.ts but never called.
// They exist only to prevent import errors. The actual legacy code
// is preserved in pages-legacy-reference.ts.

/* eslint-disable @typescript-eslint/no-unused-vars */
export function landingPage(_chainId?: string): string { return ""; }
export function registerPage(_registryAddress: string, _usdcAddress: string, _chainId: string): string { return ""; }
export function managePage(_registryAddress: string, _usdcAddress: string, _chainId: string): string { return ""; }
export function dashboardPage(_registryAddress: string, _usdcAddress: string, _chainId: string): string { return ""; }
export function profilePage(_name: string, _data: any, _chainId?: string): string { return ""; }
export function aboutPage(): string { return ""; }
export function nomiPage(): string { return ""; }
export function pricingPage(): string { return ""; }
export function pricingProtectionsPage(): string { return ""; }
export function pricingDetailsPage(): string { return ""; }
export function docsPage(): string { return ""; }
export function domainsPage(): string { return ""; }
export function marketplacePage(_registryAddress: string, _usdcAddress: string, _chainId: string, _seaportAddress: string, _bazaarAddress: string, _batchExecutorAddress: string, _treasuryAddress: string, _marketplaceFeeBps: string, _wethAddress: string): string { return ""; }
