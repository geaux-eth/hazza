// HTML templates for the hazza Worker
// Palette: echoes Net Protocol green on dark background
// Font: Rubik Black (900) for headings, Rubik Regular for body

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
  @keyframes statusPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .status-pill {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 700;
    white-space: nowrap;
    animation: statusPulse 3s ease-in-out infinite;
  }
  nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 720px;
    margin: 0 auto;
    padding: 1rem 1.5rem 0;
  }
  nav .logo { display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 900; font-size: 1.1rem; color: #fff; }
  nav .logo:hover { text-decoration: none; }
  nav .logo-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    background: #0a0a0a;
    border: 2px solid #00e676;
    border-radius: 6px;
    color: #fff;
    font-weight: 900;
    font-size: 1rem;
    line-height: 1;
  }
  nav .links { display: flex; gap: 1.25rem; align-items: center; }
  nav .links a { color: #6b8f6b; font-size: 0.85rem; font-weight: 500; }
  nav .links a:hover { color: #00e676; text-decoration: none; }
  .nav-wallet-btn {
    padding: 0.3rem 0.75rem;
    background: transparent;
    color: #00e676;
    border: 1px solid #00e676;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 700;
    font-family: 'Rubik', sans-serif;
    cursor: pointer;
    white-space: nowrap;
  }
  .nav-wallet-btn:hover { background: #00e676; color: #000; }
  .nav-wallet-btn.connected { background: #00e676; color: #000; }
  .hamburger {
    display: none;
    background: none;
    border: none;
    color: #fff;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
  }
  .container { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; }
  .header {
    text-align: center;
    padding: 1.5rem 0 1rem;
    border-bottom: 1px solid #1a2e1a;
    margin-bottom: 1rem;
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
    margin: 1rem 0;
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
    border: 1px solid #00e676;
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
  .footer {
    text-align: center;
    padding: 1rem 0;
    border-top: 1px solid #1a2e1a;
    margin-top: 1rem;
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
    padding: 0.15rem 0.5rem;
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    vertical-align: middle;
  }
  .status-active { background: #00e676; color: #000; }
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
  .features {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
    margin: 2rem 0;
  }
  .feature-block {
    padding: 1.5rem;
    background: #111;
    border: 1px solid #00e676;
    border-radius: 8px;
  }
  .feature-block .feature-title {
    font-size: 1.1rem;
    font-weight: 900;
    color: #00e676;
    margin-bottom: 0.5rem;
  }
  .feature-block p {
    color: #aaa;
    font-size: 0.95rem;
    line-height: 1.6;
  }
  .divider {
    border: none;
    border-top: 1px solid #1a2e1a;
    margin: 1.5rem 0;
  }
  .checkout-step {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0;
    color: #4a6a4a;
    font-size: 0.9rem;
  }
  .checkout-step.active { color: #fff; }
  .checkout-step.done { color: #00e676; }
  .checkout-step.error { color: #ff5252; }
  .checkout-step .step-icon {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #1a2e1a;
    flex-shrink: 0;
  }
  .checkout-step.active .step-icon { background: #fff; }
  .checkout-step.done .step-icon { background: #00e676; }
  .checkout-step.error .step-icon { background: #ff5252; }
  details.collapsible { margin: 1.5rem 0; }
  details.collapsible summary {
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b8f6b;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
    user-select: none;
  }
  details.collapsible summary::-webkit-details-marker { display: none; }
  details.collapsible summary::before {
    content: '\\25B6';
    font-size: 0.6rem;
    transition: transform 0.15s;
    display: inline-block;
  }
  details.collapsible[open] summary::before { transform: rotate(90deg); }
  details.collapsible .section-content { padding-top: 0.5rem; }
  @media (max-width: 600px) {
    nav { padding: 0.75rem 1rem 0; flex-wrap: wrap; }
    .hamburger { display: block; }
    nav { position: relative; }
    nav .links {
      display: none;
      flex-direction: column;
      width: calc(100% - 2rem);
      background: #111;
      border: 1px solid #1a2e1a;
      border-radius: 8px;
      padding: 0.75rem;
      gap: 0.5rem;
      position: absolute;
      top: 100%;
      left: 1rem;
      z-index: 1000;
      box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    }
    nav .links.open { display: flex; }
    nav .links a { font-size: 0.9rem; padding: 0.4rem 0; }
    .nav-wallet-btn { width: 100%; text-align: center; padding: 0.5rem; }
    .container { padding: 1.5rem 1rem; }
    .header { padding: 2rem 0 1.5rem; }
    .header h1 { font-size: 2rem; }
    .pricing { gap: 0.5rem; }
    .price-card { padding: 0.85rem 0.5rem; }
    .price-card .amount { font-size: 1.2rem; }
    .price-card .chars { font-size: 0.75rem; }
    .profile-header h1 { font-size: 1.4rem; word-break: break-word; }
    .unclaimed h1 { font-size: 1.4rem !important; word-break: break-word; }
    .search-box input { font-size: 16px; padding: 0.65rem 0.75rem; }
    .search-box button { padding: 0.65rem 1rem; font-size: 16px; }
    .info-row { flex-wrap: wrap; gap: 0.25rem; }
    .info-row .label { min-width: 80px; }
    .info-row .value { font-size: 0.8rem; word-break: break-word; }
    .social-link { font-size: 0.8rem; padding: 0.35rem 0.7rem; }
  }
`;

function searchScript(explorerHost: string) { return `
  const input = document.getElementById('name-input');
  const btn = document.getElementById('search-btn');
  const result = document.getElementById('result');

  // Sanitize name to alphanumeric + hyphens only
  function sanitizeName(n) { return n.replace(/[^a-z0-9-]/g, '').slice(0, 64); }

  // Escape for safe innerHTML usage
  function escHtml(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  async function search() {
    const raw = input.value.trim().toLowerCase();
    const name = sanitizeName(raw);
    if (!name) {
      result.className = 'result show';
      result.innerHTML = '<div style="text-align:center;color:#ff5252;font-size:0.85rem">your name is also your web address — only letters, numbers, and hyphens work in URLs</div>';
      return;
    }
    result.className = 'result show';
    result.textContent = 'Checking...';
    // Hide feature block once user searches
    var fb = document.getElementById('landing-features');
    if (fb) fb.style.display = 'none';
    try {
      const avail = await fetch('/api/available/' + encodeURIComponent(name)).then(r => r.json());
      if (avail.available) {
        result.innerHTML = '<div style="text-align:center"><span style="color:#fff;font-weight:700">' + escHtml(name) + '</span><span class="available">.hazza.name</span><br><span style="color:#00e676;font-size:0.85rem">is available</span></div>'
          + '<div style="text-align:center;margin-top:1.25rem"><a href="/register?name=' + encodeURIComponent(name) + '" style="display:inline-block;padding:0.6rem 2rem;background:#00e676;color:#000;border-radius:8px;font-weight:700;font-size:1rem;text-decoration:none">Register</a></div>';
      } else {
        const res = await fetch('/api/resolve/' + encodeURIComponent(name)).then(r => r.json());
        result.innerHTML = '<div style="text-align:center"><span style="color:#fff;font-weight:700">' + escHtml(name) + '</span><span class="taken">.hazza.name</span><br><span style="color:#ff5252;font-size:0.85rem">is taken</span></div>'
          + '<div style="text-align:center;margin-top:0.5rem;color:#6b8f6b;font-size:0.85rem">Owner: <a href="https://${explorerHost}/address/' + escHtml(res.owner) + '" style="color:#6b8f6b">'
          + escHtml(res.owner.slice(0, 6) + '...' + res.owner.slice(-4)) + '</a></div>';
      }
    } catch (e) {
      result.textContent = 'Error checking name. Try again.';
    }
  }

  btn.addEventListener('click', search);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
`; }

const NAV = `
  <nav>
    <a class="logo" href="/"><span class="logo-icon">h</span></a>
    <button class="hamburger" id="hamburger-btn" aria-label="Menu">&#9776;</button>
    <div class="links" id="nav-links">
      <a href="/register">register</a>
      <a href="/marketplace">marketplace</a>
      <a href="/dashboard">dashboard</a>
      <a href="/pricing">pricing</a>
      <a href="/about">about</a>
      <a href="/docs">docs</a>
      <button id="nav-connect-btn" class="nav-wallet-btn">connect</button>
    </div>
  </nav>`;

const NAV_SCRIPT = `
  (function() {
    // Hamburger toggle
    var hamburger = document.getElementById('hamburger-btn');
    var navLinks = document.getElementById('nav-links');
    if (hamburger && navLinks) {
      hamburger.addEventListener('click', function(e) {
        e.stopPropagation();
        navLinks.classList.toggle('open');
      });
      // Close menu when tapping outside
      document.addEventListener('click', function(e) {
        if (navLinks.classList.contains('open') && !navLinks.contains(e.target)) {
          navLinks.classList.remove('open');
        }
      });
      // Close menu when clicking a nav link
      navLinks.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', function() {
          navLinks.classList.remove('open');
        });
      });
    }

    // Global wallet state — pages read this instead of relying on events alone
    window.__hazza_wallet = null;

    // Wallet connect (single source of truth for the entire app)
    var connectBtn = document.getElementById('nav-connect-btn');
    if (!connectBtn) return;

    function truncAddr(a) { return a.slice(0, 6) + '...' + a.slice(-4); }

    function setConnected(addr) {
      window.__hazza_wallet = addr;
      connectBtn.textContent = truncAddr(addr);
      connectBtn.classList.add('connected');
      try { sessionStorage.setItem('hazza_wallet', addr); } catch(e) {}
    }

    function doDisconnect() {
      window.__hazza_wallet = null;
      connectBtn.textContent = 'connect';
      connectBtn.classList.remove('connected');
      try { sessionStorage.removeItem('hazza_wallet'); } catch(e) {}
      // Revoke wallet permission if wallet supports it
      if (window.ethereum && window.ethereum.request) {
        window.ethereum.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }]
        }).catch(function() {});
      }
      window.dispatchEvent(new CustomEvent('hazza_wallet_disconnected'));
    }

    function doConnect() {
      if (!window.ethereum) { alert('No wallet detected. Install MetaMask or open in a wallet browser.'); return; }
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(function(accounts) {
          if (accounts && accounts[0]) {
            setConnected(accounts[0]);
            window.dispatchEvent(new CustomEvent('hazza_wallet_connected', { detail: { address: accounts[0] } }));
          }
        })
        .catch(function() {});
    }

    connectBtn.addEventListener('click', function() {
      if (connectBtn.classList.contains('connected')) {
        doDisconnect();
      } else {
        doConnect();
      }
    });

    // Check for existing connection
    function initWallet() {
      if (typeof window.ethereum === 'undefined') return false;
      var saved = null;
      try { saved = sessionStorage.getItem('hazza_wallet'); } catch(e) {}
      if (saved) {
        setConnected(saved);
        // Verify the wallet still has this account
        window.ethereum.request({ method: 'eth_accounts' }).then(function(accounts) {
          if (accounts && accounts[0]) {
            setConnected(accounts[0]);
          }
        }).catch(function() {});
        return true;
      } else if (window.ethereum.selectedAddress) {
        setConnected(window.ethereum.selectedAddress);
        return true;
      }
      return false;
    }

    // Try immediately, retry for late ethereum injection
    if (!initWallet()) {
      setTimeout(initWallet, 500);
      setTimeout(initWallet, 1500);
    }

    // Listen for EIP-6963 provider announcements (modern MetaMask)
    window.addEventListener('eip6963:announceProvider', function() {
      if (!connectBtn.classList.contains('connected')) setTimeout(initWallet, 100);
    });

    // Listen for account changes from wallet
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on && window.ethereum.on('accountsChanged', function(accounts) {
        if (accounts && accounts[0]) {
          setConnected(accounts[0]);
          window.dispatchEvent(new CustomEvent('hazza_wallet_connected', { detail: { address: accounts[0] } }));
        } else {
          doDisconnect();
        }
      });
    }
  })();
`;

/** Shell for subdomain profile pages — separate nav, absolute URLs, profile-specific icon */
function profileShell(name: string, title: string, description: string, body: string, script?: string, opts?: { externalScripts?: string[]; ogImage?: string }): string {
  const externals = (opts?.externalScripts || []).map(src => `<script src="${src}"></script>`).join("\n  ");
  const ogImg = opts?.ogImage || `https://hazza.name/api/og/${encodeURIComponent(name)}`;
  // First char of name for the profile icon
  const iconChar = name.charAt(0).toUpperCase();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${ogImg}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${ogImg}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${encodeURIComponent(iconChar)}</text></svg>">
  <style>${STYLES}</style>
</head>
<body>
  <nav>
    <a class="logo" href="https://${encodeURIComponent(name)}.hazza.name"><span class="logo-icon">${esc(iconChar)}</span></a>
    <div class="links">
      <a href="https://hazza.name/manage?name=${encodeURIComponent(name)}">edit</a>
      <a href="https://hazza.name/marketplace">marketplace</a>
      <a href="https://hazza.name/register">register</a>
      <a href="https://hazza.name">hazza.name</a>
    </div>
  </nav>
  <div class="container">
    ${body}
    <div class="footer">
      <p>Built on <a href="https://base.org">Base</a></p>
      <p>Powered by <a href="https://x402.org">x402</a> and <a href="https://netprotocol.app">Net Protocol</a></p>
    </div>
  </div>
  ${externals}
  ${script ? `<script>${script}</script>` : ""}
</body>
</html>`;
}

function shell(title: string, description: string, body: string, script?: string, opts?: { externalScripts?: string[]; ogImage?: string }): string {
  const externals = (opts?.externalScripts || []).map(src => `<script src="${src}"></script>`).join("\n  ");
  const ogImg = opts?.ogImage || "https://hazza.name/api/og/hazza";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${ogImg}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${ogImg}">
  <meta name="fc:frame" content='{"version":"1","imageUrl":"https://hazza.name/api/share","button":{"title":"open hazza","action":{"type":"launch_miniapp","url":"https://hazza.name"}}}'>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>h</text></svg>">
  <style>${STYLES}</style>
</head>
<body>
  ${NAV}
  <div class="container">
    ${body}
    <div class="footer">
      <p>Built on <a href="https://base.org">Base</a></p>
      <p>Powered by <a href="https://x402.org">x402</a> and <a href="https://netprotocol.app">Net Protocol</a></p>
    </div>
  </div>
  ${externals}
  <script>${NAV_SCRIPT}</script>
  ${script ? `<script>${script}</script>` : ""}
  <script>
  if (window.farcaster || window.parent !== window) {
    import('https://esm.sh/@farcaster/miniapp-sdk@latest').then(function(m) { if (m.sdk) m.sdk.actions.ready(); }).catch(function(){});
  }
  </script>
</body>
</html>`;
}

export function landingPage(chainId?: string): string {
  const explorerHost = chainId === "84532" ? "sepolia.basescan.org" : "basescan.org";
  return shell(
    "hazza \u2014 immediately useful names",
    "Online meets onchain. A name, a website, a verified onchain identity, and agent registration \u2014 built on Base with Net Protocol.",
    `
    <div class="header">
      <h1>hazza<span>.name</span></h1>
      <p>immediately useful</p>
    </div>

    <div class="search-box">
      <input type="text" id="name-input" placeholder="search for a name..." autocomplete="off" spellcheck="false">
      <button id="search-btn">Search</button>
    </div>
    <div class="result" id="result"></div>

    <div id="landing-features" class="feature-block" style="margin-top:1.5rem">
      <div style="display:grid;gap:1rem">
        <div>
          <div class="feature-title">Profile</div>
          <p>Live at <strong style="color:#fff">yourname.hazza.name</strong>. Bio, socials, avatar, links &mdash; all onchain.</p>
        </div>
        <div>
          <div class="feature-title">Agent</div>
          <p>Register an AI agent endpoint. <strong style="color:#fff">ERC-8004</strong> compatible. Discoverable by other agents.</p>
        </div>
        <div>
          <div class="feature-title">API</div>
          <p>Register from any HTTP client via the <a href="/docs#x402" style="font-weight:700">registration API</a>. Pay USDC, get a name. No wallet extension needed.</p>
        </div>
      </div>
    </div>`,
    searchScript(explorerHost)
  );
}

// =========================================================================
//                        REGISTER PAGE
// =========================================================================

const ETHERS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.4/ethers.umd.min.js";

const REGISTER_SCRIPT = `
  const cfg = document.getElementById('hazza-config');
  const USDC_ADDRESS = cfg.dataset.usdc;
  const CHAIN_ID = parseInt(cfg.dataset.chainid);
  const rawNameParam = new URLSearchParams(window.location.search).get('name') || '';
  const nameParam = rawNameParam.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);

  function escHtml(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
  function sanitizeName(n) { return n.replace(/[^a-z0-9-]/g, '').slice(0, 64); }

  const ERC20_ABI = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address account) view returns (uint256)"
  ];

  let provider, signer, userAddress, relayerAddress, totalCostRaw;
  let freeClaimEligible = false, freeClaimMemberId = 0;

  // --- UI helpers ---
  const $ = id => document.getElementById(id);
  function setStep(n, status) {
    const el = $('step-' + n);
    if (!el) return;
    el.className = 'checkout-step ' + status;
  }
  function showStatus(msg, isError) {
    const el = $('status');
    el.textContent = msg;
    el.style.color = isError ? '#ff5252' : '#00e676';
    el.style.display = 'block';
  }

  function showSuccess(name) {
    // Hide everything above the success section
    $('checkout-steps').style.display = 'none';
    $('checkout-btn').style.display = 'none';
    $('status').style.display = 'none';
    var nameEl = $('reg-name'); if (nameEl) nameEl.style.display = 'none';
    var fcb = $('free-claim-banner'); if (fcb) fcb.style.display = 'none';
    var ens = $('ens-suggestion'); if (ens) ens.style.display = 'none';
    var qd = $('quote-details'); if (qd) qd.style.display = 'none';
    var qt = $('quote-total'); if (qt) qt.parentElement.style.display = 'none';
    // Show success
    $('success-section').style.display = 'block';
    $('success-name').textContent = name + '.hazza.name';
    $('success-link').href = 'https://' + name + '.hazza.name';
    $('success-link').textContent = 'view ' + name + '.hazza.name';
  }

  // --- Search on the register page ---
  async function regSearch() {
    const raw = $('reg-search-input').value.trim().toLowerCase();
    const name = sanitizeName(raw);
    if (!name) {
      const result = $('reg-search-result');
      result.className = 'result show';
      result.innerHTML = '<div style="text-align:center;color:#ff5252;font-size:0.85rem">your name is also your web address — only letters, numbers, and hyphens work in URLs</div>';
      return;
    }
    const result = $('reg-search-result');
    result.className = 'result show';
    result.textContent = 'Checking...';
    try {
      const avail = await fetch('/api/available/' + encodeURIComponent(name)).then(r => r.json());
      // Hide pricing info after search
      var pricingInfo = $('reg-pricing-info');
      if (pricingInfo) pricingInfo.style.display = 'none';
      if (avail.available) {
        result.innerHTML = '<div style="text-align:center"><span style="color:#fff;font-weight:700">' + escHtml(name) + '</span><span style="color:#00e676">.hazza.name</span><br><span style="color:#00e676;font-size:0.85rem">is available</span></div>'
          + '<div style="text-align:center;margin-top:1.25rem"><a href="/register?name=' + encodeURIComponent(name) + '" style="display:inline-block;padding:0.6rem 2rem;background:#00e676;color:#000;border-radius:8px;font-weight:700;font-size:1rem;text-decoration:none">Register</a></div>';
      } else {
        const res = await fetch('/api/resolve/' + encodeURIComponent(name)).then(r => r.json());
        result.innerHTML = '<div style="text-align:center"><span style="color:#fff;font-weight:700">' + escHtml(name) + '</span><span style="color:#ff5252">.hazza.name</span><br><span style="color:#ff5252;font-size:0.85rem">is taken</span></div>'
          + '<div style="text-align:center;margin-top:0.5rem;color:#6b8f6b;font-size:0.85rem">Owner: <a href="https://' + (CHAIN_ID === 84532 ? 'sepolia.basescan.org' : 'basescan.org') + '/address/' + escHtml(res.owner) + '" style="color:#6b8f6b">'
          + escHtml(res.owner.slice(0, 6) + '...' + res.owner.slice(-4)) + '</a></div>';
      }
    } catch (e) {
      result.textContent = 'Error checking name. Try again.';
    }
  }

  // --- Load name info ---
  async function loadName() {
    if (!nameParam) {
      // No name param — show search UI
      $('reg-search-section').style.display = 'block';
      $('reg-checkout-section').style.display = 'none';
      return;
    }
    $('reg-search-section').style.display = 'none';
    $('reg-checkout-section').style.display = 'block';
    $('reg-name').textContent = nameParam + '.hazza.name';
    try {
      const avail = await fetch('/api/available/' + encodeURIComponent(nameParam)).then(r => r.json());
      if (!avail.available) {
        $('reg-checkout-section').innerHTML = '<p style="color:#ff5252;text-align:center">' + escHtml(nameParam) + '.hazza.name is already taken. <a href="/register">Try another name</a></p>';
        return;
      }
      $('connect-section').style.display = 'block';
    } catch (e) {
      showStatus('Error loading name info. Try again.', true);
    }
  }

  // --- Wallet connect ---
  async function connectWallet() {
    if (!window.ethereum) {
      showStatus('No wallet detected. Please install MetaMask or another browser wallet.', true);
      return;
    }
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      userAddress = accounts[0];
      signer = await provider.getSigner();

      // Check chain
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + CHAIN_ID.toString(16) }],
          });
          provider = new ethers.BrowserProvider(window.ethereum);
          signer = await provider.getSigner();
        } catch (switchErr) {
          // Try adding the chain (works for 4902 and other wallet-specific error codes)
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x' + CHAIN_ID.toString(16),
                chainName: CHAIN_ID === 84532 ? 'Base Sepolia' : 'Base',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: [CHAIN_ID === 84532 ? 'https://sepolia.base.org' : 'https://mainnet.base.org'],
                blockExplorerUrls: [CHAIN_ID === 84532 ? 'https://sepolia.basescan.org' : 'https://basescan.org'],
              }],
            });
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
          } catch (addErr) {
            showStatus('Please add ' + (CHAIN_ID === 84532 ? 'Base Sepolia' : 'Base') + ' to your wallet and try again.', true);
            return;
          }
        }
      }

      try { sessionStorage.setItem('hazza_wallet', userAddress); } catch(e) {}

      // Hide connect section and pre-connect info entirely
      $('connect-section').style.display = 'none';
      var pci = $('pre-connect-info');
      if (pci) pci.style.display = 'none';

      // Check ENS name suggestions (non-blocking)
      fetch('/api/ens-names/' + userAddress).then(r => r.json()).then(function(data) {
        if (data.suggestions && data.suggestions.length > 0) {
          var s = data.suggestions[0];
          var box = $('ens-suggestion');
          if (s.available) {
            box.innerHTML = '<span style="color:#6b8f6b;font-size:0.85rem">Your ENS: <strong style="color:#fff">' + escHtml(s.ensSource) + '</strong></span><br>'
              + '<span style="color:#00e676;font-weight:700">' + escHtml(s.name) + '.hazza.name</span> is available! '
              + '<a href="/register?name=' + encodeURIComponent(s.name) + '" style="display:inline-block;padding:0.2rem 0.75rem;background:#00e676;color:#000;border-radius:6px;font-weight:700;font-size:0.8rem;text-decoration:none;margin-left:0.5rem">Claim it</a>';
            box.style.display = 'block';
            box.style.borderColor = '#00e676';
          } else {
            box.innerHTML = '<span style="color:#6b8f6b;font-size:0.85rem">Your ENS: <strong style="color:#fff">' + escHtml(s.ensSource) + '</strong></span><br>'
              + '<span style="color:#aaa;font-size:0.85rem">' + escHtml(s.name) + '.hazza.name is already registered</span>';
            box.style.display = 'block';
          }
        }
      }).catch(function() {});

      // Check free claim eligibility (non-blocking — falls back to paid)
      try {
        const fcRes = await fetch('/api/free-claim/' + userAddress);
        const fcData = await fcRes.json();
        if (fcData.eligible) {
          freeClaimEligible = true;
          freeClaimMemberId = fcData.memberId || 0;
          const banner = $('free-claim-banner');
          if (banner) {
            if (fcData.reason === 'first-registration') {
              banner.innerHTML = '<strong style="color:#00e676">Your first name is free!</strong> Just pay gas.';
            } else {
              banner.innerHTML = '<strong style="color:#00e676">1 free hazza name!</strong> Net Library ' + escHtml(fcData.memberName || '') + ' + Unlimited Pass';
            }
            banner.style.display = 'block';
          }
        }
      } catch(e) { /* non-fatal */ }

      // Load quote with wallet
      await loadQuote();

      $('checkout-section').style.display = 'block';
    } catch (e) {
      showStatus('Wallet connection failed: ' + (e.message || e), true);
    }
  }

  // --- Load quote via API ---
  async function loadQuote() {
    try {
      if (freeClaimEligible) {
        $('quote-total').textContent = 'FREE + gas';
        $('quote-total').style.color = '#00e676';
        totalCostRaw = 0n;
        return;
      }
      // Get price quote (read-only, no side effects)
      const quoteRes = await fetch('/api/quote/' + encodeURIComponent(nameParam) + '?wallet=' + userAddress + '&years=1');
      const quoteData = await quoteRes.json();
      if (quoteData.firstRegistration) {
        // First registration is free — set the flag and update UI
        freeClaimEligible = true;
        totalCostRaw = 0n;
        $('quote-total').textContent = 'FREE + gas';
        $('quote-total').style.color = '#00e676';
        const banner = $('free-claim-banner');
        if (banner) {
          banner.innerHTML = '<strong style="color:#00e676">Your first name is free!</strong> Just pay gas.';
          banner.style.display = 'block';
        }
        return;
      }
      totalCostRaw = BigInt(quoteData.totalRaw || '0');
      if (totalCostRaw > 0n) {
        $('quote-total').textContent = '$' + quoteData.total + ' USDC';
        // Get relayer address from x402 402 response
        const x402Res = await fetch('/x402/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: nameParam, owner: userAddress, years: 1 }),
        });
        if (x402Res.status === 402) {
          const x402Data = await x402Res.json();
          relayerAddress = x402Data.accepts[0].payTo;
        }
      } else {
        $('quote-total').textContent = quoteData.total || 'Error loading price';
      }
    } catch (e) {
      $('quote-total').textContent = 'Error loading price';
    }
  }

  // --- Checkout flow (x402: transfer USDC to relayer → server registers) ---
  async function checkout() {
    $('checkout-btn').disabled = true;
    $('checkout-steps').style.display = 'block';
    $('status').style.display = 'none';

    try {
      // --- Free claim path: no payment needed ---
      if (freeClaimEligible) {
        setStep(1, 'done'); // Skip payment step
        setStep(2, 'active');
        showStatus('Registering your free name...', false);

        const regRes = await fetch('/x402/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: nameParam, owner: userAddress, years: 1 }),
        });
        const regData = await regRes.json();
        if (!regRes.ok) {
          throw new Error(regData.error || regData.detail || 'Registration failed');
        }
        showSuccess(nameParam);
        return;
      }

      // --- Paid path ---
      if (!relayerAddress || !totalCostRaw) {
        showStatus('Price not loaded. Refresh and try again.', true);
        $('checkout-btn').disabled = false;
        return;
      }

      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);

      // Step 1: Check USDC balance
      setStep(1, 'active');
      showStatus('Checking balance...', false);
      const balance = await usdc.balanceOf(userAddress);
      if (balance < totalCostRaw) {
        showStatus('Insufficient USDC balance. Need ' + ethers.formatUnits(totalCostRaw, 6) + ' USDC.', true);
        setStep(1, 'error');
        $('checkout-btn').disabled = false;
        return;
      }

      // Step 1: Transfer USDC to relayer
      showStatus('Confirm USDC transfer in your wallet...', false);
      const transferTx = await usdc.transfer(relayerAddress, totalCostRaw);
      const receipt = await transferTx.wait();
      setStep(1, 'done');

      // Step 2: Submit payment proof to x402 endpoint
      setStep(2, 'active');
      showStatus('Registering your name...', false);
      const payment = btoa(JSON.stringify({
        scheme: 'exact',
        txHash: receipt.hash,
        from: userAddress,
      }));
      const regRes = await fetch('/x402/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT': payment,
        },
        body: JSON.stringify({ name: nameParam, owner: userAddress, years: 1 }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) {
        throw new Error(regData.error || regData.detail || 'Registration failed');
      }
      setStep(2, 'done');

      // Step 3: Done
      showSuccess(nameParam);

    } catch (e) {
      const msg = e.reason || e.message || 'Transaction failed';
      showStatus(msg, true);
      $('checkout-btn').disabled = false;
    }
  }

  // --- Init ---
  $('checkout-btn')?.addEventListener('click', checkout);
  const regSearchBtn = $('reg-search-btn');
  const regSearchInput = $('reg-search-input');
  if (regSearchBtn) regSearchBtn.addEventListener('click', regSearch);
  if (regSearchInput) regSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') regSearch(); });
  loadName();

  // Listen for wallet connections from nav bar
  window.addEventListener('hazza_wallet_connected', function(e) {
    if (e.detail && e.detail.address && !userAddress) {
      connectWallet();
    }
  });

  // Listen for disconnects
  window.addEventListener('hazza_wallet_disconnected', function() {
    userAddress = null; signer = null; provider = null;
    $('connect-section').style.display = 'block';
    $('checkout-section').style.display = 'none';
    var pci = $('pre-connect-info');
    if (pci) pci.style.display = '';
  });

  // Auto-reconnect: check nav global first, then sessionStorage
  function tryAutoReconnect() {
    // Check if nav already connected (handles race where event fired before listener)
    if (window.__hazza_wallet && !userAddress) {
      connectWallet();
      return true;
    }
    if (!window.ethereum) return false;
    var saved = null;
    try { saved = sessionStorage.getItem('hazza_wallet'); } catch(e) {}
    if (saved && !userAddress) {
      connectWallet();
      return true;
    }
    return false;
  }
  if (!tryAutoReconnect()) {
    setTimeout(function() {
      if (!tryAutoReconnect()) {
        setTimeout(function() { tryAutoReconnect(); }, 1500);
      }
    }, 500);
  }
  // EIP-6963 support
  window.addEventListener('eip6963:announceProvider', function() {
    if (!userAddress) tryAutoReconnect();
  });
`;

export function registerPage(registryAddress: string, usdcAddress: string, chainId: string): string {
  return shell(
    "hazza \u2014 immediately useful names",
    "Register a name. Get an onchain website, agent endpoint, and more \u2014 first name free.",
    `<div id="hazza-config" data-registry="${registryAddress}" data-usdc="${usdcAddress}" data-chainid="${chainId}" style="display:none"></div>

    <div class="header">
      <h1>register</h1>
      <p>claim your onchain name</p>
    </div>

    <!-- Free claim banner (shown for eligible Unlimited Pass + NL members) -->
    <div id="free-claim-banner" style="display:none;margin-bottom:1rem;padding:0.75rem 1rem;background:#0d1a0d;border:1px solid #00e676;border-radius:8px;text-align:center;color:#aaa;font-size:0.9rem">
    </div>

    <!-- ENS suggestion (shown after wallet connect if user has ENS) -->
    <div id="ens-suggestion" style="display:none;margin-bottom:1rem;padding:0.75rem 1rem;background:#0d1a0d;border:1px solid #1a2e1a;border-radius:8px;text-align:center">
    </div>

    <!-- Search section (shown when no ?name= param) -->
    <div id="reg-search-section" style="display:none">
      <div class="search-box">
        <input type="text" id="reg-search-input" placeholder="search for a name..." autocomplete="off" spellcheck="false">
        <button id="reg-search-btn">Search</button>
      </div>
      <div class="result" id="reg-search-result"></div>
      <div id="reg-pricing-info" style="margin-top:1.5rem;color:#6b8f6b;font-size:0.9rem;line-height:1.8;text-align:center">
        <p style="margin:0"><strong style="color:#00e676">your first name is <span style="color:#fff">free</span></strong></p>
        <p style="margin:0.25rem 0 0 0">just pay gas</p>
        <p style="margin:0.75rem 0 0 0;color:#fff;font-size:0.8rem">additional names $5+</p>
      </div>
    </div>

    <!-- Checkout section (shown when ?name= param is provided) -->
    <div id="reg-checkout-section" style="display:none">
    <div style="text-align:center;margin-bottom:0.5rem">
      <h2 id="reg-name" style="font-weight:900;color:#fff;font-size:1.5rem;word-break:break-word"></h2>
    </div>

    <div id="pre-connect-info" style="text-align:center;margin-bottom:1.5rem">
      <p style="color:#6b8f6b;font-size:0.9rem;margin:0 0 0.25rem 0">your first name is free — just pay gas</p>
      <p style="color:#fff;font-size:0.8rem;margin:0">additional names $5+</p>
    </div>

    <div id="connect-section" style="display:none;text-align:center;margin-bottom:1.5rem">
      <p style="color:#444;font-size:0.85rem">tap <strong style="color:#00e676">connect</strong> in the menu to continue</p>
    </div>

    <div id="checkout-section" style="display:none">
      <div class="section" style="margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
          <span style="color:#6b8f6b">Total</span>
          <span id="quote-total" style="color:#fff;font-weight:700;font-size:1.2rem"></span>
        </div>
        <div id="quote-details"></div>
      </div>

      <div style="text-align:center;margin-bottom:1.5rem">
        <button id="checkout-btn" style="padding:0.75rem 2.5rem;background:#00e676;color:#000;border:none;border-radius:8px;font-weight:700;font-size:1rem;cursor:pointer;font-family:'Rubik',sans-serif">Register Name</button>
      </div>

      <div id="checkout-steps" style="display:none">
        <div id="step-1" class="checkout-step pending">
          <span class="step-icon"></span>
          <span>transfer USDC</span>
        </div>
        <div id="step-2" class="checkout-step pending">
          <span class="step-icon"></span>
          <span>register name</span>
        </div>
        <div id="step-3" class="checkout-step pending">
          <span class="step-icon"></span>
          <span>done</span>
        </div>
      </div>

      <div id="status" style="display:none;text-align:center;padding:0.75rem;font-size:0.9rem;margin-top:1rem"></div>

      <div id="success-section" style="display:none;text-align:center;margin-top:2rem;padding:1.5rem;background:#0d1a0d;border:1px solid #00e676;border-radius:12px">
        <p style="color:#00e676;font-weight:900;font-size:1.4rem;margin-bottom:0.5rem">registered!</p>
        <p id="success-name" style="color:#fff;font-weight:700;font-size:1.1rem;margin-bottom:1rem"></p>
        <a id="success-link" href="#" style="display:inline-block;padding:0.75rem 2rem;background:#00e676;color:#000;border-radius:8px;font-weight:700;text-decoration:none;margin-bottom:0.75rem">view your page</a>
        <div style="margin-top:0.75rem">
          <a href="/dashboard" style="color:#6b8f6b;font-size:0.85rem">go to dashboard &rarr;</a>
        </div>
        <div style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid #1a2e1a">
          <a href="/register" style="display:inline-block;padding:0.6rem 1.5rem;background:transparent;color:#00e676;border:1px solid #00e676;border-radius:8px;font-weight:700;text-decoration:none;font-size:0.9rem">register another name</a>
        </div>
      </div>
    </div>
    </div>`,
    REGISTER_SCRIPT,
    { externalScripts: [ETHERS_CDN] }
  );
}

// =========================================================================
//                        MANAGE PAGE
// =========================================================================

const MANAGE_SCRIPT = `
  const cfg = document.getElementById('hazza-config');
  const REGISTRY = cfg.dataset.registry;
  const USDC_ADDRESS = cfg.dataset.usdc;
  const CHAIN_ID = parseInt(cfg.dataset.chainid);
  const rawNameParam = new URLSearchParams(window.location.search).get('name') || '';
  const nameParam = rawNameParam.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);

  function escHtml(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  const REGISTRY_ABI = [
    "function setText(string name, string key, string value) external",
    "function setOperator(string name, address operator) external",
    "function setPrimaryName(string name) external",
    "function setCustomDomain(string name, string domain) external",
    "function registerAgent(string name, string agentURI, address agentWallet) external",
    "function generateApiKey(string name, bytes32 salt) external returns (bytes32)",
    "function quoteName(string name, address wallet, uint8 charCount, bool ensImport, bool verifiedPass) view returns (uint256 totalCost, uint256 registrationFee)",
    "function transferFrom(address from, address to, uint256 tokenId) external",
    "function resolve(string name) view returns (address owner, uint256 tokenId, uint256 registeredAt, address operator, uint256 agentId, address agentWallet)"
  ];
  const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
  ];

  let provider, signer, userAddress, profileData, currentTokenId;

  const $ = id => document.getElementById(id);

  function showMsg(msg, isError) {
    const el = $('manage-status');
    el.textContent = msg;
    el.style.color = isError ? '#ff5252' : '#00e676';
    el.style.display = 'block';
    if (!isError) setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  // --- Load profile ---
  async function loadProfile() {
    if (!nameParam) {
      $('manage-body').innerHTML = '<p style="color:#ff5252;text-align:center">No name specified. <a href="/">Search for a name</a></p>';
      return;
    }
    $('manage-name').textContent = nameParam + '.hazza.name';
    try {
      const res = await fetch('/api/profile/' + encodeURIComponent(nameParam));
      profileData = await res.json();
      if (!profileData.registered) {
        $('manage-body').innerHTML = '<p style="color:#ff5252;text-align:center">' + escHtml(nameParam) + '.hazza.name is not registered. <a href="/register?name=' + encodeURIComponent(nameParam) + '">Register it</a></p>';
        return;
      }

      // Fill current values
      const t = profileData.texts || {};
      if (t.description) $('field-description').value = t.description;
      if (t.avatar) $('field-avatar').value = t.avatar;
      if (t.url) $('field-url').value = t.url;
      if (t['com.twitter']) $('field-twitter').value = t['com.twitter'];
      if (t['xyz.farcaster']) $('field-farcaster').value = t['xyz.farcaster'];
      if (t['com.github']) $('field-github').value = t['com.github'];
      if (t['org.telegram']) $('field-telegram').value = t['org.telegram'];
      if (t['com.discord']) $('field-discord').value = t['com.discord'];
      if (t['com.linkedin']) $('field-linkedin').value = t['com.linkedin'];
      if (t['xmtp']) $('field-xmtp').value = t['xmtp'];

      // Status info
      $('info-status').textContent = profileData.status;
      $('info-owner').textContent = profileData.owner.slice(0, 6) + '...' + profileData.owner.slice(-4);

      // Store tokenId for transfer
      currentTokenId = profileData.tokenId;

      // If wallet is already connected (from nav or session), auto-connect now that profile is loaded
      if (!userAddress && (window.__hazza_wallet || sessionStorage.getItem('hazza_wallet'))) {
        connectWallet();
      } else if (!userAddress) {
        $('connect-section').style.display = 'block';
      }
    } catch (e) {
      showMsg('Error loading profile.', true);
    }
  }

  // --- Connect wallet ---
  async function connectWallet() {
    if (!window.ethereum) {
      showMsg('No wallet detected. Install MetaMask or another browser wallet.', true);
      return;
    }
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      userAddress = accounts[0];
      signer = await provider.getSigner();

      const network = await provider.getNetwork();
      if (Number(network.chainId) !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + CHAIN_ID.toString(16) }],
          });
          provider = new ethers.BrowserProvider(window.ethereum);
          signer = await provider.getSigner();
        } catch (switchErr) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x' + CHAIN_ID.toString(16),
                chainName: CHAIN_ID === 84532 ? 'Base Sepolia' : 'Base',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: [CHAIN_ID === 84532 ? 'https://sepolia.base.org' : 'https://mainnet.base.org'],
                blockExplorerUrls: [CHAIN_ID === 84532 ? 'https://sepolia.basescan.org' : 'https://basescan.org'],
              }],
            });
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
          } catch (addErr) {
            showMsg('Please add ' + (CHAIN_ID === 84532 ? 'Base Sepolia' : 'Base') + ' to your wallet and try again.', true);
            return;
          }
        }
      }

      try { sessionStorage.setItem('hazza_wallet', userAddress); } catch(e) {}

      // Wait for profile data if not loaded yet
      if (!profileData || !profileData.owner) {
        $('connect-section').style.display = 'none';
        showMsg('Loading profile...', false);
        return;
      }

      // Check if connected wallet is owner or operator
      const isOwner = userAddress.toLowerCase() === profileData.owner.toLowerCase();
      const isOperator = profileData.operator && userAddress.toLowerCase() === profileData.operator.toLowerCase();
      if (!isOwner && !isOperator) {
        showMsg('Connected wallet is not the owner or operator of this name.', true);
        return;
      }

      // Hide connect button, show edit sections
      $('connect-section').style.display = 'none';
      $('edit-section').style.display = 'block';
      $('actions-section').style.display = 'block';

      // Only owner can transfer (not operators)
      if (isOwner) {
        $('transfer-section').style.display = 'block';
        // Load offers for this name
        loadNameOffers();
      }

      // Load My Names
      loadMyNames();
    } catch (e) {
      showMsg('Wallet connection failed: ' + (e.message || e), true);
    }
  }

  // --- My Names ---
  async function loadMyNames() {
    const container = $('my-names');
    if (!container) return;
    container.style.display = 'block';
    const list = $('my-names-list');
    list.innerHTML = '<span style="color:#888;font-size:0.85rem">Loading...</span>';
    try {
      const res = await fetch('/api/names/' + encodeURIComponent(userAddress));
      const data = await res.json();
      if (!data.names || data.names.length === 0) {
        list.innerHTML = '<span style="color:#888;font-size:0.85rem">No names found for this wallet.</span>';
        return;
      }
      let html = '';
      for (const n of data.names) {
        const isCurrent = n.name === nameParam;
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0.75rem;background:#111;border:1px solid ' + (isCurrent ? '#00e676' : '#1a2e1a') + ';border-radius:6px;margin-bottom:0.35rem">';
        html += '<a href="https://' + escHtml(n.name) + '.hazza.name" style="color:#fff;font-weight:' + (isCurrent ? '700' : '400') + ';font-size:0.9rem">' + escHtml(n.name) + '<span style="color:#00e676">.hazza.name</span></a>';
        html += '<div style="display:flex;gap:0.5rem">';
        if (!isCurrent) html += '<a href="https://hazza.name/manage?name=' + encodeURIComponent(n.name) + '" style="color:#6b8f6b;font-size:0.75rem;border:1px solid #1a2e1a;padding:0.15rem 0.5rem;border-radius:4px">Manage</a>';
        else html += '<span style="color:#00e676;font-size:0.75rem;padding:0.15rem 0.5rem">Current</span>';
        html += '</div></div>';
      }
      if (data.total > 50) html += '<span style="color:#888;font-size:0.8rem">Showing 50 of ' + data.total + ' names</span>';
      list.innerHTML = html;
    } catch (e) {
      list.innerHTML = '<span style="color:#ff5252;font-size:0.85rem">Error loading names.</span>';
    }
  }

  // --- Save a text record ---
  async function saveField(key, inputId) {
    const value = $(inputId).value.trim();
    const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
    try {
      showMsg('Saving ' + key + '...', false);
      const tx = await registry.setText(nameParam, key, value);
      await tx.wait();
      showMsg(key + ' saved!', false);
    } catch (e) {
      showMsg('Error: ' + (e.reason || e.message || e), true);
    }
  }

  // --- Set primary name ---
  async function setPrimary() {
    const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
    try {
      showMsg('Setting primary name...', false);
      const tx = await registry.setPrimaryName(nameParam);
      await tx.wait();
      showMsg('Primary name set!', false);
    } catch (e) {
      showMsg('Error: ' + (e.reason || e.message || e), true);
    }
  }

  // --- Set operator ---
  async function saveOperator() {
    const addr = $('field-operator').value.trim();
    if (!ethers.isAddress(addr)) { showMsg('Invalid address.', true); return; }
    const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
    try {
      showMsg('Setting operator...', false);
      const tx = await registry.setOperator(nameParam, addr);
      await tx.wait();
      showMsg('Operator set!', false);
    } catch (e) {
      showMsg('Error: ' + (e.reason || e.message || e), true);
    }
  }

  // --- Set custom domain ---
  async function saveDomain() {
    const domain = $('field-domain').value.trim();
    if (!domain) { showMsg('Enter a domain.', true); return; }
    const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
    try {
      showMsg('Setting custom domain...', false);
      const tx = await registry.setCustomDomain(nameParam, domain);
      await tx.wait();
      showMsg('Custom domain set!', false);
    } catch (e) {
      showMsg('Error: ' + (e.reason || e.message || e), true);
    }
  }

  // --- Transfer name ---
  async function transferName() {
    const to = $('transfer-to').value.trim();
    const statusEl = $('transfer-status');
    if (!to || !ethers.isAddress(to)) {
      statusEl.style.color = '#ff5252';
      statusEl.textContent = 'Enter a valid wallet address (0x...)';
      return;
    }
    if (to.toLowerCase() === userAddress.toLowerCase()) {
      statusEl.style.color = '#ff5252';
      statusEl.textContent = 'Cannot transfer to yourself';
      return;
    }
    if (!confirm('Transfer ' + nameParam + '.hazza.name to ' + to.slice(0,6) + '...' + to.slice(-4) + '? This is irreversible.')) return;
    const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
    try {
      statusEl.style.color = '#6b8f6b';
      statusEl.textContent = 'Sending transfer...';
      const tx = await registry.transferFrom(userAddress, to, currentTokenId);
      statusEl.textContent = 'Confirming...';
      await tx.wait();
      statusEl.style.color = '#00e676';
      statusEl.textContent = 'Transferred! Redirecting...';
      setTimeout(() => { window.location.href = '/dashboard'; }, 2000);
    } catch (e) {
      statusEl.style.color = '#ff5252';
      statusEl.textContent = e.reason || e.message || 'Transfer failed';
    }
  }

  // --- Load offers for this name ---
  async function loadNameOffers() {
    const offersSection = $('offers-section');
    const offersList = $('name-offers-list');
    if (!offersSection || !offersList) return;
    try {
      const res = await fetch('/api/marketplace/offers/' + encodeURIComponent(nameParam));
      const data = await res.json();
      const offers = data.offers || [];
      offersSection.style.display = 'block';
      if (offers.length === 0) {
        offersList.innerHTML = '<p style="color:#444;font-size:0.85rem">No offers on this name yet.</p>';
        return;
      }
      let html = '';
      offers.forEach(function(o) {
        const brokerTag = o.broker ? ' <span style="font-size:0.65rem;background:#1a2e1a;color:#00e676;padding:0.1rem 0.3rem;border-radius:4px">brokered</span>' : '';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0;border-bottom:1px solid #1a2e1a">'
          + '<div>'
          + '<span style="font-weight:700;color:#00e676">' + escHtml(String(o.price)) + ' ' + escHtml(o.currency || 'ETH') + '</span>' + brokerTag
          + '<div style="font-size:0.75rem;color:#6b8f6b">From: ' + (o.offerer ? escHtml(o.offerer.slice(0,6) + '...' + o.offerer.slice(-4)) : '?') + ' · Expires: ' + (o.expiresAt ? new Date(o.expiresAt * 1000).toLocaleDateString() : '—') + '</div>'
          + '</div>'
          + '<a href="/marketplace?tab=offers" style="padding:0.4rem 1rem;background:#00e676;color:#000;border-radius:6px;font-weight:700;font-size:0.8rem;text-decoration:none">View</a>'
          + '</div>';
      });
      offersList.innerHTML = html;
    } catch(e) {
      offersList.innerHTML = '<p style="color:#ff5252;font-size:0.85rem">Failed to load offers</p>';
    }
  }

  // --- Register agent ---
  async function registerAgent() {
    const uri = $('field-agent-uri').value.trim();
    const wallet = $('field-agent-wallet').value.trim();
    if (!uri) { showMsg('Enter an agent URI.', true); return; }
    if (wallet && !ethers.isAddress(wallet)) { showMsg('Invalid agent wallet address.', true); return; }
    const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
    try {
      showMsg('Registering agent...', false);
      const tx = await registry.registerAgent(nameParam, uri, wallet || ethers.ZeroAddress);
      await tx.wait();
      showMsg('Agent registered!', false);
    } catch (e) {
      showMsg('Error: ' + (e.reason || e.message || e), true);
    }
  }

  // --- Generate API Key ---
  async function generateKey() {
    const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
    try {
      showMsg('Generating API key (confirm in wallet)...', false);
      const salt = ethers.randomBytes(32);
      const saltHex = ethers.hexlify(salt);
      const tx = await registry.generateApiKey(nameParam, saltHex);
      const receipt = await tx.wait();

      // Reconstruct rawKey: keccak256(abi.encodePacked(name, msg.sender, salt, block.timestamp))
      const block = await provider.getBlock(receipt.blockNumber);
      const rawKey = ethers.keccak256(ethers.solidityPacked(
        ['string', 'address', 'bytes32', 'uint256'],
        [nameParam, userAddress, saltHex, block.timestamp]
      ));

      $('api-key-display').style.display = 'block';
      $('api-key-value').textContent = rawKey;
      $('api-key-note').innerHTML = 'This is your API key. <strong style="color:#ff5252">Copy it now — it cannot be shown again.</strong><br>Use it with: <code style="color:#00e676">Authorization: Bearer ' + rawKey + '</code>';
      showMsg('API key generated!', false);
    } catch (e) {
      showMsg('Error: ' + (e.reason || e.message || e), true);
    }
  }

  // --- Copy to clipboard ---
  function copyKey() {
    const val = $('api-key-value').textContent;
    navigator.clipboard.writeText(val).then(() => {
      showMsg('Copied!', false);
    });
  }

  // --- NFT Avatar Picker ---
  function openNftPicker() {
    if (!userAddress) { showMsg('Connect your wallet first.', true); return; }
    const picker = $('nft-picker');
    const grid = $('nft-grid');
    const status = $('nft-picker-status');
    picker.style.display = 'block';
    grid.innerHTML = '';
    status.textContent = 'Loading NFTs...';
    fetch('/api/nfts/' + encodeURIComponent(userAddress))
      .then(r => r.json())
      .then(data => {
        if (!data.nfts || data.nfts.length === 0) {
          status.textContent = 'No NFTs found in your wallet.';
          return;
        }
        status.textContent = data.nfts.length + ' NFT' + (data.nfts.length === 1 ? '' : 's') + ' found';
        let html = '';
        for (const nft of data.nfts) {
          html += '<div style="cursor:pointer;position:relative" title="' + escHtml(nft.name || nft.collection + ' #' + nft.tokenId) + '">';
          html += '<img src="' + escHtml(nft.image) + '" onclick="selectNft(this.src)" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:2px solid transparent;display:block" onmouseover="this.style.borderColor=\\x27#00e676\\x27" onmouseout="this.style.borderColor=\\x27transparent\\x27" onerror="this.parentElement.style.display=\\x27none\\x27">';
          html += '</div>';
        }
        grid.innerHTML = html;
      })
      .catch(() => { status.textContent = 'Error loading NFTs.'; });
  }

  function selectNft(imageUrl) {
    $('field-avatar').value = imageUrl;
    closeNftPicker();
    showMsg('Avatar URL set. Click Save to store it onchain.', false);
  }

  function closeNftPicker() {
    $('nft-picker').style.display = 'none';
  }

  // --- Init ---
  if (nameParam) {
    const pl = $('profile-link');
    if (pl) { pl.href = 'https://' + nameParam + '.hazza.name'; }
  }
  loadProfile();

  // Listen for wallet connections from nav bar
  window.addEventListener('hazza_wallet_connected', function(e) {
    if (e.detail && e.detail.address && !userAddress) {
      connectWallet();
    }
  });

  // Listen for disconnects
  window.addEventListener('hazza_wallet_disconnected', function() {
    userAddress = null; signer = null; provider = null;
    $('connect-section').style.display = 'block';
    $('my-names').style.display = 'none';
    $('text-records').style.display = 'none';
  });

  // Auto-reconnect: check nav global first, then sessionStorage
  function tryAutoReconnect() {
    if (window.__hazza_wallet && !userAddress) {
      connectWallet();
      return true;
    }
    if (!window.ethereum) return false;
    var saved = null;
    try { saved = sessionStorage.getItem('hazza_wallet'); } catch(e) {}
    if (saved && !userAddress) {
      connectWallet();
      return true;
    }
    return false;
  }
  if (!tryAutoReconnect()) {
    setTimeout(function() {
      if (!tryAutoReconnect()) {
        setTimeout(function() { tryAutoReconnect(); }, 1500);
      }
    }, 500);
  }
  window.addEventListener('eip6963:announceProvider', function() {
    if (!userAddress) tryAutoReconnect();
  });
`;

export function managePage(registryAddress: string, usdcAddress: string, chainId: string): string {
  const fieldRow = (label: string, key: string, inputId: string, placeholder: string) => `
    <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;flex-wrap:wrap">
      <label style="color:#6b8f6b;font-size:0.85rem;min-width:80px">${label}</label>
      <input id="${inputId}" type="text" placeholder="${placeholder}" style="flex:1;min-width:150px;padding:0.5rem 0.75rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.9rem;font-family:'Rubik',sans-serif;outline:none">
      <button onclick="saveField('${key}','${inputId}')" style="padding:0.5rem 1rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.8rem;font-family:'Rubik',sans-serif;white-space:nowrap">Save</button>
    </div>`;

  return shell(
    "hazza \u2014 immediately useful names",
    "Manage your name. Edit your profile, set text records, and configure your onchain identity.",
    `<div id="hazza-config" data-registry="${registryAddress}" data-usdc="${usdcAddress}" data-chainid="${chainId}" style="display:none"></div>
    <div id="manage-body">
    <div class="header">
      <h1 id="manage-name" style="word-break:break-word"></h1>
    </div>

    <div style="display:flex;justify-content:center;gap:2rem;margin-bottom:1.5rem;font-size:0.85rem">
      <div><span style="color:#6b8f6b">Status</span> <span id="info-status" style="color:#fff"></span></div>
      <div><span style="color:#6b8f6b">Owner</span> <span id="info-owner" style="color:#fff"></span></div>
    </div>

    <div id="connect-section" style="display:none;text-align:center;margin-bottom:1.5rem">
      <p style="color:#6b8f6b">connect your wallet to manage this name</p>
      <p style="color:#444;font-size:0.85rem">tap <strong style="color:#00e676">connect</strong> in the menu above</p>
    </div>

    <div id="manage-status" style="display:none;text-align:center;padding:0.75rem;font-size:0.9rem;margin-bottom:1rem"></div>

    <div id="my-names" style="display:none;margin-bottom:1.5rem">
      <div class="section">
        <div class="section-title">My Names</div>
        <div id="my-names-list"></div>
      </div>
    </div>

    <div id="edit-section" style="display:none">
      <p style="color:#6b8f6b;font-size:0.8rem;margin-bottom:1rem">
        Setting text records costs Base gas (~$0.01 per transaction). Changes are onchain and permanent.
      </p>
      <div class="section">
        <div class="section-title">Profile</div>
        ${fieldRow("Bio", "description", "field-description", "A short bio...")}
        <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;flex-wrap:wrap">
          <label style="color:#6b8f6b;font-size:0.85rem;min-width:80px">Avatar</label>
          <input id="field-avatar" type="text" placeholder="https://... image URL" style="flex:1;min-width:150px;padding:0.5rem 0.75rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.9rem;font-family:'Rubik',sans-serif;outline:none">
          <button onclick="saveField('avatar','field-avatar')" style="padding:0.5rem 1rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.8rem;font-family:'Rubik',sans-serif;white-space:nowrap">Save</button>
          <button onclick="openNftPicker()" style="padding:0.5rem 0.75rem;background:#111;color:#6b8f6b;border:1px solid #1a2e1a;border-radius:6px;font-size:0.8rem;cursor:pointer;font-family:'Rubik',sans-serif;white-space:nowrap" title="Browse your NFTs">NFTs</button>
        </div>
        <div id="nft-picker" style="display:none;margin-bottom:1rem;padding:1rem;background:#0d1a0d;border:1px solid #1a2e1a;border-radius:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
            <span style="color:#6b8f6b;font-size:0.85rem">Select an NFT as your avatar</span>
            <button onclick="closeNftPicker()" style="background:transparent;border:none;color:#6b8f6b;font-size:1.2rem;cursor:pointer;padding:0 0.25rem">&times;</button>
          </div>
          <div id="nft-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:0.5rem"></div>
          <div id="nft-picker-status" style="text-align:center;color:#6b8f6b;font-size:0.8rem;margin-top:0.5rem"></div>
        </div>
        ${fieldRow("Website", "url", "field-url", "https://...")}
      </div>

      <div class="section">
        <div class="section-title">Socials</div>
        ${fieldRow("Twitter", "com.twitter", "field-twitter", "@handle")}
        ${fieldRow("Farcaster", "xyz.farcaster", "field-farcaster", "@handle")}
        ${fieldRow("GitHub", "com.github", "field-github", "username")}
        ${fieldRow("Telegram", "org.telegram", "field-telegram", "username")}
        ${fieldRow("Discord", "com.discord", "field-discord", "username#1234")}
        ${fieldRow("LinkedIn", "com.linkedin", "field-linkedin", "username")}
        ${fieldRow("XMTP", "xmtp", "field-xmtp", "0x... XMTP-enabled address")}
        <p style="color:#555;font-size:0.7rem;margin-top:-0.25rem;margin-bottom:0.5rem">Set your XMTP address to enable private DMs on your profile. <a href="https://xmtp.org" style="color:#7c3aed" target="_blank" rel="noopener">What is XMTP?</a></p>
      </div>
    </div>

    <div id="actions-section" style="display:none">
      <hr class="divider">

      <div class="section">
        <div class="section-title">Primary Name</div>
        <p style="color:#aaa;font-size:0.85rem;margin-bottom:0.75rem">Set this as the primary name for your wallet (reverse resolution).</p>
        <button onclick="setPrimary()" style="padding:0.5rem 1.5rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.85rem;font-family:'Rubik',sans-serif">Set as Primary</button>
      </div>

      <hr class="divider">

      <div class="section">
        <div class="section-title">Operator</div>
        <p style="color:#aaa;font-size:0.85rem;margin-bottom:0.75rem">Grant another address permission to manage this name's records.</p>
        <div style="display:flex;gap:0.5rem;align-items:center">
          <input id="field-operator" type="text" placeholder="0x..." style="flex:1;padding:0.5rem 0.75rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.9rem;font-family:'Rubik',monospace;outline:none">
          <button onclick="saveOperator()" style="padding:0.5rem 1rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.85rem;font-family:'Rubik',sans-serif">Set</button>
        </div>
      </div>

      <hr class="divider">

      <div class="section">
        <div class="section-title">Custom Domain</div>
        <p style="color:#aaa;font-size:0.85rem;margin-bottom:0.75rem">Link a custom domain to resolve to this name.</p>
        <div style="display:flex;gap:0.5rem;align-items:center">
          <input id="field-domain" type="text" placeholder="example.com" style="flex:1;padding:0.5rem 0.75rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.9rem;font-family:'Rubik',sans-serif;outline:none">
          <button onclick="saveDomain()" style="padding:0.5rem 1rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.85rem;font-family:'Rubik',sans-serif">Set</button>
        </div>
      </div>

      <hr class="divider">

      <div class="section">
        <div class="section-title">Website</div>
        <p style="color:#aaa;font-size:0.85rem;margin-bottom:0.75rem">Host a custom website on your subdomain via <a href="https://netprotocol.app">Net Protocol</a>. Upload HTML to Net Protocol, then paste the storage key here.</p>
        <div style="display:flex;gap:0.5rem;align-items:center">
          <input id="field-sitekey" type="text" placeholder="my-site-key" style="flex:1;padding:0.5rem 0.75rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.9rem;font-family:'Rubik',sans-serif;outline:none">
          <button onclick="saveField('site.key','field-sitekey')" style="padding:0.5rem 1rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.85rem;font-family:'Rubik',sans-serif">Set</button>
        </div>
        <p style="color:#6b8f6b;font-size:0.75rem;margin-top:0.5rem">Your subdomain will serve the HTML directly instead of the profile page.</p>
      </div>

      <hr class="divider">

      <div class="section">
        <div class="section-title">AI Agent (ERC-8004)</div>
        <p style="color:#aaa;font-size:0.85rem;margin-bottom:0.75rem">Register an AI agent for this name. Once registered, the agent ID is permanent.</p>
        <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem">
          <label style="color:#6b8f6b;font-size:0.85rem;min-width:80px">Agent URI</label>
          <input id="field-agent-uri" type="text" placeholder="https://... agent metadata" style="flex:1;padding:0.5rem 0.75rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.9rem;font-family:'Rubik',sans-serif;outline:none">
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.75rem">
          <label style="color:#6b8f6b;font-size:0.85rem;min-width:80px">Wallet</label>
          <input id="field-agent-wallet" type="text" placeholder="0x... (optional)" style="flex:1;padding:0.5rem 0.75rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.9rem;font-family:'Rubik',monospace;outline:none">
        </div>
        <button onclick="registerAgent()" style="padding:0.5rem 1.5rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.85rem;font-family:'Rubik',sans-serif">Register Agent</button>
      </div>

      <hr class="divider">

      <div class="section">
        <div class="section-title">Badges & Identity</div>
        <p style="color:#aaa;font-size:0.85rem;margin-bottom:0.75rem">Link your onchain identity to display badges and data on your profile.</p>
        <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem">
          <label style="color:#6b8f6b;font-size:0.85rem;min-width:110px">Helixa ID</label>
          <input id="field-helixa-id" type="text" placeholder="e.g. 57" style="flex:1;padding:0.5rem 0.75rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.9rem;font-family:'Rubik',sans-serif;outline:none">
          <button onclick="saveField('helixa.id','field-helixa-id')" style="padding:0.5rem 0.75rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.8rem;font-family:'Rubik',sans-serif">Save</button>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem">
          <label style="color:#6b8f6b;font-size:0.85rem;min-width:110px">Net Library #</label>
          <input id="field-netlibrary-member" type="text" placeholder="e.g. 1" style="flex:1;padding:0.5rem 0.75rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.9rem;font-family:'Rubik',sans-serif;outline:none">
          <button onclick="saveField('netlibrary.member','field-netlibrary-member')" style="padding:0.5rem 0.75rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.8rem;font-family:'Rubik',sans-serif">Save</button>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem">
          <label style="color:#6b8f6b;font-size:0.85rem;min-width:110px">Net Profile Key</label>
          <input id="field-net-profile" type="text" placeholder="storedon.net URL or key" style="flex:1;padding:0.5rem 0.75rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.9rem;font-family:'Rubik',sans-serif;outline:none">
          <button onclick="saveField('net.profile','field-net-profile')" style="padding:0.5rem 0.75rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.8rem;font-family:'Rubik',sans-serif">Save</button>
        </div>
        <p style="color:#555;font-size:0.75rem;margin-top:0.5rem">Exoskeleton ownership is auto-detected from your wallet. Unlimited Pass badge appears automatically.</p>
      </div>

      <hr class="divider">

      <div class="section">
        <div class="section-title">API Access</div>
        <p style="color:#aaa;font-size:0.85rem;margin-bottom:0.75rem">
          Generate an API key to manage this name programmatically.
          Bots, CLIs, and other services can use the key to set text records, update your domain, and more &mdash; no wallet needed.
        </p>
        <button onclick="generateKey()" style="padding:0.5rem 1.5rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.85rem;font-family:'Rubik',sans-serif">Generate API Key</button>
        <div id="api-key-display" style="display:none;margin-top:1rem;padding:1rem;background:#0d1a0d;border:1px solid #00e676;border-radius:8px">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
            <code id="api-key-value" style="color:#00e676;font-size:0.8rem;word-break:break-all;flex:1"></code>
            <button onclick="copyKey()" style="padding:0.3rem 0.75rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:4px;font-size:0.75rem;cursor:pointer;white-space:nowrap">Copy</button>
          </div>
          <p id="api-key-note" style="color:#aaa;font-size:0.8rem;line-height:1.5"></p>
        </div>
        <p style="color:#6b8f6b;font-size:0.8rem;margin-top:0.75rem">
          See <a href="/docs#write-api">API docs</a> for endpoints and examples.
        </p>
      </div>

      <hr class="divider">


      <div id="offers-section" style="display:none">
        <div class="section">
          <div class="section-title">Offers</div>
          <div id="name-offers-list" style="color:#6b8f6b;font-size:0.85rem">Loading offers...</div>
        </div>
        <hr class="divider">
      </div>

      <div id="transfer-section" style="display:none">
        <div class="section">
          <div class="section-title">Transfer</div>
          <p style="color:#6b8f6b;font-size:0.85rem;margin-bottom:0.75rem">Transfer ownership of this name to another wallet. This is irreversible.</p>
          <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
            <input id="transfer-to" type="text" placeholder="0x... recipient address" style="flex:1;min-width:200px;padding:0.5rem 0.75rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.9rem;font-family:'Rubik',sans-serif;outline:none">
            <button onclick="transferName()" style="padding:0.5rem 1.5rem;background:#ff5252;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.85rem;font-family:'Rubik',sans-serif">Transfer</button>
          </div>
          <p id="transfer-status" style="font-size:0.8rem;margin-top:0.5rem;color:#6b8f6b"></p>
        </div>
        <hr class="divider">
      </div>

      <div style="text-align:center;margin:1.5rem 0">
        <a id="profile-link" href="#" style="color:#6b8f6b;font-size:0.85rem">view page &rarr;</a>
      </div>
    </div>
    </div>`,
    MANAGE_SCRIPT,
    { externalScripts: [ETHERS_CDN] }
  );
}

// =========================================================================
//                        DASHBOARD PAGE
// =========================================================================

const DASHBOARD_SCRIPT = `
  const cfg = document.getElementById('hazza-config');
  const REGISTRY = cfg.dataset.registry;
  const USDC_ADDRESS = cfg.dataset.usdc;
  const CHAIN_ID = parseInt(cfg.dataset.chainid);

  function escHtml(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  const REGISTRY_ABI = [
    "function primaryName(address wallet) view returns (bytes32)",
    "function quoteName(string name, address wallet, uint8 charCount, bool ensImport, bool verifiedPass) view returns (uint256 totalCost, uint256 registrationFee)",
    "function transferFrom(address from, address to, uint256 tokenId) external",
    "function resolve(string name) view returns (address owner, uint256 tokenId, uint256 registeredAt, address operator, uint256 agentId, address agentWallet)",
    "function registerNamespace(string name) external",
    "function issueSubname(string namespace, string subname, address subnameOwner) external",
    "function setText(string name, string key, string value) external",
    "function setPrimaryName(string name) external"
  ];
  const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
  ];

  let provider, signer, userAddress;
  var signerAvailable = false;
  const $ = id => document.getElementById(id);

  function showStatus(msg, isError) {
    const el = $('dash-status');
    el.textContent = msg;
    el.style.color = isError ? '#ff5252' : '#00e676';
    el.style.display = msg ? 'block' : 'none';
  }

  async function connectWallet() {
    if (!window.ethereum) {
      showStatus('No wallet detected. Please install MetaMask or another browser wallet.', true);
      return;
    }
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      userAddress = accounts[0];
      signer = await provider.getSigner();

      const network = await provider.getNetwork();
      if (Number(network.chainId) !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + CHAIN_ID.toString(16) }],
          });
          provider = new ethers.BrowserProvider(window.ethereum);
          signer = await provider.getSigner();
        } catch (switchErr) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x' + CHAIN_ID.toString(16),
                chainName: CHAIN_ID === 84532 ? 'Base Sepolia' : 'Base',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: [CHAIN_ID === 84532 ? 'https://sepolia.base.org' : 'https://mainnet.base.org'],
                blockExplorerUrls: [CHAIN_ID === 84532 ? 'https://sepolia.basescan.org' : 'https://basescan.org'],
              }],
            });
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
          } catch (addErr) {
            showStatus('Please add ' + (CHAIN_ID === 84532 ? 'Base Sepolia' : 'Base') + ' to your wallet and try again.', true);
            return;
          }
        }
      }

      signerAvailable = true;
      try { sessionStorage.setItem('hazza_wallet', userAddress); } catch(e) {}
      $('connect-section').style.display = 'none';
      $('dash-content').style.display = 'block';
      loadNames();
    } catch (e) {
      showStatus('Wallet connection failed: ' + (e.message || e), true);
    }
  }

  async function loadNames() {
    const list = $('names-list');
    list.innerHTML = '<span style="color:#888;font-size:0.85rem">loading...</span>';
    try {
      const res = await fetch('/api/names/' + encodeURIComponent(userAddress));
      const data = await res.json();
      if (!data.names || data.names.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:2rem 0">'
          + '<p style="color:#6b8f6b;margin-bottom:1rem">no names yet</p>'
          + '<a href="/register" style="display:inline-block;padding:0.6rem 1.5rem;background:#00e676;color:#000;border-radius:8px;font-weight:700;text-decoration:none">register your first name — it\\\'s free!</a>'
          + '</div>';
        return;
      }
      $('names-count').textContent = data.total + ' name' + (data.total === 1 ? '' : 's');

      let html = '';
      for (const n of data.names) {
        const statusColor = '#00e676';
        const statusLabel = 'active';
        const eName = escHtml(n.name);
        const uName = encodeURIComponent(n.name);
        var pillBg = 'rgba(0,230,118,0.15)';
        var pillClass = 'status-pill';
        html += '<div class="name-card" data-name="' + eName + '" style="margin-bottom:0.5rem">';
        // Collapsed card header — tappable
        html += '<div class="name-card-header" onclick="toggleCard(\\x27' + eName + '\\x27)" style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;background:#111;border:1px solid #1a2e1a;border-radius:8px;cursor:pointer;transition:border-radius 0.2s">';
        html += '<div style="min-width:0">';
        html += '<span style="color:#fff;font-weight:700;font-size:0.95rem">' + eName + '<span style="color:#00e676">.hazza.name</span></span>';
        if (n.isNamespace) html += ' <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:#00e676;color:#000;font-size:0.65rem;font-weight:900;border-radius:4px;vertical-align:middle;margin-left:0.25rem" title="Namespace">N</span>';
        html += '</div>';
        html += '<span class="' + pillClass + '" style="color:' + statusColor + ';background:' + pillBg + '">' + escHtml(statusLabel) + '</span>';
        html += '</div>';
        // Expanded detail panel — hidden by default
        html += '<div id="card-detail-' + eName + '" class="name-card-detail" style="display:none;padding:0.75rem 1rem;background:#0a150a;border:1px solid #1a2e1a;border-top:none;border-radius:0 0 8px 8px">';
        // Info row
        html += '<div style="display:flex;gap:1.5rem;font-size:0.75rem;color:#6b8f6b;margin-bottom:0.75rem;flex-wrap:wrap">';
        html += '<span>permanent</span>';
        html += '<a href="https://' + eName + '.hazza.name" style="color:#00e676;text-decoration:none">view profile ↗</a>';
        html += '</div>';
        // Action buttons
        html += '<div style="display:flex;gap:0.4rem;flex-wrap:wrap">';
        if (signerAvailable) {
          html += '<button onclick="event.stopPropagation();toggleEdit(\\x27' + eName + '\\x27)" style="color:#00e676;font-size:0.75rem;border:1px solid #00e676;padding:0.3rem 0.6rem;border-radius:6px;background:transparent;cursor:pointer;font-family:Rubik,sans-serif">edit profile</button>';
          html += '<button onclick="event.stopPropagation();toggleTransfer(\\x27' + eName + '\\x27, ' + escHtml(String(n.tokenId)) + ')" style="color:#6b8f6b;font-size:0.75rem;border:1px solid #1a2e1a;padding:0.3rem 0.6rem;border-radius:6px;background:transparent;cursor:pointer;font-family:Rubik,sans-serif">transfer</button>';
          html += '<a href="/marketplace?sell=' + uName + '" style="color:#6b8f6b;font-size:0.75rem;border:1px solid #1a2e1a;padding:0.3rem 0.6rem;border-radius:6px;text-decoration:none" onclick="event.stopPropagation()">sell</a>';
          if (!n.isNamespace) html += '<button onclick="event.stopPropagation();toggleNamespace(\\x27' + eName + '\\x27)" style="color:#6b8f6b;font-size:0.75rem;border:1px solid #1a2e1a;padding:0.3rem 0.6rem;border-radius:6px;background:transparent;cursor:pointer;font-family:Rubik,sans-serif">namespace</button>';
        }
        html += '<button onclick="event.stopPropagation();shareName(\\x27' + eName + '\\x27)" style="color:#6b8f6b;font-size:0.75rem;border:1px solid #1a2e1a;padding:0.3rem 0.6rem;border-radius:6px;background:transparent;cursor:pointer;font-family:Rubik,sans-serif">share</button>';
        html += '</div>';
        // Inline edit profile panel
        html += '<div id="edit-' + eName + '" style="display:none;margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid #1a2e1a">';
        html += '<div style="font-size:0.75rem;color:#444;margin-bottom:0.5rem">Changes are onchain (Base gas ~$0.01 each)</div>';
        var fields = [
          ['Bio', 'description', 'A short bio...'],
          ['Avatar', 'avatar', 'https://... image URL'],
          ['Website', 'url', 'https://...'],
          ['Twitter', 'com.twitter', '@handle'],
          ['Farcaster', 'xyz.farcaster', '@handle'],
          ['GitHub', 'com.github', 'username']
        ];
        for (var fi = 0; fi < fields.length; fi++) {
          var f = fields[fi];
          var fid = 'edit-' + eName + '-' + f[1].replace(/\\./g, '-');
          html += '<div style="display:flex;gap:0.4rem;align-items:center;margin-bottom:0.4rem;flex-wrap:wrap">';
          html += '<label style="color:#6b8f6b;font-size:0.75rem;min-width:65px">' + f[0] + '</label>';
          html += '<input id="' + fid + '" type="text" placeholder="' + f[2] + '" style="flex:1;min-width:120px;padding:0.3rem 0.5rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.8rem;font-family:Rubik,sans-serif;outline:none" onclick="event.stopPropagation()">';
          html += '<button onclick="event.stopPropagation();saveField(\\x27' + eName + '\\x27,\\x27' + f[1] + '\\x27,\\x27' + fid + '\\x27)" style="padding:0.3rem 0.6rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.7rem;font-family:Rubik,sans-serif">Save</button>';
          html += '</div>';
        }
        html += '<div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.5rem">';
        html += '<button onclick="event.stopPropagation();setPrimary(\\x27' + eName + '\\x27)" style="padding:0.3rem 0.6rem;background:transparent;color:#6b8f6b;border:1px solid #1a2e1a;border-radius:6px;font-size:0.7rem;cursor:pointer;font-family:Rubik,sans-serif">set as primary name</button>';
        html += '<a href="/manage?name=' + uName + '" style="color:#444;font-size:0.7rem;text-decoration:none;margin-left:auto" onclick="event.stopPropagation()">advanced settings →</a>';
        html += '</div>';
        html += '<span id="edit-status-' + eName + '" style="font-size:0.75rem;color:#6b8f6b;display:block;margin-top:0.35rem"></span>';
        html += '</div>';
        // Inline transfer panel
        html += '<div id="transfer-' + eName + '" style="display:none;margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid #1a2e1a">';
        html += '<div style="font-size:0.8rem;color:#6b8f6b;margin-bottom:0.5rem">Transfer <strong style="color:#fff">' + eName + '.hazza.name</strong></div>';
        html += '<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">';
        html += '<input id="transfer-to-' + eName + '" type="text" placeholder="0x... recipient address" style="flex:1;min-width:200px;padding:0.4rem 0.5rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.85rem;font-family:Rubik,sans-serif" onclick="event.stopPropagation()">';
        html += '<button onclick="event.stopPropagation();doTransfer(\\x27' + eName + '\\x27, ' + escHtml(String(n.tokenId)) + ')" style="padding:0.4rem 1rem;background:#ff5252;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.8rem;font-family:Rubik,sans-serif">Transfer</button>';
        html += '</div>';
        html += '<span id="transfer-status-' + eName + '" style="font-size:0.8rem;color:#6b8f6b;display:block;margin-top:0.35rem"></span>';
        html += '</div>';
        // Inline namespace upgrade panel
        if (!n.isNamespace && n.status === 'active') {
          html += '<div id="namespace-' + eName + '" style="display:none;margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid #1a2e1a">';
          html += '<div style="font-size:0.8rem;color:#6b8f6b;margin-bottom:0.5rem">Enable namespaces on <strong style="color:#fff">' + eName + '</strong></div>';
          html += '<div style="font-size:0.75rem;color:#444;margin-bottom:0.5rem">Create subnames like alice.' + eName + ', bot.' + eName + ', etc. Each subname costs $1. This is a permanent change and cannot be undone.</div>';
          html += '<div style="display:flex;gap:0.5rem;align-items:center">';
          html += '<button onclick="event.stopPropagation();doNamespace(\\x27' + eName + '\\x27)" style="padding:0.4rem 1rem;background:#00e676;color:#000;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.8rem;font-family:Rubik,sans-serif">Enable Namespaces</button>';
          html += '<span id="namespace-status-' + eName + '" style="font-size:0.8rem;color:#6b8f6b"></span>';
          html += '</div></div>';
        }
        html += '</div>'; // close name-card-detail
        html += '</div>'; // close name-card
      }
      if (data.total > 50) html += '<p style="color:#888;font-size:0.8rem;margin-top:0.5rem">showing 50 of ' + data.total + '</p>';
      list.innerHTML = html;
    } catch (e) {
      list.innerHTML = '<span style="color:#ff5252;font-size:0.85rem">error loading names</span>';
    }
  }

  var openCardName = null;
  function toggleCard(name) {
    var detail = $('card-detail-' + name);
    if (!detail) return;
    if (openCardName && openCardName !== name) {
      // Close previously open card
      var prev = $('card-detail-' + openCardName);
      if (prev) {
        prev.style.display = 'none';
        prev.previousElementSibling.style.borderRadius = '8px';
      }
    }
    if (detail.style.display === 'none') {
      detail.style.display = 'block';
      detail.previousElementSibling.style.borderRadius = '8px 8px 0 0';
      openCardName = name;
    } else {
      detail.style.display = 'none';
      detail.previousElementSibling.style.borderRadius = '8px';
      openCardName = null;
    }
  }

  // Close expanded card when clicking outside
  document.addEventListener('click', function(e) {
    if (!openCardName) return;
    var card = e.target.closest('.name-card');
    if (!card || card.getAttribute('data-name') !== openCardName) {
      var detail = $('card-detail-' + openCardName);
      if (detail) {
        detail.style.display = 'none';
        detail.previousElementSibling.style.borderRadius = '8px';
      }
      openCardName = null;
    }
  });

  function closeAllPanels(name) {
    ['edit-','transfer-','namespace-'].forEach(function(p) {
      var el = $(p + name); if (el) el.style.display = 'none';
    });
  }

  function toggleEdit(name) {
    var panel = $('edit-' + name);
    if (!panel) return;
    var wasOpen = panel.style.display !== 'none';
    closeAllPanels(name);
    if (!wasOpen) {
      panel.style.display = 'block';
      // Pre-populate fields from profile API
      fetch('/api/profile/' + name).then(function(r){return r.json()}).then(function(d) {
        if (!d || !d.texts) return;
        var map = {};
        d.texts.forEach(function(t){ map[t.key] = t.value; });
        var fields = ['description','avatar','url','com.twitter','xyz.farcaster','com.github'];
        fields.forEach(function(key) {
          var el = $('edit-' + name + '-' + key.replace(/\\./g, '-'));
          if (el && map[key]) el.value = map[key];
        });
      }).catch(function(){});
    }
  }

  async function saveField(name, key, inputId) {
    var statusEl = $('edit-status-' + name);
    var input = $(inputId);
    if (!input) return;
    var value = input.value.trim();
    if (!signer) { statusEl.style.color='#ff5252'; statusEl.textContent='Connect wallet first'; return; }
    try {
      var registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
      statusEl.style.color = '#6b8f6b';
      statusEl.textContent = 'Setting ' + key + '...';
      var tx = await registry.setText(name, key, value);
      statusEl.textContent = 'Confirming...';
      await tx.wait();
      statusEl.style.color = '#00e676';
      statusEl.textContent = key + ' updated!';
      setTimeout(function(){ statusEl.textContent = ''; }, 3000);
    } catch(e) {
      statusEl.style.color = '#ff5252';
      statusEl.textContent = e.reason || e.message || 'Failed to save';
    }
  }

  async function setPrimary(name) {
    var statusEl = $('edit-status-' + name);
    if (!signer) { statusEl.style.color='#ff5252'; statusEl.textContent='Connect wallet first'; return; }
    try {
      var registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
      statusEl.style.color = '#6b8f6b';
      statusEl.textContent = 'Setting primary name...';
      var tx = await registry.setPrimaryName(name);
      statusEl.textContent = 'Confirming...';
      await tx.wait();
      statusEl.style.color = '#00e676';
      statusEl.textContent = name + ' is now your primary name!';
    } catch(e) {
      statusEl.style.color = '#ff5252';
      statusEl.textContent = e.reason || e.message || 'Failed';
    }
  }

  function shareName(name) {
    var url = 'https://' + name + '.hazza.name';
    var text = 'Check out ' + name + '.hazza.name';
    // Remove any existing share modal
    var existing = $('share-modal');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'share-modal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    var box = document.createElement('div');
    box.style.cssText = 'background:#111;border:1px solid #1a2e1a;border-radius:12px;padding:1.5rem;max-width:320px;width:90%;text-align:center';
    box.innerHTML = '<div style="font-size:1rem;color:#fff;margin-bottom:1rem;font-family:Rubik,sans-serif">Share <strong style="color:#00e676">' + name + '.hazza.name</strong></div>'
      + '<div style="display:flex;gap:1rem;justify-content:center;margin-bottom:1rem">'
      + '<a href="https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url) + '" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;text-decoration:none;gap:0.3rem">'
      + '<svg width="32" height="32" viewBox="0 0 24 24" fill="#fff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>'
      + '<span style="color:#888;font-size:0.7rem;font-family:Rubik,sans-serif">Twitter</span></a>'
      + '<a href="https://warpcast.com/~/compose?text=' + encodeURIComponent(text + ' ' + url) + '" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;text-decoration:none;gap:0.3rem">'
      + '<svg width="32" height="32" viewBox="0 0 24 24" fill="#8a63d2"><path d="M3.77 2h16.46C21.21 2 22 2.79 22 3.77v16.46c0 .98-.79 1.77-1.77 1.77H3.77C2.79 22 2 21.21 2 20.23V3.77C2 2.79 2.79 2 3.77 2zm3.48 4.3L5.6 12.26h2.18l.89 5.44h2.07l1.26-7.4 1.26 7.4h2.07l.89-5.44h2.18L16.75 6.3h-2.82l-.93 5.5-.93-5.5H8.07z"/></svg>'
      + '<span style="color:#888;font-size:0.7rem;font-family:Rubik,sans-serif">Farcaster</span></a>'
      + '</div>'
      + '<button id="share-copy-btn" style="width:100%;padding:0.6rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.85rem;font-family:Rubik,sans-serif">Copy URL</button>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    $('share-copy-btn').onclick = function(e) {
      e.stopPropagation();
      navigator.clipboard.writeText(url).then(function() {
        $('share-copy-btn').textContent = 'Copied!';
        $('share-copy-btn').style.background = '#00e676';
        $('share-copy-btn').style.color = '#000';
        setTimeout(function(){ overlay.remove(); }, 1200);
      });
    };
  }

  function toggleTransfer(name, tokenId) {
    var panel = $('transfer-' + name);
    var wasOpen = panel && panel.style.display !== 'none';
    closeAllPanels(name);
    if (!wasOpen && panel) panel.style.display = 'block';
  }

  async function doTransfer(name, tokenId) {
    const statusEl = $('transfer-status-' + name);
    const toInput = $('transfer-to-' + name);
    const to = toInput.value.trim();
    if (!to || !to.match(/^0x[a-fA-F0-9]{40}$/)) {
      statusEl.style.color = '#ff5252';
      statusEl.textContent = 'Enter a valid wallet address (0x...)';
      return;
    }
    if (to.toLowerCase() === userAddress.toLowerCase()) {
      statusEl.style.color = '#ff5252';
      statusEl.textContent = 'Cannot transfer to yourself';
      return;
    }
    if (!confirm('Transfer ' + name + '.hazza.name to ' + to.slice(0,6) + '...' + to.slice(-4) + '? This is irreversible.')) return;
    try {
      const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
      statusEl.style.color = '#6b8f6b';
      statusEl.textContent = 'Sending transfer...';
      const tx = await registry.transferFrom(userAddress, to, tokenId);
      statusEl.textContent = 'Confirming...';
      await tx.wait();
      statusEl.style.color = '#00e676';
      statusEl.textContent = 'Transferred!';
      setTimeout(() => loadNames(), 2000);
    } catch (e) {
      statusEl.style.color = '#ff5252';
      statusEl.textContent = e.reason || e.message || 'Transfer failed';
    }
  }

  function toggleNamespace(name) {
    var panel = $('namespace-' + name);
    var wasOpen = panel && panel.style.display !== 'none';
    closeAllPanels(name);
    if (!wasOpen && panel) panel.style.display = 'block';
  }

  async function doNamespace(name) {
    const statusEl = $('namespace-status-' + name);
    if (!confirm('Enable namespaces on ' + name + '? This is permanent and cannot be undone. Each subname you create will cost $1.')) return;
    try {
      const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
      statusEl.style.color = '#6b8f6b';
      statusEl.textContent = 'Enabling namespaces...';
      const tx = await registry.registerNamespace(name);
      await tx.wait();
      statusEl.style.color = '#00e676';
      statusEl.textContent = 'Namespace created!';
      setTimeout(() => loadNames(), 2000);
    } catch (e) {
      statusEl.style.color = '#ff5252';
      statusEl.textContent = e.reason || e.message || 'Error';
    }
  }

  // Listen for wallet connections from nav bar
  window.addEventListener('hazza_wallet_connected', function(e) {
    if (e.detail && e.detail.address && !userAddress) {
      initFromAddress(e.detail.address);
    }
  });

  // Listen for disconnects
  window.addEventListener('hazza_wallet_disconnected', function() {
    userAddress = null; signer = null; provider = null; signerAvailable = false;
    $('connect-section').style.display = 'block';
    $('dash-content').style.display = 'none';
  });

  // Initialize dashboard from a known address (no extra eth_requestAccounts call)
  function initFromAddress(addr) {
    userAddress = addr;
    $('connect-section').style.display = 'none';
    $('dash-content').style.display = 'block';
    if (window.ethereum) {
      provider = new ethers.BrowserProvider(window.ethereum);
      provider.getSigner().then(function(s) {
        signer = s;
        provider.getNetwork().then(function(net) {
          if (Number(net.chainId) !== CHAIN_ID) {
            showStatus('Connected to wrong network. Switch to ' + (CHAIN_ID === 84532 ? 'Base Sepolia' : 'Base') + ' for full functionality.', true);
          } else {
            signerAvailable = true;
          }
        });
      }).catch(function() {});
    }
    loadNames();
  }

  // Check if nav already connected (handles race where nav event fired before this listener)
  function tryInitFromNav() {
    if (window.__hazza_wallet && !userAddress) {
      initFromAddress(window.__hazza_wallet);
      return true;
    }
    return false;
  }

  // Auto-reconnect with retry for late ethereum injection (MetaMask mobile)
  function tryAutoReconnect() {
    // First check if nav already has the wallet
    if (tryInitFromNav()) return true;
    if (!window.ethereum) return false;
    var saved = null;
    try { saved = sessionStorage.getItem('hazza_wallet'); } catch(e) {}
    if (saved) {
      initFromAddress(saved);
      return true;
    }
    return false;
  }

  // Try immediately, then retry after delays for late ethereum injection
  if (!tryAutoReconnect()) {
    setTimeout(function() { if (!userAddress) tryAutoReconnect(); }, 500);
    setTimeout(function() { if (!userAddress) tryAutoReconnect(); }, 1500);
  }

  // Also listen for MetaMask's own EIP-6963 provider announcement
  window.addEventListener('eip6963:announceProvider', function() {
    if (!userAddress) setTimeout(tryAutoReconnect, 100);
  });
`;

export function dashboardPage(registryAddress: string, usdcAddress: string, chainId: string): string {
  return shell(
    "hazza \u2014 immediately useful names",
    "View and manage all your names from one place.",
    `<div id="hazza-config" data-registry="${registryAddress}" data-usdc="${usdcAddress}" data-chainid="${chainId}" style="display:none"></div>

    <div class="header">
      <h1>dashboard</h1>
      <p>your names</p>
    </div>

    <div id="connect-section" style="text-align:center;margin:2rem 0">
      <p style="color:#6b8f6b;margin-bottom:0.5rem">connect your wallet to see your names</p>
      <p style="color:#444;font-size:0.85rem">tap <strong style="color:#00e676">connect</strong> in the menu above</p>
    </div>

    <div id="dash-status" style="display:none;text-align:center;padding:0.75rem;font-size:0.9rem;margin-bottom:1rem"></div>

    <div id="dash-content" style="display:none">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <span id="names-count" style="color:#6b8f6b;font-size:0.85rem"></span>
        <a href="/register" style="color:#00e676;font-size:0.85rem;border:1px solid #1a2e1a;padding:0.3rem 0.75rem;border-radius:6px;text-decoration:none">+ register new</a>
      </div>
      <div id="names-list"></div>
    </div>`,
    DASHBOARD_SCRIPT,
    { externalScripts: [ETHERS_CDN] }
  );
}

// =========================================================================
//                        PROFILE PAGE (name.hazza.name)
// =========================================================================

type ProfileData = {
  owner: string;
  ownerEns?: string | null;
  tokenId: string;
  registeredAt: number;
  operator: string;
  agentId: string;
  agentWallet: string;
  status: "active";
  texts: Record<string, string>;
  contenthash: string | null;
  agentMeta?: any;
  netProfile?: any;
  helixaData?: any;
  exoData?: any;
  bankrData?: any;
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
    const handle = esc(val.replace(/^@/, ""));
    if (urlPrefix) {
      links.push(`<a class="social-link" href="${esc(urlPrefix)}${handle}" target="_blank" rel="noopener">${label}</a>`);
    } else {
      links.push(`<span class="social-link">${label}: ${esc(val)}</span>`);
    }
  }
  if (texts["url"]) {
    links.push(`<a class="social-link" href="${safeHref(texts["url"])}" target="_blank" rel="noopener">Website</a>`);
  }
  return links.length ? `<div class="socials">${links.join("")}</div>` : "";
}

function statusBadge(status: string): string {
  return `<span class="status-badge status-active">Active</span>`;
}

export function profilePage(name: string, data: ProfileData | null, chainId?: string): string {
  const explorer = chainId === "84532" ? "sepolia.basescan.org" : "basescan.org";
  const title = data ? `${name}.hazza.name` : `${name}.hazza.name \u2014 Available`;

  let content: string;
  if (data) {
    const regDate = new Date(data.registeredAt * 1000).toLocaleDateString();
    const shortOwner = data.owner.slice(0, 6) + "..." + data.owner.slice(-4);
    const ownerDisplay = data.ownerEns || shortOwner;
    const hasAgent = data.agentId !== "0";
    const zeroAddr = "0x0000000000000000000000000000000000000000";
    const hasOperator = data.operator !== zeroAddr && data.operator.toLowerCase() !== data.owner.toLowerCase();
    const texts = data.texts || {};

    // Avatar
    const avatarHtml = texts["avatar"]
      ? `<img class="avatar" src="${safeHref(texts["avatar"])}" alt="${esc(name)}" onerror="this.style.display='none'">`
      : `<div class="avatar-placeholder">${esc(name.charAt(0).toUpperCase())}</div>`;

    // Social links
    const socialsHtml = buildSocialLinks(texts);

    // XMTP DM button
    const xmtpAddr = texts["xmtp"];
    const xmtpHtml = xmtpAddr
      ? `<div style="margin-top:0.5rem;text-align:center"><button onclick="document.getElementById('xmtp-modal').style.display='flex'" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.4rem 1rem;background:#1a1a2e;border:1px solid #7c3aed;border-radius:20px;color:#a78bfa;font-size:0.8rem;font-weight:600;cursor:pointer;font-family:'Rubik',sans-serif"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Send DM</button></div>
<div id="xmtp-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:1000;justify-content:center;align-items:center;padding:1rem" onclick="if(event.target===this)this.style.display='none'">
<div style="background:#111;border:1px solid #7c3aed;border-radius:12px;max-width:400px;width:100%;padding:1.5rem">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem"><span style="color:#a78bfa;font-weight:700;font-size:1rem">Private Message via XMTP</span><button onclick="document.getElementById('xmtp-modal').style.display='none'" style="background:none;border:none;color:#666;font-size:1.5rem;cursor:pointer">&times;</button></div>
<p style="color:#aaa;font-size:0.85rem;line-height:1.5;margin-bottom:1rem">XMTP is an encrypted, wallet-to-wallet messaging protocol. Messages are private and decentralized &mdash; no one can read them except you and the recipient.</p>
<a href="https://xmtp.chat/production/dm/${esc(xmtpAddr)}" target="_blank" rel="noopener" style="display:block;text-align:center;padding:0.6rem 1.5rem;background:#7c3aed;color:#fff;border-radius:8px;font-weight:700;font-size:0.9rem;text-decoration:none;margin-bottom:0.75rem">Open XMTP Chat</a>
<p style="color:#555;font-size:0.7rem;text-align:center">Opens xmtp.chat in a new tab. You'll need an XMTP-enabled wallet.</p>
</div></div>`
      : "";

    // Bio
    const bioHtml = texts["description"]
      ? `<p class="bio">${esc(texts["description"])}</p>`
      : "";

    // --- Badges ---
    const badges: string[] = [];
    const memberNum = texts["netlibrary.member"];
    if (memberNum) {
      badges.push(`<span style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.25rem 0.65rem;background:#0d1f0d;border:1px solid #00e676;border-radius:20px;font-size:0.75rem;color:#00e676;font-weight:700">Net Library #${esc(memberNum)}</span>`);
    }
    if (texts["netlibrary.pass"] === "unlimited") {
      badges.push(`<span style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.25rem 0.65rem;background:#0d1a2e;border:1px solid #448aff;border-radius:20px;font-size:0.75rem;color:#448aff;font-weight:700"><svg width="14" height="10" viewBox="0 0 20 12" fill="none"><path d="M5.5 1C3 1 1 3.5 1 6s2 5 4.5 5c1.5 0 3-1 4.5-3 1.5 2 3 3 4.5 3 2.5 0 4.5-2.5 4.5-5S16.5 1 14.5 1c-1.5 0-3 1-4.5 3C8.5 2 7 1 5.5 1z" stroke="#448aff" stroke-width="1.5" fill="none"/></svg>Unlimited Pass</span>`);
    }
    const badgesHtml = badges.length ? `<div style="display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:center;margin-top:0.5rem">${badges.join("")}</div>` : "";

    // --- Onchain Profile section (groups ERC-8004 agent, Helixa, Exoskeleton, etc.) ---
    const onchainBlocks: string[] = [];
    const agentMeta = data.agentMeta;

    // ERC-8004 Agent subsection
    if (hasAgent || texts["agent.endpoint"] || texts["agent.model"] || agentMeta) {
      const agentRows: string[] = [];
      if (agentMeta) {
        if (agentMeta.metadata?.pfp) {
          agentRows.push(`<div class="agent-card" style="grid-column:1/-1;text-align:center"><img src="${safeHref(String(agentMeta.metadata.pfp))}" alt="${esc(String(agentMeta.name || "Agent"))}" style="width:64px;height:64px;border-radius:50%;border:2px solid #00e676;object-fit:cover"></div>`);
        }
        if (agentMeta.name) {
          agentRows.push(`<div class="agent-card"><div class="agent-label">Agent Name</div><div class="agent-value" style="font-weight:700;color:#fff">${esc(String(agentMeta.name))}</div></div>`);
        }
        if (agentMeta.description) {
          agentRows.push(`<div class="agent-card" style="grid-column:1/-1"><div class="agent-label">Description</div><div class="agent-value" style="font-size:0.85rem;line-height:1.5">${esc(String(agentMeta.description))}</div></div>`);
        }
        if (agentMeta.metadata?.role) {
          agentRows.push(`<div class="agent-card"><div class="agent-label">Role</div><div class="agent-value">${esc(String(agentMeta.metadata.role))}</div></div>`);
        }
        if (agentMeta.metadata?.organization) {
          agentRows.push(`<div class="agent-card"><div class="agent-label">Organization</div><div class="agent-value">${esc(String(agentMeta.metadata.organization))}</div></div>`);
        }
        if (agentMeta.services && agentMeta.services.length > 0) {
          const svcHtml = agentMeta.services.map((s: any) => {
            const label = esc(String(s.type).charAt(0).toUpperCase() + String(s.type).slice(1));
            return `<span style="display:inline-block;padding:0.15rem 0.5rem;background:#111;border:1px solid #222;border-radius:4px;font-size:0.75rem;color:#aaa">${label}: ${esc(String(s.endpoint))}</span>`;
          }).join(" ");
          agentRows.push(`<div class="agent-card" style="grid-column:1/-1"><div class="agent-label">Services</div><div class="agent-value" style="display:flex;flex-wrap:wrap;gap:0.35rem">${svcHtml}</div></div>`);
        }
      }
      if (hasAgent) {
        agentRows.push(`<div class="agent-card"><div class="agent-label">Agent ID</div><div class="agent-value">#${esc(data.agentId)}</div></div>`);
        if (data.agentWallet !== zeroAddr) {
          const shortAgent = data.agentWallet.slice(0, 6) + "..." + data.agentWallet.slice(-4);
          agentRows.push(`<div class="agent-card"><div class="agent-label">Agent Wallet</div><div class="agent-value"><a href="https://${explorer}/address/${esc(data.agentWallet)}">${esc(shortAgent)}</a></div></div>`);
        }
      }
      if (texts["agent.endpoint"]) agentRows.push(`<div class="agent-card"><div class="agent-label">Endpoint</div><div class="agent-value">${esc(texts["agent.endpoint"])}</div></div>`);
      if (texts["agent.model"]) agentRows.push(`<div class="agent-card"><div class="agent-label">Model</div><div class="agent-value">${esc(texts["agent.model"])}</div></div>`);
      if (texts["agent.status"]) agentRows.push(`<div class="agent-card"><div class="agent-label">Status</div><div class="agent-value">${esc(texts["agent.status"])}</div></div>`);

      const poweredBy = agentMeta
        ? `<div style="text-align:right;margin-top:0.35rem;font-size:0.65rem;color:#444"><a href="https://netprotocol.app" style="color:#00e676">Net Protocol</a> &middot; <a href="https://eips.ethereum.org/EIPS/eip-8004" style="color:#666">ERC-8004</a></div>`
        : "";
      onchainBlocks.push(`<div style="margin-bottom:1rem"><div style="color:#6b8f6b;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem">AI Agent</div><div class="info-grid">${agentRows.join("")}</div>${poweredBy}</div>`);
    }

    // Helixa AgentDNA subsection
    const helixaAgent = data.helixaData;
    if (helixaAgent && helixaAgent.tokenId) {
      const rows: string[] = [];
      const hTokenId = esc(String(helixaAgent.tokenId));
      if (helixaAgent.name) rows.push(`<div class="agent-card"><div class="agent-label">Name</div><div class="agent-value" style="font-weight:700;color:#fff">${esc(String(helixaAgent.name))}</div></div>`);
      rows.push(`<div class="agent-card"><div class="agent-label">Token ID</div><div class="agent-value"><a href="https://helixa.xyz/agent/${hTokenId}" style="color:#00e676">#${hTokenId}</a></div></div>`);
      if (helixaAgent.credScore !== undefined) rows.push(`<div class="agent-card"><div class="agent-label">Cred Score</div><div class="agent-value" style="font-weight:700">${esc(String(helixaAgent.credScore))}</div></div>`);
      if (helixaAgent.ethosScore) rows.push(`<div class="agent-card"><div class="agent-label">Ethos</div><div class="agent-value" style="font-weight:700">${esc(String(helixaAgent.ethosScore))}</div></div>`);
      if (helixaAgent.framework) rows.push(`<div class="agent-card"><div class="agent-label">Framework</div><div class="agent-value">${esc(String(helixaAgent.framework))}</div></div>`);
      if (helixaAgent.verified) rows.push(`<div class="agent-card"><div class="agent-label">Verified</div><div class="agent-value" style="color:#00e676">Yes</div></div>`);
      if (helixaAgent.soulbound) rows.push(`<div class="agent-card"><div class="agent-label">Soulbound</div><div class="agent-value" style="color:#00e676">Yes</div></div>`);
      if (helixaAgent.personality?.communicationStyle) rows.push(`<div class="agent-card" style="grid-column:1/-1"><div class="agent-label">Style</div><div class="agent-value" style="font-size:0.85rem;color:#aaa">${esc(String(helixaAgent.personality.communicationStyle))}</div></div>`);
      if (helixaAgent.narrative?.mission) rows.push(`<div class="agent-card" style="grid-column:1/-1"><div class="agent-label">Mission</div><div class="agent-value" style="font-size:0.85rem;line-height:1.5">${esc(String(helixaAgent.narrative.mission))}</div></div>`);
      const auraUrl = "https://api.helixa.xyz/api/v2/aura/" + encodeURIComponent(String(helixaAgent.tokenId)) + ".png";
      onchainBlocks.push(`<div style="margin-bottom:1rem"><div style="color:#6b8f6b;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.4rem">Helixa AgentDNA <img src="${esc(auraUrl)}" alt="Aura" style="width:18px;height:18px;border-radius:50%"></div><div class="info-grid">${rows.join("")}</div><div style="text-align:right;margin-top:0.35rem;font-size:0.65rem;color:#444"><a href="https://helixa.xyz" style="color:#666">helixa.xyz</a></div></div>`);
    }

    // Exoskeleton subsection
    const exo = data.exoData;
    if (exo) {
      const exoRows: string[] = [];
      if (exo.image && typeof exo.image === "string" && exo.image.startsWith("data:image/")) {
        exoRows.push(`<div class="agent-card" style="grid-column:1/-1;text-align:center"><img src="${esc(exo.image)}" alt="${esc(String(exo.name || "Exoskeleton"))}" style="width:100px;height:100px;border-radius:8px;border:1px solid #222"></div>`);
      }
      if (exo.name) exoRows.push(`<div class="agent-card"><div class="agent-label">Name</div><div class="agent-value" style="font-weight:700;color:#fff">${esc(String(exo.name))}</div></div>`);
      exoRows.push(`<div class="agent-card"><div class="agent-label">Token ID</div><div class="agent-value">#${esc(String(exo.tokenId))}</div></div>`);
      if (exo.attributes && Array.isArray(exo.attributes)) {
        for (const attr of exo.attributes) {
          if (attr.value && String(attr.value) !== "0") {
            exoRows.push(`<div class="agent-card"><div class="agent-label">${esc(String(attr.trait_type))}</div><div class="agent-value">${esc(String(attr.value))}</div></div>`);
          }
        }
      }
      onchainBlocks.push(`<div style="margin-bottom:1rem"><div style="color:#6b8f6b;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem">Exoskeleton</div><div class="info-grid">${exoRows.join("")}</div><div style="text-align:right;margin-top:0.35rem;font-size:0.65rem;color:#444">100% onchain &middot; <a href="https://exoagent.xyz" style="color:#666">exoagent.xyz</a></div></div>`);
    }

    // Bankr Agent Profile subsection
    const bankr = data.bankrData;
    if (bankr && bankr.projectName) {
      const bRows: string[] = [];
      bRows.push(`<div class="agent-card"><div class="agent-label">Project</div><div class="agent-value" style="font-weight:700;color:#fff">${esc(String(bankr.projectName))}</div></div>`);
      if (bankr.description) bRows.push(`<div class="agent-card" style="grid-column:1/-1"><div class="agent-label">Description</div><div class="agent-value" style="font-size:0.85rem;line-height:1.5">${esc(String(bankr.description))}</div></div>`);
      if (bankr.tokenSymbol) bRows.push(`<div class="agent-card"><div class="agent-label">Token</div><div class="agent-value" style="font-weight:700;color:#00e676">$${esc(String(bankr.tokenSymbol))}</div></div>`);
      if (bankr.marketCapUsd) bRows.push(`<div class="agent-card"><div class="agent-label">Market Cap</div><div class="agent-value">$${Number(bankr.marketCapUsd).toLocaleString()}</div></div>`);
      if (bankr.weeklyRevenueWeth) bRows.push(`<div class="agent-card"><div class="agent-label">Weekly Revenue</div><div class="agent-value">${Number(bankr.weeklyRevenueWeth).toFixed(4)} WETH</div></div>`);
      if (bankr.website) bRows.push(`<div class="agent-card"><div class="agent-label">Website</div><div class="agent-value"><a href="${safeHref(String(bankr.website))}" target="_blank" rel="noopener">${esc(String(bankr.website).replace(/^https?:\/\//, ""))}</a></div></div>`);
      if (bankr.twitterUsername) bRows.push(`<div class="agent-card"><div class="agent-label">Twitter</div><div class="agent-value"><a href="https://x.com/${esc(String(bankr.twitterUsername))}" target="_blank" rel="noopener">@${esc(String(bankr.twitterUsername))}</a></div></div>`);

      // Products (collapsible sub-dropdown)
      let productsHtml = "";
      if (bankr.products && bankr.products.length > 0) {
        const pItems = bankr.products.map((p: any) => {
          let item = `<div style="margin-bottom:0.5rem"><span style="font-weight:700;color:#fff">${esc(String(p.name))}</span>`;
          if (p.description) item += `<div style="font-size:0.8rem;color:#6b8f6b;margin-top:0.15rem">${esc(String(p.description))}</div>`;
          if (p.url) item += `<div style="font-size:0.75rem;margin-top:0.15rem"><a href="${safeHref(String(p.url))}" target="_blank" rel="noopener">${esc(String(p.url).replace(/^https?:\/\//, ""))}</a></div>`;
          item += "</div>";
          return item;
        }).join("");
        productsHtml = `<details style="margin-top:0.5rem"><summary style="font-size:0.75rem;color:#6b8f6b;cursor:pointer;font-weight:700">Products (${bankr.products.length})</summary><div style="margin-top:0.35rem;padding-left:0.5rem;border-left:2px solid #1a2e1a">${pItems}</div></details>`;
      }

      // Team (collapsible sub-dropdown)
      let teamHtml = "";
      if (bankr.teamMembers && bankr.teamMembers.length > 0) {
        const tItems = bankr.teamMembers.map((t: any) => {
          let item = `<div style="margin-bottom:0.5rem"><span style="font-weight:700;color:#fff">${esc(String(t.name))}</span>`;
          if (t.role) item += ` <span style="font-size:0.75rem;color:#6b8f6b">${esc(String(t.role))}</span>`;
          if (t.links && t.links.length > 0) {
            const linkHtml = t.links.map((l: any) => `<a href="${safeHref(String(l.url))}" target="_blank" rel="noopener" style="font-size:0.7rem">${esc(String(l.type))}</a>`).join(" ");
            item += `<div style="margin-top:0.1rem">${linkHtml}</div>`;
          }
          item += "</div>";
          return item;
        }).join("");
        teamHtml = `<details style="margin-top:0.5rem"><summary style="font-size:0.75rem;color:#6b8f6b;cursor:pointer;font-weight:700">Team (${bankr.teamMembers.length})</summary><div style="margin-top:0.35rem;padding-left:0.5rem;border-left:2px solid #1a2e1a">${tItems}</div></details>`;
      }

      // Revenue sources (collapsible sub-dropdown)
      let revenueHtml = "";
      if (bankr.revenueSources && bankr.revenueSources.length > 0) {
        const rItems = bankr.revenueSources.map((r: any) => {
          let item = `<div style="margin-bottom:0.5rem"><span style="font-weight:700;color:#fff">${esc(String(r.name))}</span>`;
          if (r.description) item += `<div style="font-size:0.8rem;color:#6b8f6b;margin-top:0.15rem">${esc(String(r.description))}</div>`;
          item += "</div>";
          return item;
        }).join("");
        revenueHtml = `<details style="margin-top:0.5rem"><summary style="font-size:0.75rem;color:#6b8f6b;cursor:pointer;font-weight:700">Revenue Sources (${bankr.revenueSources.length})</summary><div style="margin-top:0.35rem;padding-left:0.5rem;border-left:2px solid #1a2e1a">${rItems}</div></details>`;
      }

      // Recent updates (collapsible sub-dropdown)
      let updatesHtml = "";
      if (bankr.updates && bankr.updates.length > 0) {
        const uItems = bankr.updates.slice(0, 5).map((u: any) => {
          let item = `<div style="margin-bottom:0.5rem"><span style="font-weight:700;color:#fff">${esc(String(u.title))}</span>`;
          if (u.timestamp) item += ` <span style="font-size:0.65rem;color:#444">${new Date(u.timestamp).toLocaleDateString()}</span>`;
          if (u.content) item += `<div style="font-size:0.8rem;color:#6b8f6b;margin-top:0.15rem">${esc(String(u.content).slice(0, 200))}</div>`;
          item += "</div>";
          return item;
        }).join("");
        updatesHtml = `<details style="margin-top:0.5rem"><summary style="font-size:0.75rem;color:#6b8f6b;cursor:pointer;font-weight:700">Updates (${bankr.updates.length})</summary><div style="margin-top:0.35rem;padding-left:0.5rem;border-left:2px solid #1a2e1a">${uItems}</div></details>`;
      }

      const bankrSlug = bankr.slug ? esc(String(bankr.slug)) : "";
      const bankrLink = bankrSlug ? `https://bankr.bot/agent/${bankrSlug}` : "https://bankr.bot";
      onchainBlocks.push(`<div style="margin-bottom:1rem"><div style="color:#6b8f6b;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem">Bankr Profile</div><div class="info-grid">${bRows.join("")}</div>${productsHtml}${teamHtml}${revenueHtml}${updatesHtml}<div style="text-align:right;margin-top:0.35rem;font-size:0.65rem;color:#444"><a href="${esc(bankrLink)}" style="color:#666">bankr.bot</a></div></div>`);
    }

    // Build the unified Onchain Profile section (collapsible)
    const onchainProfileHtml = onchainBlocks.length
      ? `<details class="collapsible">
          <summary>Onchain Profile</summary>
          <div class="section-content">
          ${onchainBlocks.join('<hr style="border:none;border-top:1px solid #1a2e1a;margin:0.75rem 0">')}
          </div>
        </details>`
      : "";

    // Contenthash section (collapsible)
    const contenthashHtml = data.contenthash
      ? `<details class="collapsible">
          <summary>Contenthash</summary>
          <div class="section-content">
          <div class="info-grid">
            <div class="info-row">
              <span class="label">Hash</span>
              <span class="value" style="font-size:0.75rem">${esc(data.contenthash.slice(0, 18) + "..." + data.contenthash.slice(-8))}</span>
            </div>
          </div>
          </div>
        </details>`
      : "";

    // Setup prompt for sparse profiles
    const hasBio = !!texts["description"];
    const hasAvatar = !!texts["avatar"];
    const hasSocials = !!(texts["com.twitter"] || texts["xyz.farcaster"] || texts["com.github"] || texts["org.telegram"] || texts["com.discord"] || texts["com.linkedin"]);
    const setupHtml = (!hasBio && !hasAvatar && !hasSocials)
      ? `<div style="margin-top:1rem;padding:0.75rem 1rem;background:#0d1f0d;border:1px solid #1a2e1a;border-radius:8px;text-align:center"><span style="color:#6b8f6b;font-size:0.85rem">This profile is empty. <a href="https://hazza.name/manage?name=${encodeURIComponent(name)}" style="color:#00e676;font-weight:700">Set it up</a></span></div>`
      : "";

    content = `
    <div class="profile-header">
      ${avatarHtml}
      <h1>${esc(name)}<span>.hazza.name</span></h1>
      ${bioHtml}
      ${statusBadge(data.status)}
      ${badgesHtml}
      ${socialsHtml}
      ${xmtpHtml}
      ${setupHtml}
    </div>

    <details class="collapsible">
      <summary>Name Info</summary>
      <div class="section-content">
      <div class="info-grid">
        <div class="info-row">
          <span class="label">Owner</span>
          <span class="value"><a href="https://${explorer}/address/${esc(data.owner)}">${esc(ownerDisplay)}</a></span>
        </div>
        <div class="info-row">
          <span class="label">Token ID</span>
          <span class="value">#${esc(data.tokenId)}</span>
        </div>
        <div class="info-row">
          <span class="label">Registered</span>
          <span class="value">${regDate}</span>
        </div>
        ${hasOperator ? `<div class="info-row">
          <span class="label">Operator</span>
          <span class="value"><a href="https://${explorer}/address/${esc(data.operator)}">${esc(data.operator.slice(0, 6) + "..." + data.operator.slice(-4))}</a></span>
        </div>` : ""}
        <div class="info-row">
          <span class="label">Subdomain</span>
          <span class="value"><a href="https://${encodeURIComponent(name)}.hazza.name">${esc(name)}.hazza.name</a></span>
        </div>
      </div>
      </div>
    </details>

    ${onchainProfileHtml}
    ${contenthashHtml}

    <div style="display:flex;justify-content:center;gap:1rem;margin-top:2rem;flex-wrap:wrap">
      <a href="https://hazza.name/manage?name=${encodeURIComponent(name)}" style="display:inline-block;padding:0.6rem 1.5rem;border:1px solid #00e676;color:#00e676;border-radius:8px;font-weight:700;font-size:0.9rem;text-decoration:none">manage</a>
    </div>`;
  } else {
    content = `
    <div class="unclaimed">
      <h1 style="color:#fff;font-size:2rem;font-weight:900;margin-bottom:0.5rem">${esc(name)}<span style="color:#00e676">.hazza.name</span></h1>
      <p>this name is available</p>
      <a class="cta" href="https://hazza.name/register?name=${encodeURIComponent(name)}">Register it</a>
    </div>`;
  }

  return profileShell(
    name,
    title,
    data ? `${name}.hazza.name \u2014 owned by ${data.ownerEns || data.owner}` : `${name}.hazza.name is available on hazza`,
    content
  );
}

// =========================================================================
//                          ABOUT PAGE
// =========================================================================

export function aboutPage(): string {
  return shell(
    "hazza \u2014 immediately useful names",
    "Learn more about hazza and the tech that makes these names immediately useful.",
    `
    <div class="header">
      <h1>about</h1>
    </div>

    <div class="section">
      <div class="section-title">What is hazza?</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        hazza is an onchain name registry on Base. Register a <strong style="color:#fff">.hazza.name</strong> domain
        and get an ERC-721 NFT that serves as your identity, your subdomain, your content host, and your AI agent endpoint &mdash; all in one.
      </p>
    </div>

    <div class="section">
      <div class="section-title">What you get</div>
      <div class="info-grid">
        <div class="info-row"><span class="label">NFT</span><span class="value">Your name as an ERC-721 on Base</span></div>
        <div class="info-row"><span class="label">Website</span><span class="value">Live page at yourname.hazza.name</span></div>
        <div class="info-row"><span class="label">Profile</span><span class="value">Bio, socials, avatar &mdash; all onchain</span></div>
        <div class="info-row"><span class="label">Content</span><span class="value">Host via <a href="https://netprotocol.app">Net Protocol</a> (ENSIP-7)</span></div>
        <div class="info-row"><span class="label">Agent</span><span class="value">ERC-8004 AI agent registration</span></div>
        <div class="info-row"><span class="label">DNS</span><span class="value">Custom domain linking</span></div>
        <div class="info-row"><span class="label">Addresses</span><span class="value">Multi-chain via API (ENSIP-9/11)</span></div>
        <div class="info-row"><span class="label">Subnames</span><span class="value">Free to enable &mdash; $1 per subname</span></div>
        <div class="info-row"><span class="label">Unicode</span><span class="value">ENSIP-15 emoji &amp; unicode support</span></div>
        <div class="info-row"><span class="label">API</span><span class="value">Programmatic access to everything</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">How it works</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        <strong style="color:#fff">For humans:</strong> Connect your wallet on the <a href="/register">register page</a>, pay USDC, and your name is minted as an NFT. Your profile page goes live immediately.
      </p>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        <strong style="color:#fff">For agents &amp; CLIs:</strong> Use the <a href="/docs#x402" style="font-weight:700">x402 API</a> to register programmatically &mdash; send an HTTP request, pay USDC, and receive a registered name. No wallet extension needed.
      </p>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        Content hosting is powered by <a href="https://netprotocol.app" style="font-weight:700">Net Protocol</a>.
        Set text records, link socials, point to content, or register an AI agent &mdash; all through onchain transactions.
      </p>
    </div>

    <div class="section">
      <div class="section-title">Need help?</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        <strong style="color:#fff">Cheryl</strong> is an AI agent from <a href="https://netlibrary.app">Net Library</a> who can help with hazza names.
        She can check availability, explain pricing, walk you through registration, and answer questions about text records, agents, or anything else.
      </p>
      <div class="info-grid">
        <div class="info-row"><span class="label">XMTP</span><span class="value"><a href="http://xmtp.chat/production/dm/0x08160267ca94b6682ab9044545998479dc9c0408">Message Cheryl</a></span></div>
        <div class="info-row"><span class="label">Farcaster</span><span class="value"><a href="https://warpcast.com/cherylfromnet">@cherylfromnet</a></span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Built on</div>
      <div class="info-grid">
        <div class="info-row"><span class="label"><a href="https://base.org">Base</a></span><span class="value">Low-cost L2 for everything onchain</span></div>
        <div class="info-row"><span class="label"><a href="https://x402.org">x402</a></span><span class="value">HTTP-native payment protocol</span></div>
        <div class="info-row"><span class="label"><a href="https://netprotocol.app">Net Protocol</a></span><span class="value">Onchain content hosting</span></div>
        <div class="info-row"><span class="label"><a href="https://eips.ethereum.org/EIPS/eip-8004">ERC-8004</a></span><span class="value">AI agent registry standard</span></div>
      </div>
    </div>

    <div style="text-align:center;margin:2rem 0">
      <a href="/" style="display:inline-block;padding:0.75rem 2rem;background:#00e676;color:#000;border-radius:8px;font-weight:700">Search for a name</a>
    </div>`
  );
}

// =========================================================================
//                          PRICING PAGE
// =========================================================================

export function pricingPage(): string {
  return shell(
    "hazza \u2014 immediately useful names",
    "First name free, additional names $5+ \u2014 pay once, available forever.",
    `
    <div class="header">
      <h1>pricing</h1>
    </div>

    <div style="text-align:center;margin:2rem 0 1.5rem;padding:1.25rem 1rem;border:2px solid #00e676;border-radius:12px;background:#0d1a0d">
      <div style="color:#00e676;font-weight:700;font-size:1.1rem;letter-spacing:-0.02em">your first name</div>
      <div style="color:#fff;font-weight:900;font-size:1.8rem;letter-spacing:-0.02em">FREE</div>
      <div style="color:#6b8f6b;font-size:0.95rem;margin-top:0.25rem">just pay gas &mdash; 1 per wallet</div>
    </div>

    <div style="text-align:center;margin-bottom:2rem">
      <div style="color:#fff;font-weight:700;font-size:1.2rem">additional names $5+</div>
      <div style="color:#6b8f6b;font-size:0.85rem;margin-top:0.25rem">pay once, available forever</div>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Perks</div>
      <div class="info-grid">
        <div class="info-row"><span class="label">First name</span><span class="value">Free for everyone &mdash; 1 per wallet, just pay gas</span></div>
        <div class="info-row"><span class="label">Unlimited Pass holder</span><span class="value">1 additional free name + 20% off all registrations</span></div>
        <div class="info-row"><span class="label">ENS names</span><span class="value">Suggested on registration page</span></div>
      </div>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Progressive pricing</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        Registering multiple names gets <strong style="color:#fff">progressively more expensive</strong>.
        The contract tracks how many names each wallet registers within a 90-day window and applies multipliers:
      </p>
      <div class="info-grid">
        <div class="info-row"><span class="label">Names 1&ndash;3</span><span class="value">1x ($5 each)</span></div>
        <div class="info-row"><span class="label">Names 4&ndash;5</span><span class="value">2.5x ($12.50 each)</span></div>
        <div class="info-row"><span class="label">Names 6&ndash;7</span><span class="value">5x ($25 each)</span></div>
        <div class="info-row"><span class="label">Names 8+</span><span class="value">10x ($50 each)</span></div>
      </div>
      <p style="color:#6b8f6b;font-size:0.85rem;margin-top:0.75rem">
        Your first name is free. Progressive pricing applies starting from your second name. The 90-day window resets automatically.
      </p>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Namespaces</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        Turn any hazza name into a namespace and issue subnames under it.<br>
        Useful for teams, organizations, or agent networks &mdash; e.g. <strong style="color:#fff">alice.yourname</strong>, <strong style="color:#fff">bot.yourname</strong>.
      </p>
      <div class="info-grid">
        <div class="info-row"><span class="label">Enable namespaces</span><span class="value">Free (permanent, cannot be undone)</span></div>
        <div class="info-row"><span class="label">Issue subname</span><span class="value">$1 each</span></div>
      </div>
      <p style="color:#6b8f6b;font-size:0.85rem;margin-top:0.75rem">
        Each subname is its own full hazza name with a profile, agent, and DNS.
      </p>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Learn more</div>
      <div class="info-grid">
        <div class="info-row"><span class="label"><a href="/pricing/protections">Protections</a></span><span class="value">Anti-squatting, rate limits, and name rights</span></div>
        <div class="info-row"><span class="label"><a href="/pricing/details">Fine print</a></span><span class="value">Payment, ownership, name rules, and contract</span></div>
      </div>
    </div>

    <div style="text-align:center;margin:2rem 0">
      <a href="/" style="display:inline-block;padding:0.75rem 2rem;background:#00e676;color:#000;border-radius:8px;font-weight:700">Search for a name</a>
    </div>`
  );
}

// =========================================================================
//                     PRICING / PROTECTIONS SUB-PAGE
// =========================================================================

export function pricingProtectionsPage(): string {
  return shell(
    "hazza \u2014 immediately useful names",
    "Anti-squatting, front-running, rate limits, and name rights for hazza registrations.",
    `
    <div class="header">
      <h1>protections</h1>
    </div>

    <div class="section">
      <div class="section-title">Progressive pricing</div>
      <p style="color:#aaa;line-height:1.7">
        Bulk registration is deterred by progressively increasing prices. See the full breakdown on the <a href="/pricing">pricing page</a>.
      </p>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Rate limits</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        New wallets have registration limits that relax over time.<br>
        Holding a <a href="https://netlibrary.app">Net Library</a> membership or Unlimited Pass increases your limits.
      </p>
      <div class="info-grid">
        <div class="info-row"><span class="label">Non-member (week 1)</span><span class="value">1 name/day, 10 total</span></div>
        <div class="info-row"><span class="label">Non-member (after week 1)</span><span class="value">3 names/day, 10 total</span></div>
        <div class="info-row"><span class="label"><a href="https://netlibrary.app">Net Library</a> member (week 1)</span><span class="value">3 names/day, 30 total</span></div>
        <div class="info-row"><span class="label"><a href="https://netlibrary.app">Net Library</a> member (after)</span><span class="value">Unlimited daily, 30 total</span></div>
        <div class="info-row"><span class="label">Unlimited Pass holder</span><span class="value">No limits</span></div>
      </div>
      <p style="color:#6b8f6b;font-size:0.85rem;margin-top:0.75rem">
        Net Library membership is a <a href="https://netlibrary.app">netlibrary.eth</a> subname ($2).<br>
        The <a href="https://netlibrary.app">Unlimited Pass</a> ($10) unlocks unlimited hazza registrations, 20% discount, and 1 free name. Free name tracked by Net Library member number &mdash; one per member, ever.
      </p>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Name rights</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        hazza names are <strong style="color:#fff">first-come, first-served</strong>.
        There is no challenge or dispute system. Progressive pricing and rate limits provide the anti-squatting protection.
      </p>
      <div class="info-grid">
        <div class="info-row"><span class="label">Ownership</span><span class="value">Whoever registers first, owns it</span></div>
        <div class="info-row"><span class="label">Protection</span><span class="value">Progressive pricing deters bulk registration</span></div>
      </div>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Front-running protection</div>
      <p style="color:#aaa;line-height:1.7">
        The contract supports a <strong style="color:#fff">commit-reveal</strong> scheme for front-running protection.<br>
        A user commits a hash of their desired name (hidden from others),
        waits at least 60 seconds, then reveals and pays.<br>
        The default registration flow uses a relayer that handles this automatically.
        Commits expire after 24 hours.
      </p>
    </div>

    <div style="text-align:center;margin:2rem 0">
      <a href="/pricing" style="display:inline-block;padding:0.6rem 1.5rem;border:1px solid #00e676;color:#00e676;border-radius:8px;font-weight:700;font-size:0.9rem">&larr; Back to Pricing</a>
    </div>`
  );
}

// =========================================================================
//                     PRICING / DETAILS SUB-PAGE
// =========================================================================

export function pricingDetailsPage(): string {
  return shell(
    "hazza \u2014 immediately useful names",
    "Fine print \u2014 payment, ownership, and technical details for hazza names.",
    `
    <div class="header">
      <h1>fine print</h1>
    </div>

    <div class="section">
      <div class="section-title">Payment</div>
      <div class="info-grid">
        <div class="info-row"><span class="label">Currency</span><span class="value">USDC on Base</span></div>
        <div class="info-row"><span class="label">Gas</span><span class="value">Paid in ETH on Base (~$0.01 per tx)</span></div>
        <div class="info-row"><span class="label">Agents &amp; CLIs</span><span class="value"><a href="/docs#x402">x402 API</a> for programmatic registration</span></div>
      </div>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Ownership</div>
      <div class="info-grid">
        <div class="info-row"><span class="label">Standard</span><span class="value">ERC-721 NFT on Base</span></div>
        <div class="info-row"><span class="label">Transfer</span><span class="value">Names are transferable via the dashboard</span></div>
        <div class="info-row"><span class="label">Marketplace</span><span class="value">Buy and sell via <a href="/marketplace">Seaport</a></span></div>
        <div class="info-row"><span class="label">Operator</span><span class="value">Grant write access to another address</span></div>
      </div>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Name rules</div>
      <div class="info-grid">
        <div class="info-row"><span class="label">Characters</span><span class="value">Lowercase a&ndash;z, 0&ndash;9, hyphens</span></div>
        <div class="info-row"><span class="label">Length</span><span class="value">1&ndash;64 characters</span></div>
        <div class="info-row"><span class="label">Unicode</span><span class="value">ENSIP-15 emoji &amp; international support</span></div>
        <div class="info-row"><span class="label">First-come</span><span class="value">No challenge or dispute system</span></div>
      </div>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Contract</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        The hazza registry is a non-upgradeable smart contract on Base. All name data, ownership, and text records live onchain.
      </p>
      <div class="info-grid">
        <div class="info-row"><span class="label">Network</span><span class="value">Base (Sepolia testnet)</span></div>
        <div class="info-row"><span class="label">Source</span><span class="value"><a href="https://github.com/geaux-eth/hazza">GitHub</a></span></div>
      </div>
    </div>

    <div style="text-align:center;margin:2rem 0">
      <a href="/pricing" style="display:inline-block;padding:0.6rem 1.5rem;border:1px solid #00e676;color:#00e676;border-radius:8px;font-weight:700;font-size:0.9rem">&larr; Back to Pricing</a>
    </div>`
  );
}

// =========================================================================
//                          DOCS PAGE
// =========================================================================

export function docsPage(): string {
  return shell(
    "hazza \u2014 immediately useful names",
    "CLI, registration flow, API endpoints, contract references, text record keys \u2014 all the hazza documentation needed to be online and onchain.",
    `
    <div class="header">
      <h1>docs</h1>
    </div>

    <div class="info-grid" style="margin-bottom:1.5rem">
      <div class="info-row"><span class="label"><a href="https://github.com/geaux-eth/hazza">GitHub</a></span><span class="value">Source code &amp; contracts</span></div>
      <div class="info-row"><span class="label"><a href="https://github.com/geaux-eth/hazza/tree/main/worker">Worker</a></span><span class="value">API &amp; gateway source</span></div>
    </div>

    <div class="section">
      <div class="section-title">Read Endpoints</div>
      <div class="info-grid">
        <div class="info-row"><span class="label">GET</span><span class="value">/api/available/:name</span></div>
        <div class="info-row"><span class="label">GET</span><span class="value">/api/resolve/:name</span></div>
        <div class="info-row"><span class="label">GET</span><span class="value">/api/profile/:name</span></div>
        <div class="info-row"><span class="label">GET</span><span class="value">/api/text/:name/:key</span></div>
        <div class="info-row"><span class="label">GET</span><span class="value">/api/metadata/:name</span></div>
        <div class="info-row"><span class="label">GET</span><span class="value">/api/price/:name</span></div>
        <div class="info-row"><span class="label">GET</span><span class="value">/api/quote/:name</span></div>
        <div class="info-row"><span class="label">GET</span><span class="value">/api/reverse/:address</span></div>
        <div class="info-row"><span class="label">GET</span><span class="value">/api/names/:address</span></div>
        <div class="info-row"><span class="label">GET</span><span class="value">/api/stats</span></div>
      </div>
      <div class="section-title" style="margin-top:1.5rem">x402 Registration</div>
      <div class="info-grid">
        <div class="info-row"><span class="label">POST</span><span class="value"><a href="#x402">/x402/register</a> &mdash; register a name via HTTP payment</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Check availability</div>
      <div style="background:#111;border:1px solid #1a2e1a;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
        <code style="color:#00e676;font-size:0.85rem">GET /api/available/yourname</code>
        <pre style="color:#aaa;font-size:0.8rem;margin-top:0.5rem;white-space:pre-wrap">{ "name": "yourname", "available": true }</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Full profile</div>
      <div style="background:#111;border:1px solid #1a2e1a;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
        <code style="color:#00e676;font-size:0.85rem">GET /api/profile/geaux</code>
        <pre style="color:#aaa;font-size:0.8rem;margin-top:0.5rem;white-space:pre-wrap">{
  "name": "geaux",
  "registered": true,
  "owner": "0x9616...8097",
  "status": "active",
  "texts": {
    "com.twitter": "@hazzaname",
    "description": "Builder..."
  },
  "url": "https://geaux.hazza.name"
}</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Get a quote</div>
      <div style="background:#111;border:1px solid #1a2e1a;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
        <code style="color:#00e676;font-size:0.85rem">GET /api/quote/myname?wallet=0x...&ensImport=true</code>
        <pre style="color:#aaa;font-size:0.8rem;margin-top:0.5rem;white-space:pre-wrap">{
  "total": "6.50",
  "registrationFee": "2.50",
  "lineItems": [...]
}</pre>
      </div>
    </div>

    <div id="write-api" class="section">
      <div class="section-title">Write API</div>
      <p style="color:#6b8f6b;font-size:0.8rem;margin-bottom:0.75rem">
        All write operations are onchain Base transactions. Gas cost is typically ~$0.01 per transaction.
      </p>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        Manage your name programmatically with API keys. Generate a key on the <a href="/manage">manage page</a>, then use it to build transactions from any bot, CLI, or server.
      </p>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        All write endpoints require <strong style="color:#fff">Authorization: Bearer &lt;api-key&gt;</strong> and return <strong style="color:#fff">unsigned transaction data</strong> (to, data, chainId) that you sign and submit with your own wallet. No relay needed &mdash; you keep full control.
      </p>
    </div>

    <div class="section">
      <div class="section-title">Set a text record</div>
      <div style="background:#111;border:1px solid #1a2e1a;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
        <code style="color:#00e676;font-size:0.85rem">POST /api/text/:name</code>
        <pre style="color:#aaa;font-size:0.8rem;margin-top:0.5rem;white-space:pre-wrap">curl -X POST https://hazza.name/api/text/geaux \\
  -H "Authorization: Bearer 0xYOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"key": "description", "value": "hello world"}'</pre>
        <pre style="color:#6b8f6b;font-size:0.75rem;margin-top:0.5rem;white-space:pre-wrap">{ "name": "geaux", "key": "description",
  "tx": { "to": "0x...", "data": "0x...", "chainId": 84532 } }</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Batch set text records</div>
      <div style="background:#111;border:1px solid #1a2e1a;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
        <code style="color:#00e676;font-size:0.85rem">POST /api/text/:name/batch</code>
        <pre style="color:#aaa;font-size:0.8rem;margin-top:0.5rem;white-space:pre-wrap">curl -X POST https://hazza.name/api/text/geaux/batch \\
  -H "Authorization: Bearer 0xYOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"records": [
    {"key": "com.twitter", "value": "@handle"},
    {"key": "description", "value": "my bio"}
  ]}'</pre>
        <pre style="color:#6b8f6b;font-size:0.75rem;margin-top:0.5rem;white-space:pre-wrap">{ "name": "geaux", "txs": [
  { "key": "com.twitter", "tx": { "to": "0x...", "data": "0x...", "chainId": 84532 } },
  ...
] }</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Set custom domain</div>
      <div style="background:#111;border:1px solid #1a2e1a;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
        <code style="color:#00e676;font-size:0.85rem">POST /api/domain/:name</code>
        <pre style="color:#aaa;font-size:0.8rem;margin-top:0.5rem;white-space:pre-wrap">curl -X POST https://hazza.name/api/domain/geaux \\
  -H "Authorization: Bearer 0xYOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"domain": "example.com"}'</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Set operator</div>
      <div style="background:#111;border:1px solid #1a2e1a;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
        <code style="color:#00e676;font-size:0.85rem">POST /api/operator/:name</code>
        <pre style="color:#aaa;font-size:0.8rem;margin-top:0.5rem;white-space:pre-wrap">curl -X POST https://hazza.name/api/operator/geaux \\
  -H "Authorization: Bearer 0xYOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"address": "0x..."}'</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Submitting transactions</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        The API returns unsigned transaction data. Sign and submit with your own wallet:
      </p>
      <div style="background:#111;border:1px solid #1a2e1a;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
        <pre style="color:#aaa;font-size:0.8rem;white-space:pre-wrap">// ethers.js
const response = await fetch('/api/text/geaux', { ... });
const { tx } = await response.json();
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
await signer.sendTransaction(tx);

// cast (foundry)
cast send $TO $DATA --private-key $KEY --rpc-url $RPC</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Text record keys</div>
      <div class="info-grid">
        <div class="info-row"><span class="label">description</span><span class="value">Bio / about text</span></div>
        <div class="info-row"><span class="label">avatar</span><span class="value">Profile image URL</span></div>
        <div class="info-row"><span class="label">url</span><span class="value">Website URL</span></div>
        <div class="info-row"><span class="label">com.twitter</span><span class="value">Twitter / X handle</span></div>
        <div class="info-row"><span class="label">xyz.farcaster</span><span class="value">Farcaster handle</span></div>
        <div class="info-row"><span class="label">com.github</span><span class="value">GitHub username</span></div>
        <div class="info-row"><span class="label">org.telegram</span><span class="value">Telegram username</span></div>
        <div class="info-row"><span class="label">com.discord</span><span class="value">Discord username</span></div>
        <div class="info-row"><span class="label">com.linkedin</span><span class="value">LinkedIn username</span></div>
        <div class="info-row"><span class="label">agent.endpoint</span><span class="value">AI agent API URL</span></div>
        <div class="info-row"><span class="label">agent.model</span><span class="value">AI model name</span></div>
        <div class="info-row"><span class="label">agent.status</span><span class="value">Agent status (online/offline)</span></div>
      </div>
      <p style="color:#6b8f6b;font-size:0.8rem;margin-top:0.75rem">Any string key is valid. The keys above are conventions used by the profile page and other hazza integrations.</p>
    </div>

    <hr class="divider">

    <div id="x402" class="section">
      <div class="section-title">x402 &mdash; Register via HTTP payment</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        The <strong style="color:#fff">x402 protocol</strong> lets agents, CLIs, and any HTTP client register names programmatically.
        Send a POST, get a price quote, pay USDC onchain, retry with proof &mdash; done.
      </p>
    </div>

    <div class="section">
      <div class="section-title">Step 1: Request registration</div>
      <div style="background:#111;border:1px solid #1a2e1a;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
        <code style="color:#00e676;font-size:0.85rem">POST /x402/register</code>
        <pre style="color:#aaa;font-size:0.8rem;margin-top:0.5rem;white-space:pre-wrap">curl -X POST https://hazza.name/x402/register \\
  -H "Content-Type: application/json" \\
  -d '{"name": "alice", "owner": "0xYOUR_WALLET", "years": 1}'</pre>
        <pre style="color:#6b8f6b;font-size:0.75rem;margin-top:0.5rem;white-space:pre-wrap">&larr; 402 Payment Required
{
  "x402Version": "1",
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "5000000",
    "asset": "0x06A0...USDC",
    "payTo": "0xa6eB...relayer"
  }],
  "name": "alice",
  "price": "5",
  "currency": "USDC"
}</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Step 2: Pay USDC onchain</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        Transfer the quoted USDC amount to the <strong style="color:#fff">payTo</strong> address. Use any method &mdash; wallet, cast, ethers.js, viem.
      </p>
      <div style="background:#111;border:1px solid #1a2e1a;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
        <pre style="color:#aaa;font-size:0.8rem;white-space:pre-wrap"># cast (foundry)
cast send $USDC "transfer(address,uint256)" \\
  $RELAYER_ADDRESS 5000000 \\
  --rpc-url https://sepolia.base.org \\
  --private-key $KEY</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Step 3: Retry with payment proof</div>
      <div style="background:#111;border:1px solid #1a2e1a;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
        <code style="color:#00e676;font-size:0.85rem">POST /x402/register + X-PAYMENT header</code>
        <pre style="color:#aaa;font-size:0.8rem;margin-top:0.5rem;white-space:pre-wrap"># Base64-encode the payment proof
PAYMENT=$(echo -n '{"scheme":"exact","txHash":"0x...","from":"0x..."}' | base64)

curl -X POST https://hazza.name/x402/register \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: $PAYMENT" \\
  -d '{"name": "alice", "owner": "0xYOUR_WALLET", "years": 1}'</pre>
        <pre style="color:#6b8f6b;font-size:0.75rem;margin-top:0.5rem;white-space:pre-wrap">&larr; 200 OK
X-PAYMENT-RESPONSE: 0x...registrationTxHash
{
  "name": "alice",
  "owner": "0xYOUR_WALLET",
  "tokenId": "42",
  "registrationTx": "0x...",
  "profileUrl": "https://alice.hazza.name"
}</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">x402 payment object</div>
      <div class="info-grid">
        <div class="info-row"><span class="label">scheme</span><span class="value">"exact" &mdash; direct USDC transfer</span></div>
        <div class="info-row"><span class="label">txHash</span><span class="value">The USDC transfer transaction hash</span></div>
        <div class="info-row"><span class="label">from</span><span class="value">The wallet that sent the USDC</span></div>
      </div>
      <p style="color:#6b8f6b;font-size:0.8rem;margin-top:0.75rem">
        The X-PAYMENT header is base64-encoded JSON. The server verifies the USDC transfer onchain before registering.
        Each tx hash can only be used once (replay protection).
      </p>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Contract</div>
      <div class="info-grid">
        <div class="info-row"><span class="label">Network</span><span class="value">Base Sepolia (testnet)</span></div>
        <div class="info-row"><span class="label">Registry</span><span class="value" style="font-size:0.75rem">0x9B31E8892B95fa92DB3974951859B400cD282280</span></div>
        <div class="info-row"><span class="label">USDC</span><span class="value" style="font-size:0.75rem">0x06A096A051906dEDd05Ef22dCF61ca1199bb038c</span></div>
        <div class="info-row"><span class="label">Source</span><span class="value"><a href="https://github.com/geaux-eth/hazza">github.com/geaux-eth/hazza</a></span></div>
      </div>
      <p style="color:#ffab00;font-size:0.8rem">(Currently on Base Sepolia testnet. Addresses will change at mainnet launch.)</p>
    </div>`
  );
}

// =========================================================================
//                          DOMAINS PAGE
// =========================================================================

export function domainsPage(): string {
  return shell(
    "hazza \u2014 immediately useful names",
    "Link your domain to your hazza name. Whether it\u2019s a .com, .xyz, .io \u2014 route your DNS to your onchain profile.",
    `
    <div class="header">
      <h1>custom domains</h1>
    </div>

    <div class="section">
      <div class="section-title">Bring your own domain</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        Every hazza name gets a live subdomain at <strong style="color:#fff">yourname.hazza.name</strong> automatically.<br>
        But you can also link any domain you already own &mdash; .com, .xyz, .io, whatever &mdash; and it will resolve to your onchain profile.
      </p>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">How to link your domain</div>
      <div class="info-grid">
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">1. Register</span><span class="value">Get a hazza name at <a href="/register">/register</a></span></div>
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">2. Buy a domain</span><span class="value">Use any registrar &mdash; Namecheap, GoDaddy, Cloudflare, etc.</span></div>
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">3. Point DNS</span><span class="value">Add a CNAME record pointing to <strong style="color:#00e676">hazza.name</strong></span></div>
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">4. Link onchain</span><span class="value">Call <code style="color:#00e676">setCustomDomain</code> on the contract (or use the API)</span></div>
      </div>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">What you get</div>
      <div class="info-grid">
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">Routing</span><span class="value">Your domain resolves to your hazza profile, agent endpoint, or custom content</span></div>
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">Subdomain</span><span class="value">yourname.hazza.name always works &mdash; free and included</span></div>
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">Onchain</span><span class="value">Domain mapping is stored in the hazza contract &mdash; verifiable and permanent</span></div>
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">Flexible</span><span class="value">Point at your profile, custom HTML via <a href="https://netprotocol.app" style="font-weight:700">Net Protocol</a>, or your own server</span></div>
      </div>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">DNS setup</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        At your domain registrar, add these DNS records:
      </p>
      <div style="background:#111;border:1px solid #1a2e1a;border-radius:8px;padding:1rem;margin-bottom:1rem">
        <pre style="color:#aaa;font-size:0.85rem;white-space:pre-wrap;margin:0"><span style="color:#6b8f6b">Type</span>    <span style="color:#6b8f6b">Name</span>    <span style="color:#6b8f6b">Value</span>
CNAME   @       hazza.name
CNAME   www     hazza.name</pre>
      </div>
      <p style="color:#888;font-size:0.85rem;line-height:1.7">
        Some registrars don't support CNAME on root (@). Use an A record pointing to hazza's IP, or use a registrar that supports CNAME flattening (Cloudflare, etc.).
      </p>
    </div>

    <hr class="divider">

    <div class="section">
    <div style="text-align:center;margin:2rem 0">
      <a href="/" style="display:inline-block;padding:0.75rem 2rem;background:#00e676;color:#000;border-radius:8px;font-weight:700">Register a name</a>
    </div>`
  );
}

// =========================================================================
//                     DOMAINS / MANAGE SUB-PAGE
// =========================================================================

const DNS_MANAGE_SCRIPT = `
  const $ = id => document.getElementById(id);
  let currentSld = '', currentTld = '', currentRecords = [];

  function splitDomain(d) {
    const parts = d.split('.');
    if (parts.length < 2) return null;
    const tld = parts.pop();
    return { sld: parts.join('.'), tld };
  }

  async function loadDomain() {
    const raw = $('domain-lookup').value.trim().toLowerCase();
    if (!raw) return;
    const parts = splitDomain(raw);
    if (!parts) { $('manage-result').innerHTML = '<span style="color:#ff5252">Enter a full domain (e.g. example.com)</span>'; return; }

    currentSld = parts.sld;
    currentTld = parts.tld;
    $('manage-result').innerHTML = '<span style="color:#888">Loading DNS records...</span>';

    try {
      const res = await fetch('/api/domains/dns/' + currentSld + '/' + currentTld);
      const data = await res.json();
      if (data.error) { $('manage-result').innerHTML = '<span style="color:#ff5252">' + data.error + '</span>'; return; }

      currentRecords = data.records || [];
      $('manage-result').innerHTML = '<span style="color:#00e676">Loaded ' + currentRecords.length + ' records for ' + raw + '</span>';
      $('domain-name-display').textContent = raw;
      renderRecords();
      $('dns-editor').style.display = 'block';
    } catch (e) {
      $('manage-result').innerHTML = '<span style="color:#ff5252">Failed to load DNS records.</span>';
    }
  }

  function renderRecords() {
    let html = '';
    if (currentRecords.length === 0) {
      html = '<p style="color:#888;text-align:center">No DNS records found.</p>';
    }
    for (let i = 0; i < currentRecords.length; i++) {
      const r = currentRecords[i];
      html += '<div style="display:grid;grid-template-columns:80px 100px 1fr 60px 40px;gap:0.5rem;align-items:center;padding:0.5rem 0;border-bottom:1px solid #1a1a1a">';
      html += '<input value="' + (r.name || '@') + '" data-i="' + i + '" data-f="name" style="background:#111;border:1px solid #222;color:#fff;padding:0.3rem 0.5rem;border-radius:4px;font-size:0.8rem;font-family:monospace">';
      html += '<select data-i="' + i + '" data-f="type" style="background:#111;border:1px solid #222;color:#fff;padding:0.3rem;border-radius:4px;font-size:0.8rem">';
      for (const t of ['A','AAAA','CNAME','MX','TXT','NS','URL301']) {
        html += '<option' + (r.type === t ? ' selected' : '') + '>' + t + '</option>';
      }
      html += '</select>';
      html += '<input value="' + (r.address || '') + '" data-i="' + i + '" data-f="address" style="background:#111;border:1px solid #222;color:#fff;padding:0.3rem 0.5rem;border-radius:4px;font-size:0.8rem;font-family:monospace">';
      html += '<input value="' + (r.ttl || '1800') + '" data-i="' + i + '" data-f="ttl" style="background:#111;border:1px solid #222;color:#fff;padding:0.3rem 0.5rem;border-radius:4px;font-size:0.8rem;width:60px;text-align:center">';
      html += '<button onclick="removeRecord(' + i + ')" style="background:none;border:none;color:#ff5252;cursor:pointer;font-size:1rem" title="Remove">x</button>';
      html += '</div>';
    }
    $('records-list').innerHTML = html;

    // Attach change listeners
    $('records-list').querySelectorAll('input,select').forEach(el => {
      el.addEventListener('change', () => {
        const i = parseInt(el.dataset.i);
        const f = el.dataset.f;
        currentRecords[i][f] = el.value;
      });
    });
  }

  function addRecord() {
    currentRecords.push({ name: '@', type: 'A', address: '', ttl: '1800' });
    renderRecords();
  }

  function removeRecord(i) {
    currentRecords.splice(i, 1);
    renderRecords();
  }

  async function saveRecords() {
    $('save-status').innerHTML = '<span style="color:#888">Saving...</span>';
    try {
      const res = await fetch('/api/domains/dns/' + currentSld + '/' + currentTld, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: currentRecords }),
      });
      const data = await res.json();
      if (data.error) { $('save-status').innerHTML = '<span style="color:#ff5252">' + data.error + '</span>'; return; }
      if (data.success) {
        $('save-status').innerHTML = '<span style="color:#00e676">Saved ' + data.recordCount + ' records.</span>';
      } else {
        $('save-status').innerHTML = '<span style="color:#ff5252">Save failed.</span>';
      }
    } catch (e) {
      $('save-status').innerHTML = '<span style="color:#ff5252">Save failed.</span>';
    }
  }

  // Quick setup presets
  function applyPreset(type) {
    if (type === 'profile') {
      currentRecords = [
        { name: '@', type: 'CNAME', address: 'hazza.name', ttl: '1800' },
        { name: 'www', type: 'CNAME', address: 'hazza.name', ttl: '1800' },
      ];
    } else if (type === 'server') {
      const ip = prompt('Enter your server IP address:');
      if (!ip) return;
      currentRecords = [
        { name: '@', type: 'A', address: ip, ttl: '1800' },
        { name: 'www', type: 'A', address: ip, ttl: '1800' },
      ];
    }
    renderRecords();
  }

  $('domain-lookup-btn').addEventListener('click', loadDomain);
  $('domain-lookup').addEventListener('keydown', e => { if (e.key === 'Enter') loadDomain(); });
`;

export function domainsManagePage(): string {
  return shell(
    "hazza \u2014 immediately useful names",
    "Manage DNS records, nameservers, and routing for your hazza name.",
    `
    <div class="header">
      <h1>manage dns</h1>
    </div>

    <div class="section">
      <p style="color:#aaa;line-height:1.7;margin-bottom:1.5rem">
        Load your domain to view and edit DNS records. Changes propagate in real time.
      </p>

      <div class="search-box" style="margin-bottom:1.5rem">
        <input type="text" id="domain-lookup" placeholder="enter your domain (e.g. example.com)..." autocomplete="off" spellcheck="false">
        <button id="domain-lookup-btn">Load</button>
      </div>
      <div class="result" id="manage-result" style="text-align:center;color:#aaa;font-size:0.95rem;min-height:1.5rem"></div>
    </div>

    <div id="dns-editor" style="display:none">
      <hr class="divider">

      <div class="section">
        <div class="section-title">DNS records &mdash; <span id="domain-name-display" style="color:#00e676"></span></div>
        <div id="records-list" style="margin-bottom:1rem"></div>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem">
          <button onclick="addRecord()" style="padding:0.4rem 1rem;background:none;border:1px solid #00e676;color:#00e676;border-radius:6px;font-size:0.85rem;cursor:pointer;font-family:'Rubik',sans-serif">+ Add Record</button>
          <button onclick="saveRecords()" style="padding:0.4rem 1rem;background:#00e676;color:#000;border:none;border-radius:6px;font-size:0.85rem;cursor:pointer;font-weight:700;font-family:'Rubik',sans-serif">Save All</button>
        </div>
        <div id="save-status" style="font-size:0.85rem;min-height:1.25rem"></div>
      </div>

      <hr class="divider">

      <div class="section">
        <div class="section-title">Quick setup</div>
        <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
          Apply a preset configuration with one click. This replaces all existing records.
        </p>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
          <button onclick="applyPreset('profile')" style="padding:0.5rem 1rem;background:none;border:1px solid #1a2e1a;color:#aaa;border-radius:6px;font-size:0.85rem;cursor:pointer;font-family:'Rubik',sans-serif">hazza Profile</button>
          <button onclick="applyPreset('server')" style="padding:0.5rem 1rem;background:none;border:1px solid #1a2e1a;color:#aaa;border-radius:6px;font-size:0.85rem;cursor:pointer;font-family:'Rubik',sans-serif">External Server</button>
        </div>
      </div>
    </div>

    <div style="text-align:center;margin:2rem 0">
      <a href="/domains" style="display:inline-block;padding:0.6rem 1.5rem;border:1px solid #00e676;color:#00e676;border-radius:8px;font-weight:700;font-size:0.9rem">&larr; Back to Domains</a>
    </div>`,
    DNS_MANAGE_SCRIPT
  );
}

// =========================================================================
//                         MARKETPLACE PAGE
// =========================================================================

const MARKETPLACE_STYLES = `
  .tabs { display: flex; gap: 0; border-bottom: 2px solid #1a2e1a; margin-bottom: 1.5rem; }
  .tab {
    padding: 0.75rem 1.25rem;
    background: none;
    border: none;
    color: #fff;
    font-family: 'Rubik', sans-serif;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: color 0.15s, border-color 0.15s;
  }
  .tab:hover { color: #00e676; }
  .tab.active { color: #00e676; border-bottom-color: #00e676; font-weight: 700; }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }
  .listing-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
  .listing-card {
    background: #111;
    border: 1px solid #1a2e1a;
    border-radius: 10px;
    padding: 1.25rem;
    transition: border-color 0.15s;
    position: relative;
  }
  .listing-card:hover { border-color: #00e676; }
  .listing-name { font-size: 1.15rem; font-weight: 700; color: #fff; margin-bottom: 0.25rem; }
  .listing-name a { color: #fff; }
  .listing-name a:hover { color: #00e676; }
  .listing-meta { font-size: 0.8rem; color: #6b8f6b; margin-bottom: 0.75rem; }
  .listing-price { font-size: 1.3rem; font-weight: 900; color: #fff; }
  .currency-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    margin-left: 0.5rem;
    vertical-align: middle;
  }
  .badge-eth { background: #3b82f6; color: #fff; }
  .badge-usdc { background: #00e676; color: #000; }
  .listing-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
  .btn-buy {
    flex: 1;
    padding: 0.6rem;
    background: #00e676;
    color: #000;
    border: none;
    border-radius: 6px;
    font-weight: 700;
    font-family: 'Rubik', sans-serif;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .btn-buy:hover { background: #00c853; }
  .btn-watch {
    padding: 0.6rem 0.75rem;
    background: transparent;
    border: 1px solid #1a2e1a;
    border-radius: 6px;
    color: #6b8f6b;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
  }
  .btn-watch:hover { border-color: #00e676; color: #00e676; }
  .btn-watch.saved { color: #00e676; border-color: #00e676; }
  .watch-count { font-size: 0.7rem; color: #4a6a4a; margin-top: 0.35rem; text-align: right; }
  .sell-form {
    background: #0d0d0d;
    border: 1px solid #1a2e1a;
    border-radius: 8px;
    padding: 1rem;
    margin-top: 0.75rem;
  }
  .sell-form label { display: block; color: #6b8f6b; font-size: 0.8rem; margin-bottom: 0.25rem; }
  .sell-form input, .sell-form select {
    width: 100%;
    padding: 0.5rem;
    background: #111;
    border: 1px solid #1a2e1a;
    border-radius: 6px;
    color: #fff;
    font-family: 'Rubik', sans-serif;
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }
  .sell-form input:focus, .sell-form select:focus { border-color: #00e676; outline: none; }
  .btn-sell {
    width: 100%;
    padding: 0.6rem;
    background: #00e676;
    color: #000;
    border: none;
    border-radius: 6px;
    font-weight: 700;
    font-family: 'Rubik', sans-serif;
    cursor: pointer;
  }
  .btn-cancel {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid #ff5252;
    color: #ff5252;
    border-radius: 6px;
    font-weight: 700;
    font-family: 'Rubik', sans-serif;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .btn-cancel:hover { background: #ff5252; color: #fff; }
  .name-card {
    background: #111;
    border: 1px solid #1a2e1a;
    border-radius: 10px;
    padding: 1rem 1.25rem;
    margin-bottom: 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .name-card-info { flex: 1; min-width: 200px; }
  .name-card-name { font-weight: 700; color: #fff; font-size: 1rem; }
  .name-card-detail { font-size: 0.8rem; color: #6b8f6b; }
  .name-card-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .name-card-actions a, .name-card-actions button {
    padding: 0.4rem 0.85rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: 'Rubik', sans-serif;
    cursor: pointer;
    text-decoration: none;
    border: 1px solid #1a2e1a;
    background: transparent;
    color: #6b8f6b;
  }
  .name-card-actions a:hover, .name-card-actions button:hover { border-color: #00e676; color: #00e676; text-decoration: none; }
  .sales-table { width: 100%; border-collapse: collapse; }
  .sales-table th { text-align: left; padding: 0.5rem; color: #6b8f6b; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #1a2e1a; }
  .sales-table td { padding: 0.6rem 0.5rem; border-bottom: 1px solid #0d1a0d; font-size: 0.85rem; }
  .empty-state { text-align: center; padding: 3rem 1rem; color: #4a6a4a; }
  .empty-state p { margin-bottom: 1rem; }
  .offer-card {
    background: #111;
    border: 1px solid #1a2e1a;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .cart-fab {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #00e676;
    color: #000;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0,230,118,0.3);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .cart-fab .badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #ff5252;
    color: #fff;
    border-radius: 50%;
    width: 22px;
    height: 22px;
    font-size: 0.7rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cart-drawer {
    position: fixed;
    top: 0;
    right: -400px;
    width: 380px;
    max-width: 90vw;
    height: 100vh;
    background: #0a0a0a;
    border-left: 1px solid #1a2e1a;
    z-index: 200;
    transition: right 0.3s ease;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .cart-drawer.open { right: 0; }
  .cart-drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #1a2e1a;
  }
  .cart-drawer-header h3 { color: #fff; font-size: 1rem; margin: 0; }
  .cart-drawer-close {
    background: none;
    border: none;
    color: #6b8f6b;
    font-size: 1.5rem;
    cursor: pointer;
    line-height: 1;
  }
  .cart-items { flex: 1; overflow-y: auto; padding: 1rem 1.25rem; }
  .cart-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid #0d1a0d;
  }
  .cart-item-info { flex: 1; }
  .cart-item-type { font-size: 0.7rem; color: #4a6a4a; text-transform: uppercase; letter-spacing: 0.05em; }
  .cart-item-name { font-weight: 700; color: #fff; font-size: 0.9rem; }
  .cart-item-price { font-size: 0.85rem; color: #6b8f6b; }
  .cart-item-remove {
    background: none;
    border: none;
    color: #ff5252;
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0.25rem;
  }
  .cart-footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid #1a2e1a;
  }
  .cart-total { color: #fff; font-weight: 700; margin-bottom: 0.75rem; font-size: 0.9rem; }
  .btn-execute {
    width: 100%;
    padding: 0.75rem;
    background: #00e676;
    color: #000;
    border: none;
    border-radius: 8px;
    font-weight: 700;
    font-family: 'Rubik', sans-serif;
    font-size: 1rem;
    cursor: pointer;
  }
  .btn-execute:hover { background: #00c853; }
  .btn-execute:disabled { background: #1a2e1a; color: #4a6a4a; cursor: not-allowed; }
  .cart-saved-section { margin-top: 1rem; }
  .cart-saved-title { font-size: 0.75rem; color: #6b8f6b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
  .progress-bar {
    background: #111;
    border: 1px solid #1a2e1a;
    border-radius: 8px;
    padding: 1rem;
    margin-top: 0.75rem;
  }
  .progress-step { padding: 0.25rem 0; font-size: 0.85rem; color: #6b8f6b; }
  .progress-step.done { color: #00e676; }
  .progress-step.active { color: #fff; }
  .progress-step.error { color: #ff5252; }
  @media (max-width: 600px) {
    .listing-grid { grid-template-columns: 1fr; }
    .cart-drawer { width: 100vw; max-width: 100vw; right: -100vw; }
    .tabs { overflow-x: auto; }
    .tab { white-space: nowrap; font-size: 0.8rem; padding: 0.6rem 0.9rem; }
  }
`;

export function marketplacePage(registryAddress: string, usdcAddress: string, chainId: string, seaportAddress: string, bazaarAddress: string, batchExecutorAddress: string, treasuryAddress: string, marketplaceFeeBps: string, wethAddress: string): string {
  const SEAPORT_ABI_SNIPPET = JSON.stringify([
    { name: "fulfillOrder", type: "function", stateMutability: "payable",
      inputs: [{ name: "order", type: "tuple", components: [
        { name: "parameters", type: "tuple", components: [
          { name: "offerer", type: "address" }, { name: "zone", type: "address" },
          { name: "offer", type: "tuple[]", components: [{ name: "itemType", type: "uint8" }, { name: "token", type: "address" }, { name: "identifierOrCriteria", type: "uint256" }, { name: "startAmount", type: "uint256" }, { name: "endAmount", type: "uint256" }] },
          { name: "consideration", type: "tuple[]", components: [{ name: "itemType", type: "uint8" }, { name: "token", type: "address" }, { name: "identifierOrCriteria", type: "uint256" }, { name: "startAmount", type: "uint256" }, { name: "endAmount", type: "uint256" }, { name: "recipient", type: "address" }] },
          { name: "orderType", type: "uint8" }, { name: "startTime", type: "uint256" }, { name: "endTime", type: "uint256" },
          { name: "zoneHash", type: "bytes32" }, { name: "salt", type: "uint256" }, { name: "conduitKey", type: "bytes32" }, { name: "totalOriginalConsiderationItems", type: "uint256" }
        ]},
        { name: "signature", type: "bytes" }
      ]}, { name: "fulfillerConduitKey", type: "bytes32" }],
      outputs: [{ name: "fulfilled", type: "bool" }]
    },
    { name: "cancel", type: "function", stateMutability: "nonpayable",
      inputs: [{ name: "orders", type: "tuple[]", components: [
        { name: "offerer", type: "address" }, { name: "zone", type: "address" },
        { name: "offer", type: "tuple[]", components: [{ name: "itemType", type: "uint8" }, { name: "token", type: "address" }, { name: "identifierOrCriteria", type: "uint256" }, { name: "startAmount", type: "uint256" }, { name: "endAmount", type: "uint256" }] },
        { name: "consideration", type: "tuple[]", components: [{ name: "itemType", type: "uint8" }, { name: "token", type: "address" }, { name: "identifierOrCriteria", type: "uint256" }, { name: "startAmount", type: "uint256" }, { name: "endAmount", type: "uint256" }, { name: "recipient", type: "address" }] },
        { name: "orderType", type: "uint8" }, { name: "startTime", type: "uint256" }, { name: "endTime", type: "uint256" },
        { name: "zoneHash", type: "bytes32" }, { name: "salt", type: "uint256" }, { name: "conduitKey", type: "bytes32" }, { name: "totalOriginalConsiderationItems", type: "uint256" },
        { name: "counter", type: "uint256" }
      ]}],
      outputs: [{ name: "cancelled", type: "bool" }]
    }
  ]);

  const ERC721_APPROVE_ABI = JSON.stringify([
    { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [] },
    { name: "setApprovalForAll", type: "function", stateMutability: "nonpayable", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [] },
    { name: "isApprovedForAll", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "operator", type: "address" }], outputs: [{ type: "bool" }] },
  ]);

  const ERC20_ABI = JSON.stringify([
    { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
    { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
    { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
    { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
    { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  ]);

  const script = `
    var REGISTRY = '${esc(registryAddress)}';
    var USDC = '${esc(usdcAddress)}';
    var CHAIN_ID = '${esc(chainId)}';
    var SEAPORT = '${esc(seaportAddress)}';
    var BAZAAR = '${esc(bazaarAddress)}';
    var BATCH_EXECUTOR = '${esc(batchExecutorAddress)}';
    var TREASURY = '${esc(treasuryAddress)}';
    var FEE_BPS = ${parseInt(marketplaceFeeBps) || 200};
    var WETH = '${esc(wethAddress)}';
    var BATCH_EXECUTOR_ABI = [
      { name: 'executeBatch', type: 'function', stateMutability: 'payable',
        inputs: [
          { name: 'tokens', type: 'tuple[]', components: [
            { name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'spender', type: 'address' }
          ]},
          { name: 'calls', type: 'tuple[]', components: [
            { name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }
          ]}
        ],
        outputs: [{ name: 'results', type: 'tuple[]', components: [
          { name: 'success', type: 'bool' }, { name: 'returnData', type: 'bytes' }
        ]}]
      },
      { name: 'executeBatchSimple', type: 'function', stateMutability: 'payable',
        inputs: [{ name: 'calls', type: 'tuple[]', components: [
          { name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }
        ]}],
        outputs: [{ name: 'results', type: 'tuple[]', components: [
          { name: 'success', type: 'bool' }, { name: 'returnData', type: 'bytes' }
        ]}]
      }
    ];
    var SEAPORT_ABI = ${SEAPORT_ABI_SNIPPET};
    var ERC721_ABI = ${ERC721_APPROVE_ABI};
    var ERC20_ABI = ${ERC20_ABI};
    var wallet = null;
    var provider = null;
    var signer = null;

    function $(id) { return document.getElementById(id); }
    function escHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function truncAddr(a) { return a ? a.slice(0,6) + '...' + a.slice(-4) : ''; }
    function formatDate(ts) { return ts ? new Date(ts * 1000).toLocaleDateString() : '—'; }

    // --- Cart ---
    var cart = JSON.parse(localStorage.getItem('hazza_cart') || '[]');
    var watchlist = JSON.parse(localStorage.getItem('hazza_watchlist') || '[]');

    function saveCart() { localStorage.setItem('hazza_cart', JSON.stringify(cart)); updateCartUI(); }
    function saveWatchlist() { localStorage.setItem('hazza_watchlist', JSON.stringify(watchlist)); }

    function addToCart(item) {
      if (cart.find(function(c) { return c.id === item.id; })) return;
      cart.push(item);
      saveCart();
    }
    function removeFromCart(id) {
      cart = cart.filter(function(c) { return c.id !== id; });
      saveCart();
    }

    function toggleWatch(orderHash, name, price, currency) {
      var idx = watchlist.findIndex(function(w) { return w.orderHash === orderHash; });
      if (idx >= 0) {
        watchlist.splice(idx, 1);
        if (wallet) fetch('/api/marketplace/watch', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({orderHash: orderHash, address: wallet}) }).catch(function(){});
      } else {
        watchlist.push({ orderHash: orderHash, name: name, price: price, currency: currency });
        if (wallet) fetch('/api/marketplace/watch', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({orderHash: orderHash, address: wallet}) }).catch(function(){});
      }
      saveWatchlist();
      renderListings();
    }

    function isWatched(orderHash) {
      return watchlist.some(function(w) { return w.orderHash === orderHash; });
    }

    function updateCartUI() {
      var fab = $('cart-fab');
      var badge = $('cart-badge');
      if (cart.length > 0) {
        fab.style.display = 'flex';
        badge.textContent = cart.length;
      } else {
        fab.style.display = 'none';
      }
    }

    function openCart() { $('cart-drawer').classList.add('open'); renderCartItems(); }
    function closeCart() { $('cart-drawer').classList.remove('open'); }

    function renderCartItems() {
      var container = $('cart-items-list');
      if (cart.length === 0) {
        container.innerHTML = '<p style="color:#4a6a4a;text-align:center;padding:2rem 0">Cart is empty</p>';
        $('cart-total').textContent = '';
        $('btn-execute-all').disabled = true;
      } else {
        var html = '';
        var ethTotal = 0, usdcTotal = 0;
        cart.forEach(function(item) {
          html += '<div class="cart-item">'
            + '<div class="cart-item-info">'
            + '<div class="cart-item-type">' + escHtml(item.type) + '</div>'
            + '<div class="cart-item-name">' + escHtml(item.name) + '</div>'
            + '<div class="cart-item-price">' + item.price + ' ' + item.currency + '</div>'
            + '</div>'
            + '<button class="cart-item-remove" onclick="removeFromCart(\\x27'+item.id+'\\x27)">✕</button>'
            + '</div>';
          if (item.currency === 'ETH') ethTotal += parseFloat(item.price) || 0;
          else usdcTotal += parseFloat(item.price) || 0;
        });
        container.innerHTML = html;
        var totalParts = [];
        if (ethTotal > 0) totalParts.push(ethTotal.toFixed(4) + ' ETH');
        if (usdcTotal > 0) totalParts.push(usdcTotal.toFixed(2) + ' USDC');
        $('cart-total').textContent = 'Total: ' + totalParts.join(' + ');
        $('btn-execute-all').disabled = false;
      }

      // Saved/watchlist section
      var savedContainer = $('cart-saved-list');
      if (watchlist.length > 0) {
        var shtml = '';
        watchlist.forEach(function(w) {
          shtml += '<div class="cart-item">'
            + '<div class="cart-item-info">'
            + '<div class="cart-item-name">' + escHtml(w.name) + '</div>'
            + '<div class="cart-item-price">' + w.price + ' ' + w.currency + '</div>'
            + '</div>'
            + '<button class="btn-buy" style="flex:0;padding:0.4rem 0.6rem;font-size:0.75rem" onclick="addToCart({id:\\x27buy-'+w.orderHash+'\\x27,type:\\x27Buy\\x27,name:\\x27'+escHtml(w.name)+'\\x27,price:\\x27'+w.price+'\\x27,currency:\\x27'+w.currency+'\\x27,orderHash:\\x27'+w.orderHash+'\\x27})">+ cart</button>'
            + '</div>';
        });
        savedContainer.innerHTML = shtml;
        $('cart-saved-section').style.display = 'block';
      } else {
        $('cart-saved-section').style.display = 'none';
      }
    }

    // --- Tabs ---
    function switchTab(tabName) {
      document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
      document.querySelector('[data-tab="'+tabName+'"]').classList.add('active');
      $('panel-'+tabName).classList.add('active');
      if (tabName === 'browse') loadListings();
      else if (tabName === 'mynames') loadMyNames();
      else if (tabName === 'offers') loadOffers();
      else if (tabName === 'sales') loadSales();
      else if (tabName === 'board') loadBoardMessages();
    }

    // --- Connect Wallet ---
    async function connectWallet() {
      if (!window.ethereum) { alert('No wallet detected. Install MetaMask or open in Warpcast.'); return; }
      try {
        var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts[0]) {
          wallet = accounts[0];
          provider = new ethers.BrowserProvider(window.ethereum);
          // Verify correct chain
          var network = await provider.getNetwork();
          var targetChainId = parseInt(CHAIN_ID);
          if (Number(network.chainId) !== targetChainId) {
            try {
              await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + targetChainId.toString(16) }] });
            } catch(switchErr) {
              try {
                await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{
                  chainId: '0x' + targetChainId.toString(16),
                  chainName: targetChainId === 84532 ? 'Base Sepolia' : 'Base',
                  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                  rpcUrls: [targetChainId === 84532 ? 'https://sepolia.base.org' : 'https://mainnet.base.org'],
                  blockExplorerUrls: [targetChainId === 84532 ? 'https://sepolia.basescan.org' : 'https://basescan.org'],
                }]});
              } catch(addErr) { alert('Please add ' + (targetChainId === 84532 ? 'Base Sepolia' : 'Base') + ' to your wallet.'); return; }
            }
            provider = new ethers.BrowserProvider(window.ethereum);
          }
          signer = await provider.getSigner();
          try { sessionStorage.setItem('hazza_wallet', wallet); } catch(e) {}
          var wd = $('mp-wallet-display');
          if (wd) wd.textContent = truncAddr(wallet);
          // Report watchlist to server
          watchlist.forEach(function(w) {
            fetch('/api/marketplace/watch', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({orderHash: w.orderHash, address: wallet}) }).catch(function(){});
          });
          // Show board compose if on board tab
          if ($('board-compose')) { $('board-compose').style.display = 'block'; $('board-connect-prompt').style.display = 'none'; }
        }
      } catch(e) { console.error('Connect failed', e); }
    }

    // --- Browse Listings ---
    var listingsData = [];
    var offersData = [];
    async function loadListings() {
      $('listings-container').innerHTML = '<p style="color:#6b8f6b;text-align:center">Loading listings...</p>';
      try {
        var res = await fetch('/api/marketplace/listings');
        var data = await res.json();
        listingsData = data.listings || [];
        renderListings();
      } catch(e) {
        $('listings-container').innerHTML = '<div class="empty-state"><p>Failed to load listings</p></div>';
      }
    }

    function renderListings() {
      var container = $('listings-container');
      if (listingsData.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No names listed yet.</p><p><a href="#" onclick="event.preventDefault();switchTab(\\x27mynames\\x27)">list a name</a></p></div>';
        return;
      }

      // Apply filters
      var search = ($('mp-search') ? $('mp-search').value : '').toLowerCase().trim();
      var sortBy = $('mp-sort') ? $('mp-sort').value : 'newest';
      var typeFilter = $('mp-type') ? $('mp-type').value : 'all';

      var filtered = listingsData.filter(function(l) {
        if (search && l.name.toLowerCase().indexOf(search) === -1) return false;
        if (typeFilter === 'namespace' && !l.isNamespace) return false;
        if (typeFilter === 'regular' && l.isNamespace) return false;
        return true;
      });

      // Sort
      filtered.sort(function(a, b) {
        if (sortBy === 'price-low') return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
        if (sortBy === 'price-high') return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0);
        if (sortBy === 'name-az') return a.name.localeCompare(b.name);
        return 0; // newest = default API order
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No names match your filters.</p></div>';
        return;
      }

      var html = '<div class="listing-grid">';
      filtered.forEach(function(l) {
        var badgeClass = l.currency === 'USDC' ? 'badge-usdc' : 'badge-eth';
        var watched = isWatched(l.orderHash);
        var nsBadgeHtml = l.isNamespace ? ' <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;background:#00e676;color:#000;font-size:0.6rem;font-weight:900;border-radius:3px;vertical-align:middle;margin-left:0.2rem" title="Namespace">N</span>' : '';
        html += '<div class="listing-card">'
          + '<div class="listing-name"><a href="' + escHtml(l.profileUrl) + '">' + escHtml(l.name) + '<span style="color:#00e676">.hazza.name</span></a>' + nsBadgeHtml + '</div>'
          + '<div class="listing-meta">Seller: ' + truncAddr(l.seller) + ' &middot; Expires: ' + formatDate(l.listingExpiry) + '</div>'
          + '<div class="listing-price">' + l.price + '<span class="currency-badge ' + badgeClass + '">' + l.currency + '</span></div>'
          + '<div class="listing-actions">'
          + '<button class="btn-buy" onclick="buyListing(\\x27' + l.orderHash + '\\x27)">Buy</button>'
          + '<button class="btn-buy" style="background:transparent;border:1px solid #1a2e1a;color:#00e676;flex:0;padding:0.6rem 0.75rem;font-size:0.75rem" onclick="showOfferForm(\\x27' + escHtml(l.name) + '\\x27)">Offer</button>'
          + '<button class="btn-buy" style="background:transparent;border:1px solid #1a2e1a;color:#6b8f6b;flex:0;padding:0.6rem 0.75rem" onclick="addToCart({id:\\x27buy-'+l.orderHash+'\\x27,type:\\x27Buy\\x27,name:\\x27'+escHtml(l.name)+'\\x27,price:\\x27'+l.price+'\\x27,currency:\\x27'+l.currency+'\\x27,orderHash:\\x27'+l.orderHash+'\\x27})">+</button>'
          + '<button class="btn-watch' + (watched ? ' saved' : '') + '" onclick="toggleWatch(\\x27' + l.orderHash + '\\x27,\\x27' + escHtml(l.name) + '\\x27,\\x27' + l.price + '\\x27,\\x27' + l.currency + '\\x27)">' + (watched ? '★' : '☆') + '</button>'
          + '</div>';

        // Watchlist count
        html += '<div class="watch-count" id="wc-' + l.orderHash.slice(0,10) + '"></div>';
        html += '</div>';
      });
      html += '</div>';
      container.innerHTML = html;

      // Load watch counts
      listingsData.forEach(function(l) {
        fetch('/api/marketplace/watch/' + l.orderHash)
          .then(function(r) { return r.json(); })
          .then(function(d) {
            var el = document.getElementById('wc-' + l.orderHash.slice(0,10));
            if (el && d.count > 0) el.textContent = 'in ' + d.count + ' watchlist' + (d.count > 1 ? 's' : '');
          }).catch(function(){});
      });
    }

    // Seaport constants
    var ZONE_PUBLIC = '0x000000007F8c58fbf215bF91Bda7421A806cf3ae';
    var ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
    var SEAPORT_GET_COUNTER_ABI = [{ name: 'getCounter', type: 'function', stateMutability: 'view', inputs: [{ name: 'offerer', type: 'address' }], outputs: [{ type: 'uint256' }] }];
    var BAZAAR_SUBMIT_ABI = [{
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
    }];
    // EIP-712 types for Seaport OrderComponents
    var SEAPORT_EIP712_TYPES = {
      OrderComponents: [
        { name: 'offerer', type: 'address' },
        { name: 'zone', type: 'address' },
        { name: 'offer', type: 'OfferItem[]' },
        { name: 'consideration', type: 'ConsiderationItem[]' },
        { name: 'orderType', type: 'uint8' },
        { name: 'startTime', type: 'uint256' },
        { name: 'endTime', type: 'uint256' },
        { name: 'zoneHash', type: 'bytes32' },
        { name: 'salt', type: 'uint256' },
        { name: 'conduitKey', type: 'bytes32' },
        { name: 'counter', type: 'uint256' }
      ],
      OfferItem: [
        { name: 'itemType', type: 'uint8' },
        { name: 'token', type: 'address' },
        { name: 'identifierOrCriteria', type: 'uint256' },
        { name: 'startAmount', type: 'uint256' },
        { name: 'endAmount', type: 'uint256' }
      ],
      ConsiderationItem: [
        { name: 'itemType', type: 'uint8' },
        { name: 'token', type: 'address' },
        { name: 'identifierOrCriteria', type: 'uint256' },
        { name: 'startAmount', type: 'uint256' },
        { name: 'endAmount', type: 'uint256' },
        { name: 'recipient', type: 'address' }
      ]
    };

    function generateSalt() {
      var bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return '0x' + Array.from(bytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    }

    async function buyListing(orderHash) {
      var listing = listingsData.find(function(l) { return l.orderHash === orderHash; });
      if (!listing) return alert('Listing not found');
      if (!wallet) { await connectWallet(); if (!wallet) return; }

      try {
        // Ask server to prepare the fulfillment tx via Bazaar SDK
        var statusEl = $('buy-status');
        if (statusEl) { statusEl.textContent = 'Preparing transaction...'; statusEl.style.display = 'block'; }

        var res = await fetch('/api/marketplace/fulfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderHash: orderHash, buyerAddress: wallet })
        });
        var data = await res.json();
        if (data.error) return alert('Cannot buy: ' + data.error);

        // Execute approval transactions (e.g. USDC approve to Seaport)
        if (data.approvals && data.approvals.length > 0) {
          if (statusEl) statusEl.textContent = 'Approving tokens...';
          for (var i = 0; i < data.approvals.length; i++) {
            var appTx = await signer.sendTransaction({
              to: data.approvals[i].to,
              data: data.approvals[i].data,
              value: BigInt(data.approvals[i].value || '0')
            });
            await appTx.wait();
          }
        }

        // Execute the fulfillment transaction
        if (statusEl) statusEl.textContent = 'Confirming purchase...';
        var tx = await signer.sendTransaction({
          to: data.fulfillment.to,
          data: data.fulfillment.data,
          value: BigInt(data.fulfillment.value || '0')
        });
        var receipt = await tx.wait();

        if (statusEl) statusEl.style.display = 'none';

        if (receipt.status === 1) {
          alert('Purchase successful! ' + (listing.name || '') + '.hazza.name is now yours.\\n\\nTx: ' + tx.hash);
          loadListings();
        } else {
          alert('Transaction reverted. Check the block explorer for details.');
        }
      } catch(e) {
        if (statusEl) statusEl.style.display = 'none';
        alert('Buy failed: ' + (e.shortMessage || e.message || e));
      }
    }

    // --- My Names ---
    async function loadMyNames() {
      var container = $('mynames-container');
      if (!wallet) {
        container.innerHTML = '<div class="empty-state"><p style="color:#6b8f6b">connect your wallet to see your names</p><p style="color:#444;font-size:0.85rem">tap <strong style="color:#00e676">connect</strong> in the menu above</p></div>';
        return;
      }
      container.innerHTML = '<p style="color:#6b8f6b;text-align:center">Loading your names...</p>';
      try {
        var res = await fetch('/api/names/' + wallet);
        var data = await res.json();
        var names = data.names || [];
        if (names.length === 0) {
          container.innerHTML = '<div class="empty-state"><p>You don\\x27t own any hazza names yet.</p><a href="/register" class="btn-buy" style="display:inline-block;width:auto;padding:0.6rem 1.5rem;text-decoration:none">register your first name — it\\x27s free!</a></div>';
          return;
        }
        var html = '';
        names.forEach(function(n) {
          var statusClass = 'status-' + escHtml(n.status);
          html += '<div class="name-card">'
            + '<div class="name-card-info">'
            + '<div class="name-card-name">' + escHtml(n.name) + '<span style="color:#00e676">.hazza.name</span>'
            + ' <span class="status-badge ' + statusClass + '">' + escHtml(n.status) + '</span></div>'
            + '<div class="name-card-detail">Token #' + escHtml(String(n.tokenId)) + '</div>'
            + '</div>'
            + '<div class="name-card-actions">'
            + '<a href="https://' + encodeURIComponent(n.name) + '.hazza.name">view</a>'
            + '<a href="/manage?name=' + encodeURIComponent(n.name) + '">manage</a>'
            + '<button onclick="showSellForm(\\x27' + escHtml(n.name) + '\\x27, \\x27' + escHtml(String(n.tokenId)) + '\\x27)">list</button>'
            + '<button onclick="shareName(\\x27' + escHtml(n.name) + '\\x27)">share</button>'
            + '</div>'
            + '</div>'
            + '<div id="sell-form-' + escHtml(n.name) + '" style="display:none"></div>';
        });
        container.innerHTML = html;
      } catch(e) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load names: ' + escHtml(e.message || '') + '</p></div>';
      }
    }

    function shareName(name) {
      var url = 'https://' + name + '.hazza.name';
      var text = 'Check out ' + name + '.hazza.name';
      var existing = document.getElementById('share-modal');
      if (existing) existing.remove();
      var overlay = document.createElement('div');
      overlay.id = 'share-modal';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center';
      overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
      var box = document.createElement('div');
      box.style.cssText = 'background:#111;border:1px solid #1a2e1a;border-radius:12px;padding:1.5rem;max-width:320px;width:90%;text-align:center';
      box.innerHTML = '<div style="font-size:1rem;color:#fff;margin-bottom:1rem;font-family:Rubik,sans-serif">Share <strong style="color:#00e676">' + name + '.hazza.name</strong></div>'
        + '<div style="display:flex;gap:1rem;justify-content:center;margin-bottom:1rem">'
        + '<a href="https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url) + '" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;text-decoration:none;gap:0.3rem">'
        + '<svg width="32" height="32" viewBox="0 0 24 24" fill="#fff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>'
        + '<span style="color:#888;font-size:0.7rem;font-family:Rubik,sans-serif">Twitter</span></a>'
        + '<a href="https://warpcast.com/~/compose?text=' + encodeURIComponent(text + ' ' + url) + '" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;text-decoration:none;gap:0.3rem">'
        + '<svg width="32" height="32" viewBox="0 0 24 24" fill="#8a63d2"><path d="M3.77 2h16.46C21.21 2 22 2.79 22 3.77v16.46c0 .98-.79 1.77-1.77 1.77H3.77C2.79 22 2 21.21 2 20.23V3.77C2 2.79 2.79 2 3.77 2zm3.48 4.3L5.6 12.26h2.18l.89 5.44h2.07l1.26-7.4 1.26 7.4h2.07l.89-5.44h2.18L16.75 6.3h-2.82l-.93 5.5-.93-5.5H8.07z"/></svg>'
        + '<span style="color:#888;font-size:0.7rem;font-family:Rubik,sans-serif">Farcaster</span></a>'
        + '</div>'
        + '<button id="share-copy-btn" style="width:100%;padding:0.6rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.85rem;font-family:Rubik,sans-serif">Copy URL</button>';
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      document.getElementById('share-copy-btn').onclick = function(e) {
        e.stopPropagation();
        navigator.clipboard.writeText(url).then(function() {
          var btn = document.getElementById('share-copy-btn');
          btn.textContent = 'Copied!';
          btn.style.background = '#00e676';
          btn.style.color = '#000';
          setTimeout(function(){ overlay.remove(); }, 1200);
        });
      };
    }

    function showSellForm(name, tokenId) {
      if (!tokenId || tokenId === 'undefined') {
        alert('Token ID not found. Please select a name from My Names first.');
        return;
      }
      var el = $('sell-form-' + name);
      if (!el) return;
      if (el.style.display === 'block') { el.style.display = 'none'; return; }
      el.style.display = 'block';
      el.innerHTML = '<div class="sell-form">'
        + '<label>Price (ETH)</label>'
        + '<input type="number" id="sell-price-' + name + '" placeholder="0.01" step="any" min="0">'
        + '<div style="font-size:11px;color:#888;margin:-4px 0 8px">2% marketplace fee deducted from sale</div>'
        + '<label>Duration</label>'
        + '<select id="sell-duration-' + name + '">'
        + '<option value="604800">7 days</option>'
        + '<option value="2592000" selected>30 days</option>'
        + '<option value="7776000">90 days</option>'
        + '<option value="0">No expiry</option>'
        + '</select>'
        + '<button class="btn-sell" onclick="createListing(\\x27' + name + '\\x27, \\x27' + tokenId + '\\x27)">List for Sale</button>'
        + '</div>';
    }

    async function createListing(name, tokenId) {
      if (!wallet) { await connectWallet(); if (!wallet) return; }
      var price = $('sell-price-' + name).value;
      var duration = $('sell-duration-' + name).value;
      if (!price || parseFloat(price) <= 0) return alert('Enter a valid price');

      try {
        // Step 1: Approve NFT to Seaport
        var nft = new ethers.Contract(REGISTRY, ERC721_ABI, signer);
        var approved = await nft.isApprovedForAll(wallet, SEAPORT);
        if (!approved) {
          var appTx = await nft.setApprovalForAll(SEAPORT, true);
          await appTx.wait();
        }

        // Step 2: Get counter from Seaport
        var seaportRead = new ethers.Contract(SEAPORT, SEAPORT_GET_COUNTER_ABI, provider);
        var counter = await seaportRead.getCounter(wallet);

        // Step 3: Build order components with 2% marketplace fee
        var priceWei = ethers.parseEther(price);
        var feeAmount = (priceWei * BigInt(FEE_BPS)) / 10000n;
        var sellerAmount = priceWei - feeAmount;

        var endTime = (duration === '0')
          ? BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935') // max uint256 = no expiry
          : BigInt(Math.floor(Date.now() / 1000) + parseInt(duration));

        // Offer: seller offers 1 ERC721
        var offer = [{
          itemType: 2, // ERC721
          token: REGISTRY,
          identifierOrCriteria: BigInt(tokenId),
          startAmount: 1n,
          endAmount: 1n
        }];

        // Consideration: seller receives (price - fee), treasury receives fee
        var consideration = [{
          itemType: 0, // NATIVE (ETH)
          token: '0x0000000000000000000000000000000000000000',
          identifierOrCriteria: 0n,
          startAmount: sellerAmount,
          endAmount: sellerAmount,
          recipient: wallet
        }];
        if (feeAmount > 0n) {
          consideration.push({
            itemType: 0,
            token: '0x0000000000000000000000000000000000000000',
            identifierOrCriteria: 0n,
            startAmount: feeAmount,
            endAmount: feeAmount,
            recipient: TREASURY
          });
        }

        var orderParameters = {
          offerer: wallet,
          zone: ZONE_PUBLIC,
          offer: offer,
          consideration: consideration,
          orderType: 2, // FULL_RESTRICTED
          startTime: 0n,
          endTime: endTime,
          zoneHash: ZERO_BYTES32,
          salt: BigInt(generateSalt()),
          conduitKey: ZERO_BYTES32,
          totalOriginalConsiderationItems: BigInt(consideration.length)
        };

        // Step 4: EIP-712 sign the order
        var domain = {
          name: 'Seaport',
          version: '1.6',
          chainId: parseInt(CHAIN_ID),
          verifyingContract: SEAPORT
        };

        // Message uses counter instead of totalOriginalConsiderationItems
        var message = {
          offerer: orderParameters.offerer,
          zone: orderParameters.zone,
          offer: offer,
          consideration: consideration,
          orderType: orderParameters.orderType,
          startTime: orderParameters.startTime,
          endTime: orderParameters.endTime,
          zoneHash: orderParameters.zoneHash,
          salt: orderParameters.salt,
          conduitKey: orderParameters.conduitKey,
          counter: counter
        };

        var signature = await signer.signTypedData(domain, SEAPORT_EIP712_TYPES, message);

        // Step 5: Submit to Bazaar V2 contract
        var bazaar = new ethers.Contract(BAZAAR, BAZAAR_SUBMIT_ABI, signer);

        var submission = {
          parameters: [
            orderParameters.offerer,
            orderParameters.zone,
            offer.map(function(o) { return [o.itemType, o.token, o.identifierOrCriteria, o.startAmount, o.endAmount]; }),
            consideration.map(function(c) { return [c.itemType, c.token, c.identifierOrCriteria, c.startAmount, c.endAmount, c.recipient]; }),
            orderParameters.orderType,
            orderParameters.startTime,
            orderParameters.endTime,
            orderParameters.zoneHash,
            orderParameters.salt,
            orderParameters.conduitKey,
            orderParameters.totalOriginalConsiderationItems
          ],
          counter: counter,
          signature: signature
        };

        var tx = await bazaar.submit(submission);
        var receipt = await tx.wait();

        if (receipt.status === 1) {
          alert('Listed! ' + name + '.hazza.name is now for sale at ' + price + ' ETH (2% fee).\\n\\nTx: ' + tx.hash + '\\n\\nThis listing appears on hazza.name/marketplace and netprotocol.app/bazaar.');
          showSellForm(name, tokenId); // Close the form
          loadListings(); // Refresh browse tab
        } else {
          alert('Submission reverted. Check block explorer.');
        }
      } catch(e) {
        alert('Listing failed: ' + (e.shortMessage || e.message || e));
      }
    }

    // --- Make Offer on a Name ---
    function showOfferForm(name) {
      // Create modal overlay
      var existing = document.getElementById('offer-modal');
      if (existing) existing.remove();
      var overlay = document.createElement('div');
      overlay.id = 'offer-modal';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center';
      overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
      var box = document.createElement('div');
      box.style.cssText = 'background:#111;border:1px solid #1a2e1a;border-radius:12px;padding:1.5rem;max-width:360px;width:90%';
      box.innerHTML = '<div style="font-size:1rem;color:#fff;margin-bottom:1rem;font-weight:700;font-family:Rubik,sans-serif">Make Offer for <span style="color:#00e676">' + escHtml(name) + '.hazza.name</span></div>'
        + '<label style="display:block;font-size:0.8rem;color:#6b8f6b;margin-bottom:0.25rem">Offer Amount (WETH)</label>'
        + '<input type="number" id="offer-price" placeholder="0.01" step="any" min="0" style="width:100%;padding:0.5rem;background:#0a0a0a;border:1px solid #1a2e1a;border-radius:6px;color:#fff;font-size:0.9rem;font-family:Rubik,sans-serif;margin-bottom:0.75rem">'
        + '<div style="font-size:0.7rem;color:#444;margin-bottom:0.75rem">Offers use WETH (wrapped ETH). You must have WETH in your wallet.</div>'
        + '<label style="display:block;font-size:0.8rem;color:#6b8f6b;margin-bottom:0.25rem">Expires</label>'
        + '<select id="offer-duration" style="width:100%;padding:0.5rem;background:#0a0a0a;border:1px solid #1a2e1a;border-radius:6px;color:#fff;font-size:0.85rem;font-family:Rubik,sans-serif;margin-bottom:0.75rem">'
        + '<option value="86400">1 day</option>'
        + '<option value="259200">3 days</option>'
        + '<option value="604800" selected>7 days</option>'
        + '<option value="2592000">30 days</option>'
        + '</select>'
        + '<div style="font-size:0.75rem;color:#444;margin-bottom:1rem">2% marketplace fee (included in offer). Seller receives 98% in WETH.</div>'
        + '<button id="offer-submit-btn" style="width:100%;padding:0.6rem;background:#00e676;color:#000;border:none;border-radius:8px;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:Rubik,sans-serif" onclick="makeOffer(\\x27' + escHtml(name) + '\\x27)">Sign & Submit Offer</button>'
        + '<div id="offer-status" style="display:none;margin-top:0.75rem;font-size:0.85rem;text-align:center"></div>';
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    }

    async function makeOffer(name) {
      if (!wallet) { await connectWallet(); if (!wallet) return; }
      var priceStr = document.getElementById('offer-price').value;
      var duration = document.getElementById('offer-duration').value;
      var statusEl = document.getElementById('offer-status');
      var submitBtn = document.getElementById('offer-submit-btn');
      if (!priceStr || parseFloat(priceStr) <= 0) { alert('Enter a valid offer amount'); return; }
      var dur = parseInt(duration);
      if (isNaN(dur) || dur <= 0) { alert('Invalid duration'); return; }

      statusEl.style.display = 'block';
      statusEl.style.color = '#6b8f6b';
      statusEl.textContent = 'Looking up name...';
      submitBtn.disabled = true;

      try {
        // Get tokenId for this name
        var resolveRes = await fetch('/api/resolve/' + encodeURIComponent(name));
        var resolveData = await resolveRes.json();
        if (!resolveData.tokenId) throw new Error('Name not found');
        var tokenId = resolveData.tokenId;
        var nameOwner = resolveData.owner;

        // Build Seaport offer order: buyer offers WETH, wants specific ERC721
        // Seaport cannot escrow native ETH from offerer — must use WETH (ERC20)
        var priceWei = ethers.parseEther(priceStr);
        var feeAmount = (priceWei * BigInt(FEE_BPS)) / 10000n;
        var sellerAmount = priceWei - feeAmount;

        var now = Math.floor(Date.now() / 1000);
        var endTime = BigInt(now + dur);

        // Check WETH balance
        statusEl.textContent = 'Checking WETH balance...';
        var wethContract = new ethers.Contract(WETH, ERC20_ABI, signer);
        var wethBal = BigInt(await wethContract.balanceOf(wallet));
        if (wethBal < priceWei) {
          var needed = ethers.formatEther(priceWei);
          var have = ethers.formatEther(wethBal);
          throw new Error('Insufficient WETH: need ' + needed + ', have ' + have + '. Wrap ETH to WETH first.');
        }

        // Approve WETH to Seaport if needed
        statusEl.textContent = 'Checking WETH approval...';
        var currentAllowance = BigInt(await wethContract.allowance(wallet, SEAPORT));
        if (currentAllowance < priceWei) {
          statusEl.textContent = 'Approve WETH for Seaport...';
          var appTx = await wethContract.approve(SEAPORT, priceWei);
          await appTx.wait();
        }

        // Get counter from Seaport
        statusEl.textContent = 'Preparing order...';
        var seaportRead = new ethers.Contract(SEAPORT, SEAPORT_GET_COUNTER_ABI, provider);
        var counter = await seaportRead.getCounter(wallet);

        // Offer: buyer offers WETH (ERC20, itemType 1)
        var offer = [{
          itemType: 1, // ERC20 (WETH)
          token: WETH,
          identifierOrCriteria: 0n,
          startAmount: priceWei,
          endAmount: priceWei
        }];

        // Consideration: buyer gets NFT, seller gets WETH payment, treasury gets fee
        var consideration = [
          {
            itemType: 2, // ERC721
            token: REGISTRY,
            identifierOrCriteria: BigInt(tokenId),
            startAmount: 1n,
            endAmount: 1n,
            recipient: wallet // buyer receives the NFT
          },
          {
            itemType: 1, // ERC20 (WETH to seller)
            token: WETH,
            identifierOrCriteria: 0n,
            startAmount: sellerAmount,
            endAmount: sellerAmount,
            recipient: nameOwner // seller gets paid
          }
        ];
        // Add treasury fee if non-zero
        if (feeAmount > 0n) {
          consideration.push({
            itemType: 1, // ERC20 (WETH fee to treasury)
            token: WETH,
            identifierOrCriteria: 0n,
            startAmount: feeAmount,
            endAmount: feeAmount,
            recipient: TREASURY
          });
        }

        var orderParameters = {
          offerer: wallet,
          zone: '0x0000000000000000000000000000000000000000',
          offer: offer,
          consideration: consideration,
          orderType: 0, // FULL_OPEN — no zone restrictions
          startTime: BigInt(now),
          endTime: endTime,
          zoneHash: ZERO_BYTES32,
          salt: BigInt(generateSalt()),
          conduitKey: ZERO_BYTES32,
          totalOriginalConsiderationItems: BigInt(consideration.length)
        };

        // EIP-712 sign
        statusEl.textContent = 'Sign the offer in your wallet...';
        var domain = {
          name: 'Seaport',
          version: '1.6',
          chainId: parseInt(CHAIN_ID),
          verifyingContract: SEAPORT
        };
        var message = {
          offerer: orderParameters.offerer,
          zone: orderParameters.zone,
          offer: offer,
          consideration: consideration,
          orderType: orderParameters.orderType,
          startTime: orderParameters.startTime,
          endTime: orderParameters.endTime,
          zoneHash: orderParameters.zoneHash,
          salt: orderParameters.salt,
          conduitKey: orderParameters.conduitKey,
          counter: counter
        };
        var signature = await signer.signTypedData(domain, SEAPORT_EIP712_TYPES, message);

        // Submit to our API
        statusEl.textContent = 'Submitting offer...';
        var orderComponentsData = {
          offerer: wallet,
          zone: '0x0000000000000000000000000000000000000000',
          offer: offer.map(function(o) { return { itemType: o.itemType, token: o.token, identifierOrCriteria: o.identifierOrCriteria.toString(), startAmount: o.startAmount.toString(), endAmount: o.endAmount.toString() }; }),
          consideration: consideration.map(function(c) { return { itemType: c.itemType, token: c.token, identifierOrCriteria: c.identifierOrCriteria.toString(), startAmount: c.startAmount.toString(), endAmount: c.endAmount.toString(), recipient: c.recipient }; }),
          orderType: 0,
          startTime: orderParameters.startTime.toString(),
          endTime: orderParameters.endTime.toString(),
          zoneHash: ZERO_BYTES32,
          salt: orderParameters.salt.toString(),
          conduitKey: ZERO_BYTES32,
          counter: counter.toString(),
          totalOriginalConsiderationItems: consideration.length.toString()
        };

        var res = await fetch('/api/marketplace/offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name,
            offerer: wallet,
            price: priceStr,
            currency: 'WETH',
            signature: signature,
            orderComponents: orderComponentsData,
            expiresAt: now + dur,
            sellerAmount: sellerAmount.toString(),
            feeAmount: feeAmount.toString(),
            tokenId: tokenId
          })
        });
        var result = await res.json();
        if (result.error) throw new Error(result.error);

        statusEl.style.color = '#00e676';
        statusEl.textContent = 'Offer submitted! The owner will be notified.';
        setTimeout(function() {
          var modal = document.getElementById('offer-modal');
          if (modal) modal.remove();
        }, 2000);
      } catch(e) {
        statusEl.style.color = '#ff5252';
        statusEl.textContent = 'Error: ' + (e.shortMessage || e.message || e);
        submitBtn.disabled = false;
      }
    }

    // --- Accept an OTC Offer ---
    async function acceptNameOffer(name, offererAddr) {
      if (!wallet) { await connectWallet(); if (!wallet) return; }

      try {
        // Fetch the offer
        var res = await fetch('/api/marketplace/offers/' + encodeURIComponent(name));
        var data = await res.json();
        var offer = (data.offers || []).find(function(o) { return o.offerer === offererAddr.toLowerCase(); });
        if (!offer) return alert('Offer no longer available');
        if (!confirm('Accept offer of ' + offer.price + ' ETH for ' + name + '.hazza.name? This transfers your name to the buyer.')) return;

        // Reconstruct the Seaport order for fulfillment
        var oc = offer.orderComponents;
        if (!oc || !offer.signature) return alert('Invalid offer data — missing order components');

        // Seller needs to approve NFT to Seaport
        var nft = new ethers.Contract(REGISTRY, ERC721_ABI, signer);
        var approved = await nft.isApprovedForAll(wallet, SEAPORT);
        if (!approved) {
          var appTx = await nft.setApprovalForAll(SEAPORT, true);
          await appTx.wait();
        }

        // Build the full order for Seaport fulfillOrder
        var order = {
          parameters: {
            offerer: oc.offerer,
            zone: oc.zone,
            offer: oc.offer.map(function(o) { return { itemType: o.itemType, token: o.token, identifierOrCriteria: BigInt(o.identifierOrCriteria), startAmount: BigInt(o.startAmount), endAmount: BigInt(o.endAmount) }; }),
            consideration: oc.consideration.map(function(c) { return { itemType: c.itemType, token: c.token, identifierOrCriteria: BigInt(c.identifierOrCriteria), startAmount: BigInt(c.startAmount), endAmount: BigInt(c.endAmount), recipient: c.recipient }; }),
            orderType: oc.orderType,
            startTime: BigInt(oc.startTime),
            endTime: BigInt(oc.endTime),
            zoneHash: oc.zoneHash,
            salt: BigInt(oc.salt),
            conduitKey: oc.conduitKey,
            totalOriginalConsiderationItems: BigInt(oc.totalOriginalConsiderationItems)
          },
          signature: offer.signature
        };

        var seaport = new ethers.Contract(SEAPORT, SEAPORT_ABI, signer);
        var tx = await seaport.fulfillOrder(order, ZERO_BYTES32);
        var receipt = await tx.wait();

        if (receipt.status === 1) {
          // Remove the accepted offer from KV (best-effort, non-critical)
          // The owner signs the cancellation on behalf — but we need the offerer's sig
          // Since the offer was fulfilled onchain, it's now invalid anyway. Leave it to expire.
          // Future improvement: add an "accepted" endpoint that marks offers as fulfilled.
          alert('Sale complete! ' + name + '.hazza.name transferred for ' + offer.price + ' ETH.\\nTx: ' + tx.hash);
          loadOffers();
        } else {
          alert('Transaction reverted. The offer may have expired or the buyer may not have enough ETH.');
        }
      } catch(e) {
        alert('Accept failed: ' + (e.shortMessage || e.message || e));
      }
    }

    // --- Offers ---
    async function loadOffers() {
      $('offers-container').innerHTML = '<p style="color:#6b8f6b;text-align:center">Loading offers...</p>';
      try {
        // Fetch both collection offers (Bazaar) and individual name offers (our KV) in parallel
        var [collRes, indivRes] = await Promise.all([
          fetch('/api/marketplace/offers').then(function(r) { return r.json(); }).catch(function() { return { offers: [] }; }),
          fetch('/api/marketplace/all-offers').then(function(r) { return r.json(); }).catch(function() { return { offers: [] }; })
        ]);
        var collectionOffers = collRes.offers || [];
        var individualOffers = indivRes.offers || [];

        var html = '';

        // Individual name offers section
        if (individualOffers.length > 0) {
          html += '<div style="margin-bottom:1.25rem">'
            + '<div style="font-size:0.9rem;font-weight:700;color:#fff;margin-bottom:0.75rem">Name Offers</div>';
          individualOffers.forEach(function(o) {
            var isOwner = wallet && o.owner === wallet.toLowerCase();
            var brokerBadge = o.broker ? ' <span style="font-size:0.65rem;background:#1a2e1a;color:#00e676;padding:0.1rem 0.3rem;border-radius:4px;vertical-align:middle">brokered</span>' : '';
            html += '<div class="offer-card">'
              + '<div style="flex:1">'
              + '<div style="font-weight:700;color:#fff">' + escHtml(o.name) + '<span style="color:#00e676">.hazza.name</span>' + brokerBadge + '</div>'
              + '<div style="font-size:0.95rem;color:#00e676;font-weight:700;margin-top:0.2rem">' + escHtml(String(o.price)) + ' ' + escHtml(o.currency || 'ETH') + '</div>'
              + '<div style="font-size:0.8rem;color:#6b8f6b">From: ' + truncAddr(o.offerer) + ' &middot; Expires: ' + formatDate(o.expiresAt) + '</div>'
              + '</div>';
            if (isOwner) {
              html += '<button class="btn-buy" style="flex:0;white-space:nowrap;padding:0.5rem 1rem;font-size:0.8rem" onclick="acceptNameOffer(\\x27' + escHtml(o.name) + '\\x27,\\x27' + escHtml(o.offerer) + '\\x27)">Accept</button>';
            } else if (wallet && o.offerer === wallet.toLowerCase()) {
              html += '<button class="btn-buy" style="flex:0;white-space:nowrap;padding:0.5rem 1rem;font-size:0.8rem;background:#333;color:#ff5252" onclick="cancelMyOffer(\\x27' + escHtml(o.name) + '\\x27)">Cancel</button>';
            }
            html += '</div>';
          });
          html += '</div>';
        }

        // Collection offers section (from Bazaar)
        html += '<div style="margin-bottom:1rem;padding:0.75rem 1rem;background:#0d1a0d;border:1px solid #1a2e1a;border-radius:8px;font-size:0.85rem;color:#6b8f6b">'
          + '<p style="margin:0 0 0.25rem 0">Collection offers apply to <strong style="color:#fff">any</strong> hazza name. If you own a name, you can accept an offer to sell it instantly.</p>'
          + '<p style="margin:0;color:#444;font-size:0.8rem">Collection offers are made via Seaport on <a href="https://netprotocol.app/bazaar" style="color:#00e676" target="_blank">Net Protocol Bazaar</a>.</p>'
          + '</div>';

        if (collectionOffers.length === 0 && individualOffers.length === 0) {
          $('offers-container').innerHTML = html + '<div class="empty-state"><p>No offers yet. Click <strong style="color:#00e676">Offer</strong> on any listing to make one.</p></div>';
          return;
        }
        offersData = collectionOffers;
        collectionOffers.forEach(function(o, idx) {
          html += '<div class="offer-card">'
            + '<div>'
            + '<div style="font-weight:700;color:#fff">' + escHtml(String(o.price)) + ' ' + escHtml(o.currency || 'ETH') + ' <span style="font-size:0.65rem;background:#1a2e1a;color:#6b8f6b;padding:0.1rem 0.3rem;border-radius:4px;vertical-align:middle">collection</span></div>'
            + '<div style="font-size:0.8rem;color:#6b8f6b">From: ' + truncAddr(o.offerer) + ' &middot; Expires: ' + formatDate(o.expirationDate) + '</div>'
            + '</div>';
          if (wallet) {
            html += '<button class="btn-buy" style="flex:0;white-space:nowrap;padding:0.5rem 1rem;font-size:0.8rem" onclick="showAcceptOffer(\\x27' + escHtml(o.orderHash) + '\\x27)">Accept</button>';
          }
          html += '<div id="accept-panel-' + escHtml(o.orderHash.slice(0,10)) + '" style="display:none;width:100%;margin-top:0.5rem"></div>';
          html += '</div>';
        });
        $('offers-container').innerHTML = html;
      } catch(e) {
        $('offers-container').innerHTML = '<div class="empty-state"><p>Failed to load offers</p></div>';
      }
    }

    async function cancelMyOffer(name) {
      if (!wallet) return;
      if (!signer) { await connectWallet(); if (!signer) return; }
      if (!confirm('Cancel your offer on ' + name + '.hazza.name?')) return;
      try {
        // Sign a message proving we own this address
        var timestamp = Math.floor(Date.now() / 1000);
        var message = 'cancel-offer:' + name.toLowerCase() + ':' + wallet.toLowerCase() + ':' + timestamp;
        var signature = await signer.signMessage(message);
        var res = await fetch('/api/marketplace/offer', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, offerer: wallet, signature: signature, timestamp: timestamp })
        });
        var data = await res.json();
        if (data.error) throw new Error(data.error);
        loadOffers();
      } catch(e) {
        alert('Failed to cancel: ' + (e.shortMessage || e.message || e));
      }
    }

    // Show accept-offer panel — user selects which name to sell into the offer
    async function showAcceptOffer(orderHash) {
      if (!wallet) { await connectWallet(); if (!wallet) return; }
      var panelId = 'accept-panel-' + orderHash.slice(0,10);
      var panel = $(panelId);
      if (!panel) return;
      if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
      panel.style.display = 'block';
      panel.innerHTML = '<p style="color:#6b8f6b;font-size:0.8rem">Loading your names...</p>';
      try {
        var res = await fetch('/api/names/' + wallet);
        var data = await res.json();
        var names = (data.names || []).filter(function(n) { return n.status === 'active'; });
        if (names.length === 0) {
          panel.innerHTML = '<p style="color:#888;font-size:0.8rem">You don\\x27t own any active names to sell.</p>';
          return;
        }
        var html = '<div style="font-size:0.8rem;color:#6b8f6b;margin-bottom:0.4rem">Select a name to sell:</div>';
        names.forEach(function(n) {
          html += '<button style="display:block;width:100%;text-align:left;padding:0.4rem 0.6rem;margin-bottom:0.3rem;background:#111;border:1px solid #1a2e1a;border-radius:6px;color:#fff;font-size:0.85rem;cursor:pointer;font-family:Rubik,sans-serif" onclick="acceptOffer(\\x27' + escHtml(orderHash) + '\\x27,\\x27' + escHtml(n.name) + '\\x27,\\x27' + escHtml(String(n.tokenId)) + '\\x27)">' + escHtml(n.name) + '<span style="color:#00e676">.hazza.name</span> <span style="color:#444;font-size:0.7rem">#' + escHtml(String(n.tokenId)) + '</span></button>';
        });
        panel.innerHTML = html;
      } catch(e) {
        panel.innerHTML = '<p style="color:#ff5252;font-size:0.8rem">Failed to load names</p>';
      }
    }

    async function acceptOffer(orderHash, name, tokenId) {
      if (!wallet) { await connectWallet(); if (!wallet) return; }
      if (!confirm('Sell ' + name + '.hazza.name into this offer? This transfers ownership immediately.')) return;
      var panelId = 'accept-panel-' + orderHash.slice(0,10);
      var panel = $(panelId);
      try {
        if (panel) panel.innerHTML = '<p style="color:#6b8f6b;font-size:0.8rem">Preparing transaction...</p>';

        var res = await fetch('/api/marketplace/fulfill-offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderHash: orderHash, tokenId: tokenId, sellerAddress: wallet })
        });
        var data = await res.json();
        if (data.error) { if (panel) panel.innerHTML = '<p style="color:#ff5252;font-size:0.8rem">' + escHtml(data.error) + '</p>'; return; }

        // Execute approval txs (NFT approval to Seaport)
        if (data.approvals && data.approvals.length > 0) {
          if (panel) panel.innerHTML = '<p style="color:#6b8f6b;font-size:0.8rem">Approving NFT transfer...</p>';
          for (var i = 0; i < data.approvals.length; i++) {
            var appTx = await signer.sendTransaction({
              to: data.approvals[i].to, data: data.approvals[i].data,
              value: BigInt(data.approvals[i].value || '0')
            });
            await appTx.wait();
          }
        }

        // Execute fulfillment
        if (panel) panel.innerHTML = '<p style="color:#6b8f6b;font-size:0.8rem">Confirming sale...</p>';
        var tx = await signer.sendTransaction({
          to: data.fulfillment.to, data: data.fulfillment.data,
          value: BigInt(data.fulfillment.value || '0')
        });
        var receipt = await tx.wait();

        if (receipt.status === 1) {
          if (panel) panel.innerHTML = '<p style="color:#00e676;font-size:0.85rem;font-weight:700">Sold! ' + name + '.hazza.name transferred.</p>';
          alert('Sale complete! ' + name + '.hazza.name has been sold.\\n\\nTx: ' + tx.hash);
          loadOffers();
        } else {
          if (panel) panel.innerHTML = '<p style="color:#ff5252;font-size:0.8rem">Transaction reverted.</p>';
        }
      } catch(e) {
        if (panel) panel.innerHTML = '<p style="color:#ff5252;font-size:0.8rem">Failed: ' + escHtml(e.shortMessage || e.message || String(e)) + '</p>';
      }
    }

    // --- Sales ---
    async function loadSales() {
      $('sales-container').innerHTML = '<p style="color:#6b8f6b;text-align:center">Loading sales...</p>';
      try {
        var res = await fetch('/api/marketplace/sales');
        var data = await res.json();
        var sales = data.sales || [];
        if (sales.length === 0) {
          $('sales-container').innerHTML = '<div class="empty-state"><p>No sales recorded yet.</p></div>';
          return;
        }
        // Price history chart (last 20 sales, reversed to chronological)
        var chartSales = sales.slice(0, 20).reverse();
        var maxPrice = 0;
        chartSales.forEach(function(s) { if (s.price > maxPrice) maxPrice = s.price; });
        if (maxPrice === 0) maxPrice = 1;
        var html = '<div style="margin-bottom:1.25rem">';
        html += '<div style="font-size:0.8rem;color:#6b8f6b;margin-bottom:0.5rem">Price History (last ' + chartSales.length + ' sales)</div>';
        html += '<div style="display:flex;align-items:flex-end;gap:3px;height:100px;padding:0.25rem 0;border-bottom:1px solid #1a2e1a">';
        chartSales.forEach(function(s) {
          var pct = Math.max(4, (s.price / maxPrice) * 100);
          var color = s.currency === 'USDC' ? '#2775ca' : '#00e676';
          html += '<div title="' + escHtml(s.name) + ': ' + s.price + ' ' + s.currency + '" style="flex:1;min-width:8px;max-width:32px;height:' + pct + '%;background:' + color + ';border-radius:3px 3px 0 0;cursor:pointer;transition:opacity 0.15s" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1"></div>';
        });
        html += '</div>';
        html += '<div style="display:flex;justify-content:space-between;font-size:0.65rem;color:#444;margin-top:0.2rem">';
        if (chartSales.length > 0) {
          html += '<span>' + formatDate(chartSales[0].timestamp) + '</span>';
          html += '<span>' + formatDate(chartSales[chartSales.length - 1].timestamp) + '</span>';
        }
        html += '</div>';
        html += '<div style="display:flex;gap:0.75rem;margin-top:0.35rem;font-size:0.7rem">';
        html += '<span><span style="display:inline-block;width:8px;height:8px;background:#00e676;border-radius:2px;vertical-align:middle"></span> ETH</span>';
        html += '<span><span style="display:inline-block;width:8px;height:8px;background:#2775ca;border-radius:2px;vertical-align:middle"></span> USDC</span>';
        html += '</div>';
        html += '</div>';

        // Sales table
        html += '<table class="sales-table"><thead><tr><th>Name</th><th>Price</th><th>Buyer</th><th>Seller</th><th>Date</th></tr></thead><tbody>';
        sales.forEach(function(s) {
          html += '<tr>'
            + '<td><a href="https://' + encodeURIComponent(s.name) + '.hazza.name">' + escHtml(s.name) + '</a></td>'
            + '<td style="font-weight:700">' + s.price + ' ' + s.currency + '</td>'
            + '<td>' + truncAddr(s.buyer) + '</td>'
            + '<td>' + truncAddr(s.seller) + '</td>'
            + '<td>' + formatDate(s.timestamp) + '</td>'
            + '</tr>';
        });
        html += '</tbody></table>';
        $('sales-container').innerHTML = html;
      } catch(e) {
        $('sales-container').innerHTML = '<div class="empty-state"><p>Failed to load sales</p></div>';
      }
    }

    // --- Message Board ---
    var boardLoaded = false;
    async function loadBoardMessages() {
      if (wallet) {
        $('board-compose').style.display = 'block';
        $('board-connect-prompt').style.display = 'none';
      }
      var container = $('board-messages');
      container.innerHTML = '<p style="color:#6b8f6b;text-align:center">Loading messages...</p>';
      try {
        var res = await fetch('/api/board');
        var data = await res.json();
        var msgs = data.messages || [];
        if (msgs.length === 0) {
          container.innerHTML = '<div class="empty-state"><p>No messages yet. Be the first to post!</p></div>';
          return;
        }
        var html = '';
        msgs.forEach(function(m) {
          var addr = m.author || '0x???';
          var short = addr.slice(0, 6) + '...' + addr.slice(-4);
          var date = m.timestamp ? new Date(m.timestamp).toLocaleDateString() + ' ' + new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
          var nameLink = m.authorName ? '<a href="https://' + encodeURIComponent(m.authorName) + '.hazza.name" style="color:#00e676;font-weight:600;font-size:0.85rem">' + escHtml(m.authorName) + '.hazza</a>' : '<span style="color:#6b8f6b;font-size:0.8rem;font-family:monospace">' + short + '</span>';
          html += '<div style="padding:0.75rem;background:#0a0a0a;border:1px solid #1a2e1a;border-radius:8px;margin-bottom:0.5rem">';
          html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem">' + nameLink + '<span style="color:#444;font-size:0.7rem">' + date + '</span></div>';
          html += '<p style="color:#ccc;font-size:0.85rem;line-height:1.5;margin:0;word-break:break-word">' + escHtml(m.text) + '</p>';
          html += '</div>';
        });
        container.innerHTML = html;
        boardLoaded = true;
      } catch(e) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load messages</p></div>';
      }
    }

    async function postBoardMessage() {
      if (!wallet) { await connectWallet(); if (!wallet) return; }
      var input = $('board-msg-input');
      var text = input.value.trim();
      if (!text) return;
      if (text.length > 500) { alert('Message too long (max 500 characters)'); return; }
      var btn = $('board-send-btn');
      btn.disabled = true;
      btn.textContent = 'Posting...';
      try {
        // Sign message to prove wallet ownership
        var sig = await provider.getSigner().then(function(s) {
          return s.signMessage('hazza board post: ' + text);
        });
        var res = await fetch('/api/board', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text, author: wallet, signature: sig })
        });
        if (!res.ok) {
          var err = await res.json().catch(function() { return {}; });
          throw new Error(err.error || 'Failed to post');
        }
        input.value = '';
        loadBoardMessages();
      } catch(e) {
        alert('Post failed: ' + (e.message || e));
      } finally {
        btn.disabled = false;
        btn.textContent = 'Post';
      }
    }

    // --- Execute Cart ---
    async function executeCart() {
      if (cart.length === 0) return;
      if (!wallet) { await connectWallet(); if (!wallet) return; }
      var progress = $('cart-progress');
      progress.style.display = 'block';
      progress.innerHTML = '';
      $('btn-execute-all').disabled = true;

      // Separate by type: listings require individual signing, buys can be batched
      var listings = cart.filter(function(c) { return c.type === 'List'; });
      var buys = cart.filter(function(c) { return c.type === 'Buy'; });

      // Execute listings sequentially (each needs EIP-712 signing)
      for (var i = 0; i < listings.length; i++) {
        var item = listings[i];
        var stepEl = document.createElement('div');
        stepEl.className = 'progress-step active';
        stepEl.textContent = 'List: ' + item.name + '...';
        progress.appendChild(stepEl);
        try {
          await createListing(item.name, item.tokenId);
          stepEl.className = 'progress-step done';
          stepEl.textContent = '✓ Listed: ' + item.name;
          removeFromCart(item.id);
        } catch(e) {
          stepEl.className = 'progress-step error';
          stepEl.textContent = '✗ List: ' + item.name + ' — ' + (e.message || 'failed');
        }
      }

      // Process buys
      if (buys.length > 0) {
        var batchStep = document.createElement('div');
        batchStep.className = 'progress-step active';
        batchStep.textContent = 'Preparing ' + buys.length + ' purchase' + (buys.length > 1 ? 's' : '') + '...';
        progress.appendChild(batchStep);

        try {
          // Fetch all fulfillment txs in parallel
          var fulfillResults = await Promise.all(buys.map(function(b) {
            return fetch('/api/marketplace/fulfill', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderHash: b.orderHash, buyerAddress: wallet })
            }).then(function(r) { return r.json(); });
          }));

          // Collect fulfillment data and token requirements
          var fulfillmentCalls = [];
          var validBuys = [];
          // Track ERC20 token needs: { "tokenAddr:spender": { token, spender, amount } }
          var tokenNeeds = {};
          var totalEthValue = BigInt(0);

          for (var j = 0; j < fulfillResults.length; j++) {
            var fr = fulfillResults[j];
            if (fr.error) {
              var errEl = document.createElement('div');
              errEl.className = 'progress-step error';
              errEl.textContent = '\\u2717 ' + buys[j].name + ': ' + fr.error;
              progress.appendChild(errEl);
              continue;
            }
            // Aggregate token needs from structured approval data
            if (fr.approvals) fr.approvals.forEach(function(a) {
              if (a.spender && a.amount && a.amount !== '0') {
                var key = a.to.toLowerCase() + ':' + a.spender.toLowerCase();
                if (!tokenNeeds[key]) {
                  tokenNeeds[key] = { token: a.to, spender: a.spender, amount: BigInt(0) };
                }
                tokenNeeds[key].amount += BigInt(a.amount);
              }
            });
            var fValue = BigInt(fr.fulfillment.value || '0');
            totalEthValue += fValue;
            fulfillmentCalls.push({ target: fr.fulfillment.to, value: fValue, data: fr.fulfillment.data });
            validBuys.push(buys[j]);
          }

          if (validBuys.length > 0) {
            // Pre-flight balance check — verify user has enough of each token + ETH
            batchStep.textContent = 'Checking balances...';
            var insufficientFunds = [];
            // Check ETH
            if (totalEthValue > BigInt(0)) {
              var ethBal = BigInt(await provider.getBalance(wallet));
              if (ethBal < totalEthValue) {
                var needed = ethers.formatEther(totalEthValue);
                var have = ethers.formatEther(ethBal);
                insufficientFunds.push('ETH: need ' + needed + ', have ' + have);
              }
            }
            // Check each ERC20 token
            var tokenPullsList = Object.values(tokenNeeds);
            for (var ci = 0; ci < tokenPullsList.length; ci++) {
              var tn = tokenPullsList[ci];
              try {
                var tc = new ethers.Contract(tn.token, ERC20_ABI, provider);
                var bal = BigInt(await tc.balanceOf(wallet));
                if (bal < tn.amount) {
                  var sym = 'token';
                  var dec = 18;
                  try { sym = await tc.symbol(); } catch(e) {}
                  try { dec = Number(await tc.decimals()); } catch(e) {}
                  var neededAmt = ethers.formatUnits(tn.amount, dec);
                  var haveAmt = ethers.formatUnits(bal, dec);
                  insufficientFunds.push(sym + ': need ' + neededAmt + ', have ' + haveAmt);
                }
              } catch(e) {
                // Can\\u2019t check balance — proceed and let tx fail naturally
              }
            }
            if (insufficientFunds.length > 0) {
              batchStep.className = 'progress-step error';
              batchStep.innerHTML = '\\u2717 Insufficient funds:<br>' + insufficientFunds.join('<br>');
              $('btn-execute-all').disabled = false;
              return;
            }

            // Use HazzaBatchExecutor if deployed and multiple buys
            if (BATCH_EXECUTOR && validBuys.length > 1) {
              // Build TokenPull array for executor
              var tokenPulls = Object.values(tokenNeeds);

              // Step 1: User approves batch executor for each token
              if (tokenPulls.length > 0) {
                batchStep.textContent = 'Approving tokens for batch...';
                for (var ti = 0; ti < tokenPulls.length; ti++) {
                  var tp = tokenPulls[ti];
                  try {
                    var tokenContract = new ethers.Contract(tp.token, ERC20_ABI, signer);
                    var currentAllowance = await tokenContract.allowance(wallet, BATCH_EXECUTOR);
                    if (BigInt(currentAllowance) < tp.amount) {
                      var appTx = await tokenContract.approve(BATCH_EXECUTOR, tp.amount);
                      await appTx.wait();
                    }
                  } catch(appErr) {
                    // Continue — approval might already exist
                  }
                }
              }

              batchStep.textContent = 'Confirm batch purchase (' + validBuys.length + ' names)...';

              // Step 2: Build args for executeBatch(TokenPull[], Call[])
              var batchTokens = tokenPulls.map(function(tp) {
                return { token: tp.token, amount: tp.amount, spender: tp.spender };
              });
              var batchCalls = fulfillmentCalls.map(function(fc) {
                return { target: fc.target, value: fc.value, data: fc.data };
              });

              var executorContract = new ethers.Contract(BATCH_EXECUTOR, BATCH_EXECUTOR_ABI, signer);
              var tx = await executorContract.executeBatch(batchTokens, batchCalls, { value: totalEthValue });
              var receipt = await tx.wait();

              // Try to get per-item results via staticCall replay
              var decoded = null;
              try {
                decoded = await executorContract.executeBatch.staticCall(batchTokens, batchCalls, { value: totalEthValue, from: wallet });
              } catch(e) {
                decoded = null;
              }

              batchStep.className = 'progress-step done';
              batchStep.textContent = '\\u2713 Batch transaction confirmed';

              for (var bi = 0; bi < validBuys.length; bi++) {
                var resultEl = document.createElement('div');
                var succeeded = decoded ? decoded[bi].success : true;
                if (succeeded) {
                  resultEl.className = 'progress-step done';
                  resultEl.textContent = '\\u2713 Bought: ' + validBuys[bi].name;
                  removeFromCart(validBuys[bi].id);
                } else {
                  resultEl.className = 'progress-step error';
                  resultEl.textContent = '\\u2717 Failed: ' + validBuys[bi].name + ' (refunded)';
                }
                progress.appendChild(resultEl);
              }
            } else {
              // Single buy or no batch executor — execute directly
              batchStep.style.display = 'none';
              for (var k = 0; k < validBuys.length; k++) {
                var buyItem = validBuys[k];
                var buyStep = document.createElement('div');
                buyStep.className = 'progress-step active';
                buyStep.textContent = 'Buy: ' + buyItem.name + '...';
                progress.appendChild(buyStep);
                try {
                  await buyListing(buyItem.orderHash);
                  buyStep.className = 'progress-step done';
                  buyStep.textContent = '\\u2713 Bought: ' + buyItem.name;
                  removeFromCart(buyItem.id);
                } catch(e) {
                  buyStep.className = 'progress-step error';
                  buyStep.textContent = '\\u2717 Buy: ' + buyItem.name + ' \\u2014 ' + (e.message || 'failed');
                }
              }
            }
          }
        } catch(e) {
          batchStep.className = 'progress-step error';
          batchStep.textContent = '\\u2717 Batch prepare failed: ' + (e.message || 'error');
        }
      }

      $('btn-execute-all').disabled = false;
      loadListings();
    }

    // --- Init ---
    document.addEventListener('DOMContentLoaded', function() {
      // Check URL params
      var params = new URLSearchParams(window.location.search);
      var sellName = params.get('sell');
      var buyHash = params.get('buy');

      var tabParam = params.get('tab');
      if (sellName) {
        switchTab('mynames');
        // Auto-open sell form after names load
        setTimeout(function() { showSellForm(sellName, ''); }, 1500);
      } else if (buyHash) {
        switchTab('browse');
      } else if (tabParam && ['browse','mynames','offers','sales','board'].indexOf(tabParam) !== -1) {
        switchTab(tabParam);
      } else {
        loadListings();
      }

      updateCartUI();

      // Listen for wallet connections from nav bar
      window.addEventListener('hazza_wallet_connected', function(e) {
        if (e.detail && e.detail.address && !wallet) {
          connectWallet();
        }
      });

      // Listen for disconnects
      window.addEventListener('hazza_wallet_disconnected', function() {
        wallet = null; signer = null; provider = null;
        var wd = $('mp-wallet-display');
        if (wd) wd.textContent = '';
      });

      // Auto-connect: check nav global first, then sessionStorage
      function tryAutoReconnect() {
        if (window.__hazza_wallet && !wallet) {
          wallet = window.__hazza_wallet;
          var wd = $('mp-wallet-display');
          if (wd) wd.textContent = truncAddr(wallet);
          if (window.ethereum) {
            provider = new ethers.BrowserProvider(window.ethereum);
            provider.getSigner().then(function(s) { signer = s; }).catch(function(){});
          }
          return true;
        }
        if (!window.ethereum) return false;
        var saved = null;
        try { saved = sessionStorage.getItem('hazza_wallet'); } catch(e) {}
        if (saved && !wallet) {
          wallet = saved;
          var wd2 = $('mp-wallet-display');
          if (wd2) wd2.textContent = truncAddr(wallet);
          provider = new ethers.BrowserProvider(window.ethereum);
          provider.getSigner().then(function(s) { signer = s; }).catch(function(){});
          return true;
        }
        return false;
      }
      if (!tryAutoReconnect()) {
        setTimeout(function() {
          if (!tryAutoReconnect()) {
            setTimeout(function() { tryAutoReconnect(); }, 1500);
          }
        }, 500);
      }
      window.addEventListener('eip6963:announceProvider', function() {
        if (!wallet) tryAutoReconnect();
      });

      // Farcaster Mini App ready
      if (window.farcaster || (window.parent !== window)) {
        try {
          import('https://esm.sh/@farcaster/miniapp-sdk@latest').then(function(mod) {
            if (mod.sdk) mod.sdk.actions.ready();
          }).catch(function(){});
        } catch(e) {}
      }
    });
  `;

  return shell(
    "hazza \u2014 immediately useful names",
    "Buy, sell and trade hazza names. Powered by Seaport on Base.",
    `
    <style>${MARKETPLACE_STYLES}</style>

    <div class="header">
      <h1>hazza <span>marketplace</span></h1>
      <p>buy and sell onchain names</p>
      <div id="mp-connect-status" style="margin-top:0.75rem;font-size:0.85rem;color:#444">
        <span id="mp-wallet-display"></span>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" data-tab="browse" onclick="switchTab('browse')">browse</button>
      <button class="tab" data-tab="mynames" onclick="switchTab('mynames')">my names</button>
      <button class="tab" data-tab="offers" onclick="switchTab('offers')">offers</button>
      <button class="tab" data-tab="sales" onclick="switchTab('sales')">recent sales</button>
      <button class="tab" data-tab="board" onclick="switchTab('board')">board</button>
    </div>

    <div id="panel-browse" class="tab-panel active">
      <div id="mp-filters" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem;align-items:center">
        <input type="text" id="mp-search" placeholder="search names..." oninput="renderListings()" style="flex:1;min-width:120px;padding:0.4rem 0.6rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.85rem;font-family:'Rubik',sans-serif;outline:none">
        <select id="mp-sort" onchange="renderListings()" style="padding:0.4rem 0.5rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.8rem;font-family:'Rubik',sans-serif">
          <option value="newest">newest</option>
          <option value="price-low">price: low to high</option>
          <option value="price-high">price: high to low</option>
          <option value="name-az">name: A-Z</option>
        </select>
        <select id="mp-type" onchange="renderListings()" style="padding:0.4rem 0.5rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.8rem;font-family:'Rubik',sans-serif">
          <option value="all">all names</option>
          <option value="namespace">namespaces only</option>
          <option value="regular">regular only</option>
        </select>
      </div>
      <div id="buy-status" style="display:none;text-align:center;color:#6b8f6b;font-size:0.85rem;padding:0.5rem;margin-bottom:0.5rem"></div>
      <div id="listings-container">
        <p style="color:#6b8f6b;text-align:center">Loading listings...</p>
      </div>
    </div>

    <div id="panel-mynames" class="tab-panel">
      <div id="mynames-container">
        <div class="empty-state"><p>Connect your wallet to see your names</p></div>
      </div>
    </div>

    <div id="panel-offers" class="tab-panel">
      <div style="display:flex;gap:0.5rem;margin-bottom:1rem;align-items:center">
        <input type="text" id="offer-name-input" placeholder="make an offer on any name..." style="flex:1;padding:0.5rem 0.75rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.85rem;font-family:'Rubik',sans-serif;outline:none">
        <button onclick="var n=document.getElementById('offer-name-input').value.trim().toLowerCase().replace(/[^a-z0-9\\-]/g,'');if(n)showOfferForm(n);else alert('Enter a name')" style="padding:0.5rem 1rem;background:#00e676;color:#000;border:none;border-radius:6px;font-weight:700;font-size:0.85rem;cursor:pointer;font-family:'Rubik',sans-serif;white-space:nowrap">Make Offer</button>
      </div>
      <div id="offers-container">
        <p style="color:#6b8f6b;text-align:center">Loading offers...</p>
      </div>
    </div>

    <div id="panel-sales" class="tab-panel">
      <div id="sales-container">
        <p style="color:#6b8f6b;text-align:center">Loading sales...</p>
      </div>
    </div>

    <div id="panel-board" class="tab-panel">
      <div style="margin-bottom:1rem">
        <p style="color:#6b8f6b;font-size:0.85rem;margin-bottom:0.75rem">Public message board for the hazza marketplace. Messages are stored onchain via <a href="https://netprotocol.app" style="color:#00e676" target="_blank" rel="noopener">Net Protocol</a>.</p>
        <div id="board-compose" style="display:none;margin-bottom:1rem">
          <div style="display:flex;gap:0.5rem;align-items:flex-start">
            <textarea id="board-msg-input" placeholder="Write a message..." rows="2" style="flex:1;padding:0.5rem 0.75rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.85rem;font-family:'Rubik',sans-serif;outline:none;resize:vertical"></textarea>
            <button id="board-send-btn" onclick="postBoardMessage()" style="padding:0.5rem 1rem;background:#00e676;color:#000;border:none;border-radius:6px;font-weight:700;font-size:0.85rem;cursor:pointer;font-family:'Rubik',sans-serif;white-space:nowrap;align-self:flex-end">Post</button>
          </div>
          <p style="color:#444;font-size:0.7rem;margin-top:0.35rem">Posts are public and permanent. Your wallet address is visible.</p>
        </div>
        <div id="board-connect-prompt" style="text-align:center;padding:0.5rem;color:#6b8f6b;font-size:0.85rem">Connect your wallet to post messages.</div>
      </div>
      <div id="board-messages">
        <p style="color:#6b8f6b;text-align:center">Loading messages...</p>
      </div>
    </div>

    <!-- Cart FAB -->
    <button class="cart-fab" id="cart-fab" onclick="openCart()">
      🛒<span class="badge" id="cart-badge">0</span>
    </button>

    <!-- Cart Drawer -->
    <div class="cart-drawer" id="cart-drawer">
      <div class="cart-drawer-header">
        <h3>Cart</h3>
        <button class="cart-drawer-close" onclick="closeCart()">&times;</button>
      </div>
      <div class="cart-items" id="cart-items-list"></div>
      <div class="cart-saved-section" id="cart-saved-section" style="display:none;padding:0 1.25rem">
        <div class="cart-saved-title">Saved for Later</div>
        <div id="cart-saved-list"></div>
      </div>
      <div class="cart-footer">
        <div class="cart-total" id="cart-total"></div>
        <div id="cart-progress" class="progress-bar" style="display:none"></div>
        <button class="btn-execute" id="btn-execute-all" onclick="executeCart()" disabled>Execute All</button>
      </div>
    </div>`,
    script,
    { externalScripts: ["https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.4/ethers.umd.min.js"] }
  );
}
