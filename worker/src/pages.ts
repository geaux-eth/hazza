// HTML templates for the HAZZA Worker
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
  nav .links { display: flex; gap: 1.25rem; }
  nav .links a { color: #6b8f6b; font-size: 0.85rem; font-weight: 500; }
  nav .links a:hover { color: #00e676; text-decoration: none; }
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
  @media (max-width: 600px) {
    nav { padding: 0.75rem 1rem 0; }
    nav .links { gap: 0.75rem; }
    nav .links a { font-size: 0.8rem; }
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
    .info-row .value { font-size: 0.8rem; }
    .social-link { font-size: 0.8rem; padding: 0.35rem 0.7rem; }
  }
`;

const SEARCH_SCRIPT = `
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
    if (!name) return;
    result.className = 'result show';
    result.textContent = 'Checking...';
    try {
      const [avail, priceRes] = await Promise.all([
        fetch('/api/available/' + encodeURIComponent(name)).then(r => r.json()),
        fetch('/api/price/' + encodeURIComponent(name)).then(r => r.json()),
      ]);
      if (avail.available) {
        result.innerHTML = '<span style="color:#fff;font-weight:700">' + escHtml(name) + '</span><span class="available">.hazza.name</span> is available! '
          + '<strong>$' + escHtml(priceRes.basePrice) + '</strong> + $2/yr renewal '
          + '<a href="/register?name=' + encodeURIComponent(name) + '" style="display:inline-block;padding:0.3rem 1rem;background:#00e676;color:#000;border-radius:6px;font-weight:700;font-size:0.85rem;vertical-align:middle;margin-left:0.5rem;text-decoration:none">Register</a>';
      } else {
        const res = await fetch('/api/resolve/' + encodeURIComponent(name)).then(r => r.json());
        result.innerHTML = '<span style="color:#fff;font-weight:700">' + escHtml(name) + '</span><span class="taken">.hazza.name</span> is taken. '
          + 'Owner: <a href="https://basescan.org/address/' + escHtml(res.owner) + '">'
          + escHtml(res.owner.slice(0, 6) + '...' + res.owner.slice(-4)) + '</a>';
      }
    } catch (e) {
      result.textContent = 'Error checking name. Try again.';
    }
  }

  btn.addEventListener('click', search);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
`;

const NAV = `
  <nav>
    <a class="logo" href="/"><span class="logo-icon">h</span></a>
    <div class="links">
      <a href="/domains">Domains</a>
      <a href="/pricing">Pricing</a>
      <a href="/about">About</a>
      <a href="/docs">Docs</a>
    </div>
  </nav>`;

function shell(title: string, description: string, body: string, script?: string, opts?: { externalScripts?: string[] }): string {
  const externals = (opts?.externalScripts || []).map(src => `<script src="${src}"></script>`).join("\n  ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <style>${STYLES}</style>
</head>
<body>
  ${NAV}
  <div class="container">
    ${body}
    <div class="footer">
      <p>Powered by <a href="https://x402.org">x402</a> and <a href="https://netprotocol.app">Net Protocol</a> on <a href="https://base.org">Base</a></p>
    </div>
  </div>
  ${externals}
  ${script ? `<script>${script}</script>` : ""}
</body>
</html>`;
}

