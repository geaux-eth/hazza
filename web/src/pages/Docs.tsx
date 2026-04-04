import { Link } from 'react-router-dom';

export default function Docs() {
  return (
    <>
      <style>{`.section-title { color: #CF3748 !important; }`}</style>
      <div
        className="header"
        style={{ background: '#4870D4', padding: '1rem 1rem', borderRadius: '12px', marginBottom: '1.5rem' }}
      >
        <h1 style={{ color: '#fff' }}>docs</h1>
      </div>

      <div className="info-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="info-row">
          <span className="label">
            <a href="https://github.com/geaux-eth/hazza">GitHub</a>
          </span>
          <span className="value">Source code &amp; contracts</span>
        </div>
        <div className="info-row">
          <span className="label">
            <a href="https://github.com/geaux-eth/hazza/tree/main/worker">Worker</a>
          </span>
          <span className="value">API &amp; gateway source</span>
        </div>
        <div className="info-row">
          <span className="label">
            <a href="#cli">CLI</a>
          </span>
          <span className="value">
            <code style={{ fontSize: '0.85rem', color: '#CF3748' }}>npx hazza-cli</code>
          </span>
        </div>
        <div className="info-row">
          <span className="label">
            <a href="https://github.com/geaux-eth/hazza/blob/main/hazza-SKILL.md">OpenClaw</a>
          </span>
          <span className="value">hazza skill for ai agents</span>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Read Endpoints</div>
        <div className="info-grid">
          <div className="info-row"><span className="label">GET</span><span className="value">/api/available/:name</span></div>
          <div className="info-row"><span className="label">GET</span><span className="value">/api/resolve/:name</span></div>
          <div className="info-row"><span className="label">GET</span><span className="value">/api/profile/:name</span></div>
          <div className="info-row"><span className="label">GET</span><span className="value">/api/text/:name/:key</span></div>
          <div className="info-row"><span className="label">GET</span><span className="value">/api/metadata/:name</span></div>
          <div className="info-row"><span className="label">GET</span><span className="value">/api/price/:name</span></div>
          <div className="info-row"><span className="label">GET</span><span className="value">/api/quote/:name</span></div>
          <div className="info-row"><span className="label">GET</span><span className="value">/api/reverse/:address</span></div>
          <div className="info-row"><span className="label">GET</span><span className="value">/api/names/:address</span></div>
          <div className="info-row"><span className="label">GET</span><span className="value">/api/stats</span></div>
        </div>
        <div className="section-title" style={{ marginTop: '1.5rem' }}>x402 Endpoints</div>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">POST</span>
            <span className="value">
              <a href="#x402">/x402/register</a> &mdash; register a name via HTTP payment
            </span>
          </div>
          <div className="info-row">
            <span className="label">POST</span>
            <span className="value">
              <a href="#x402-text">/x402/text/:name</a> &mdash; set a text record ($0.02 USDC)
            </span>
          </div>
          <div className="info-row">
            <span className="label">POST</span>
            <span className="value">
              <a href="#x402-text">/x402/text/:name/batch</a> &mdash; set multiple text records ($0.02 USDC)
            </span>
          </div>
        </div>

        <div className="section-title" style={{ marginTop: '1.5rem' }}>Marketplace</div>
        <div className="info-grid">
          <div className="info-row"><span className="label">GET</span><span className="value">/api/marketplace/listings &mdash; active listings</span></div>
          <div className="info-row"><span className="label">GET</span><span className="value">/api/marketplace/offers &mdash; collection offers</span></div>
          <div className="info-row"><span className="label">GET</span><span className="value">/api/marketplace/offers/:name &mdash; offers on a name</span></div>
          <div className="info-row"><span className="label">GET</span><span className="value">/api/marketplace/sales &mdash; recent sales</span></div>
          <div className="info-row"><span className="label">POST</span><span className="value">/api/marketplace/fulfill &mdash; get buy tx data</span></div>
          <div className="info-row"><span className="label">POST</span><span className="value">/api/marketplace/fulfill-offer &mdash; get offer acceptance tx</span></div>
          <div className="info-row"><span className="label">POST</span><span className="value">/api/marketplace/offer &mdash; submit an offer</span></div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Check availability</div>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <code style={{ color: '#CF3748', fontSize: '0.85rem' }}>GET /api/available/yourname</code>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`{ "name": "yourname", "available": true }`}
          </pre>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Full profile</div>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <code style={{ color: '#CF3748', fontSize: '0.85rem' }}>GET /api/profile/geaux</code>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`{
  "name": "geaux",
  "registered": true,
  "owner": "0x9616...8097",
  "status": "active",
  "texts": {
    "com.twitter": "@hazzaname",
    "description": "Builder..."
  },
  "url": "https://geaux.hazza.name"
}`}
          </pre>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Get a quote</div>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <code style={{ color: '#CF3748', fontSize: '0.85rem' }}>GET /api/quote/myname?wallet=0x...&amp;ensImport=true</code>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`{
  "total": "5.00",
  "registrationFee": "5.00",
  "lineItems": [...]
}`}
          </pre>
        </div>
      </div>

      <div id="write-api" className="section">
        <div className="section-title">Write API</div>
        <p style={{ color: '#8a7d5a', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          All write operations are onchain Base transactions. Gas cost is typically ~$0.01 per transaction.
        </p>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          Manage your name programmatically with API keys. Generate a key on the{' '}
          <Link to="/manage">manage page</Link>, then use it to build transactions from any bot, CLI, or
          server.
        </p>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          All write endpoints require{' '}
          <strong style={{ color: '#131325' }}>Authorization: Bearer &lt;api-key&gt;</strong> and return{' '}
          <strong style={{ color: '#131325' }}>unsigned transaction data</strong> (to, data, chainId) that
          you sign and submit with your own wallet. No relay needed &mdash; you keep full control.
        </p>
      </div>

      <div className="section">
        <div className="section-title">Set a text record</div>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <code style={{ color: '#CF3748', fontSize: '0.85rem' }}>POST /api/text/:name</code>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`curl -X POST https://hazza.name/api/text/geaux \\
  -H "Authorization: Bearer 0xYOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"key": "description", "value": "hello world"}'`}
          </pre>
          <pre style={{ color: '#8a7d5a', fontSize: '0.75rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`{ "name": "geaux", "key": "description",
  "tx": { "to": "0x...", "data": "0x...", "chainId": 8453 } }`}
          </pre>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Batch set text records</div>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <code style={{ color: '#CF3748', fontSize: '0.85rem' }}>POST /api/text/:name/batch</code>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`curl -X POST https://hazza.name/api/text/geaux/batch \\
  -H "Authorization: Bearer 0xYOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"records": [
    {"key": "com.twitter", "value": "@handle"},
    {"key": "description", "value": "my bio"}
  ]}'`}
          </pre>
          <pre style={{ color: '#8a7d5a', fontSize: '0.75rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`{ "name": "geaux", "txs": [
  { "key": "com.twitter", "tx": { "to": "0x...", "data": "0x...", "chainId": 8453 } },
  ...
] }`}
          </pre>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Set custom domain</div>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <code style={{ color: '#CF3748', fontSize: '0.85rem' }}>POST /api/domain/:name</code>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`curl -X POST https://hazza.name/api/domain/geaux \\
  -H "Authorization: Bearer 0xYOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"domain": "example.com"}'`}
          </pre>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Set operator</div>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <code style={{ color: '#CF3748', fontSize: '0.85rem' }}>POST /api/operator/:name</code>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`curl -X POST https://hazza.name/api/operator/geaux \\
  -H "Authorization: Bearer 0xYOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"address": "0x..."}'`}
          </pre>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Submitting transactions</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          The API returns unsigned transaction data. Sign and submit with your own wallet:
        </p>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
{`// ethers.js
const response = await fetch('/api/text/geaux', { ... });
const { tx } = await response.json();
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
await signer.sendTransaction(tx);

// cast (foundry)
cast send $TO $DATA --private-key $KEY --rpc-url $RPC`}
          </pre>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Text record keys</div>
        <div className="info-grid">
          <div className="info-row"><span className="label">description</span><span className="value">Bio / about text</span></div>
          <div className="info-row"><span className="label">avatar</span><span className="value">Profile image URL</span></div>
          <div className="info-row"><span className="label">url</span><span className="value">Website URL</span></div>
          <div className="info-row"><span className="label">com.twitter</span><span className="value">Twitter / X handle</span></div>
          <div className="info-row"><span className="label">xyz.farcaster</span><span className="value">Farcaster handle</span></div>
          <div className="info-row"><span className="label">com.github</span><span className="value">GitHub username</span></div>
          <div className="info-row"><span className="label">org.telegram</span><span className="value">Telegram username</span></div>
          <div className="info-row"><span className="label">com.discord</span><span className="value">Discord username</span></div>
          <div className="info-row"><span className="label">com.linkedin</span><span className="value">LinkedIn username</span></div>
          <div className="info-row"><span className="label">agent.endpoint</span><span className="value">AI agent API URL</span></div>
          <div className="info-row"><span className="label">agent.model</span><span className="value">AI model name</span></div>
          <div className="info-row"><span className="label">agent.status</span><span className="value">Agent status (online/offline)</span></div>
        </div>
        <p style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.75rem' }}>
          Any string key is valid. The keys above are conventions used by the profile page and other hazza
          integrations.
        </p>
      </div>

      <hr className="divider" />

      <div id="x402" className="section">
        <div className="section-title">x402 &mdash; Register via HTTP payment</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          The <strong style={{ color: '#131325' }}>x402 protocol</strong> lets agents, CLIs, and any HTTP
          client register names programmatically. Send a POST, get a price quote, pay USDC onchain, retry
          with proof &mdash; done.
        </p>
      </div>

      <div className="section">
        <div className="section-title">Step 1: Request registration</div>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <code style={{ color: '#CF3748', fontSize: '0.85rem' }}>POST /x402/register</code>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`curl -X POST https://hazza.name/x402/register \\
  -H "Content-Type: application/json" \\
  -d '{"name": "alice", "owner": "0xYOUR_WALLET", "years": 1}'`}
          </pre>
          <pre style={{ color: '#8a7d5a', fontSize: '0.75rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`\u2190 402 Payment Required
{
  "x402Version": "1",
  "accepts": [{
    "scheme": "exact",
    "network": "base",
    "maxAmountRequired": "5000000",
    "asset": "0x8335...USDC",
    "payTo": "0xa6eB...relayer"
  }],
  "name": "alice",
  "price": "5",
  "currency": "USDC"
}`}
          </pre>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Step 2: Pay USDC onchain</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          Transfer the quoted USDC amount to the{' '}
          <strong style={{ color: '#131325' }}>payTo</strong> address. Use any method &mdash; wallet,
          cast, ethers.js, viem.
        </p>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
{`# cast (foundry)
cast send $USDC "transfer(address,uint256)" \\
  $RELAYER_ADDRESS 5000000 \\
  --rpc-url https://mainnet.base.org \\
  --private-key $KEY`}
          </pre>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Step 3: Retry with payment proof</div>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <code style={{ color: '#CF3748', fontSize: '0.85rem' }}>POST /x402/register + X-PAYMENT header</code>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`# Base64-encode the payment proof
PAYMENT=$(echo -n '{"scheme":"exact","txHash":"0x...","from":"0x..."}' | base64)

curl -X POST https://hazza.name/x402/register \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: $PAYMENT" \\
  -d '{"name": "alice", "owner": "0xYOUR_WALLET", "years": 1}'`}
          </pre>
          <pre style={{ color: '#8a7d5a', fontSize: '0.75rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`\u2190 200 OK
X-PAYMENT-RESPONSE: 0x...registrationTxHash
{
  "name": "alice",
  "owner": "0xYOUR_WALLET",
  "tokenId": "42",
  "registrationTx": "0x...",
  "profileUrl": "https://alice.hazza.name"
}`}
          </pre>
        </div>
      </div>

      <div className="section">
        <div className="section-title">x402 payment object</div>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">scheme</span>
            <span className="value">"exact" &mdash; direct USDC transfer</span>
          </div>
          <div className="info-row">
            <span className="label">txHash</span>
            <span className="value">The USDC transfer transaction hash</span>
          </div>
          <div className="info-row">
            <span className="label">from</span>
            <span className="value">The wallet that sent the USDC</span>
          </div>
        </div>
        <p style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.75rem' }}>
          The X-PAYMENT header is base64-encoded JSON. The server verifies the USDC transfer onchain
          before registering. Each tx hash can only be used once (replay protection).
        </p>
      </div>

      <hr className="divider" />

      <div id="x402-text" className="section">
        <div className="section-title">x402 &mdash; Update text records via HTTP payment</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          Set text records on any name you own &mdash; no API key, no wallet extension. Pay <strong style={{ color: '#131325' }}>$0.02 USDC</strong> per
          request and the relayer executes the transaction for you. Same x402 flow as registration.
        </p>

        <div className="section-title">Single record</div>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <code style={{ color: '#CF3748', fontSize: '0.85rem' }}>POST /x402/text/:name</code>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`curl -X POST https://hazza.name/x402/text/alice \\
  -H "Content-Type: application/json" \\
  -d '{"key": "avatar", "value": "https://example.com/pfp.png"}'

← 402 Payment Required
{
  "x402Version": "1",
  "accepts": [{ "maxAmountRequired": "20000", "asset": "USDC", "payTo": "0x..." }],
  "price": "0.02", "currency": "USDC"
}

# Pay $0.02 USDC, then retry with payment proof:
PAYMENT=$(echo -n '{"scheme":"exact","txHash":"0x...","from":"0x..."}' | base64)

curl -X POST https://hazza.name/x402/text/alice \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: $PAYMENT" \\
  -d '{"key": "avatar", "value": "https://example.com/pfp.png"}'

← 200 OK
{ "name": "alice", "key": "avatar", "value": "https://...", "tx": "0x..." }`}
          </pre>
        </div>

        <div className="section-title">Batch records</div>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <code style={{ color: '#CF3748', fontSize: '0.85rem' }}>POST /x402/text/:name/batch</code>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`curl -X POST https://hazza.name/x402/text/alice/batch \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: $PAYMENT" \\
  -d '{"records": [
    {"key": "avatar", "value": "https://example.com/pfp.png"},
    {"key": "description", "value": "Builder on Base"},
    {"key": "com.twitter", "value": "alice"}
  ]}'

