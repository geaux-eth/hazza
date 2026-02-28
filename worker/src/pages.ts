// HTML templates for the HAZZA Worker
// Palette: echoes Net Protocol green on dark background
// Font: Rubik Black (900) for headings, Rubik Regular for body

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Rubik', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #0a0a0a;
    color: #e0e0e0;
    min-height: 100vh;
  }
  a { color: #00e676; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .container { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; }
  .header {
    text-align: center;
    padding: 3rem 0 2rem;
    border-bottom: 1px solid #1a2e1a;
    margin-bottom: 2rem;
  }
  .header h1 {
    font-family: 'Rubik', sans-serif;
    font-size: 2.5rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: #fff;
  }
  .header h1 span { color: #00e676; }
  .header p {
    color: #6b8f6b;
    margin-top: 0.5rem;
    font-size: 1.1rem;
    font-weight: 400;
  }
  .search-box {
    display: flex;
    gap: 0.5rem;
    margin: 2rem 0;
  }
  .search-box input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 2px solid #1a2e1a;
    border-radius: 8px;
    background: #111;
    color: #fff;
    font-size: 1rem;
    font-family: 'Rubik', monospace;
    outline: none;
  }
  .search-box input:focus { border-color: #00e676; }
  .search-box button {
    padding: 0.75rem 1.5rem;
    background: #00e676;
    color: #000;
    border: none;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    font-size: 1rem;
    font-family: 'Rubik', sans-serif;
  }
  .search-box button:hover { background: #00c853; }
  .result {
    padding: 1rem;
    border: 1px solid #1a2e1a;
    border-radius: 8px;
    margin: 1rem 0;
    background: #111;
    display: none;
  }
  .result.show { display: block; }
  .result .available { color: #00e676; font-weight: 700; }
  .result .taken { color: #ff5252; }
  .pricing {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1rem;
    margin: 2rem 0;
  }
  .price-card {
    border: 2px solid #1a2e1a;
    border-radius: 8px;
    padding: 1.25rem;
    text-align: center;
    background: #111;
  }
  .price-card .chars { color: #6b8f6b; font-size: 0.9rem; }
  .price-card .amount {
    font-size: 1.5rem;
    font-weight: 900;
    color: #fff;
    margin: 0.5rem 0;
    font-family: 'Rubik', sans-serif;
  }
  .price-card .unit { color: #4a6a4a; font-size: 0.8rem; }
  .features {
    margin: 2rem 0;
  }
  .features h2 {
    font-size: 1.3rem;
    font-weight: 900;
    margin-bottom: 1rem;
    color: #fff;
  }
  .features ul { list-style: none; }
  .features li {
    padding: 0.5rem 0;
    color: #aaa;
    border-bottom: 1px solid #151f15;
  }
  .features li::before {
    content: "\\2713 ";
    color: #00e676;
    margin-right: 0.5rem;
  }
  .footer {
    text-align: center;
    padding: 2rem 0;
    border-top: 1px solid #1a2e1a;
    margin-top: 2rem;
    color: #4a6a4a;
    font-size: 0.85rem;
  }
  .profile-header {
    text-align: center;
    padding: 2.5rem 0 1.5rem;
  }
  .avatar {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    border: 3px solid #00e676;
    object-fit: cover;
    margin-bottom: 1rem;
  }
  .avatar-placeholder {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    border: 3px solid #1a2e1a;
    background: #111;
    margin: 0 auto 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
    font-weight: 900;
    color: #00e676;
  }
  .profile-header h1 {
    font-size: 2rem;
    font-weight: 900;
    color: #fff;
  }
  .profile-header h1 span { color: #00e676; }
  .bio {
    color: #aaa;
    margin-top: 0.5rem;
    font-size: 1rem;
    line-height: 1.5;
  }
  .status-badge {
    display: inline-block;
    padding: 0.2rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.75rem;
  }
  .status-active { background: #00e676; color: #000; }
  .status-grace { background: #ffab00; color: #000; }
  .status-redemption { background: #ff5252; color: #fff; }
  .status-expired { background: #444; color: #999; }
  .socials {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 1rem;
  }
  .social-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.85rem;
    background: #111;
    border: 1px solid #1a2e1a;
    border-radius: 20px;
    color: #aaa;
    font-size: 0.85rem;
    transition: border-color 0.15s;
  }
  .social-link:hover { border-color: #00e676; color: #00e676; text-decoration: none; }
  .section {
    margin: 1.5rem 0;
  }
  .section-title {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b8f6b;
    margin-bottom: 0.75rem;
  }
  .info-grid {
    display: grid;
    gap: 0.5rem;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.85rem;
    background: #111;
    border: 1px solid #1a2e1a;
    border-radius: 6px;
  }
  .info-row .label { color: #6b8f6b; font-size: 0.85rem; }
  .info-row .value { color: #fff; font-family: 'Rubik', monospace; font-size: 0.85rem; }
  .info-row .value a { color: #00e676; }
  .agent-card {
    padding: 1rem;
    background: #111;
    border: 1px solid #1a2e1a;
    border-radius: 8px;
  }
  .agent-card .agent-label { color: #6b8f6b; font-size: 0.8rem; margin-bottom: 0.25rem; }
  .agent-card .agent-value { color: #fff; font-size: 0.9rem; word-break: break-all; }
  .unclaimed {
    text-align: center;
    padding: 3rem;
    color: #6b8f6b;
  }
  .unclaimed .cta {
    display: inline-block;
    margin-top: 1rem;
    padding: 0.75rem 2rem;
    background: #00e676;
    color: #000;
    border-radius: 8px;
    font-weight: 700;
  }
`;

const SEARCH_SCRIPT = `
  const input = document.getElementById('name-input');
  const btn = document.getElementById('search-btn');
  const result = document.getElementById('result');

  async function search() {
    const name = input.value.trim().toLowerCase();
    if (!name) return;
    result.className = 'result show';
    result.innerHTML = 'Checking...';
    try {
      const [avail, priceRes] = await Promise.all([
        fetch('/api/available/' + name).then(r => r.json()),
        fetch('/api/price/' + name).then(r => r.json()),
      ]);
      if (avail.available) {
        result.innerHTML = '<span class="available">' + name + '.hazza.name</span> is available! '
          + '<strong>$' + priceRes.basePrice + '</strong> + $2/yr renewal '
          + '<span style="display:inline-block;padding:0.3rem 1rem;background:#00e676;color:#000;border-radius:6px;font-weight:700;font-size:0.85rem;opacity:0.5;cursor:default;vertical-align:middle;margin-left:0.5rem">Register</span>';
      } else {
        const res = await fetch('/api/resolve/' + name).then(r => r.json());
        result.innerHTML = '<span class="taken">' + name + '.hazza.name</span> is taken. '
          + 'Owner: <a href="https://basescan.org/address/' + res.owner + '">'
          + res.owner.slice(0, 6) + '...' + res.owner.slice(-4) + '</a>';
      }
    } catch (e) {
      result.innerHTML = 'Error checking name. Try again.';
    }
  }

  btn.addEventListener('click', search);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
`;

export function landingPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HAZZA \u2014 Your Onchain Name</title>
  <meta name="description" content="Register your onchain name on Base. Own your identity, DNS, content, and agent \u2014 all in one name.">
  <style>${STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>hazza<span>.name</span></h1>
      <p>onchain domain registry</p>
    </div>

    <div class="search-box">
      <input type="text" id="name-input" placeholder="search for a name..." autocomplete="off" spellcheck="false">
      <button id="search-btn">Search</button>
    </div>
    <div class="result" id="result"></div>

    <div class="pricing">
      <div class="price-card">
        <div class="chars">3 characters</div>
        <div class="amount">$100</div>
        <div class="unit">+ $2/yr</div>
      </div>
      <div class="price-card">
        <div class="chars">4 characters</div>
        <div class="amount">$25</div>
        <div class="unit">+ $2/yr</div>
      </div>
      <div class="price-card">
        <div class="chars">5+ characters</div>
        <div class="amount">$5</div>
        <div class="unit">+ $2/yr</div>
      </div>
    </div>

    <div class="features">
      <h2>what you get</h2>
      <ul>
        <li>Your name as an NFT on Base (ERC-721)</li>
        <li>Your own subdomain: yourname.hazza.name</li>
        <li>Onchain content hosting via Net Protocol</li>
        <li>Optional ERC-8004 AI agent registration</li>
        <li>Custom DNS linking</li>
        <li>API key for programmatic access</li>
        <li>Namespace delegation (subnames for your team/agents)</li>
        <li>ENSIP-15 Unicode & emoji support</li>
        <li>ENS import with 50% discount</li>
      </ul>
    </div>

    <div class="features">
      <h2>discounts</h2>
      <ul>
        <li>ENS holders: 50% off registration + challenge immunity</li>
        <li>Net Library Unlimited Pass: 20% off registration</li>
        <li>Both discounts stack</li>
      </ul>
    </div>

    <div class="footer">
      <p>Powered by <a href="https://netprotocol.app">Net Protocol</a> on <a href="https://base.org">Base</a></p>
      <p style="margin-top:0.5rem">Built by Cheryl from <a href="https://netlibrary.app">Net Library</a></p>
    </div>
  </div>
  <script>${SEARCH_SCRIPT}</script>
</body>
</html>`;
}

type ProfileData = {
  owner: string;
  tokenId: string;
  registeredAt: number;
  expiresAt: number;
  operator: string;
  agentId: string;
  agentWallet: string;
  status: "active" | "grace" | "redemption" | "expired";
  texts: Record<string, string>;
  contenthash: string | null;
};

const SOCIAL_LABELS: Record<string, { label: string; urlPrefix: string }> = {
  "com.twitter": { label: "Twitter", urlPrefix: "https://x.com/" },
  "xyz.farcaster": { label: "Farcaster", urlPrefix: "https://warpcast.com/" },
  "com.github": { label: "GitHub", urlPrefix: "https://github.com/" },
  "org.telegram": { label: "Telegram", urlPrefix: "https://t.me/" },
  "com.discord": { label: "Discord", urlPrefix: "" },
  "com.linkedin": { label: "LinkedIn", urlPrefix: "https://linkedin.com/in/" },
};

function buildSocialLinks(texts: Record<string, string>): string {
  const links: string[] = [];
  for (const [key, { label, urlPrefix }] of Object.entries(SOCIAL_LABELS)) {
    const val = texts[key];
    if (!val) continue;
    const handle = val.replace(/^@/, "");
    if (urlPrefix) {
      links.push(`<a class="social-link" href="${urlPrefix}${handle}" target="_blank" rel="noopener">${label}</a>`);
    } else {
      links.push(`<span class="social-link">${label}: ${val}</span>`);
    }
  }
  if (texts["url"]) {
    links.push(`<a class="social-link" href="${texts["url"]}" target="_blank" rel="noopener">Website</a>`);
  }
  return links.length ? `<div class="socials">${links.join("")}</div>` : "";
}

function daysUntil(ts: number): number {
  return Math.max(0, Math.ceil((ts * 1000 - Date.now()) / 86400000));
}

function statusBadge(status: string): string {
  const labels: Record<string, string> = {
    active: "Active",
    grace: "Grace Period",
    redemption: "Redemption",
    expired: "Expired",
  };
  return `<span class="status-badge status-${status}">${labels[status] || status}</span>`;
}

export function profilePage(name: string, data: ProfileData | null): string {
  const title = data ? `${name}.hazza.name` : `${name}.hazza.name \u2014 Available`;

  let content: string;
  if (data) {
    const regDate = new Date(data.registeredAt * 1000).toLocaleDateString();
    const expDate = new Date(data.expiresAt * 1000).toLocaleDateString();
    const shortOwner = data.owner.slice(0, 6) + "..." + data.owner.slice(-4);
    const hasAgent = data.agentId !== "0";
    const zeroAddr = "0x0000000000000000000000000000000000000000";
    const hasOperator = data.operator !== zeroAddr && data.operator.toLowerCase() !== data.owner.toLowerCase();
    const days = daysUntil(data.expiresAt);
    const texts = data.texts || {};

    // Avatar
    const avatarHtml = texts["avatar"]
      ? `<img class="avatar" src="${texts["avatar"]}" alt="${name}" onerror="this.style.display='none'">`
      : `<div class="avatar-placeholder">${name.charAt(0).toUpperCase()}</div>`;

    // Social links
    const socialsHtml = buildSocialLinks(texts);

    // Bio
    const bioHtml = texts["description"]
      ? `<p class="bio">${texts["description"]}</p>`
      : "";

    // Renewal info
    const renewalText = data.status === "active"
      ? `${expDate} (${days} day${days !== 1 ? "s" : ""} left)`
      : expDate;

    // Agent section
    let agentHtml = "";
    if (hasAgent || texts["agent.endpoint"] || texts["agent.model"]) {
      const agentRows: string[] = [];
      if (hasAgent) {
        agentRows.push(`<div class="agent-card"><div class="agent-label">Agent ID</div><div class="agent-value">#${data.agentId}</div></div>`);
        if (data.agentWallet !== zeroAddr) {
          const shortAgent = data.agentWallet.slice(0, 6) + "..." + data.agentWallet.slice(-4);
          agentRows.push(`<div class="agent-card"><div class="agent-label">Agent Wallet</div><div class="agent-value"><a href="https://basescan.org/address/${data.agentWallet}">${shortAgent}</a></div></div>`);
        }
      }
      if (texts["agent.endpoint"]) {
        agentRows.push(`<div class="agent-card"><div class="agent-label">Endpoint</div><div class="agent-value">${texts["agent.endpoint"]}</div></div>`);
      }
      if (texts["agent.model"]) {
        agentRows.push(`<div class="agent-card"><div class="agent-label">Model</div><div class="agent-value">${texts["agent.model"]}</div></div>`);
      }
      if (texts["agent.status"]) {
        agentRows.push(`<div class="agent-card"><div class="agent-label">Status</div><div class="agent-value">${texts["agent.status"]}</div></div>`);
      }
      agentHtml = `
      <div class="section">
        <div class="section-title">AI Agent (ERC-8004)</div>
        <div class="info-grid">${agentRows.join("")}</div>
      </div>`;
    }

    // Contenthash section
    const contenthashHtml = data.contenthash
      ? `<div class="section">
          <div class="section-title">Contenthash</div>
          <div class="info-grid">
            <div class="info-row">
              <span class="label">Hash</span>
              <span class="value" style="font-size:0.75rem">${data.contenthash.slice(0, 18)}...${data.contenthash.slice(-8)}</span>
            </div>
          </div>
        </div>`
      : "";

    content = `
    <div class="profile-header">
      ${avatarHtml}
      <h1>${name}<span>.hazza.name</span></h1>
      ${bioHtml}
      ${statusBadge(data.status)}
      ${socialsHtml}
    </div>

    <div class="section">
      <div class="section-title">Name Info</div>
      <div class="info-grid">
        <div class="info-row">
          <span class="label">Owner</span>
          <span class="value"><a href="https://basescan.org/address/${data.owner}">${shortOwner}</a></span>
        </div>
        <div class="info-row">
          <span class="label">Token ID</span>
          <span class="value">#${data.tokenId}</span>
        </div>
        <div class="info-row">
          <span class="label">Registered</span>
          <span class="value">${regDate}</span>
        </div>
        <div class="info-row">
          <span class="label">Expires</span>
          <span class="value">${renewalText}</span>
        </div>
        ${hasOperator ? `<div class="info-row">
          <span class="label">Operator</span>
          <span class="value"><a href="https://basescan.org/address/${data.operator}">${data.operator.slice(0, 6)}...${data.operator.slice(-4)}</a></span>
        </div>` : ""}
        <div class="info-row">
          <span class="label">Subdomain</span>
          <span class="value"><a href="https://${name}.hazza.name">${name}.hazza.name</a></span>
        </div>
      </div>
    </div>

    ${agentHtml}
    ${contenthashHtml}`;
  } else {
    content = `
    <div class="unclaimed">
      <h1 style="color:#fff;font-size:2rem;font-weight:900;margin-bottom:0.5rem">${name}<span style="color:#00e676">.hazza.name</span></h1>
      <p>this name is available</p>
      <a class="cta" href="https://hazza.name">Register it</a>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${data ? `${name}.hazza.name \u2014 owned by ${data.owner}` : `${name}.hazza.name is available on HAZZA`}">
  <style>${STYLES}</style>
</head>
<body>
  <div class="container">
    ${content}
    <div class="footer">
      <p>Powered by <a href="https://netprotocol.app">Net Protocol</a> on <a href="https://base.org">Base</a></p>
      <p style="margin-top:0.5rem">Built by Cheryl from <a href="https://netlibrary.app">Net Library</a></p>
    </div>
  </div>
</body>
</html>`;
}
