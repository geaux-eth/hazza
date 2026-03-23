import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from 'react-router-dom';
import { REGISTRY_ADDRESS, REGISTRY_ABI } from '../config/contracts';
import { API_BASE } from '../constants';
import ChatPanel from '../components/ChatPanel';

type NameEntry = {
  name: string;
  tokenId: string;
  registeredAt: number;
  status: string;
  isNamespace: boolean;
  image?: string;
};

type NamesData = {
  names: NameEntry[];
  total: number;
};

const EDIT_FIELDS = [
  { label: 'Bio', key: 'description', placeholder: 'A short bio...' },
  { label: 'Avatar', key: 'avatar', placeholder: 'https://... image URL' },
  { label: 'Website', key: 'url', placeholder: 'https://...' },
  { label: 'Twitter', key: 'com.twitter', placeholder: '@handle' },
  { label: 'Farcaster', key: 'xyz.farcaster', placeholder: '@handle' },
  { label: 'GitHub', key: 'com.github', placeholder: 'username' },
];

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [namesData, setNamesData] = useState<NamesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<{ name: string; panel: 'edit' | 'transfer' | 'messaging' } | null>(null);
  const [chatTarget, setChatTarget] = useState<{ address: string; name: string; context?: string } | null>(null);
  const [delegateSettings, setDelegateSettings] = useState<Record<string, { delegate: string; mode: string }>>({});
  const [editValues, setEditValues] = useState<Record<string, Record<string, string>>>({});
  const [editStatuses, setEditStatuses] = useState<Record<string, string>>({});
  const [transferInputs, setTransferInputs] = useState<Record<string, string>>({});
  const [transferStatuses, setTransferStatuses] = useState<Record<string, string>>({});
  const [shareModal, setShareModal] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const PAGE_SIZE = 20;

  const { writeContract, data: txHash, isPending: isWriting, reset: resetWrite, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const [pendingAction, setPendingAction] = useState<{
    type: 'setText' | 'setPrimary' | 'transfer' | 'saveAll';
    name: string;
    key?: string;
  } | null>(null);

  const loadNames = useCallback(() => {
    if (!address) return;
    setLoading(true);
    setError('');
    fetch(`${API_BASE}/api/names/${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((data: NamesData) => {
        setNamesData(data);
      })
      .catch(() => {
        setError('error loading names');
      })
      .finally(() => setLoading(false));
  }, [address]);

  useEffect(() => {
    if (address) loadNames();
  }, [address, loadNames]);

  // Load avatars for all names
  useEffect(() => {
    if (!namesData?.names?.length) return;
    namesData.names.forEach((n) => {
      if (avatars[n.name]) return;
      fetch(`${API_BASE}/api/text/${n.name}/avatar`)
        .then((r) => r.json())
        .then((d) => {
          if (d.value) setAvatars((prev) => ({ ...prev, [n.name]: d.value }));
        })
        .catch(() => {});
    });
  }, [namesData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-populate edit fields when opening edit panel
  const loadEditFields = useCallback((name: string) => {
    fetch(`${API_BASE}/api/profile/${name}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.texts) return;
        const map: Record<string, string> = {};
        if (Array.isArray(d.texts)) {
          d.texts.forEach((t: { key: string; value: string }) => { map[t.key] = t.value; });
        } else {
          Object.assign(map, d.texts);
        }
        setEditValues((prev) => ({ ...prev, [name]: { ...(prev[name] || {}), ...map } }));
        setDelegateSettings((prev) => ({
          ...prev,
          [name]: {
            delegate: map['message.delegate'] || '',
            mode: map['message.mode'] || 'all',
          },
        }));
      })
      .catch(() => {});
  }, []);

  // Handle confirmed transactions
  useEffect(() => {
    if (!isConfirmed || !pendingAction) return;

    if (pendingAction.type === 'setText') {
      const key = pendingAction.key || '';
      setEditStatuses((prev) => ({ ...prev, [pendingAction.name]: `${key} updated!` }));
      setTimeout(() => {
        setEditStatuses((prev) => ({ ...prev, [pendingAction.name]: '' }));
      }, 3000);
    } else if (pendingAction.type === 'setPrimary') {
      setEditStatuses((prev) => ({ ...prev, [pendingAction.name]: `${pendingAction.name} is now your primary name!` }));
    } else if (pendingAction.type === 'transfer') {
      setTransferStatuses((prev) => ({ ...prev, [pendingAction.name]: 'Transferred!' }));
      setTimeout(() => loadNames(), 2000);
    } else if (pendingAction.type === 'saveAll') {
      setEditStatuses((prev) => ({ ...prev, [pendingAction.name]: `All fields saved!` }));
      setTimeout(() => {
        setEditStatuses((prev) => ({ ...prev, [pendingAction.name]: '' }));
      }, 3000);
    }

    setPendingAction(null);
    resetWrite();
  }, [isConfirmed, pendingAction, resetWrite, loadNames, writeContract]);

  // Handle write errors (tx rejection, revert, etc.)
  useEffect(() => {
    if (!writeError || !pendingAction) return;
    const errMsg = (writeError as any).shortMessage || writeError.message || 'Transaction failed';
    const friendlyMsg = errMsg.includes('User rejected') || errMsg.includes('user rejected')
      ? 'Transaction rejected'
      : errMsg;

    if (pendingAction.type === 'setText' || pendingAction.type === 'saveAll' || pendingAction.type === 'setPrimary') {
      setEditStatuses((prev) => ({ ...prev, [pendingAction.name]: friendlyMsg }));
      setTimeout(() => setEditStatuses((prev) => ({ ...prev, [pendingAction.name]: '' })), 5000);
    } else if (pendingAction.type === 'transfer') {
      setTransferStatuses((prev) => ({ ...prev, [pendingAction.name]: friendlyMsg }));
      setTimeout(() => setTransferStatuses((prev) => ({ ...prev, [pendingAction.name]: '' })), 5000);
    }

    setPendingAction(null);
    resetWrite();
  }, [writeError, pendingAction, resetWrite]);

  const saveField = useCallback(
    (name: string, key: string) => {
      const value = editValues[name]?.[key] || '';
      setEditStatuses((prev) => ({ ...prev, [name]: `Setting ${key}...` }));
      setPendingAction({ type: 'setText', name, key });
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'setText',
        args: [name, key, value],
      });
    },
    [editValues, writeContract]
  );

  const saveAll = useCallback(
    (name: string) => {
      const vals = editValues[name] || {};
      // Include fields that have a value OR that exist in editValues (were loaded, possibly cleared)
      const toSave = EDIT_FIELDS.map((f) => ({
        key: f.key,
        value: (vals[f.key] || '').trim(),
      })).filter((f) => f.value || f.key in (editValues[name] || {}));

      if (toSave.length === 0) {
        setEditStatuses((prev) => ({ ...prev, [name]: 'No fields to save' }));
        return;
      }

      const keys = toSave.map((f) => f.key);
      const values = toSave.map((f) => f.value);
      setEditStatuses((prev) => ({ ...prev, [name]: `Saving ${toSave.length} field${toSave.length > 1 ? 's' : ''}...` }));
      setPendingAction({ type: 'saveAll', name });
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'setTexts',
        args: [name, keys, values],
      });
    },
    [editValues, writeContract]
  );

  const setPrimary = useCallback(
    (name: string) => {
      setEditStatuses((prev) => ({ ...prev, [name]: 'Setting primary name...' }));
      setPendingAction({ type: 'setPrimary', name });
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'setPrimaryName',
        args: [name],
      });
    },
    [writeContract]
  );

  const doTransfer = useCallback(
    (name: string, tokenId: string) => {
      const to = (transferInputs[name] || '').trim();
      if (!to || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
        setTransferStatuses((prev) => ({ ...prev, [name]: 'Enter a valid wallet address (0x...)' }));
        return;
      }
      if (address && to.toLowerCase() === address.toLowerCase()) {
        setTransferStatuses((prev) => ({ ...prev, [name]: 'Cannot transfer to yourself' }));
        return;
      }
      if (!window.confirm(`Transfer ${name}.hazza.name to ${to.slice(0, 6)}...${to.slice(-4)}? This is irreversible.`)) return;
      setTransferStatuses((prev) => ({ ...prev, [name]: 'Sending transfer...' }));
      setPendingAction({ type: 'transfer', name });
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'transferFrom',
        args: [address as `0x${string}`, to as `0x${string}`, BigInt(tokenId)],
      });
    },
    [address, transferInputs, writeContract]
  );

  const toggleCard = useCallback((name: string) => {
    setOpenCard((prev) => (prev === name ? null : name));
    setOpenPanel(null);
  }, []);

  const togglePanel = useCallback(
    (name: string, panel: 'edit' | 'transfer' | 'messaging') => {
      setOpenPanel((prev) => {
        if (prev?.name === name && prev?.panel === panel) return null;
        if (panel === 'edit' || panel === 'messaging') loadEditFields(name);
        return { name, panel };
      });
    },
    [loadEditFields]
  );

  const shareName = useCallback((name: string) => {
    setShareModal(name);
  }, []);

  const copyShareUrl = useCallback((name: string) => {
    const url = `https://${name}.hazza.name`;
    navigator.clipboard.writeText(url).then(() => {
      setTimeout(() => setShareModal(null), 1200);
    });
  }, []);

  if (!isConnected) {
    return (
      <div className="dash-page">
        <div className="header" style={{ background: '#4870D4', padding: '1rem 1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <h1 style={{ color: '#fff' }}>dashboard</h1>
        </div>
        <div id="connect-section" style={{ textAlign: 'center', margin: '2rem 0' }}>
          <p style={{ color: '#8a7d5a', marginBottom: '0.5rem' }}>connect your wallet to see your names</p>
          <p style={{ color: '#8a7d5a', fontSize: '0.85rem' }}>tap <strong style={{ color: '#CF3748' }}>connect</strong> in the menu above</p>
          <div style={{ marginTop: '1rem' }}>
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-page">
      <div className="header" style={{ background: '#4870D4', padding: '1rem 1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#fff' }}>dashboard</h1>
      </div>

      {error && (
        <span style={{ color: '#CF3748', fontSize: '0.85rem' }}>{error}</span>
      )}

      <div id="dash-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span id="names-count" style={{ fontFamily: "'Fredoka', sans-serif", color: '#4870D4', fontSize: '1rem', fontWeight: 700 }}>
            {namesData ? `${namesData.total} name${namesData.total === 1 ? '' : 's'}` : ''}
          </span>
          <Link to="/register" style={{ fontFamily: "'Fredoka', sans-serif", color: '#fff', fontSize: '0.85rem', fontWeight: 700, background: '#CF3748', padding: '0.4rem 1rem', borderRadius: '8px', textDecoration: 'none', boxShadow: '0 2px 6px rgba(207,55,72,0.2)' }}>
            + register new
          </Link>
        </div>

        {loading && (
          <span style={{ color: '#8a7d5a', fontSize: '0.85rem' }}>loading...</span>
        )}

        {!loading && namesData && namesData.names.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <p style={{ fontFamily: "'Fredoka',sans-serif", color: '#131325', fontSize: '1rem', marginBottom: '0.5rem' }}>
              no names yet? let's fix that.
            </p>
            <Link
              to="/register"
              style={{ display: 'inline-block', padding: '0.6rem 1.5rem', background: '#CF3748', color: '#fff', borderRadius: '8px', fontWeight: 700, textDecoration: 'none' }}
            >
              register your first name — it's free!
            </Link>
            <p style={{ fontFamily: "'Fredoka',sans-serif", color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.75rem' }}>
              &mdash; nomi
            </p>
          </div>
        )}

        <div id="names-list" style={{ background: '#CF3748', border: '2px solid #fff', borderRadius: '12px', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {namesData && (showAll ? namesData.names : namesData.names.slice(0, PAGE_SIZE)).map((n) => {
            const eName = n.name;
            const uName = encodeURIComponent(n.name);
            const isOpen = openCard === eName;
            const statusColor = '#1B7A3D';
            const statusLabel = 'active';
            const pillBg = 'rgba(0,230,118,0.15)';

            return (
              <div className="name-card" data-name={eName} key={eName}>
                {/* NFT image — full width, square */}
                <div onClick={() => toggleCard(eName)}>
                  <img
                    src={`${API_BASE}/api/nft-image/${encodeURIComponent(eName)}`}
                    alt={`${eName}.hazza.name`}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                {/* Name + status + icons row */}
                <div style={{ padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#4870D4' }}>{eName}</span><span style={{ color: '#131325' }}>.hazza.name</span>
                    </div>
                    <span className="status-pill" style={{ color: statusColor, background: pillBg, fontSize: '0.6rem', padding: '0.05rem 0.4rem', marginTop: '0.1rem', display: 'inline-block' }}>
                      {statusLabel}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenCard(eName); togglePanel(eName, 'messaging'); }}
                      title="Messages"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: '#4870D4', display: 'flex' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); shareName(eName); }}
                      title="Share"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: '#8a7d5a', display: 'flex' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                    </button>
                  </div>
                </div>

              </div>
            );
          })}

          {namesData && namesData.total > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
              {!showAll ? (
                <>
                  <span style={{ color: '#8a7d5a', fontSize: '0.8rem', alignSelf: 'center' }}>
                    showing {PAGE_SIZE} of {namesData.total}
                  </span>
                  <button
                    onClick={() => setShowAll(true)}
                    style={{ background: 'transparent', border: '2px solid #E8DCAB', color: '#CF3748', padding: '0.35rem 1rem', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Fredoka', sans-serif" }}
                  >
                    show all
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAll(false)}
                  style={{ background: 'transparent', border: '2px solid #E8DCAB', color: '#8a7d5a', padding: '0.35rem 1rem', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Fredoka', sans-serif" }}
                >
                  show less
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Name detail popup overlay */}
      {openCard && namesData && (() => {
        const n = namesData.names.find((x) => x.name === openCard);
        if (!n) return null;
        const eName = n.name;
        const uName = encodeURIComponent(n.name);
        return (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) { setOpenCard(null); setOpenPanel(null); } }}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.7)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '1rem',
            }}
          >
            <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '12px', padding: '1.5rem', maxWidth: '420px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
              {/* Popup header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <span style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: '1.1rem' }}>
                  <span style={{ color: '#4870D4' }}>{eName}</span><span style={{ color: '#131325' }}>.hazza.name</span>
                </span>
                <button onClick={() => { setOpenCard(null); setOpenPanel(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#8a7d5a', fontSize: '1.2rem', lineHeight: 1 }}>&times;</button>
              </div>

              {/* Info row */}
              <div style={{ marginBottom: '1rem' }}>
                <a href={`https://${eName}.hazza.name`} style={{ color: '#4870D4', textDecoration: 'none', fontSize: '0.8rem', fontFamily: 'Fredoka,sans-serif' }} target="_blank" rel="noopener noreferrer">
                  view profile &uarr;
                </a>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <button
                  onClick={() => { togglePanel(eName, 'edit'); }}
                  style={{ color: openPanel?.panel === 'edit' ? '#fff' : '#CF3748', fontSize: '0.75rem', border: '2px solid #CF3748', padding: '0.3rem 0.6rem', borderRadius: '6px', background: openPanel?.panel === 'edit' ? '#CF3748' : 'transparent', cursor: 'pointer', fontFamily: 'Fredoka,sans-serif', fontWeight: 700 }}
                >
                  manage
                </button>
                <button
                  onClick={() => { togglePanel(eName, 'transfer'); }}
                  style={{ color: openPanel?.panel === 'transfer' ? '#fff' : '#4870D4', fontSize: '0.75rem', border: '2px solid #4870D4', padding: '0.3rem 0.6rem', borderRadius: '6px', background: openPanel?.panel === 'transfer' ? '#4870D4' : 'transparent', cursor: 'pointer', fontFamily: 'Fredoka,sans-serif', fontWeight: 700 }}
                >
                  transfer
                </button>
                <Link
                  to={`/marketplace?sell=${uName}`}
                  style={{ color: '#8a7d5a', fontSize: '0.75rem', border: '2px solid #E8DCAB', padding: '0.3rem 0.6rem', borderRadius: '6px', textDecoration: 'none', fontFamily: 'Fredoka,sans-serif' }}
                >
                  sell
                </Link>
              </div>

              {/* Edit/manage panel */}
              {openPanel?.name === eName && openPanel?.panel === 'edit' && (
                <div style={{ paddingTop: '0.75rem', borderTop: '2px solid #E8DCAB' }}>
                  <div style={{ background: '#FFF3CD', border: '1px solid #E8DCAB', borderRadius: '8px', padding: '0.5rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.7rem', color: '#856404' }}>
                    <strong>Onchain transaction:</strong> Saving changes requires a Base transaction (~$0.01 gas). This is NOT a server save.
                  </div>
                  {EDIT_FIELDS.map((f) => {
                    const fieldId = `edit-${eName}-${f.key.replace(/\./g, '-')}`;
                    return (
                      <div key={fieldId} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <label style={{ color: '#8a7d5a', fontSize: '0.75rem', minWidth: '65px' }}>{f.label}</label>
                        <input
                          type="text"
                          placeholder={f.placeholder}
                          value={editValues[eName]?.[f.key] || ''}
                          onChange={(e) => {
                            setEditValues((prev) => ({
                              ...prev,
                              [eName]: { ...(prev[eName] || {}), [f.key]: e.target.value },
                            }));
                          }}
                          style={{ flex: 1, minWidth: '120px', padding: '0.3rem 0.5rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.8rem', fontFamily: 'Fredoka,sans-serif', outline: 'none' }}
                        />
                      </div>
                    );
                  })}
                  <div style={{ fontSize: '0.65rem', color: '#8a7d5a', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
                    Avatar tip: for ENS wallets, use format <span style={{ color: '#8a7d5a' }}>eip155:8453/erc721:0xContractAddr/tokenId</span>
                  </div>
                  <button
                    onClick={() => saveAll(eName)}
                    disabled={isWriting || isConfirming}
                    style={{ padding: '0.5rem 1.25rem', background: '#CF3748', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Fredoka,sans-serif', width: '100%', marginBottom: '0.75rem' }}
                  >
                    {isWriting || isConfirming ? 'Saving...' : 'Save All Fields'}
                  </button>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      onClick={() => setPrimary(eName)}
                      disabled={isWriting || isConfirming}
                      style={{ padding: '0.3rem 0.6rem', background: 'transparent', color: '#8a7d5a', border: '2px solid #E8DCAB', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'Fredoka,sans-serif' }}
                    >
                      set as primary name
                    </button>
                    <Link
                      to={`/manage?name=${uName}`}
                      style={{ color: '#4870D4', fontSize: '0.7rem', textDecoration: 'none', marginLeft: 'auto', fontFamily: 'Fredoka,sans-serif' }}
                    >
                      advanced settings &rarr;
                    </Link>
                  </div>
                  {editStatuses[eName] && (
                    <span style={{ fontSize: '0.75rem', color: editStatuses[eName].includes('failed') || editStatuses[eName].includes('rejected') ? '#CF3748' : '#1B7A3D', display: 'block', marginTop: '0.5rem', fontFamily: 'Fredoka,sans-serif' }}>
                      {editStatuses[eName]}
                    </span>
                  )}
                </div>
              )}

              {/* Messaging panel */}
              {openPanel?.name === eName && openPanel?.panel === 'messaging' && (
                <div style={{ paddingTop: '0.75rem', borderTop: '2px solid #4870D4' }}>
                  <div style={{ fontSize: '0.85rem', color: '#4870D4', fontWeight: 700, marginBottom: '0.75rem', fontFamily: 'Fredoka,sans-serif' }}>
                    Messaging
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <label style={{ color: '#8a7d5a', fontSize: '0.75rem', minWidth: '65px' }}>XMTP</label>
                    <input
                      type="text"
                      placeholder="0x... your XMTP address"
                      value={editValues[eName]?.['xmtp'] || ''}
                      onChange={(e) => {
                        setEditValues((prev) => ({
                          ...prev,
                          [eName]: { ...(prev[eName] || {}), xmtp: e.target.value },
                        }));
                      }}
                      style={{ flex: 1, minWidth: '120px', padding: '0.3rem 0.5rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.8rem', fontFamily: 'Fredoka,sans-serif', outline: 'none' }}
                    />
                    <button
                      onClick={() => saveField(eName, 'xmtp')}
                      disabled={isWriting || isConfirming}
                      style={{ padding: '0.3rem 0.6rem', background: '#4870D4', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'Fredoka,sans-serif' }}
                    >
                      Save
                    </button>
                  </div>
                  {editValues[eName]?.['xmtp'] && (
                    <button
                      onClick={() => {
                        setChatTarget({ address: editValues[eName]?.['xmtp'] || '', name: eName, context: `Testing DM for ${eName}` });
                      }}
                      style={{ padding: '0.4rem 1rem', background: '#4870D4', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'Fredoka,sans-serif', marginBottom: '0.75rem' }}
                    >
                      Test DM
                    </button>
                  )}
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #E8DCAB' }}>
                    <div style={{ fontSize: '0.75rem', color: '#8a7d5a', fontWeight: 700, marginBottom: '0.5rem', fontFamily: 'Fredoka,sans-serif' }}>
                      Message Routing
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                      <label style={{ color: '#8a7d5a', fontSize: '0.75rem', minWidth: '65px' }}>Delegate</label>
                      <input
                        type="text"
                        placeholder="hazza name or 0x address"
                        value={delegateSettings[eName]?.delegate || ''}
                        onChange={(e) => {
                          setDelegateSettings((prev) => ({
                            ...prev,
                            [eName]: { ...(prev[eName] || { delegate: '', mode: 'all' }), delegate: e.target.value },
                          }));
                        }}
                        style={{ flex: 1, minWidth: '120px', padding: '0.3rem 0.5rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.8rem', fontFamily: 'Fredoka,sans-serif', outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                      <label style={{ color: '#8a7d5a', fontSize: '0.75rem', minWidth: '65px' }}>Mode</label>
                      <select
                        value={delegateSettings[eName]?.mode || 'all'}
                        onChange={(e) => {
                          setDelegateSettings((prev) => ({
                            ...prev,
                            [eName]: { ...(prev[eName] || { delegate: '', mode: 'all' }), mode: e.target.value },
                          }));
                        }}
                        style={{ flex: 1, padding: '0.3rem', borderRadius: '6px', border: '2px solid #E8DCAB', background: '#fff', color: '#131325', fontSize: '0.8rem', fontFamily: 'DM Sans,sans-serif' }}
                      >
                        <option value="all">Receive all directly</option>
                        <option value="delegate-all">Forward all to delegate</option>
                        <option value="delegate-agents">Forward agents, keep human</option>
                      </select>
                    </div>
                    <button
                      onClick={() => {
                        const delVal = delegateSettings[eName]?.delegate || '';
                        const modeVal = delegateSettings[eName]?.mode || 'all';
                        setEditStatuses((prev) => ({ ...prev, [eName]: 'Saving messaging settings...' }));
                        setPendingAction({ type: 'saveAll', name: eName });
                        writeContract({ address: REGISTRY_ADDRESS, abi: REGISTRY_ABI, functionName: 'setTexts', args: [eName, ['message.delegate', 'message.mode'], [delVal, modeVal]] });
                      }}
                      disabled={isWriting || isConfirming}
                      style={{ padding: '0.4rem 1rem', background: '#4870D4', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'Fredoka,sans-serif', marginTop: '0.5rem', width: '100%' }}
                    >
                      {isWriting || isConfirming ? 'Saving...' : 'Save Messaging Settings'}
                    </button>
                    <div style={{ fontSize: '0.65rem', color: '#8a7d5a', marginTop: '0.5rem' }}>
                      Forward incoming messages to an agent or another name. Delegate must have an XMTP address set.
                    </div>
                  </div>
                  {editStatuses[eName] && (
                    <span style={{ fontSize: '0.75rem', color: editStatuses[eName].includes('failed') || editStatuses[eName].includes('rejected') ? '#CF3748' : '#1B7A3D', display: 'block', marginTop: '0.5rem', fontFamily: 'Fredoka,sans-serif' }}>
                      {editStatuses[eName]}
                    </span>
                  )}
                </div>
              )}

              {/* Transfer panel */}
              {openPanel?.name === eName && openPanel?.panel === 'transfer' && (
                <div style={{ paddingTop: '0.75rem', borderTop: '2px solid #4870D4' }}>
                  <div style={{ fontSize: '0.85rem', color: '#131325', marginBottom: '0.5rem', fontFamily: 'Fredoka,sans-serif' }}>
                    Transfer <span style={{ color: '#4870D4' }}>{eName}</span>.hazza.name
                  </div>
                  <div style={{ background: '#FFF3CD', border: '1px solid #E8DCAB', borderRadius: '8px', padding: '0.5rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.7rem', color: '#856404' }}>
                    <strong>Warning:</strong> This is an irreversible onchain transfer. The name will be permanently moved to the recipient wallet.
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="0x... recipient address"
                      value={transferInputs[eName] || ''}
                      onChange={(e) => setTransferInputs((prev) => ({ ...prev, [eName]: e.target.value }))}
                      style={{ flex: 1, minWidth: '200px', padding: '0.4rem 0.5rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: 'Fredoka,sans-serif' }}
                    />
                    <button
                      onClick={() => doTransfer(eName, n.tokenId)}
                      disabled={isWriting || isConfirming}
                      style={{ padding: '0.4rem 1rem', background: '#4870D4', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Fredoka,sans-serif' }}
                    >
                      Transfer
                    </button>
                  </div>
                  {transferStatuses[eName] && (
                    <span style={{ fontSize: '0.8rem', color: transferStatuses[eName].includes('Transferred') ? '#1B7A3D' : '#CF3748', display: 'block', marginTop: '0.5rem', fontFamily: 'Fredoka,sans-serif' }}>
                      {transferStatuses[eName]}
                    </span>
                  )}
                </div>
              )}

            </div>
          </div>
        );
      })()}

      {/* Share modal */}
      {shareModal && (
        <div
          id="share-modal"
          onClick={(e) => { if (e.target === e.currentTarget) setShareModal(null); }}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '12px', padding: '1.5rem', maxWidth: '320px', width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', color: '#131325', marginBottom: '1rem', fontFamily: 'Fredoka,sans-serif' }}>
              Share <strong style={{ color: '#CF3748' }}>{shareModal}.hazza.name</strong>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${shareModal}.hazza.name`)}&url=${encodeURIComponent(`https://${shareModal}.hazza.name`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', gap: '0.3rem' }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#131325">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span style={{ color: '#8a7d5a', fontSize: '0.7rem', fontFamily: 'Fredoka,sans-serif' }}>Twitter</span>
              </a>
              <a
                href={`https://warpcast.com/~/compose?text=${encodeURIComponent(`Check out ${shareModal}.hazza.name https://${shareModal}.hazza.name`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', gap: '0.3rem' }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#4870D4">
                  <path d="M3.77 2h16.46C21.21 2 22 2.79 22 3.77v16.46c0 .98-.79 1.77-1.77 1.77H3.77C2.79 22 2 21.21 2 20.23V3.77C2 2.79 2.79 2 3.77 2zm3.48 4.3L5.6 12.26h2.18l.89 5.44h2.07l1.26-7.4 1.26 7.4h2.07l.89-5.44h2.18L16.75 6.3h-2.82l-.93 5.5-.93-5.5H8.07z" />
                </svg>
                <span style={{ color: '#8a7d5a', fontSize: '0.7rem', fontFamily: 'Fredoka,sans-serif' }}>Farcaster</span>
              </a>
            </div>
            <button
              onClick={() => copyShareUrl(shareModal)}
              style={{ width: '100%', padding: '0.6rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Fredoka,sans-serif' }}
            >
              Copy URL
            </button>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {chatTarget && (
        <ChatPanel
          isOpen={!!chatTarget}
          onClose={() => setChatTarget(null)}
          targetAddress={chatTarget.address}
          targetName={chatTarget.name}
          context={chatTarget.context}
        />
      )}
    </div>
  );
}