export function landingPage(): string {
  return shell(
    "HAZZA \u2014 Your Onchain Name",
    "One x402 payment. Your name, your website, your agent, your DNS \u2014 all onchain on Base, instantly.",
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

    <p style="text-align:center;color:#fff;font-size:1.1rem;font-weight:700;margin:1rem auto">
      One <a href="https://x402.org" style="color:#00e676">x402</a> payment handles everything.
    </p>

    <div class="feature-block" style="margin-top:0">
      <div style="display:grid;gap:1rem">
        <div>
          <div class="feature-title">Your Website</div>
          <p><strong style="color:#fff">yourname.hazza.name</strong> instantly hosted via <a href="https://netprotocol.app">Net Protocol</a>.</p>
        </div>
        <div>
          <div class="feature-title">Your Agent</div>
          <p>Register an AI agent endpoint. <strong style="color:#fff">ERC-8004</strong> compatible.</p>
        </div>
        <div>
          <div class="feature-title">Your DNS</div>
          <p>Link a custom <strong style="color:#fff">domain</strong>. Subdomain routing, content hosting, and API access built in.</p>
        </div>
      </div>
    </div>`,
    SEARCH_SCRIPT
  );
}

// =========================================================================
//                        REGISTER PAGE
// =========================================================================

const ETHERS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.4/ethers.umd.min.js";

const REGISTER_SCRIPT = `
  const cfg = document.getElementById('hazza-config');
  const REGISTRY = cfg.dataset.registry;
  const USDC_ADDRESS = cfg.dataset.usdc;
  const CHAIN_ID = parseInt(cfg.dataset.chainid);
  const rawNameParam = new URLSearchParams(window.location.search).get('name') || '';
  const nameParam = rawNameParam.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);

  function escHtml(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  const REGISTRY_ABI = [
    "function commit(bytes32 commitHash) external",
    "function register(string name, address nameOwner, bytes32 salt, uint256 numYears, bool wantAgent, address agentWallet, string agentURI) external",
    "function available(string name) view returns (bool)",
    "function quoteName(string name, address wallet, uint256 numYears, uint8 charCount, bool ensImport, bool verifiedPass) view returns (uint256 totalCost, uint256 registrationFee, uint256 renewalFee)"
  ];
  const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)"
  ];

  let provider, signer, userAddress;

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

  // --- Load name info ---
  async function loadName() {
    if (!nameParam) {
      $('register-body').innerHTML = '<p style="color:#ff5252;text-align:center">No name specified. <a href="/">Search for a name</a></p>';
      return;
    }
    $('reg-name').textContent = nameParam + '.hazza.name';
    try {
      const [avail, priceRes] = await Promise.all([
        fetch('/api/available/' + encodeURIComponent(nameParam)).then(r => r.json()),
        fetch('/api/price/' + encodeURIComponent(nameParam)).then(r => r.json()),
      ]);
      if (!avail.available) {
        $('register-body').innerHTML = '<p style="color:#ff5252;text-align:center">' + escHtml(nameParam) + '.hazza.name is already taken. <a href="/">Try another name</a></p>';
        return;
      }
      $('reg-price').textContent = '$' + priceRes.basePrice;
      $('reg-renewal').textContent = '+ $2/yr renewal';
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
          showStatus('Please switch to Base Sepolia (chain ' + CHAIN_ID + ') in your wallet.', true);
          return;
        }
      }

      $('wallet-addr').textContent = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
      $('wallet-addr').style.display = 'inline';
      $('connect-btn').textContent = 'Connected';
      $('connect-btn').disabled = true;
      $('connect-btn').style.opacity = '0.6';

      // Load quote with wallet
      await loadQuote();

      $('checkout-section').style.display = 'block';
    } catch (e) {
      showStatus('Wallet connection failed: ' + (e.message || e), true);
    }
  }

  // --- Load quote ---
  async function loadQuote() {
    try {
      const res = await fetch('/api/quote/' + nameParam + '?wallet=' + userAddress + '&years=1').then(r => r.json());
      $('quote-total').textContent = '$' + res.total;
      if (res.lineItems) {
        let html = '';
        for (const item of res.lineItems) {
          html += '<div style="display:flex;justify-content:space-between;color:#aaa;font-size:0.85rem;padding:0.25rem 0">';
          html += '<span>' + item.label + '</span><span>' + item.amount + '</span></div>';
        }
        $('quote-details').innerHTML = html;
      }
    } catch (e) {
      $('quote-total').textContent = 'Error loading price';
    }
  }

  // --- Checkout flow ---
  async function checkout() {
    $('checkout-btn').disabled = true;
    $('checkout-steps').style.display = 'block';
    $('status').style.display = 'none';

    const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);

    try {
      // Get exact cost from contract
      const [totalCost] = await registry.quoteName(nameParam, userAddress, 1, 0, false, false);

      // Step 1: Check USDC balance
      setStep(1, 'active');
      const balance = await usdc.balanceOf(userAddress);
      if (balance < totalCost) {
        showStatus('Insufficient USDC balance. Need ' + ethers.formatUnits(totalCost, 6) + ' USDC.', true);
        setStep(1, 'error');
        $('checkout-btn').disabled = false;
        return;
      }

      // Step 1: Approve USDC
      const allowance = await usdc.allowance(userAddress, REGISTRY);
      if (allowance < totalCost) {
        showStatus('Approving USDC...', false);
        const approveTx = await usdc.approve(REGISTRY, totalCost);
        await approveTx.wait();
      }
      setStep(1, 'done');

      // Step 2: Commit
      setStep(2, 'active');
      showStatus('Submitting commitment...', false);
      const salt = ethers.randomBytes(32);
      const saltHex = ethers.hexlify(salt);
      const commitHash = ethers.keccak256(ethers.solidityPacked(
        ['string', 'address', 'bytes32'],
        [nameParam, userAddress, saltHex]
      ));
      const commitTx = await registry.commit(commitHash);
      await commitTx.wait();
      setStep(2, 'done');

      // Step 3: Wait 60 seconds
      setStep(3, 'active');
      let countdown = 65;
      const timer = setInterval(() => {
        countdown--;
        $('countdown').textContent = countdown + 's';
        if (countdown <= 0) clearInterval(timer);
      }, 1000);
      await new Promise(resolve => setTimeout(resolve, 65000));
      clearInterval(timer);
      setStep(3, 'done');

      // Step 4: Register
      setStep(4, 'active');
      showStatus('Registering name...', false);
      const registerTx = await registry.register(
        nameParam,
        userAddress,
        saltHex,
        1,     // numYears
        false, // wantAgent
        ethers.ZeroAddress, // agentWallet
        ""     // agentURI
      );
      await registerTx.wait();
      setStep(4, 'done');

      // Step 5: Done
      setStep(5, 'done');
      showStatus('', false);
      $('success-section').style.display = 'block';
      $('success-link').href = 'https://' + nameParam + '.hazza.name';
      $('success-link').textContent = nameParam + '.hazza.name';
      $('checkout-btn').style.display = 'none';

    } catch (e) {
      const msg = e.reason || e.message || 'Transaction failed';
      showStatus(msg, true);
      $('checkout-btn').disabled = false;
    }
  }

  // --- Init ---
  $('connect-btn').addEventListener('click', connectWallet);
  $('checkout-btn').addEventListener('click', checkout);
  loadName();