← 200 OK
{ "name": "alice", "records": [...], "tx": "0x..." }`}
          </pre>
        </div>
        <p style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          Batch updates any number of records in a single transaction for one $0.02 payment.
          The <code>from</code> address in the payment must be the name owner.
        </p>
      </div>

      <hr className="divider" />

      <div className="section">
        <div className="section-title">Marketplace API</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          hazza names trade on the <strong style={{ color: '#131325' }}>Seaport protocol</strong> (same as OpenSea) via the Net Protocol Bazaar.
          The API handles all Seaport complexity &mdash; you get ready-to-execute transaction data.
        </p>

        <div className="section-title">List a name (agent-friendly)</div>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <code style={{ color: '#CF3748', fontSize: '0.85rem' }}>POST /api/marketplace/list-helper</code>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`curl -X POST https://hazza.name/api/marketplace/list-helper \\
  -H "Content-Type: application/json" \\
  -d '{"name": "alice", "price": "0.1", "seller": "0xYOUR_WALLET"}'

← 200 OK
{
  "typedData": { ... },        // EIP-712 data — sign with your wallet
  "bazaarSubmit": { ... },     // Bazaar.submit() params — call after signing
  "approvalNeeded": { ... },   // setApprovalForAll tx (if needed, one-time)
  "bountyRegistration": null   // registerBounty tx (if bounty set)
}`}
          </pre>
        </div>
        <p style={{ color: '#8a7d5a', fontSize: '0.8rem', marginBottom: '1rem' }}>
          No Seaport knowledge needed. Call the helper, sign the typed data, submit to Bazaar. Optional: include
          <code>bountyAmount</code> (ETH) to set an agent bounty, <code>duration</code> (seconds, 0 = 10 years).
        </p>

        <div className="section-title">Browse listings</div>
        <pre style={{ background: '#f5f0e0', padding: '0.75rem', borderRadius: '6px', overflow: 'auto', fontSize: '0.8rem' }}>
{`curl -s https://hazza.name/api/marketplace/listings`}
        </pre>
        <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          Returns <code>{`{listings: [{name, tokenId, seller, price, currency, orderHash, ...}], total}`}</code>
        </p>

        <div className="section-title" style={{ marginTop: '1.25rem' }}>Buy a name (2-step)</div>
        <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          <strong style={{ color: '#131325' }}>Step 1</strong> &mdash; Get the transaction data:
        </p>
        <pre style={{ background: '#f5f0e0', padding: '0.75rem', borderRadius: '6px', overflow: 'auto', fontSize: '0.8rem' }}>
{`curl -X POST https://hazza.name/api/marketplace/fulfill \\
  -H "Content-Type: application/json" \\
  -d '{"orderHash": "0x...", "buyerAddress": "0x..."}'`}
        </pre>
        <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          Returns <code>{`{approvals: [{to, data, value}], fulfillment: {to, data, value}}`}</code>
        </p>
        <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          <strong style={{ color: '#131325' }}>Step 2</strong> &mdash; Send each approval tx (if any), then send the fulfillment tx. The fulfillment <code>data</code> is complete Seaport calldata, ready to use as-is.
        </p>

        <div className="section-title" style={{ marginTop: '1.25rem' }}>Accept an offer</div>
        <pre style={{ background: '#f5f0e0', padding: '0.75rem', borderRadius: '6px', overflow: 'auto', fontSize: '0.8rem' }}>
{`curl -X POST https://hazza.name/api/marketplace/fulfill-offer \\
  -H "Content-Type: application/json" \\
  -d '{"orderHash": "0x...", "tokenId": "42", "sellerAddress": "0x..."}'`}
        </pre>
        <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          Same <code>{`{approvals, fulfillment}`}</code> format. Execute to accept the offer and transfer your name.
        </p>

        <div className="info-grid" style={{ marginTop: '1rem' }}>
          <div className="info-row"><span className="label">Marketplace fee</span><span className="value">None — 0%</span></div>
          <div className="info-row"><span className="label">Seaport</span><span className="value" style={{ fontSize: '0.75rem' }}>0x0000000000000068F116a894984e2DB1123eB395</span></div>
        </div>
      </div>

      <hr className="divider" />

      <div className="section">
        <div className="section-title">Contract</div>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">Network</span>
            <span className="value">Base (mainnet)</span>
          </div>
          <div className="info-row">
            <span className="label">Registry</span>
            <span className="value" style={{ fontSize: '0.75rem' }}>
              <a href="https://basescan.org/address/0xD4E420201fE02F44AaF6d28D4c8d3A56fEaE0D3E">
                0xD4E420201fE02F44AaF6d28D4c8d3A56fEaE0D3E
              </a>
            </span>
          </div>
          <div className="info-row">
            <span className="label">USDC</span>
            <span className="value" style={{ fontSize: '0.75rem' }}>
              0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
            </span>
          </div>
          <div className="info-row">
            <span className="label">Source</span>
            <span className="value">
              <a href="https://github.com/geaux-eth/hazza">github.com/geaux-eth/hazza</a>
            </span>
          </div>
        </div>
      </div>

      <hr className="divider" />

      <div id="cli" className="section">
        <div className="section-title">CLI</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          Register names, check availability, look up profiles, and manage text records from your terminal.
        </p>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <code style={{ color: '#CF3748', fontSize: '0.85rem' }}>Install</code>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
npm install -g hazza-cli
          </pre>
        </div>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <code style={{ color: '#CF3748', fontSize: '0.85rem' }}>Usage</code>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`hazza search alice          # check availability
hazza profile geaux         # view a profile
hazza register alice        # register via x402
hazza set geaux description "hello world"`}
          </pre>
        </div>
        <p style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.75rem' }}>
          Or run without installing: <code style={{ color: '#CF3748' }}>npx hazza-cli search alice</code>
        </p>
      </div>

      <div id="openclaw" className="section">
        <div className="section-title">OpenClaw</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          The <strong style={{ color: '#131325' }}>hazza skill</strong> lets AI agents register names,
          look up profiles, and manage records through natural language.
        </p>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
          <code style={{ color: '#CF3748', fontSize: '0.85rem' }}>Install the skill</code>
          <pre style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`Copy the hazza skill folder into your
OpenClaw workspace/skills/ directory.`}
          </pre>
        </div>
        <p style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.75rem' }}>
          Source: <a href="https://github.com/geaux-eth/hazza">github.com/geaux-eth/hazza</a>
        </p>
      </div>
    </>
  );
}
