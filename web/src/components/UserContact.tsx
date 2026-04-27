import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../constants';

interface Identity {
  wallet: string;
  primaryName: string | null;
  ens: string | null;
  display: string;
  truncated: string;
  xmtp: string | null;
  avatar: string | null;
  description: string | null;
  profileUrl: string | null;
}

interface NameEntry {
  name: string;
  tokenId: string;
  url: string;
}

// Module-level cache to avoid duplicate fetches across renders/components
const identityCache = new Map<string, Identity>();
const inflight = new Map<string, Promise<Identity>>();

async function fetchIdentity(address: string): Promise<Identity> {
  const key = address.toLowerCase();
  const cached = identityCache.get(key);
  if (cached) return cached;
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = fetch(`${API_BASE}/api/identity/${address}`)
    .then(r => r.json())
    .then((d: Identity) => { identityCache.set(key, d); inflight.delete(key); return d; })
    .catch(err => { inflight.delete(key); throw err; });
  inflight.set(key, promise);
  return promise;
}

export default function UserContact({ address, onMessage }: { address: string; onMessage?: (xmtpAddress: string) => void }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<NameEntry[] | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!address) return;
    fetchIdentity(address).then(setIdentity).catch(() => {});
  }, [address]);

  // Lazy-load names when popup opens
  useEffect(() => {
    if (!open || names !== null) return;
    fetch(`${API_BASE}/api/names/${address}`)
      .then(r => r.json())
      .then(d => setNames(d.names || []))
      .catch(() => setNames([]));
  }, [open, names, address]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!address) return null;
  const truncated = address.slice(0, 6) + '...' + address.slice(-4);
  const display = identity?.display || truncated;
  const isHazza = !!identity?.primaryName;

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(o => !o); }}
        style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          color: isHazza ? '#4870D4' : '#8a7d5a',
          fontWeight: isHazza ? 700 : 600,
          fontFamily: "'Fredoka', sans-serif", fontSize: 'inherit',
          textDecoration: 'none',
        }}
        title={identity?.primaryName ? `${identity.primaryName}.hazza.name` : address}
      >
        {display}
      </button>

      {open && identity && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 1000,
            background: '#fff', border: '2px solid #4870D4', borderRadius: 10,
            boxShadow: '0 6px 20px rgba(19,19,37,0.15)',
            minWidth: 240, maxWidth: 320, padding: '0.75rem',
            fontFamily: "'Fredoka', sans-serif", color: '#131325',
            textAlign: 'left',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.5rem' }}>
            {identity.avatar ? (
              <img src={identity.avatar} alt={display}
                style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #E8DCAB', objectFit: 'cover' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#E8DCAB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a7d5a', fontWeight: 700 }}>
                {display.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {identity.primaryName ? (
                <a href={identity.profileUrl!} style={{ color: '#4870D4', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {identity.primaryName}
                </a>
              ) : identity.ens ? (
                <span style={{ color: '#131325', fontWeight: 700, fontSize: '0.9rem' }}>{identity.ens}</span>
              ) : (
                <span style={{ color: '#8a7d5a', fontFamily: 'monospace', fontSize: '0.8rem' }}>{truncated}</span>
              )}
              <div style={{ fontSize: '0.65rem', color: '#8a7d5a', fontFamily: 'monospace' }}>{truncated}</div>
            </div>
          </div>

          {identity.description && (
            <p style={{ fontSize: '0.75rem', color: '#8a7d5a', margin: '0 0 0.5rem', lineHeight: 1.3 }}>
              {identity.description}
            </p>
          )}

          {/* Names list */}
          {names === null ? (
            <p style={{ fontSize: '0.7rem', color: '#8a7d5a', margin: '0.5rem 0' }}>Loading names...</p>
          ) : names.length > 0 ? (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#8a7d5a', fontWeight: 700, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Owns {names.length} name{names.length === 1 ? '' : 's'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxHeight: 120, overflowY: 'auto' }}>
                {names.slice(0, 12).map(n => (
                  <a key={n.tokenId} href={n.url}
                    style={{ display: 'inline-block', padding: '0.2rem 0.5rem', background: '#f5f0e0', border: '1px solid #E8DCAB', borderRadius: 4, fontSize: '0.7rem', color: '#131325', textDecoration: 'none' }}>
                    {n.name}
                  </a>
                ))}
                {names.length > 12 && <span style={{ fontSize: '0.65rem', color: '#8a7d5a', alignSelf: 'center' }}>+{names.length - 12} more</span>}
              </div>
            </div>
          ) : null}

          {/* DM button */}
          {identity.xmtp && onMessage && identity.primaryName && (
            <button
              onClick={() => { setOpen(false); onMessage(identity.xmtp!); }}
              style={{
                width: '100%', marginTop: '0.6rem', padding: '0.4rem',
                background: '#4870D4', color: '#fff', border: 'none', borderRadius: 6,
                fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                fontFamily: "'Fredoka', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Message {identity.primaryName}
            </button>
          )}
        </div>
      )}
    </span>
  );
}