`;

export function registerPage(registryAddress: string, usdcAddress: string, chainId: string): string {
  return shell(
    "HAZZA \u2014 Register",
    "Register a HAZZA name. Connect your wallet, pay with USDC, and get your onchain name instantly.",
    `<div id="hazza-config" data-registry="${registryAddress}" data-usdc="${usdcAddress}" data-chainid="${chainId}" style="display:none"></div>
    <div id="register-body">
    <div class="header">
      <h1 id="reg-name" style="word-break:break-word"></h1>
    </div>

    <div style="text-align:center;margin-bottom:1.5rem">
      <span id="reg-price" style="font-size:2rem;font-weight:900;color:#fff"></span>
      <span id="reg-renewal" style="color:#6b8f6b;font-size:0.9rem;margin-left:0.5rem"></span>
    </div>

    <div id="connect-section" style="display:none;text-align:center;margin-bottom:1.5rem">
      <button id="connect-btn" style="padding:0.75rem 2rem;background:#00e676;color:#000;border:none;border-radius:8px;font-weight:700;font-size:1rem;cursor:pointer;font-family:'Rubik',sans-serif">Connect Wallet</button>
      <span id="wallet-addr" style="display:none;color:#6b8f6b;font-size:0.85rem;margin-left:1rem"></span>
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
          <span>Approve USDC</span>
        </div>
        <div id="step-2" class="checkout-step pending">
          <span class="step-icon"></span>
          <span>Submit commitment</span>
        </div>
        <div id="step-3" class="checkout-step pending">
          <span class="step-icon"></span>
          <span>Waiting for confirmation <span id="countdown"></span></span>
        </div>
        <div id="step-4" class="checkout-step pending">
          <span class="step-icon"></span>
          <span>Register name</span>
        </div>
        <div id="step-5" class="checkout-step pending">
          <span class="step-icon"></span>
          <span>Done</span>
        </div>
      </div>

      <div id="status" style="display:none;text-align:center;padding:0.75rem;font-size:0.9rem;margin-top:1rem"></div>

      <div id="success-section" style="display:none;text-align:center;margin-top:1.5rem">
        <p style="color:#00e676;font-weight:700;font-size:1.2rem;margin-bottom:0.75rem">Name registered!</p>
        <a id="success-link" href="#" style="display:inline-block;padding:0.75rem 2rem;background:#00e676;color:#000;border-radius:8px;font-weight:700;text-decoration:none">Visit your profile</a>
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
    "function renew(string name, uint256 numYears) external",
    "function registerAgent(string name, string agentURI, address agentWallet) external",
    "function generateApiKey(string name, bytes32 salt) external returns (bytes32)",
    "function quoteName(string name, address wallet, uint256 numYears, uint8 charCount, bool ensImport, bool verifiedPass) view returns (uint256 totalCost, uint256 registrationFee, uint256 renewalFee)"
  ];
  const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
  ];

  let provider, signer, userAddress, profileData;

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
      $('connect-section').style.display = 'block';

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

      // Status info
      $('info-status').textContent = profileData.status;
      $('info-owner').textContent = profileData.owner.slice(0, 6) + '...' + profileData.owner.slice(-4);
      $('info-expires').textContent = new Date(profileData.expiresAt * 1000).toLocaleDateString();

      // Show renew section if in grace/redemption
      if (profileData.status === 'grace' || profileData.status === 'redemption') {
        $('renew-section').style.display = 'block';
        $('renew-notice').textContent = profileData.status === 'grace'
          ? 'Your name is in the grace period. Renew at normal price.'
          : 'Your name is in redemption. Renew with a $10 penalty.';
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
        } catch (e) {
          showMsg('Please switch to the correct chain in your wallet.', true);
          return;
        }
      }

      // Check if connected wallet is owner or operator
      const isOwner = userAddress.toLowerCase() === profileData.owner.toLowerCase();
      const isOperator = profileData.operator && userAddress.toLowerCase() === profileData.operator.toLowerCase();
      if (!isOwner && !isOperator) {
        showMsg('Connected wallet is not the owner or operator of this name.', true);
        return;
      }

      $('wallet-addr').textContent = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
      $('wallet-addr').style.display = 'inline';
      $('connect-btn').textContent = 'Connected';
      $('connect-btn').disabled = true;
      $('connect-btn').style.opacity = '0.6';
      $('edit-section').style.display = 'block';
      $('actions-section').style.display = 'block';

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

  // --- Renew ---
  async function renewName() {
    const years = parseInt($('renew-years').value) || 1;
    const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
    try {
      showMsg('Getting renewal cost...', false);
      const [totalCost] = await registry.quoteName(nameParam, userAddress, years, 0, false, false);
      showMsg('Approving USDC...', false);
      const allowance = await usdc.allowance(userAddress, REGISTRY);
      if (allowance < totalCost) {
        const approveTx = await usdc.approve(REGISTRY, totalCost);
        await approveTx.wait();
      }
      showMsg('Renewing...', false);
      const tx = await registry.renew(nameParam, years);
      await tx.wait();
      showMsg('Renewed for ' + years + ' year' + (years > 1 ? 's' : '') + '!', false);
    } catch (e) {
      showMsg('Error: ' + (e.reason || e.message || e), true);
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

  // --- Init ---
  $('connect-btn').addEventListener('click', connectWallet);
  if (nameParam) {
    const pl = $('profile-link');
    if (pl) { pl.href = 'https://' + nameParam + '.hazza.name'; }
  }
  loadProfile();
`;

export function managePage(registryAddress: string, usdcAddress: string, chainId: string): string {
  const fieldRow = (label: string, key: string, inputId: string, placeholder: string) => `
    <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem">
      <label style="color:#6b8f6b;font-size:0.85rem;min-width:80px">${label}</label>
      <input id="${inputId}" type="text" placeholder="${placeholder}" style="flex:1;padding:0.5rem 0.75rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.9rem;font-family:'Rubik',sans-serif;outline:none">
      <button onclick="saveField('${key}','${inputId}')" style="padding:0.5rem 1rem;background:#1a2e1a;color:#00e676;border:1px solid #00e676;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.8rem;font-family:'Rubik',sans-serif;white-space:nowrap">Save</button>
    </div>`;

  return shell(
    "HAZZA — Manage",
    "Manage your HAZZA name. Edit profile, set text records, renew, and configure your onchain identity.",
    `<div id="hazza-config" data-registry="${registryAddress}" data-usdc="${usdcAddress}" data-chainid="${chainId}" style="display:none"></div>
    <div id="manage-body">
    <div class="header">
      <h1 id="manage-name" style="word-break:break-word"></h1>
    </div>

    <div style="display:flex;justify-content:center;gap:2rem;margin-bottom:1.5rem;font-size:0.85rem">
      <div><span style="color:#6b8f6b">Status</span> <span id="info-status" style="color:#fff"></span></div>
      <div><span style="color:#6b8f6b">Owner</span> <span id="info-owner" style="color:#fff"></span></div>
      <div><span style="color:#6b8f6b">Expires</span> <span id="info-expires" style="color:#fff"></span></div>
    </div>

    <div id="connect-section" style="display:none;text-align:center;margin-bottom:1.5rem">
      <button id="connect-btn" style="padding:0.75rem 2rem;background:#00e676;color:#000;border:none;border-radius:8px;font-weight:700;font-size:1rem;cursor:pointer;font-family:'Rubik',sans-serif">Connect Wallet</button>
      <span id="wallet-addr" style="display:none;color:#6b8f6b;font-size:0.85rem;margin-left:1rem"></span>
    </div>

    <div id="manage-status" style="display:none;text-align:center;padding:0.75rem;font-size:0.9rem;margin-bottom:1rem"></div>

    <div id="my-names" style="display:none;margin-bottom:1.5rem">
      <div class="section">
        <div class="section-title">My Names</div>
        <div id="my-names-list"></div>
      </div>
    </div>

    <div id="edit-section" style="display:none">
      <div class="section">
        <div class="section-title">Profile</div>
        ${fieldRow("Bio", "description", "field-description", "A short bio...")}
        ${fieldRow("Avatar", "avatar", "field-avatar", "https://... image URL")}
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
        <p style="color:#555;font-size:0.75rem;margin-top:0.5rem">Exoskeleton ownership is auto-detected from your wallet. Unlimited Pass badge appears automatically once the contract is live.</p>
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

      <div id="renew-section" style="display:none">
        <div class="section">
          <div class="section-title">Renew</div>
          <p id="renew-notice" style="color:#ffab00;font-size:0.85rem;margin-bottom:0.75rem"></p>
          <div style="display:flex;gap:0.5rem;align-items:center">
            <label style="color:#6b8f6b;font-size:0.85rem">Years</label>
            <select id="renew-years" style="padding:0.5rem;border:1px solid #1a2e1a;border-radius:6px;background:#111;color:#fff;font-size:0.9rem;font-family:'Rubik',sans-serif">
              <option value="1">1 year</option>
              <option value="2">2 years</option>
              <option value="3">3 years</option>
              <option value="5">5 years</option>
            </select>
            <button onclick="renewName()" style="padding:0.5rem 1.5rem;background:#ffab00;color:#000;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.85rem;font-family:'Rubik',sans-serif">Renew</button>
          </div>
        </div>
        <hr class="divider">
      </div>

      <div style="text-align:center;margin:1.5rem 0">
        <a id="profile-link" href="#" style="color:#6b8f6b;font-size:0.85rem">View profile &rarr;</a>
      </div>
    </div>
    </div>`,
    MANAGE_SCRIPT,
    { externalScripts: [ETHERS_CDN] }
  );
}

type ProfileData = {
  owner: string;
  ownerEns?: string | null;
  tokenId: string;
  registeredAt: number;
  expiresAt: number;
  operator: string;
  agentId: string;
  agentWallet: string;
  status: "active" | "grace" | "redemption" | "expired";
  texts: Record<string, string>;
  contenthash: string | null;
  agentMeta?: any;
  netProfile?: any;
  helixaData?: any;
  exoData?: any;
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
    const ownerDisplay = data.ownerEns || shortOwner;
    const hasAgent = data.agentId !== "0";
    const zeroAddr = "0x0000000000000000000000000000000000000000";
    const hasOperator = data.operator !== zeroAddr && data.operator.toLowerCase() !== data.owner.toLowerCase();
    const days = daysUntil(data.expiresAt);
    const texts = data.texts || {};

    // Avatar
    const avatarHtml = texts["avatar"]
      ? `<img class="avatar" src="${safeHref(texts["avatar"])}" alt="${esc(name)}" onerror="this.style.display='none'">`
      : `<div class="avatar-placeholder">${esc(name.charAt(0).toUpperCase())}</div>`;

    // Social links
    const socialsHtml = buildSocialLinks(texts);

    // Bio
    const bioHtml = texts["description"]
      ? `<p class="bio">${esc(texts["description"])}</p>`
      : "";

    // Renewal info
    const renewalText = data.status === "active"
      ? `${expDate} (${days} day${days !== 1 ? "s" : ""} left)`
      : expDate;

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
          agentRows.push(`<div class="agent-card"><div class="agent-label">Agent Wallet</div><div class="agent-value"><a href="https://basescan.org/address/${esc(data.agentWallet)}">${esc(shortAgent)}</a></div></div>`);
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

    // Build the unified Onchain Profile section
    const onchainProfileHtml = onchainBlocks.length
      ? `<div class="section">
          <div class="section-title">Onchain Profile</div>
          ${onchainBlocks.join('<hr style="border:none;border-top:1px solid #1a2e1a;margin:0.75rem 0">')}
        </div>`
      : "";

    // Contenthash section
    const contenthashHtml = data.contenthash
      ? `<div class="section">
          <div class="section-title">Contenthash</div>
          <div class="info-grid">
            <div class="info-row">
              <span class="label">Hash</span>
              <span class="value" style="font-size:0.75rem">${esc(data.contenthash.slice(0, 18) + "..." + data.contenthash.slice(-8))}</span>
            </div>
          </div>
        </div>`
      : "";

    content = `
    <div class="profile-header">
      ${avatarHtml}
      <h1>${esc(name)}<span>.hazza.name</span></h1>
      ${bioHtml}
      ${statusBadge(data.status)}
      ${badgesHtml}
      ${socialsHtml}
    </div>

    <div class="section">
      <div class="section-title">Name Info</div>
      <div class="info-grid">
        <div class="info-row">
          <span class="label">Owner</span>
          <span class="value"><a href="https://basescan.org/address/${esc(data.owner)}">${esc(ownerDisplay)}</a></span>
        </div>
        <div class="info-row">
          <span class="label">Token ID</span>
          <span class="value">#${esc(data.tokenId)}</span>
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
          <span class="value"><a href="https://basescan.org/address/${esc(data.operator)}">${esc(data.operator.slice(0, 6) + "..." + data.operator.slice(-4))}</a></span>
        </div>` : ""}
        <div class="info-row">
          <span class="label">Subdomain</span>
          <span class="value"><a href="https://${encodeURIComponent(name)}.hazza.name">${esc(name)}.hazza.name</a></span>
        </div>
      </div>
    </div>

    ${onchainProfileHtml}
    ${contenthashHtml}

    <div style="display:flex;justify-content:center;gap:1rem;margin-top:2rem;flex-wrap:wrap">
      <a href="https://hazza.name/manage?name=${encodeURIComponent(name)}" style="display:inline-block;padding:0.6rem 1.5rem;border:1px solid #00e676;color:#00e676;border-radius:8px;font-weight:700;font-size:0.9rem;text-decoration:none">Edit Profile</a>
      ${data.status === "grace" || data.status === "redemption" ? `<a href="https://hazza.name/manage?name=${encodeURIComponent(name)}" style="display:inline-block;padding:0.6rem 1.5rem;background:#ffab00;color:#000;border:none;border-radius:8px;font-weight:700;font-size:0.9rem;text-decoration:none">Renew Now</a>` : ""}
    </div>`;
  } else {
    content = `
    <div class="unclaimed">
      <h1 style="color:#fff;font-size:2rem;font-weight:900;margin-bottom:0.5rem">${esc(name)}<span style="color:#00e676">.hazza.name</span></h1>
      <p>this name is available</p>
      <a class="cta" href="https://hazza.name/register?name=${encodeURIComponent(name)}">Register it</a>
    </div>`;
  }

  return shell(
    title,
    data ? `${name}.hazza.name \u2014 owned by ${data.owner}` : `${name}.hazza.name is available on HAZZA`,
    content
  );
}

