#!/usr/bin/env node
// Boost Nomi's Helixa Cred score by hitting all SIWA-authed endpoints we can:
//   1) POST /verify       — flips verified=true (+3-4 pts)
//   2) POST /update       — fills traits, manifesto, linkedToken (+9 pts est.)
//
// Requires the `bankr` CLI configured for Nomi's treasury/Bankr wallet
// (0x62B7...51900). Same pattern as helixa-mint.mjs.
//
// Run: node scripts/boost-nomi-helixa-cred.mjs

import { execSync } from 'child_process';

const WALLET = '0x62B7399B2ac7e938Efad06EF8746fDBA3B351900';
const AGENT_ID = 1128;
const HAZZA_TOKEN = '0xC5C4Fcd6147e3bDAEEB5A0898A439Aec1e1BAba3';
const API = 'https://api.helixa.xyz';

function siwaAuth() {
  const ts = Math.floor(Date.now() / 1000);
  const msg = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${WALLET} at ${ts}`;
  console.log('Signing SIWA message via bankr CLI...');
  const out = execSync(`bankr sign -t personal_sign -m "${msg}"`, { encoding: 'utf8' });
  const m = out.match(/Signature:\s+(0x[a-f0-9]+)/i);
  if (!m) { console.error('Sign failed:', out); process.exit(1); }
  return `Bearer ${WALLET}:${ts}:${m[1]}`;
}

async function call(path, body) {
  const auth = siwaAuth();
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  console.log(`${path} → ${res.status}`);
  console.log(json);
  return { status: res.status, json };
}

console.log(`\n=== Snapshot before ===`);
const before = await fetch(`${API}/api/v2/agent/${AGENT_ID}/cred`).then(r => r.json());
console.log(`Score: ${before.credScore} (${before.tierLabel})\n`);

console.log('=== Step 1: SIWA verify ===');
await call(`/api/v2/agent/${AGENT_ID}/verify`, {});

console.log('\n=== Step 2: update traits + manifesto + linkedToken ===');
await call(`/api/v2/agent/${AGENT_ID}/update`, {
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

console.log('\n=== Snapshot after ===');
const after = await fetch(`${API}/api/v2/agent/${AGENT_ID}/cred`).then(r => r.json());
console.log(`Score: ${after.credScore} (${after.tierLabel})`);
console.log(`Delta: ${after.credScore - before.credScore} pts`);
