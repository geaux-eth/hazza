import { useState, useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE } from '../constants';

export interface Identity {
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

export interface NameEntry {
  name: string;
  tokenId: string;
  url: string;
}

// Module-level cache shared across components
const identityCache = new Map<string, Identity>();
const inflight = new Map<string, Promise<Identity>>();
const namesCache = new Map<string, NameEntry[]>();

export async function fetchIdentity(address: string): Promise<Identity> {
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

export async function fetchNames(address: string): Promise<NameEntry[]> {
  const key = address.toLowerCase();
  const cached = namesCache.get(key);
  if (cached) return cached;
  const data = await fetch(`${API_BASE}/api/names/${address}`).then(r => r.json()).catch(() => ({ names: [] }));
  const names = data.names || [];
  namesCache.set(key, names);
  return names;
}

interface ProfileCardProps {
  identity: Identity;
  triggerRef: RefObject<HTMLElement>;
  onClose: () => void;
  onMessage?: (xmtpAddress: string) => void;
  onDisconnect?: () => void;
  onSwitchNetwork?: () => void;
  wrongNetwork?: boolean;
  isSelf?: boolean;
}

/**
 * Master profile card — rendered via portal to document.body to escape
 * any parent stacking contexts (transforms, etc.). Positioned relative
 * to the trigger element using getBoundingClientRect.
 */
export default function ProfileCard({
  identity, triggerRef, onClose, onMessage, onDisconnect, onSwitchNetwork, wrongNetwork, isSelf,
}: ProfileCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [names, setNames] = useState<NameEntry[] | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; right?: number } | null>(null);

  // Position calculation
  useEffect(() => {
    if (!triggerRef.current) return;
    const calc = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const cardWidth = 280;
      const margin = 8;
      let left = rect.left + window.scrollX;
      // If too close to right edge, anchor to right of trigger
      if (left + cardWidth + margin > window.innerWidth) {
        left = Math.max(margin, rect.right + window.scrollX - cardWidth);
      }
      const top = rect.bottom + window.scrollY + 4;
      setPos({ top, left });
    };
    calc();
    window.addEventListener('resize', calc);
    window.addEventListener('scroll', calc, true);
    return () => {
      window.removeEventListener('resize', calc);
      window.removeEventListener('scroll', calc, true);
    };
  }, [triggerRef]);

  // Lazy-load names
  useEffect(() => {
    if (names !== null) return;
    fetchNames(identity.wallet).then(setNames);
  }, [identity.wallet, names]);

  // Close on outside click / Escape
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, triggerRef]);

  if (!pos) return null;

  const truncated = identity.truncated || (identity.wallet.slice(0, 6) + '...' + identity.wallet.slice(-4));

  const card = (
    <div
      ref={cardRef}
      style={{
        position: 'absolute', top: pos.top, left: pos.left, zIndex: 999999,
        background: '#fff', border: '2px solid #4870D4', borderRadius: 10,
        boxShadow: '0 8px 24px rgba(19,19,37,0.18)',
        width: 280, padding: '0.8rem',
        fontFamily: "'Fredoka', sans-serif", color: '#131325',
        textAlign: 'left',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.5rem' }}>
        {identity.avatar ? (
          <img src={identity.avatar} alt={identity.display}
            style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid #E8DCAB', objectFit: 'cover', flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div style={{
            width: 44, height: 44, borderRadius: '50%', background: '#E8DCAB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#8a7d5a', fontWeight: 700, fontSize: '1.2rem', flexShrink: 0,
          }}>
            {identity.display.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {identity.primaryName ? (
            <a href={identity.profileUrl!} style={{ color: '#4870D4', fontWeight: 700, fontSize: '1rem', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {identity.primaryName}
            </a>
          ) : identity.ens ? (
            <span style={{ color: '#131325', fontWeight: 700, fontSize: '0.95rem' }}>{identity.ens}</span>
          ) : (
            <span style={{ color: '#8a7d5a', fontFamily: 'monospace', fontSize: '0.85rem' }}>{truncated}</span>
          )}
          <div style={{ fontSize: '0.65rem', color: '#8a7d5a', fontFamily: 'monospace' }}>{truncated}</div>
        </div>
      </div>

      {identity.description && (
        <p style={{ fontSize: '0.75rem', color: '#8a7d5a', margin: '0 0 0.5rem', lineHeight: 1.35 }}>
          {identity.description}
        </p>
      )}

      {/* Names list */}
      {names === null ? (
        <p style={{ fontSize: '0.7rem', color: '#8a7d5a', margin: '0.5rem 0' }}>Loading names...</p>
      ) : names.length > 0 ? (
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.65rem', color: '#8a7d5a', fontWeight: 700, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Owns {names.length} name{names.length === 1 ? '' : 's'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxHeight: 110, overflowY: 'auto' }}>
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

      {/* Self-only actions */}
      {isSelf && (
        <>
          {identity.primaryName && identity.profileUrl && (
            <a
              href={identity.profileUrl}
              style={{
                display: 'block', textAlign: 'center', marginTop: '0.6rem', padding: '0.4rem',
                background: '#4870D4', color: '#fff', borderRadius: 6,
                fontWeight: 700, fontSize: '0.75rem', textDecoration: 'none',
              }}
            >
              View main page
            </a>
          )}
          <a
            href={identity.primaryName ? `/manage?name=${encodeURIComponent(identity.primaryName)}` : '/dashboard'}
            style={{
              display: 'block', textAlign: 'center', marginTop: '0.4rem', padding: '0.4rem',
              background: 'transparent', border: '2px solid #E8DCAB', color: '#131325', borderRadius: 6,
              fontWeight: 700, fontSize: '0.75rem', textDecoration: 'none',
            }}
          >
            {identity.primaryName ? 'Manage profile' : 'Dashboard'}
          </a>
          {!identity.primaryName && (
            <p style={{ fontSize: '0.65rem', color: '#8a7d5a', textAlign: 'center', margin: '0.4rem 0 0' }}>
              Set a primary name in your dashboard to enable your master profile.
            </p>
          )}
          {wrongNetwork && onSwitchNetwork && (
            <button onClick={onSwitchNetwork}
              style={{
                width: '100%', marginTop: '0.4rem', padding: '0.4rem',
                background: '#CF3748', color: '#fff', border: 'none', borderRadius: 6,
                fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                fontFamily: "'Fredoka', sans-serif",
              }}
            >
              Switch to Base
            </button>
          )}
          {onDisconnect && (
            <button onClick={onDisconnect}
              style={{
                width: '100%', marginTop: '0.4rem', padding: '0.4rem',
                background: 'transparent', border: '2px solid #CF3748', color: '#CF3748', borderRadius: 6,
                fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                fontFamily: "'Fredoka', sans-serif",
              }}
            >
              Disconnect
            </button>
          )}
        </>
      )}

      {/* Other-user DM button */}
      {!isSelf && identity.xmtp && onMessage && identity.primaryName && (
        <button
          onClick={() => onMessage(identity.xmtp!)}
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
  );

  return createPortal(card, document.body);
}