// =========================================================================
//                          ABOUT PAGE
// =========================================================================

export function aboutPage(): string {
  return shell(
    "HAZZA \u2014 About",
    "HAZZA is an onchain domain registry on Base. One x402 payment gives you a name, website, agent, and DNS.",
    `
    <div class="header">
      <h1>about</h1>
    </div>

    <div class="section">
      <div class="section-title">What is HAZZA?</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        HAZZA is an onchain name registry on Base. Register a <strong style="color:#fff">.hazza.name</strong> domain
        and get an ERC-721 NFT that serves as your identity, your subdomain, your content host, and your AI agent endpoint &mdash; all in one.
      </p>
    </div>

    <div class="section">
      <div class="section-title">What you get</div>
      <div class="info-grid">
        <div class="info-row"><span class="label">NFT</span><span class="value">Your name as an ERC-721 on Base</span></div>
        <div class="info-row"><span class="label">Website</span><span class="value">Live page at yourname.hazza.name</span></div>
        <div class="info-row"><span class="label">Profile</span><span class="value">Bio, socials, avatar &mdash; all onchain</span></div>
        <div class="info-row"><span class="label">Content</span><span class="value">Host via Net Protocol &amp; IPFS (ENSIP-7)</span></div>
        <div class="info-row"><span class="label">Agent</span><span class="value">ERC-8004 AI agent registration</span></div>
        <div class="info-row"><span class="label">DNS</span><span class="value">Custom domain linking</span></div>
        <div class="info-row"><span class="label">Addresses</span><span class="value">Multi-chain (ENSIP-9/11)</span></div>
        <div class="info-row"><span class="label">Subnames</span><span class="value">Namespace delegation for teams</span></div>
        <div class="info-row"><span class="label">Unicode</span><span class="value">ENSIP-15 emoji &amp; unicode support</span></div>
        <div class="info-row"><span class="label">API</span><span class="value">Programmatic access to everything</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">How it works</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        One <a href="https://x402.org" style="font-weight:700">x402</a> payment in USDC on Base &mdash; that's it.
        Your name is minted as an NFT, your website goes live, your agent endpoint is ready, and DNS resolves immediately.
        x402 handles the payment so you don't have to think about gas or token approvals.
      </p>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        Under the hood, registration uses a commit-reveal scheme to prevent front-running.
        Content hosting is powered by <a href="https://netprotocol.app" style="font-weight:700">Net Protocol</a> and IPFS.
        Set text records, link socials, point to content, or register an AI agent &mdash; all through onchain transactions.
      </p>
    </div>

    <div class="section">
      <div class="section-title">Built on</div>
      <div class="info-grid">
        <div class="info-row"><span class="label"><a href="https://base.org">Base</a></span><span class="value">Low-cost L2 for everything onchain</span></div>
        <div class="info-row"><span class="label"><a href="https://x402.org">x402</a></span><span class="value">HTTP-native payment protocol</span></div>
        <div class="info-row"><span class="label"><a href="https://netprotocol.app">Net Protocol</a></span><span class="value">Onchain content hosting</span></div>
        <div class="info-row"><span class="label">ERC-8004</span><span class="value">AI agent registry standard</span></div>
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
    "HAZZA \u2014 Pricing",
    "HAZZA name pricing, anti-squatting protections, discounts, and everything you need to know before registering.",
    `
    <div class="header">
      <h1>pricing</h1>
    </div>

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

    <hr class="divider">

    <div class="section">
      <div class="section-title">Discounts</div>
      <div class="info-grid">
        <div class="info-row"><span class="label">ENS import</span><span class="value">50% off + challenge immunity</span></div>
        <div class="info-row"><span class="label">Net Library Unlimited Pass</span><span class="value">20% off</span></div>
        <div class="info-row"><span class="label">Both combined</span><span class="value">60% off (multiplicative)</span></div>
      </div>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Renewal</div>
      <div class="info-grid">
        <div class="info-row"><span class="label">Annual renewal</span><span class="value">$2 / year</span></div>
        <div class="info-row"><span class="label">Grace period</span><span class="value">30 days at normal price</span></div>
        <div class="info-row"><span class="label">Redemption</span><span class="value">30 more days + $10 penalty</span></div>
      </div>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Namespaces (add-on)</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        Turn any HAZZA name into a namespace and issue subnames under it.<br>
        Useful for teams, organizations, or agent networks &mdash; e.g. <strong style="color:#fff">alice.yourname</strong>, <strong style="color:#fff">bot.yourname</strong>.
      </p>
      <div class="info-grid">
        <div class="info-row"><span class="label">Create namespace</span><span class="value">$50 (one-time)</span></div>
        <div class="info-row"><span class="label">Issue subname</span><span class="value">$1 each</span></div>
      </div>
      <p style="color:#6b8f6b;font-size:0.85rem;margin-top:0.75rem">
        Each subname is its own full HAZZA name with a profile, agent, and DNS.
      </p>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Learn more</div>
      <div class="info-grid">
        <div class="info-row"><span class="label"><a href="/pricing/protections">Protections</a></span><span class="value">Anti-squatting, rate limits, and the challenge system</span></div>
        <div class="info-row"><span class="label"><a href="/pricing/details">Details</a></span><span class="value">Renewal, expiry, front-running protection, and payment</span></div>
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
    "HAZZA \u2014 Protections",
    "Anti-squatting, rate limits, and the challenge system for HAZZA name registrations.",
    `
    <div class="header">
      <h1>protections</h1>
    </div>

    <div class="section">
      <div class="section-title">Progressive pricing</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        Registering multiple names gets <strong style="color:#fff">progressively more expensive</strong>.
        The contract tracks how many names each wallet registers within a 90-day window and applies multipliers:
      </p>
      <div class="info-grid">
        <div class="info-row"><span class="label">Names 1&ndash;3</span><span class="value">1x base price</span></div>
        <div class="info-row"><span class="label">Names 4&ndash;5</span><span class="value">2.5x base price</span></div>
        <div class="info-row"><span class="label">Names 6&ndash;7</span><span class="value">5x base price</span></div>
        <div class="info-row"><span class="label">Names 8+</span><span class="value">10x base price</span></div>
      </div>
      <p style="color:#6b8f6b;font-size:0.85rem;margin-top:0.75rem">
        Example: A 5+ char name costs $5, $5, $5, then $12.50, $12.50, then $25, $25, then $50 each.<br>
        The window resets after 90 days.
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
        The Unlimited Pass is a Net Library storage pass ($20) that also unlocks unlimited HAZZA registrations.
      </p>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Challenge system</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        If someone squats a name that belongs to a legitimate brand or identity, the rightful owner
        can challenge for it.<br>
        Challenges are reviewed and approved by the registry admin.
      </p>
      <div class="info-grid">
        <div class="info-row"><span class="label">Claim cost</span><span class="value">2x original registration price</span></div>
        <div class="info-row"><span class="label">Compensation</span><span class="value">Full claim price paid to current holder</span></div>
        <div class="info-row"><span class="label">ENS imports</span><span class="value">Immune to challenges</span></div>
      </div>
      <p style="color:#6b8f6b;font-size:0.85rem;margin-top:0.75rem">
        The current holder is compensated at 2x what they paid &mdash; good-faith registrants are never punished.
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
    "HAZZA \u2014 Details",
    "Renewal, expiry, front-running protection, and payment details for HAZZA names.",
    `
    <div class="header">
      <h1>details</h1>
    </div>

    <div class="section">
      <div class="section-title">Renewal &amp; expiry</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        Names are active for one year.<br>
        After expiry, two recovery windows protect you before the name is released.
      </p>
      <div class="info-grid">
        <div class="info-row"><span class="label">Annual renewal</span><span class="value">$2 / year</span></div>
        <div class="info-row"><span class="label">Grace period</span><span class="value">30 days &mdash; renew at normal price</span></div>
        <div class="info-row"><span class="label">Redemption period</span><span class="value">30 more days &mdash; $10 penalty + renewal</span></div>
        <div class="info-row"><span class="label">After 60 days</span><span class="value">Name released for anyone to register</span></div>
      </div>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Front-running protection</div>
      <p style="color:#aaa;line-height:1.7">
        Registration uses a <strong style="color:#fff">commit-reveal</strong> scheme.<br>
        You first commit a hash of your desired name (hidden from others),
        wait at least 60 seconds, then reveal and pay.<br>
        This prevents bots from sniping names they see in the mempool.
        Commits expire after 24 hours.
      </p>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Payment</div>
      <p style="color:#aaa;line-height:1.7">
        All payments in <strong style="color:#fff">USDC</strong> on Base via <a href="https://x402.org">x402</a>.<br>
        Click, pay, done &mdash; no manual token approvals needed.
      </p>
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
    "HAZZA \u2014 Docs",
    "HAZZA documentation. Registration flow, API endpoints, contract reference, and text record keys.",
    `
    <div class="header">
      <h1>docs</h1>
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
        <code style="color:#00e676;font-size:0.85rem">GET /api/quote/myname?wallet=0x...&years=2&ensImport=true</code>
        <pre style="color:#aaa;font-size:0.8rem;margin-top:0.5rem;white-space:pre-wrap">{
  "total": "6.50",
  "registrationFee": "2.50",
  "renewalFee": "4.00",
  "lineItems": [...]
}</pre>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Subdomain profiles</div>
      <p style="color:#aaa;line-height:1.7">
        Every registered name gets a live profile page at <strong style="color:#fff">name.hazza.name</strong>.
        Unregistered names show an availability page with a registration link.
      </p>
    </div>

    <div id="write-api" class="section">
      <div class="section-title">Write API</div>
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
      <p style="color:#6b8f6b;font-size:0.8rem;margin-top:0.75rem">Any string key is valid. The keys above are conventions used by the profile page and other HAZZA integrations.</p>
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
  "profileUrl": "https://alice.hazza.name",
  "expiresAt": 1803854400
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
        <div class="info-row"><span class="label">Registry</span><span class="value" style="font-size:0.75rem">0xbDDa076DCc3Ac8C4Fc6CFe8bcE458D5536e695e3</span></div>
        <div class="info-row"><span class="label">USDC</span><span class="value" style="font-size:0.75rem">0x06A096A051906dEDd05Ef22dCF61ca1199bb038c</span></div>
        <div class="info-row"><span class="label">Source</span><span class="value"><a href="https://github.com/geaux-eth/hazza">github.com/geaux-eth/hazza</a></span></div>
      </div>
    </div>`
  );
}

