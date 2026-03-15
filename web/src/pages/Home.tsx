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
      text: 'this is where the magic starts. type any name and register it in seconds. your first one is free.',
      btn: 'next',
    },
    {
      text: 'your name does five things: onchain website via Net Protocol, DNS-resolvable identity, one-click x402 registration, ERC-8004 agent endpoint, and XMTP messaging.',
      btn: 'next',
    },
    {
      text: "explore the marketplace, check out docs, see pricing (spoiler: first name is free, after that it is a flat $5, forever) or come find me on my page.",
      btn: 'next',
    },
    {
      text: 'ready to claim your onchain identity? type a name right here!',
      btn: "let's go!",
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
              <span style={{ color: '#131325', fontWeight: 700 }}>{result.name}</span>
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
              <span style={{ color: '#131325', fontWeight: 700 }}>{result.name}</span>
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
            { title: 'onchain', desc: 'permanent name + website via Net Protocol' },
            { title: 'DNS + ENS', desc: 'resolves like a real domain, works with ENS' },
            { title: 'x402', desc: 'one-click name registration' },
            { title: 'ERC-8004', desc: 'give your AI agent a discoverable identity' },
            { title: 'XMTP', desc: 'message Nomi over a secure, decentralized protocol' },
          ].map((card) => (
            <div
              key={card.title}
              style={{
                background: '#fff',
                border: '2px solid #E8DCAB',
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
              <div className="subtext">hazza gives users magical onchain powers! want to learn more?</div>
              <div className="nomi-btns">
                <button className="nomi-btn-yes" onClick={startWalkthrough}>yes</button>
                <button className="nomi-btn-no" onClick={dismissWelcome}>no thanks</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Walkthrough tooltip */}
      {walkthroughStep >= 0 && walkthroughStep < walkthroughSteps.length && (
        <div
          className="wt-tooltip"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10001,
            display: 'block',
          }}
        >
          <div>
            <img src={NOMI_AVATAR} className="wt-av" alt="Nomi" />
            <div className="wt-text">{walkthroughSteps[walkthroughStep].text}</div>
            <button className="wt-next" onClick={nextWalkthroughStep}>
              {walkthroughSteps[walkthroughStep].btn}
            </button>
            <span className="wt-skip" onClick={endWalkthrough} style={{ cursor: 'pointer' }}>
              skip
            </span>
          </div>
        </div>
      )}
      {walkthroughStep >= 0 && (
        <div
          className="wt-highlight"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.4)',
            zIndex: 10000,
            display: 'block',
          }}
          onClick={endWalkthrough}
        />
      )}
    </>
  );
}
