import { Link } from 'react-router-dom';
import { NOMI_AVATAR } from '../constants';

export default function About() {
  return (
    <>
      <style>{`.section-title { color: #CF3748 !important; }`}</style>
      <div className="header" style={{ background: '#4870D4', padding: '1rem 1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#fff' }}>about</h1>
      </div>

      <div
        style={{
          background: '#CF3748',
          border: '3px solid #fff',
          borderRadius: '10px',
          padding: 0,
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'flex-end',
          overflow: 'hidden',
        }}
      >
        <img
          src={NOMI_AVATAR}
          alt="Nomi"
          style={{
            width: '180px',
            height: '180px',
            flexShrink: 0,
            marginLeft: '0.75rem',
            imageRendering: 'auto',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
          }}
        />
        <p
          style={{
            fontFamily: "'Fredoka', sans-serif",
            color: '#fff',
            fontSize: '1rem',
            lineHeight: 1.6,
            margin: 0,
            padding: '1.25rem 1.25rem 1.25rem 0.75rem',
            flex: 1,
          }}
        >
          let me tell you about hazza. it started with a simple idea: names should be immediately useful. this means online AND onchain.
        </p>
      </div>

      <div className="section">
        <div className="section-title">What is hazza?</div>
        <p style={{ color: '#131325', lineHeight: 1.7, marginBottom: '1rem' }}>
          hazza is an onchain name registry on Base. Register a{' '}
          <strong style={{ color: '#131325' }}>.hazza.name</strong> domain and get an ERC-721 NFT that
          serves as your identity, your subdomain, your content host, and your AI agent endpoint &mdash;
          all in one.
        </p>
      </div>

      <div className="section">
        <div className="section-title">What you get</div>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">NFT</span>
            <span className="value">Your name as an ERC-721 on Base</span>
          </div>
          <div className="info-row">
            <span className="label">Website</span>
            <span className="value">Live page at yourname.hazza.name</span>
          </div>
          <div className="info-row">
            <span className="label">Profile</span>
            <span className="value">Bio, socials, avatar &mdash; all onchain</span>
          </div>
          <div className="info-row">
            <span className="label">Content</span>
            <span className="value">
              Host via <a href="https://netprotocol.app">Net Protocol</a> (ENSIP-7)
            </span>
          </div>
          <div className="info-row">
            <span className="label">Agent</span>
            <span className="value">ERC-8004 AI agent registration</span>
          </div>
          <div className="info-row">
            <span className="label">DNS</span>
            <span className="value">Custom domain linking (up to 10)</span>
          </div>
          <div className="info-row">
            <span className="label">Addresses</span>
            <span className="value">Multi-chain via API (ENSIP-9/11)</span>
          </div>
          <div className="info-row">
            <span className="label">Subnames</span>
            <span className="value">Free to enable &mdash; $1 per subname</span>
          </div>
          <div className="info-row">
            <span className="label">Unicode</span>
            <span className="value">ENSIP-15 emoji &amp; unicode support</span>
          </div>
          <div className="info-row">
            <span className="label">API</span>
            <span className="value">Programmatic access to everything</span>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">How it works</div>
        <p style={{ color: '#131325', lineHeight: 1.7, marginBottom: '1rem' }}>
          <strong>For humans:</strong> Connect your wallet on the{' '}
          <Link to="/register">register page</Link>, pay USDC, and your name is minted as an NFT. Your
          profile page goes live immediately.
        </p>
        <p style={{ color: '#131325', lineHeight: 1.7, marginBottom: '1rem' }}>
          <strong>For agents &amp; CLIs:</strong> Use the{' '}
          <Link to="/docs#x402" style={{ fontWeight: 700 }}>
            x402 API
          </Link>{' '}
          to register programmatically &mdash; send an HTTP request, pay USDC, and receive a registered
          name. No wallet extension needed.
        </p>
        <p style={{ color: '#131325', lineHeight: 1.7, marginBottom: '1rem' }}>
          Content hosting is powered by{' '}
          <a href="https://netprotocol.app" style={{ fontWeight: 700 }}>
            Net Protocol
          </a>
          . Set text records, link socials, point to content, or register an AI agent &mdash; all through
          onchain transactions.
        </p>
      </div>

      <div className="section">
        <div className="section-title">Pricing</div>
        <div style={{ textAlign: 'center', margin: '1rem 0', padding: '1rem', border: '3px solid #CF3748', borderRadius: '12px', background: '#fff' }}>
          <div style={{ color: '#CF3748', fontWeight: 700, fontSize: '1rem' }}>your first name</div>
          <div style={{ color: '#4870D4', fontWeight: 700, fontSize: '1.6rem', fontFamily: "'Fredoka', sans-serif" }}>FREE</div>
          <div style={{ color: '#8a7d5a', fontSize: '0.85rem', marginTop: '0.15rem' }}>just pay gas &mdash; 1 per wallet</div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ color: '#131325', fontWeight: 700, fontSize: '1rem' }}>additional names start at $5</div>
          <div style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.15rem' }}>pay once, available forever</div>
        </div>
        <div className="info-grid">
          <div className="info-row"><span className="label">Payment</span><span className="value">USDC on Base (~$0.01 gas per tx)</span></div>
          <div className="info-row"><span className="label">Names 1&ndash;3</span><span className="value">1x ($5 each)</span></div>
          <div className="info-row"><span className="label">Names 4&ndash;5</span><span className="value">2.5x ($12.50 each)</span></div>
          <div className="info-row"><span className="label">Names 6&ndash;7</span><span className="value">5x ($25 each)</span></div>
          <div className="info-row"><span className="label">Names 8+</span><span className="value">10x ($50 each)</span></div>
        </div>
        <p style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          Progressive pricing deters bulk registration. The 90-day window resets automatically.
          <br />
          <a href="https://netlibrary.app" style={{ color: '#4870D4' }}>Unlimited Pass</a> holders get 20% off + 1 free name.
        </p>
      </div>

      <div className="section">
        <div className="section-title">Namespaces</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '0.75rem' }}>
          Turn any name into a namespace and issue subnames &mdash; e.g.{' '}
          <strong style={{ color: '#131325' }}>alice.yourname</strong>,{' '}
          <strong style={{ color: '#131325' }}>bot.yourname</strong>.
        </p>
        <div className="info-grid">
          <div className="info-row"><span className="label">Enable</span><span className="value">Free (permanent)</span></div>
          <div className="info-row"><span className="label">Subnames</span><span className="value">$1 each &mdash; full hazza name with profile, agent, and DNS</span></div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Ownership &amp; Rules</div>
        <div className="info-grid">
          <div className="info-row"><span className="label">Standard</span><span className="value">ERC-721 NFT on Base</span></div>
          <div className="info-row"><span className="label">Transfer</span><span className="value">Via dashboard or any NFT marketplace</span></div>
          <div className="info-row"><span className="label">Characters</span><span className="value">a&ndash;z, 0&ndash;9, hyphens &mdash; 1 to 64 chars</span></div>
          <div className="info-row"><span className="label">Unicode</span><span className="value">ENSIP-15 emoji &amp; international support</span></div>
          <div className="info-row"><span className="label">First-come</span><span className="value">No challenge or dispute system</span></div>
          <div className="info-row"><span className="label">Contract</span><span className="value"><a href="https://github.com/geaux-eth/hazza">Open source</a>, non-upgradeable</span></div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Need help?</div>
        <p style={{ color: '#131325', lineHeight: 1.7, marginBottom: '1rem' }}>
          <strong>Nomi</strong> can help with name registration, availability checks, pricing questions,
          text records, and marketplace transactions.
        </p>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">XMTP</span>
            <span className="value">
              <a href="https://xmtp.chat/production/dm/0x55B251E202938E562E7384bD998215885b80162e">
                Message Nomi
              </a>
            </span>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Built on</div>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">
              <a href="https://base.org">Base</a>
            </span>
            <span className="value">Low-cost L2 for everything onchain</span>
          </div>
          <div className="info-row">
            <span className="label">
              <a href="https://x402.org">x402</a>
            </span>
            <span className="value">HTTP-native payment protocol</span>
          </div>
          <div className="info-row">
            <span className="label">
              <a href="https://netprotocol.app">Net Protocol</a>
            </span>
            <span className="value">Onchain content hosting</span>
          </div>
          <div className="info-row">
            <span className="label">
              <a href="https://xmtp.org">XMTP</a>
            </span>
            <span className="value">Decentralized messaging</span>
          </div>
          <div className="info-row">
            <span className="label">
              <a href="https://eips.ethereum.org/EIPS/eip-8004">ERC-8004</a>
            </span>
            <span className="value">AI agent registry standard</span>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', margin: '2rem 0' }}>
        <Link
          to="/"
          style={{
            display: 'inline-block',
            padding: '0.75rem 2rem',
            background: '#CF3748',
            color: '#fff',
            borderRadius: '8px',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Search for a name
        </Link>
      </div>
    </>
  );
}