// =========================================================================
//                          DOMAINS PAGE
// =========================================================================

export function domainsPage(): string {
  return shell(
    "HAZZA \u2014 Custom Domains",
    "Link your own domain to your HAZZA name. Route any .com, .xyz, or .io to your onchain profile.",
    `
    <div class="header">
      <h1>custom domains</h1>
    </div>

    <div class="section">
      <div class="section-title">Bring your own domain</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        Every HAZZA name gets a live subdomain at <strong style="color:#fff">yourname.hazza.name</strong> automatically.<br>
        But you can also link any domain you already own &mdash; .com, .xyz, .io, whatever &mdash; and it will resolve to your onchain profile.
      </p>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">How to link your domain</div>
      <div class="info-grid">
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">1. Register</span><span class="value">Get a HAZZA name at <a href="/register">/register</a></span></div>
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">2. Buy a domain</span><span class="value">Use any registrar &mdash; Namecheap, GoDaddy, Cloudflare, etc.</span></div>
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">3. Point DNS</span><span class="value">Add a CNAME record pointing to <strong style="color:#00e676">hazza.name</strong></span></div>
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">4. Link onchain</span><span class="value">Call <code style="color:#00e676">setCustomDomain</code> on the contract (or use the API)</span></div>
      </div>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">What you get</div>
      <div class="info-grid">
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">Routing</span><span class="value">Your domain resolves to your HAZZA profile, agent endpoint, or custom content</span></div>
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">Subdomain</span><span class="value">yourname.hazza.name always works &mdash; free and included</span></div>
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">Onchain</span><span class="value">Domain mapping is stored in the HAZZA contract &mdash; verifiable and permanent</span></div>
        <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem"><span class="label">Flexible</span><span class="value">Point at your profile, custom HTML via <a href="https://netprotocol.app" style="font-weight:700">Net Protocol</a>, IPFS, or your own server</span></div>
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
        Some registrars don't support CNAME on root (@). Use an A record pointing to HAZZA's IP, or use a registrar that supports CNAME flattening (Cloudflare, etc.).
      </p>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Manage DNS records</div>
      <p style="color:#aaa;line-height:1.7;margin-bottom:1rem">
        If your domain's DNS is managed through HAZZA, you can view and edit records here.
      </p>
      <div style="text-align:center;margin-top:1.25rem">
        <a href="/domains/manage" style="display:inline-block;padding:0.6rem 1.5rem;border:1px solid #00e676;color:#00e676;border-radius:8px;font-weight:700;font-size:0.9rem">Manage DNS</a>
      </div>
    </div>

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
    "HAZZA \u2014 Manage DNS",
    "Manage DNS records, nameservers, and routing for your HAZZA domain.",
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
          <button onclick="applyPreset('profile')" style="padding:0.5rem 1rem;background:none;border:1px solid #1a2e1a;color:#aaa;border-radius:6px;font-size:0.85rem;cursor:pointer;font-family:'Rubik',sans-serif">HAZZA Profile</button>
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
