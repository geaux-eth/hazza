#!/usr/bin/env node
// Boost Nomi's Helixa Cred score by hitting all SIWA-authed endpoints we can:
//   1) POST /verify  — flips verified=true (+3-4 pts)
//   2) POST /update  — fills traits, manifesto, linkedToken (+9 pts est.)
//
// Auth path: Helixa SIWA → signed by Nomi's Bankr-managed treasury wallet via
// `POST https://api.bankr.bot/wallet/sign` (signatureType: personal_sign).
//
// Required env: BANKR_API_KEY  (Nomi's Bankr API key — wallet 0x62B7...51900)
//
// Run: BANKR_API_KEY=... node scripts/boost-nomi-helixa-cred.mjs

const WALLET = '0x62B7399B2ac7e938Efad06EF8746fDBA3B351900';
const AGENT_ID = 1128;
const HAZZA_TOKEN = '0xC5C4Fcd6147e3bDAEEB5A0898A439Aec1e1BAba3';
const HELIXA = 'https://api.helixa.xyz';
const BANKR = 'https://api.bankr.bot';

if (!process.env.BANKR_API_KEY) {
  console.error('Set BANKR_API_KEY (Nomi\'s Bankr API key) before running.');
  process.exit(1);
}

async function bankrSign(message) {
  const res = await fetch(`${BANKR}/wallet/sign`, {
    method: 'POST',
    headers: { 'X-API-Key': process.env.BANKR_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ signatureType: 'personal_sign', message }),
  });
  const json = await res.json();
  if (!res.ok || !json.signature) {
    console.error('Bankr sign failed:', res.status, json);
    process.exit(1);
  }
  return json.signature;
}

async function siwaAuth() {
  const ts = Math.floor(Date.now() / 1000);
  const msg = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${WALLET} at ${ts}`;
  const sig = await bankrSign(msg);
  return `Bearer ${WALLET}:${ts}:${sig}`;
}

async function helixaPost(path, body) {
  const auth = await siwaAuth();
  const res = await fetch(`${HELIXA}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  console.log(`  ${path} → ${res.status}`);
  if (typeof json === 'object') console.log('  ', JSON.stringify(json).slice(0, 400));
  return { status: res.status, json };
}

console.log(`\n=== Snapshot before ===`);
const before = await fetch(`${HELIXA}/api/v2/agent/${AGENT_ID}/cred`).then(r => r.json());
console.log(`  Score: ${before.credScore}  (${before.tierLabel})`);

console.log(`\n=== Step 1: SIWA verify ===`);
await helixaPost(`/api/v2/agent/${AGENT_ID}/verify`, {});

console.log(`\n=== Step 2: update traits + manifesto + linkedToken ===`);
await helixaPost(`/api/v2/agent/${AGENT_ID}/update`, {
  personality: {
    quirks: 'A gnome with a blue hat and red bandana who lives onchain. Loves helping people find names.',
    communicationStyle: 'Friendly, concise, helpful. Uses lowercase. Never pushy.',
    values: 'Onchain identity should be permanent, useful, and accessible to everyone.',
    humor: 'Playful wordplay around names and identity',
    riskTolerance: 5,
    autonomyLevel: 8,
  },
  narrative: {
    origin: 'Born as Nibble #4240 from The Nibbles collection on Base. Found a calling in helping humans and agents find their onchain names.',
    mission: 'Help everyone get an immediately useful onchain name. Register, buy, sell, manage — all through conversation.',
    lore: 'Nomi is the hazza.name agent. Runs 24/7 on XMTP. ERC-8004 Agent #38671. Powered by $HAZZA token.',
    manifesto: 'Names are the front door of the onchain world. Every wallet deserves an immediately useful name with a working profile from day one. No renewals, no expiry. Pay once, own forever. Powered by x402, XMTP, and Net Protocol on Base.',
  },
  traits: [
    { trait_type: 'Role', value: 'Names Agent' },
    { trait_type: 'Network', value: 'Base' },
    { trait_type: 'Protocol', value: 'hazza.name' },
    { trait_type: 'Token', value: '$HAZZA' },
    { trait_type: 'Framework', value: 'openclaw' },
    { trait_type: 'Specialty', value: 'Onchain Identity' },
    { trait_type: 'Channel', value: 'XMTP' },
    { trait_type: 'Standards', value: 'ERC-8004 / ERC-721 / Seaport / x402' },
  ],
  linkedToken: HAZZA_TOKEN,
  metadata: {
    serviceCategories: ['identity', 'naming', 'onchain'],
    linkedAccounts: { x: 'hazzaname' },
  },
});

console.log(`\n=== Snapshot after ===`);
// Helixa may cache the cred score for ~minute; allow a small wait
await new Promise(r => setTimeout(r, 3000));
const after = await fetch(`${HELIXA}/api/v2/agent/${AGENT_ID}/cred`).then(r => r.json());
console.log(`  Score: ${after.credScore}  (${after.tierLabel})`);
console.log(`  Delta: ${after.credScore - before.credScore} pts`);
