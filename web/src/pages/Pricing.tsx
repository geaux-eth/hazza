import { Link, useLocation } from 'react-router-dom';

function PricingMain() {
  return (
    <>
      <div
        className="header"
        style={{ background: '#4870D4', padding: '1.5rem 1rem', borderRadius: '12px', marginBottom: '1.5rem' }}
      >
        <h1 style={{ color: '#fff' }}>pricing</h1>
      </div>

      <div
        style={{
          textAlign: 'center',
          margin: '2rem 0 1.5rem',
          padding: '1.25rem 1rem',
          border: '3px solid #CF3748',
          borderRadius: '12px',
          background: '#fff',
        }}
      >
        <div style={{ color: '#CF3748', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
          your first name
        </div>
        <div
          style={{
            color: '#4870D4',
            fontWeight: 700,
            fontSize: '1.8rem',
            letterSpacing: '-0.02em',
            fontFamily: "'Fredoka', sans-serif",
          }}
        >
          FREE
        </div>
        <div style={{ color: '#8a7d5a', fontSize: '0.95rem', marginTop: '0.25rem' }}>
          just pay gas &mdash; 1 per wallet
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ color: '#131325', fontWeight: 700, fontSize: '1.2rem' }}>additional names $5+</div>
        <div style={{ color: '#8a7d5a', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          pay once, available forever
        </div>
      </div>

      <div className="section">
        <div className="section-title">Perks</div>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">First name</span>
            <span className="value">Free for everyone &mdash; 1 per wallet, just pay gas</span>
          </div>
          <div className="info-row">
            <span className="label">Unlimited Pass holder</span>
            <span className="value">1 additional free name + 20% off all registrations</span>
          </div>
          <div className="info-row">
            <span className="label">ENS names</span>
            <span className="value">Suggested on registration page</span>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Progressive pricing</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          Registering multiple names gets{' '}
          <strong style={{ color: '#131325' }}>progressively more expensive</strong>. The contract tracks
          how many names each wallet registers within a 90-day window and applies multipliers:
        </p>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">Names 1&ndash;3</span>
            <span className="value">1x ($5 each)</span>
          </div>
          <div className="info-row">
            <span className="label">Names 4&ndash;5</span>
            <span className="value">2.5x ($12.50 each)</span>
          </div>
          <div className="info-row">
            <span className="label">Names 6&ndash;7</span>
            <span className="value">5x ($25 each)</span>
          </div>
          <div className="info-row">
            <span className="label">Names 8+</span>
            <span className="value">10x ($50 each)</span>
          </div>
        </div>
        <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginTop: '0.75rem' }}>
          Your first name is free. Progressive pricing applies starting from your second name. The 90-day
          window resets automatically.
        </p>
      </div>

      <div className="section">
        <div className="section-title">Namespaces</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          Turn any hazza name into a namespace and issue subnames under it.
          <br />
          Useful for teams, organizations, or agent networks &mdash; e.g.{' '}
          <strong style={{ color: '#131325' }}>alice.yourname</strong>,{' '}
          <strong style={{ color: '#131325' }}>bot.yourname</strong>.
        </p>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">Enable namespaces</span>
            <span className="value">Free (permanent, cannot be undone)</span>
          </div>
          <div className="info-row">
            <span className="label">Issue subname</span>
            <span className="value">$1 each</span>
          </div>
        </div>
        <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginTop: '0.75rem' }}>
          Each subname is its own full hazza name with a profile, agent, and DNS.
        </p>
      </div>

      <div className="section">
        <div className="section-title">Learn more</div>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">
              <Link to="/pricing/protections">Protections</Link>
            </span>
            <span className="value">Anti-squatting and name rights</span>
          </div>
          <div className="info-row">
            <span className="label">
              <Link to="/pricing/details">Details</Link>
            </span>
            <span className="value">Payment, ownership, name rules, and contract</span>
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

