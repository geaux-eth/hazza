import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from 'react-router-dom';
import { NOMI_AVATAR, API_BASE } from '../constants';
import { NOMI_XMTP_ADDR } from '../config/contracts';
import ChatPanel from '../components/ChatPanel';

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function truncAddr(a: string) {
  return a.slice(0, 6) + '...' + a.slice(-4);
}

/** Extract text from XMTP message content */
function extractText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object') {
    const c = content as Record<string, unknown>;
    if (typeof c.text === 'string') return c.text;
    if (typeof c.content === 'string') return c.content;
  }
  return '';
}

interface ConvoEntry {
  peerAddress: string;
  peerName?: string;
  lastMessage?: string;
  lastTime?: Date;
}

interface DirectoryEntry {
  name: string;
  owner: string;
  tokenId: number;
  ensName?: string;
}

type InboxView = 'inbox' | 'compose' | 'directory';

export default function Messages() {
  const { isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [chatTarget, setChatTarget] = useState<{ address: string; name: string; avatar?: string; greeting?: string } | null>(null);
  const [convos, setConvos] = useState<ConvoEntry[]>([]);
  const [inboxStatus, setInboxStatus] = useState<'idle' | 'connecting' | 'loading' | 'loaded' | 'error'>('idle');

  // Menu & view state
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<InboxView>('inbox');
  const menuRef = useRef<HTMLDivElement>(null);

  // Compose state
  const [composeInput, setComposeInput] = useState('');
  const [composeError, setComposeError] = useState('');
  const [composeLoading, setComposeLoading] = useState(false);
  const composeRef = useRef<HTMLInputElement>(null);

  // Directory state
  const [dirEntries, setDirEntries] = useState<DirectoryEntry[]>([]);
  const [dirTotal, setDirTotal] = useState(0);
  const [dirPage, setDirPage] = useState(1);
  const [dirPages, setDirPages] = useState(0);
  const [dirLoading, setDirLoading] = useState(false);
  const [dirSearch, setDirSearch] = useState('');
  const [dirSearchInput, setDirSearchInput] = useState('');
  const [dirShowNames, setDirShowNames] = useState(false);
  const [dirPerPage, setDirPerPage] = useState(20);
  const dirSearchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Shared XMTP client
  const xmtpClientRef = useRef<any>(null);
  const [xmtpReady, setXmtpReady] = useState(false);
  const initAttemptedRef = useRef(false);

  const ff = "'Fredoka', sans-serif";

  const openNomi = useCallback(() => {
    setChatTarget({
      address: NOMI_XMTP_ADDR,
      name: 'nomi',
      avatar: NOMI_AVATAR,
      greeting: "gm. i'm nomi. what's up?",
    });
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Create shared XMTP client
  const initXmtp = useCallback(async () => {
    if (xmtpClientRef.current || !isConnected || !walletClient || !address) return;
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    setInboxStatus('connecting');
    try {
      const xmtp = await import('@xmtp/browser-sdk');

      const signer = {
        type: 'EOA' as const,
        getIdentifier: () => ({
          identifier: address.toLowerCase(),
          identifierKind: xmtp.IdentifierKind.Ethereum,
        }),
        signMessage: async (msg: string | Uint8Array) => {
          const textMsg = typeof msg === 'string' ? msg : new TextDecoder().decode(msg);
          const sig = await walletClient.signMessage({
            account: address as `0x${string}`,
            message: textMsg,
          });
          return new Uint8Array(
            (sig.slice(2).match(/.{2}/g) || []).map((b: string) => parseInt(b, 16))
          );
        },
      };

      const client = await xmtp.Client.create(signer, {
        env: 'production',
      });
      xmtpClientRef.current = client;
      setXmtpReady(true);
      await loadConversations(client);
    } catch (err) {
      console.error('XMTP init failed:', err);
      setInboxStatus('error');
    }
  }, [isConnected, walletClient, address]);

  // Load conversations
  const loadConversations = useCallback(async (client?: any) => {
    const c = client || xmtpClientRef.current;
    if (!c || !address) return;

    setInboxStatus('loading');
    try {
      await c.conversations.sync();
      const conversations = await c.conversations.list();

      const entries: ConvoEntry[] = [];
      for (const convo of conversations.slice(0, 20)) {
        try {
          await convo.sync();
          const messages = await convo.messages({ limit: 1n });
          const lastMsg = messages[0];
          const members = await convo.members();
          const peer = members.find((m: any) => {
            const id = m.accountIdentifiers?.[0]?.identifier;
            return id && id.toLowerCase() !== address!.toLowerCase();
          });
          const peerAddr = peer?.accountIdentifiers?.[0]?.identifier || '';
          entries.push({
            peerAddress: peerAddr,
            lastMessage: extractText(lastMsg?.content).slice(0, 80) || undefined,
            lastTime: lastMsg?.sentAtNs ? new Date(Number(lastMsg.sentAtNs) / 1_000_000) : undefined,
          });
        } catch {
          // skip broken conversations
        }
      }

      await Promise.all(entries.map(async (entry) => {
        if (!entry.peerAddress) return;
        try {
          const res = await fetch(`${API_BASE}/api/reverse/${entry.peerAddress}`);
          const data = await res.json();
          if (data.name) entry.peerName = data.name;
        } catch { /* ignore */ }
      }));

      entries.sort((a, b) => (b.lastTime?.getTime() || 0) - (a.lastTime?.getTime() || 0));
      setConvos(entries);
      setInboxStatus('loaded');
    } catch (err) {
      console.error('Inbox load failed:', err);
      setInboxStatus('error');
    }
  }, [address]);

  // Auto-init XMTP when wallet connects
  useEffect(() => {
    if (isConnected && walletClient && address && !xmtpClientRef.current && !initAttemptedRef.current) {
      initXmtp();
    }
  }, [isConnected, walletClient, address, initXmtp]);

  // Reset on disconnect
  useEffect(() => {
    if (!isConnected) {
      if (xmtpClientRef.current) {
        try { xmtpClientRef.current.close?.(); } catch (_e) { /* */ }
        xmtpClientRef.current = null;
      }
      setXmtpReady(false);
      initAttemptedRef.current = false;
      setConvos([]);
      setInboxStatus('idle');
      setActiveView('inbox');
    }
  }, [isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (xmtpClientRef.current) {
        try { xmtpClientRef.current.close?.(); } catch (_e) { /* */ }
        xmtpClientRef.current = null;
      }
    };
  }, []);

  // Focus compose input
  useEffect(() => {
    if (activeView === 'compose' && composeRef.current) composeRef.current.focus();
  }, [activeView]);

  // ── Directory ──

  const loadDirectory = useCallback(async (pg: number, q: string, perPage?: number) => {
    setDirLoading(true);
    const lim = perPage ?? dirPerPage;
    try {
      const params = new URLSearchParams({ page: String(pg), limit: String(lim) });
      if (q) params.set('q', q);
      const res = await fetch(`${API_BASE}/api/directory?${params}`);
      const data = await res.json();
      setDirEntries(data.entries || []);
      setDirTotal(data.total || 0);
      setDirPage(data.page || 1);
      setDirPages(data.pages || 0);

      // Resolve ENS for each owner (batch, non-blocking)
      const entries = data.entries as DirectoryEntry[];
      const uniqueOwners = [...new Set(entries.map((e: DirectoryEntry) => e.owner))];
      const ensMap: Record<string, string> = {};
      await Promise.all(uniqueOwners.map(async (owner) => {
        try {
          const r = await fetch(`${API_BASE}/api/ens-names/${owner}`);
          const d = await r.json();
          if (d.ensNames?.[0]) ensMap[owner.toLowerCase()] = d.ensNames[0];
        } catch { /* */ }
      }));
      if (Object.keys(ensMap).length > 0) {
        setDirEntries(prev => prev.map(e => ({
          ...e,
          ensName: ensMap[e.owner.toLowerCase()] || e.ensName,
        })));
      }
    } catch {
      setDirEntries([]);
    }
    setDirLoading(false);
  }, [dirPerPage]);

  // Load directory when view switches to it
  useEffect(() => {
    if (activeView === 'directory') loadDirectory(1, '');
  }, [activeView, loadDirectory]);

  // Debounced search
  const handleDirSearchChange = useCallback((val: string) => {
    setDirSearchInput(val);
    if (dirSearchTimeout.current) clearTimeout(dirSearchTimeout.current);
    dirSearchTimeout.current = setTimeout(() => {
      setDirSearch(val);
      loadDirectory(1, val);
    }, 400);
  }, [loadDirectory]);

  // Open chat via contact resolution (follows delegation)
  const openChatForName = useCallback(async (name: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/contact/${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.contactAddress) {
        setChatTarget({ address: data.contactAddress, name });
      } else {
        // Fallback: try profile xmtp
        const pRes = await fetch(`${API_BASE}/api/profile/${encodeURIComponent(name)}`);
        const pData = await pRes.json();
        if (pData.texts?.xmtp) {
          setChatTarget({ address: pData.texts.xmtp, name });
        } else {
          alert(`${name}.hazza.name doesn't have XMTP set up`);
        }
      }
    } catch {
      alert('Failed to resolve contact');
    }
  }, []);

  const openChatForAddress = useCallback((addr: string) => {
    setChatTarget({ address: addr, name: truncAddr(addr) });
  }, []);

  // New message — resolve name/address and open chat
  const handleCompose = useCallback(async () => {
    const input = composeInput.trim().toLowerCase();
    if (!input) return;
    setComposeError('');

    if (/^0x[a-fA-F0-9]{40}$/.test(input)) {
      setChatTarget({ address: input, name: truncAddr(input) });
      setActiveView('inbox');
      setComposeInput('');
      return;
    }

    const name = input.replace(/\.hazza\.name$/, '').replace(/\.eth$/, '');
    setComposeLoading(true);
    try {
      // Try contact resolution first (follows delegation)
      const cRes = await fetch(`${API_BASE}/api/contact/${encodeURIComponent(name)}`);
      const cData = await cRes.json();
      if (cData.contactAddress) {
        setChatTarget({ address: cData.contactAddress, name });
        setActiveView('inbox');
        setComposeInput('');
        return;
      }
      // Fallback to profile
      const res = await fetch(`${API_BASE}/api/profile/${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!data.registered) {
        setComposeError(`${name}.hazza.name is not registered`);
        return;
      }
      const xmtp = data.texts?.xmtp;
      if (!xmtp) {
        setComposeError(`${name}.hazza.name doesn't have XMTP set up`);
        return;
      }
      setChatTarget({ address: xmtp, name, avatar: data.texts?.avatar });
      setActiveView('inbox');
      setComposeInput('');
    } catch {
      setComposeError('Failed to look up name');
    } finally {
      setComposeLoading(false);
    }
  }, [composeInput]);

  // Menu actions
  const menuSelect = (view: InboxView) => {
    setActiveView(view);
    setMenuOpen(false);
    setComposeError('');
  };

  return (
    <>
      <div className="header" style={{ background: '#4870D4', padding: '1rem 1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#fff' }}>messages</h1>
      </div>

      {!isConnected && (
        <div style={{ textAlign: 'center', margin: '2rem 0' }}>
          <p style={{ color: '#8a7d5a', marginBottom: '0.5rem' }}>connect your wallet to message people</p>
          <div style={{ marginTop: '1rem' }}>
            <ConnectButton />
          </div>
        </div>
      )}

      {/* Nomi banner */}
      <div
        style={{
          background: '#CF3748', border: '3px solid #fff', borderRadius: '10px',
          padding: 0, marginBottom: '1.5rem', display: 'flex',
          alignItems: 'flex-end', overflow: 'hidden', cursor: 'pointer',
        }}
        onClick={openNomi}
      >
        <img
          src={NOMI_AVATAR} alt="Nomi"
          style={{
            width: '120px', height: '120px', flexShrink: 0, marginLeft: '0.75rem',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
          }}
        />
        <div style={{ padding: '1rem 1rem 1rem 0.75rem', flex: 1 }}>
          <div style={{ fontFamily: ff, color: '#fff', fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>
            i'm nomi
          </div>
          <p style={{ fontFamily: ff, color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
            i help with names, pricing, text records, the marketplace, agents... ask me anything.
          </p>
          <span style={{
            display: 'inline-block', marginTop: '0.5rem',
            padding: '0.2rem 0.6rem', background: 'rgba(255,255,255,0.2)',
            borderRadius: 12, fontSize: '0.7rem', color: '#fff', fontWeight: 600,
          }}>
            chat via XMTP
          </span>
        </div>
      </div>

      {/* ── INBOX SECTION ── */}
      {isConnected && (
        <div className="section">
          {/* Header: title + menu button + refresh */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div className="section-title" style={{ color: '#CF3748', margin: 0 }}>
              {activeView === 'inbox' ? 'Inbox' : activeView === 'compose' ? 'New Message' : 'Directory'}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {xmtpReady && activeView === 'inbox' && (
                <button
                  onClick={() => loadConversations()}
                  disabled={inboxStatus === 'loading'}
                  style={{
                    padding: '0.35rem 0.8rem', background: 'none',
                    border: '2px solid #4870D4', borderRadius: 6,
                    color: '#4870D4', fontSize: '0.75rem', fontWeight: 600,
                    cursor: inboxStatus === 'loading' ? 'not-allowed' : 'pointer',
                    fontFamily: ff,
                  }}
                >
                  {inboxStatus === 'loading' ? 'syncing...' : 'refresh'}
                </button>
              )}

              {/* Hamburger menu */}
              {xmtpReady && (
                <div ref={menuRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    style={{
                      width: 36, height: 36, background: menuOpen ? '#3558a8' : '#4870D4',
                      border: 'none', borderRadius: 8, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: 4, transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ width: 18, height: 2, background: '#fff', borderRadius: 1, display: 'block' }} />
                    <span style={{ width: 18, height: 2, background: '#fff', borderRadius: 1, display: 'block' }} />
                    <span style={{ width: 18, height: 2, background: '#fff', borderRadius: 1, display: 'block' }} />
                  </button>

                  {menuOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: 6,
                      background: '#fff', border: '2px solid #E8DCAB', borderRadius: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50,
                      minWidth: 180, overflow: 'hidden',
                    }}>
                      <button
                        onClick={() => menuSelect('inbox')}
                        style={{
                          width: '100%', padding: '0.7rem 1rem', background: activeView === 'inbox' ? '#FFF8E7' : 'transparent',
                          border: 'none', borderBottom: '1px solid #f0e8d0', textAlign: 'left',
                          fontFamily: ff, fontSize: '0.85rem', fontWeight: 600, color: '#131325',
                          cursor: 'pointer',
                        }}
                      >
                        inbox
                      </button>
                      <button
                        onClick={() => menuSelect('compose')}
                        style={{
                          width: '100%', padding: '0.7rem 1rem', background: activeView === 'compose' ? '#FFF8E7' : 'transparent',
                          border: 'none', borderBottom: '1px solid #f0e8d0', textAlign: 'left',
                          fontFamily: ff, fontSize: '0.85rem', fontWeight: 600, color: '#131325',
                          cursor: 'pointer',
                        }}
                      >
                        new message
                      </button>
                      <button
                        onClick={() => menuSelect('directory')}
                        style={{
                          width: '100%', padding: '0.7rem 1rem', background: activeView === 'directory' ? '#FFF8E7' : 'transparent',
                          border: 'none', textAlign: 'left',
                          fontFamily: ff, fontSize: '0.85rem', fontWeight: 600, color: '#131325',
                          cursor: 'pointer',
                        }}
                      >
                        directory
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ════ COMPOSE VIEW ════ */}
          {activeView === 'compose' && (
            <div style={{
              padding: '1rem', background: '#fff', border: '2px solid #4870D4',
              borderRadius: '10px',
            }}>
              <div style={{ color: '#131325', fontSize: '0.85rem', fontFamily: ff, fontWeight: 600, marginBottom: '0.5rem' }}>
                To:
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  ref={composeRef}
                  type="text"
                  placeholder="hazza name, ENS, or 0x address"
                  value={composeInput}
                  onChange={(e) => { setComposeInput(e.target.value); setComposeError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCompose(); }}
                  style={{
                    flex: 1, padding: '0.5rem 0.65rem',
                    border: '2px solid #E8DCAB', borderRadius: '6px',
                    background: '#FDFAF0', color: '#131325', fontSize: '0.88rem',
                    fontFamily: ff, outline: 'none',
                  }}
                />
                <button
                  onClick={handleCompose}
                  disabled={composeLoading || !composeInput.trim()}
                  style={{
                    padding: '0.5rem 1.2rem', background: '#CF3748', color: '#fff',
                    border: 'none', borderRadius: '6px', fontWeight: 700,
                    cursor: 'pointer', fontSize: '0.85rem', fontFamily: ff, whiteSpace: 'nowrap',
                  }}
                >
                  {composeLoading ? '...' : 'start chat'}
                </button>
              </div>
              {composeError && (
                <p style={{ color: '#CF3748', fontSize: '0.78rem', margin: '0.5rem 0 0' }}>{composeError}</p>
              )}
            </div>
          )}

          {/* ════ DIRECTORY VIEW ════ */}
          {activeView === 'directory' && (
            <div style={{
              background: '#fff', border: '2px solid #4870D4', borderRadius: 12,
              padding: '1rem', overflow: 'hidden',
            }}>
              {/* Search bar */}
              <input
                type="text"
                placeholder="search by name, wallet, or ENS..."
                value={dirSearchInput}
                onChange={(e) => handleDirSearchChange(e.target.value)}
                style={{
                  width: '100%', padding: '0.5rem 0.65rem',
                  border: '2px solid #E8DCAB', borderRadius: '6px',
                  background: '#FDFAF0', color: '#131325', fontSize: '0.85rem',
                  fontFamily: ff, outline: 'none', boxSizing: 'border-box',
                }}
              />

              {/* Toggle switch: wallets ↔ names */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', margin: '0.75rem 0' }}>
                <span style={{ fontSize: '0.75rem', fontFamily: ff, fontWeight: !dirShowNames ? 700 : 400, color: !dirShowNames ? '#4870D4' : '#8a7d5a' }}>
                  wallets
                </span>
                <div
                  onClick={() => setDirShowNames(!dirShowNames)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                    background: dirShowNames ? '#CF3748' : '#4870D4',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3,
                    left: dirShowNames ? 23 : 3,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </div>
                <span style={{ fontSize: '0.75rem', fontFamily: ff, fontWeight: dirShowNames ? 700 : 400, color: dirShowNames ? '#CF3748' : '#8a7d5a' }}>
                  names
                </span>
              </div>

              {dirLoading && (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#4870D4', fontSize: '0.85rem', fontFamily: ff }}>
                  loading directory...
                </div>
              )}

              {!dirLoading && dirEntries.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#8a7d5a', fontSize: '0.85rem', fontFamily: ff }}>
                  {dirSearch ? 'no results found' : 'no registrants yet'}
                </div>
              )}

              {!dirLoading && dirEntries.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {dirEntries.map((entry) => (
                    <div
                      key={entry.tokenId}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.55rem 0.65rem', background: '#FDFAF0',
                        borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FFF8E7')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#FDFAF0')}
                      onClick={() => openChatForName(entry.name)}
                    >
                      {/* Avatar circle — red */}
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: '#CF3748', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: '0.82rem', fontFamily: ff,
                      }}>
                        {entry.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Name + identifier */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {dirShowNames ? (
                          <>
                            <div style={{ fontFamily: ff, fontWeight: 600, color: '#131325', fontSize: '0.85rem' }}>
                              {entry.name}<span style={{ color: '#8a7d5a', fontWeight: 400 }}>.hazza.name</span>
                            </div>
                            <div style={{ color: '#8a7d5a', fontSize: '0.7rem', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {entry.ensName || truncAddr(entry.owner)}
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontFamily: ff, fontWeight: 600, color: '#131325', fontSize: '0.85rem' }}>
                              {entry.ensName || truncAddr(entry.owner)}
                            </div>
                            <div style={{ color: '#8a7d5a', fontSize: '0.7rem', marginTop: '0.1rem' }}>
                              {entry.name}<span style={{ fontWeight: 400 }}>.hazza.name</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); openChatForName(entry.name); }}
                          title="message via name (follows delegation)"
                          style={{
                            padding: '0.2rem 0.45rem', background: '#CF3748', color: '#fff',
                            border: 'none', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600,
                            cursor: 'pointer', fontFamily: ff,
                          }}
                        >
                          DM
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openChatForAddress(entry.owner); }}
                          title="message wallet directly"
                          style={{
                            padding: '0.2rem 0.45rem', background: 'none', color: '#4870D4',
                            border: '1.5px solid #4870D4', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600,
                            cursor: 'pointer', fontFamily: ff,
                          }}
                        >
                          wallet
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Pagination + per-page */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #E8DCAB' }}>
                    {/* Per page selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ color: '#8a7d5a', fontSize: '0.7rem', fontFamily: ff }}>show</span>
                      {[20, 50, 100].map((n) => (
                        <button
                          key={n}
                          onClick={() => { setDirPerPage(n); setDirPage(1); loadDirectory(1, dirSearch, n); }}
                          style={{
                            padding: '0.15rem 0.4rem', background: dirPerPage === n ? '#4870D4' : 'none',
                            color: dirPerPage === n ? '#fff' : '#8a7d5a',
                            border: dirPerPage === n ? 'none' : '1px solid #E8DCAB', borderRadius: 4,
                            fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', fontFamily: ff,
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>

                    {/* Page nav */}
                    {dirPages > 1 && !dirSearch && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          onClick={() => { setDirPage(dirPage - 1); loadDirectory(dirPage - 1, dirSearch); }}
                          disabled={dirPage <= 1}
                          style={{
                            padding: '0.25rem 0.6rem', background: dirPage <= 1 ? '#f0e8d0' : '#4870D4',
                            color: dirPage <= 1 ? '#8a7d5a' : '#fff', border: 'none', borderRadius: 5,
                            fontSize: '0.72rem', fontWeight: 600, cursor: dirPage <= 1 ? 'default' : 'pointer',
                            fontFamily: ff,
                          }}
                        >
                          prev
                        </button>
                        <span style={{ color: '#8a7d5a', fontSize: '0.72rem', fontFamily: ff }}>
                          {dirPage}/{dirPages}
                        </span>
                        <button
                          onClick={() => { setDirPage(dirPage + 1); loadDirectory(dirPage + 1, dirSearch); }}
                          disabled={dirPage >= dirPages}
                          style={{
                            padding: '0.25rem 0.6rem', background: dirPage >= dirPages ? '#f0e8d0' : '#4870D4',
                            color: dirPage >= dirPages ? '#8a7d5a' : '#fff', border: 'none', borderRadius: 5,
                            fontSize: '0.72rem', fontWeight: 600, cursor: dirPage >= dirPages ? 'default' : 'pointer',
                            fontFamily: ff,
                          }}
                        >
                          next
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ INBOX VIEW ════ */}
          {activeView === 'inbox' && (
            <>
              {/* XMTP not connected */}
              {(inboxStatus === 'idle' || inboxStatus === 'connecting') && (
                <div style={{
                  textAlign: 'center', padding: '2rem 1rem',
                  background: '#fff', border: '2px solid #E8DCAB', borderRadius: '10px',
                }}>
                  {inboxStatus === 'idle' ? (
                    <>
                      <p style={{ color: '#131325', fontSize: '0.9rem', fontFamily: ff, fontWeight: 600, marginBottom: '0.5rem' }}>
                        encrypted messaging via XMTP
                      </p>
                      <p style={{ color: '#8a7d5a', fontSize: '0.8rem', fontFamily: ff, marginBottom: '1rem' }}>
                        sign one message to connect. then you can message anyone with a hazza name or XMTP address.
                      </p>
                      <button
                        onClick={initXmtp}
                        style={{
                          padding: '0.6rem 2rem', background: '#4870D4', color: '#fff',
                          border: 'none', borderRadius: '8px', fontWeight: 700,
                          cursor: 'pointer', fontSize: '0.9rem', fontFamily: ff,
                        }}
                      >
                        connect XMTP
                      </button>
                    </>
                  ) : (
                    <p style={{ color: '#4870D4', fontSize: '0.85rem', fontFamily: ff }}>
                      connecting to XMTP... check your wallet if prompted
                    </p>
                  )}
                </div>
              )}

              {/* Loading */}
              {inboxStatus === 'loading' && (
                <div style={{
                  textAlign: 'center', padding: '1.5rem 1rem',
                  background: '#fff', border: '2px solid #E8DCAB', borderRadius: '10px',
                }}>
                  <p style={{ color: '#4870D4', fontSize: '0.85rem', fontFamily: ff }}>loading conversations...</p>
                </div>
              )}

              {/* Error */}
              {inboxStatus === 'error' && (
                <div style={{
                  textAlign: 'center', padding: '1.5rem 1rem',
                  background: '#fff', border: '2px solid #E8DCAB', borderRadius: '10px',
                }}>
                  <p style={{ color: '#CF3748', fontSize: '0.85rem', fontFamily: ff, marginBottom: '0.75rem' }}>
                    couldn't connect to XMTP
                  </p>
                  <button
                    onClick={() => { initAttemptedRef.current = false; initXmtp(); }}
                    style={{
                      padding: '0.4rem 1.2rem', background: 'none',
                      border: '2px solid #CF3748', borderRadius: 6,
                      color: '#CF3748', fontSize: '0.8rem', fontWeight: 600,
                      cursor: 'pointer', fontFamily: ff,
                    }}
                  >
                    try again
                  </button>
                </div>
              )}

              {/* Empty inbox */}
              {inboxStatus === 'loaded' && convos.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '2rem 1rem',
                  background: '#fff', border: '2px solid #E8DCAB', borderRadius: '10px',
                }}>
                  <p style={{ color: '#131325', fontSize: '0.9rem', fontFamily: ff, fontWeight: 600, marginBottom: '0.5rem' }}>
                    no conversations yet
                  </p>
                  <p style={{ color: '#8a7d5a', fontSize: '0.8rem', fontFamily: ff, marginBottom: '1rem' }}>
                    start a conversation with anyone who has a hazza name or XMTP address
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setActiveView('compose')}
                      style={{
                        padding: '0.5rem 1.5rem', background: '#CF3748', color: '#fff',
                        border: 'none', borderRadius: '8px', fontWeight: 700,
                        cursor: 'pointer', fontSize: '0.85rem', fontFamily: ff,
                      }}
                    >
                      new message
                    </button>
                    <button
                      onClick={() => setActiveView('directory')}
                      style={{
                        padding: '0.5rem 1.5rem', background: 'none', color: '#4870D4',
                        border: '2px solid #4870D4', borderRadius: '8px', fontWeight: 700,
                        cursor: 'pointer', fontSize: '0.85rem', fontFamily: ff,
                      }}
                    >
                      browse directory
                    </button>
                  </div>
                </div>
              )}

              {/* Conversation list */}
              {inboxStatus === 'loaded' && convos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {convos.map((c, i) => (
                    <div
                      key={i}
                      onClick={() => setChatTarget({ address: c.peerAddress, name: c.peerName || truncAddr(c.peerAddress) })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.75rem 1rem', background: '#fff',
                        border: '2px solid #E8DCAB', borderRadius: '10px',
                        cursor: 'pointer', transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#4870D4')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E8DCAB')}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: '#4870D4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: '0.85rem', fontFamily: ff,
                      }}>
                        {(c.peerName || c.peerAddress.slice(2, 4)).charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: ff, fontWeight: 600, color: '#131325', fontSize: '0.9rem' }}>
                          {c.peerName || truncAddr(c.peerAddress)}
                        </div>
                        {c.lastMessage && (
                          <div style={{
                            color: '#8a7d5a', fontSize: '0.78rem', marginTop: '0.15rem',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {c.lastMessage}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        {c.lastTime && (
                          <div style={{ color: '#8a7d5a', fontSize: '0.7rem' }}>
                            {formatTimeAgo(c.lastTime)}
                          </div>
                        )}
                        <div style={{ color: '#4870D4', fontSize: '1.1rem', fontWeight: 700 }}>&rsaquo;</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Forum link */}
      <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
        <Link
          to="/marketplace?tab=forum"
          style={{
            display: 'inline-block', padding: '0.7rem 1.8rem',
            background: '#4870D4', color: '#fff',
            border: 'none', borderRadius: '8px',
            fontWeight: 700, fontSize: '0.9rem',
            textDecoration: 'none', fontFamily: ff,
          }}
        >
          community forum <span style={{ marginLeft: '0.3rem' }}>&rarr;</span>
        </Link>
      </div>

      {/* Chat Panel */}
      {chatTarget && (
        <ChatPanel
          isOpen={!!chatTarget}
          onClose={() => setChatTarget(null)}
          targetAddress={chatTarget.address}
          targetName={chatTarget.name}
          targetAvatar={chatTarget.avatar}
          greeting={chatTarget.greeting}
          xmtpClient={xmtpClientRef.current}
        />
      )}
    </>
  );
}
