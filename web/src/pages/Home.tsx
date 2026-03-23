import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE, NOMI_AVATAR, EXPLORER_HOST } from '../constants';

function sanitizeName(n: string): string {
  return n.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);
}

interface SearchResult {
  name: string;
  available: boolean;
  owner?: string;
}

interface WalkthroughStep {
  text: string;
  btn: string;
  target: string;
  position: 'above' | 'below';
}

function WalkthroughOverlay({ step, onNext, onSkip, avatar }: {
  step: WalkthroughStep;
  onNext: () => void;
  onSkip: () => void;
  avatar: string;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const el = document.querySelector(step.target);
    if (el) {
      // For the search input, spotlight the whole search-box parent
      const spotlight = step.target === '#name-input' ? el.closest('.search-box') || el : el;
      setRect(spotlight.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [step.target]);

  const pad = 12;

  // Tooltip positioning
  let tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10002,
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: '340px',
    width: '85vw',
  };

  if (rect) {
    if (step.position === 'below') {
      tooltipStyle.top = rect.bottom + pad + 8;
    } else {
      tooltipStyle.bottom = window.innerHeight - rect.top + pad + 8;
    }
  } else {
    tooltipStyle.top = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  }

  return (
    <>
      {/* Dark overlay with cutout for spotlight */}
      <div
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 10001,
          pointerEvents: 'auto',
        }}
        onClick={onSkip}
      >
        {/* SVG overlay with rectangular cutout */}
        <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
          <defs>
            <mask id="wt-mask">
              <rect width="100%" height="100%" fill="white" />
              {rect && (
                <rect
                  x={rect.left - pad}
                  y={rect.top - pad}
                  width={rect.width + pad * 2}
                  height={rect.height + pad * 2}
                  rx="12"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(19,19,37,0.65)"
            mask="url(#wt-mask)"
          />
        </svg>
        {/* Spotlight border glow */}
        {rect && (
          <div
            style={{
              position: 'absolute',
              top: rect.top - pad,
              left: rect.left - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
              borderRadius: 12,
              border: '2px solid rgba(72,112,212,0.5)',
              boxShadow: '0 0 20px rgba(72,112,212,0.3)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div className="wt-tooltip" style={tooltipStyle} onClick={(e) => e.stopPropagation()}>
        <div>
          <img src={avatar} className="wt-av" alt="Nomi" />
          <div className="wt-text">{step.text}</div>
          <button className="wt-next" onClick={onNext}>{step.btn}</button>
          <span className="wt-skip" onClick={onSkip}>skip</span>
        </div>
      </div>
    </>
  );
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [showFeatures, setShowFeatures] = useState(true);
  const [showNomiWelcome, setShowNomiWelcome] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Nomi welcome popup (first visit only)
  useEffect(() => {
    if (!localStorage.getItem('hazza_welcomed')) {
      const timer = setTimeout(() => setShowNomiWelcome(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissWelcome = useCallback(() => {
    localStorage.setItem('hazza_welcomed', '1');
    setShowNomiWelcome(false);
  }, []);

  const startWalkthrough = useCallback(() => {
    localStorage.setItem('hazza_welcomed', '1');
    setShowNomiWelcome(false);
    setTimeout(() => setWalkthroughStep(0), 200);
  }, []);

  const walkthroughSteps = [
    {
      text: 'type a name right here. if it\'s available, you can register it instantly. oh — and your first one is free.',
      btn: 'next',
      target: '#name-input',
      position: 'below' as const,
    },
    {
      text: 'every name comes with five things baked in — an onchain website, DNS that actually resolves, x402 payments, an identity endpoint for AI agents, and encrypted messaging.',
      btn: 'next',
      target: '#landing-features',
      position: 'above' as const,
    },
    {
      text: 'up here you\'ve got the marketplace for buying and selling names, docs if you\'re building something, and pricing details. first name is free, the next one starts at just $5.',
      btn: 'next',
      target: '.nav-bar',
      position: 'below' as const,
    },
    {
      text: 'ok i\'m done. go find your name.',
      btn: "let's go",
      target: '#name-input',
      position: 'below' as const,
    },
  ];

  const nextWalkthroughStep = useCallback(() => {
    setWalkthroughStep((prev) => {
      if (prev >= walkthroughSteps.length - 1) {
        inputRef.current?.focus();
        return -1;
      }
      return prev + 1;
    });
  }, [walkthroughSteps.length]);

  const endWalkthrough = useCallback(() => {
    if (walkthroughStep === walkthroughSteps.length - 1) {
      inputRef.current?.focus();
    }
    setWalkthroughStep(-1);
  }, [walkthroughStep, walkthroughSteps.length]);

  // Escape key to dismiss walkthrough
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endWalkthrough();
    };
    if (walkthroughStep >= 0) {
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
  }, [walkthroughStep, endWalkthrough]);

  async function handleSearch() {
    const raw = query.trim().toLowerCase();
    const name = sanitizeName(raw);
    if (!name) {
      setError('your name is also your web address — only letters, numbers, and hyphens work in URLs');
      setResult(null);
      return;
    }
    setSearching(true);
    setResult(null);
    setError('');
    setShowFeatures(false);
    try {
      const avail = await fetch(`${API_BASE}/api/available/${encodeURIComponent(name)}`).then((r) => r.json());
      if (avail.available) {
        setResult({ name, available: true });
      } else {
        const res = await fetch(`${API_BASE}/api/resolve/${encodeURIComponent(name)}`).then((r) => r.json());
        setResult({ name, available: false, owner: res.owner });
      }
    } catch {
      setError('Error checking name. Try again.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <>
      <div className="header">
        <h1>hazza<span>.name</span></h1>
        <p>immediately useful</p>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto 1rem' }}>
        <div className="search-box">
          <input
            ref={inputRef}
            type="text"
            id="name-input"
            placeholder="find something awesome!"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          />
          <button id="search-btn" onClick={handleSearch} disabled={searching}>
            {searching ? 'Checking...' : 'Search'}
          </button>
        </div>
      </div>

      <div className={`result${result || error ? ' show' : ''}`} id="result">
        {error && (
          <div style={{ textAlign: 'center', color: '#CF3748', fontSize: '0.85rem' }}>{error}</div>
        )}
        {result && result.available && (
          <>
            <div style={{ textAlign: 'center' }}>
              <span style={{ color: '#4870D4', fontWeight: 700, fontFamily: "'Fredoka', sans-serif" }}>{result.name}</span>
              <span className="available">.hazza.name</span>
              <br />
              <span style={{ color: '#CF3748', fontSize: '0.85rem' }}>is available</span>
            </div>
            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <Link
                to={`/register?name=${encodeURIComponent(result.name)}`}
                style={{
                  display: 'inline-block',
                  padding: '0.6rem 2rem',
                  background: '#CF3748',
                  color: '#fff',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '1rem',
                  textDecoration: 'none',
                }}
              >
                Register
              </Link>
            </div>
          </>
        )}
        {result && !result.available && (
          <>
            <div style={{ textAlign: 'center' }}>
              <span style={{ color: '#4870D4', fontWeight: 700, fontFamily: "'Fredoka', sans-serif" }}>{result.name}</span>
              <span className="taken">.hazza.name</span>
              <br />
              <span style={{ color: '#CF3748', fontSize: '0.85rem' }}>is taken</span>
            </div>
            {result.owner && (
              <div style={{ textAlign: 'center', marginTop: '0.5rem', color: '#8a7d5a', fontSize: '0.85rem' }}>
                Owner:{' '}
                <a
                  href={`https://${EXPLORER_HOST}/address/${result.owner}`}
                  style={{ color: '#8a7d5a' }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {result.owner.slice(0, 6)}...{result.owner.slice(-4)}
                </a>
              </div>
            )}
          </>
        )}
      </div>

      {showFeatures && (
        <div
          id="landing-features"
          style={{
            marginTop: '1.5rem',
            maxWidth: '640px',
            marginLeft: 'auto',
            marginRight: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '1rem',
          }}
        >
          {[
            { title: 'onchain', desc: 'permanent name + website on Net Protocol' },
            { title: 'DNS + ENS', desc: 'URLs that work like wallet addresses' },
            { title: 'x402', desc: 'one USDC transfer, relayer handles the rest' },
            { title: 'ERC-8004', desc: 'identity endpoint for AI agents' },
            { title: 'XMTP', desc: 'decentralized, private, quantum-resistant messaging' },
          ].map((card) => (
            <div
              key={card.title}
              style={{
                background: '#fff',
                border: '2px solid #4870D4',
                borderRadius: '10px',
                padding: '0.85rem 0.6rem',
                textAlign: 'center',
                boxShadow: '0 2px 6px rgba(19,19,37,0.06)',
              }}
            >
              <div
                style={{
                  fontFamily: "'Fredoka', sans-serif",
                  fontWeight: 700,
                  color: '#4870D4',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                  marginBottom: '0.35rem',
                }}
              >
                {card.title}
              </div>
              <div style={{ color: '#131325', fontSize: '0.72rem', lineHeight: 1.4 }}>{card.desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* Nomi welcome popup (first visit only) */}
      {showNomiWelcome && (
        <div id="nomi-welcome">
          <div
            className="nomi-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) dismissWelcome(); }}
          >
            <div className="nomi-popup">
              <img src={NOMI_AVATAR} alt="Nomi" className="nomi-av" />
              <div className="nomi-bubble">gm. i'm nomi.<br />names are kinda my thing.</div>
              <div className="subtext">want me to show you around?</div>
              <div className="nomi-btns">
                <button className="nomi-btn-yes" onClick={startWalkthrough}>yes</button>
                <button className="nomi-btn-no" onClick={dismissWelcome}>no thanks</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Walkthrough spotlight + tooltip */}
      {walkthroughStep >= 0 && walkthroughStep < walkthroughSteps.length && (
        <WalkthroughOverlay
          step={walkthroughSteps[walkthroughStep]}
          onNext={nextWalkthroughStep}
          onSkip={endWalkthrough}
          avatar={NOMI_AVATAR}
        />
      )}
    </>
  );
}