function PricingProtections() {
  return (
    <>
      <div className="header">
        <h1>protections</h1>
      </div>

      <div className="section">
        <div className="section-title">Progressive pricing</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7 }}>
          Bulk registration is deterred by progressively increasing prices. See the full breakdown on the{' '}
          <Link to="/pricing">pricing page</Link>.
        </p>
      </div>

      <hr className="divider" />

      <div className="section">
        <div className="section-title">Name rights</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          hazza names are <strong style={{ color: '#131325' }}>first-come, first-served</strong>. There is
          no challenge or dispute system. Progressive pricing is the sole anti-squatting mechanism &mdash;
          no daily caps, no wallet limits. Register as many as you want.
        </p>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">Ownership</span>
            <span className="value">Whoever registers first, owns it</span>
          </div>
          <div className="info-row">
            <span className="label">Protection</span>
            <span className="value">Progressive pricing deters spam registrations</span>
          </div>
        </div>
        <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginTop: '0.75rem' }}>
          <a href="https://netlibrary.app">Unlimited Pass</a> holders ($10) get 20% off all registrations
          + 1 free name.
        </p>
      </div>

      <div style={{ textAlign: 'center', margin: '2rem 0' }}>
        <Link
          to="/pricing"
          style={{
            display: 'inline-block',
            padding: '0.6rem 1.5rem',
            border: '2px solid #CF3748',
            color: '#CF3748',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.9rem',
            textDecoration: 'none',
          }}
        >
          &larr; Back to Pricing
        </Link>
      </div>
    </>
  );
}

function PricingDetails() {
  return (
    <>
      <div className="header">
        <h1>details</h1>
      </div>

      <div className="section">
        <div className="section-title">Payment</div>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">Currency</span>
            <span className="value">USDC on Base</span>
          </div>
          <div className="info-row">
            <span className="label">Gas</span>
            <span className="value">Paid in ETH on Base (~$0.01 per tx)</span>
          </div>
          <div className="info-row">
            <span className="label">Agents &amp; CLIs</span>
            <span className="value">
              <Link to="/docs#x402">x402 API</Link> for programmatic registration
            </span>
          </div>
        </div>
      </div>

      <hr className="divider" />

      <div className="section">
        <div className="section-title">Ownership</div>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">Standard</span>
            <span className="value">ERC-721 NFT on Base</span>
          </div>
          <div className="info-row">
            <span className="label">Transfer</span>
            <span className="value">Names are transferable via the dashboard</span>
          </div>
          <div className="info-row">
            <span className="label">Marketplace</span>
            <span className="value">
              Buy and sell via <Link to="/marketplace">Seaport</Link>
            </span>
          </div>
          <div className="info-row">
            <span className="label">Operator</span>
            <span className="value">Grant write access to another address</span>
          </div>
        </div>
      </div>

      <hr className="divider" />

      <div className="section">
        <div className="section-title">Name rules</div>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">Characters</span>
            <span className="value">Lowercase a&ndash;z, 0&ndash;9, hyphens</span>
          </div>
          <div className="info-row">
            <span className="label">Length</span>
            <span className="value">1&ndash;64 characters</span>
          </div>
          <div className="info-row">
            <span className="label">Unicode</span>
            <span className="value">ENSIP-15 emoji &amp; international support</span>
          </div>
          <div className="info-row">
            <span className="label">First-come</span>
            <span className="value">No challenge or dispute system</span>
          </div>
        </div>
      </div>

      <hr className="divider" />

      <div className="section">
        <div className="section-title">Contract</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          The hazza registry is a non-upgradeable smart contract on Base. All name data, ownership, and
          text records live onchain.
        </p>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">Network</span>
            <span className="value">Base (mainnet)</span>
          </div>
          <div className="info-row">
            <span className="label">Source</span>
            <span className="value">
              <a href="https://github.com/geaux-eth/hazza">GitHub</a>
            </span>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', margin: '2rem 0' }}>
        <Link
          to="/pricing"
          style={{
            display: 'inline-block',
            padding: '0.6rem 1.5rem',
            border: '2px solid #CF3748',
            color: '#CF3748',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.9rem',
            textDecoration: 'none',
          }}
        >
          &larr; Back to Pricing
        </Link>
      </div>
    </>
  );
}

export default function Pricing() {
  const location = useLocation();

  if (location.pathname === '/pricing/protections') {
    return <PricingProtections />;
  }
  if (location.pathname === '/pricing/details') {
    return <PricingDetails />;
  }
  return <PricingMain />;
}
