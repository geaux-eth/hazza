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
  const [openPanel, setOpenPanel] = useState<{ name: string; panel: 'edit' | 'transfer' | 'namespace' | 'messaging' } | null>(null);
  const [editValues, setEditValues] = useState<Record<string, Record<string, string>>>({});
  const [editStatuses, setEditStatuses] = useState<Record<string, string>>({});
  const [transferInputs, setTransferInputs] = useState<Record<string, string>>({});
  const [transferStatuses, setTransferStatuses] = useState<Record<string, string>>({});
  const [namespaceStatuses, setNamespaceStatuses] = useState<Record<string, string>>({});
  const [shareModal, setShareModal] = useState<string | null>(null);
  const [chatTarget, setChatTarget] = useState<{ address: string; name: string; context?: string } | null>(null);
  const [delegateSettings, setDelegateSettings] = useState<Record<string, { delegate: string; mode: string }>>({});
  const [showAll, setShowAll] = useState(false);
  const PAGE_SIZE = 20;

  const { writeContract, data: txHash, isPending: isWriting, reset: resetWrite, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const [pendingAction, setPendingAction] = useState<{
    type: 'setText' | 'setPrimary' | 'transfer' | 'namespace' | 'saveAll';
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
        // Load delegate settings
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
    } else if (pendingAction.type === 'namespace') {
      setNamespaceStatuses((prev) => ({ ...prev, [pendingAction.name]: 'Namespace created!' }));
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
    } else if (pendingAction.type === 'namespace') {
      setNamespaceStatuses((prev) => ({ ...prev, [pendingAction.name]: friendlyMsg }));
      setTimeout(() => setNamespaceStatuses((prev) => ({ ...prev, [pendingAction.name]: '' })), 5000);
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

  const doNamespace = useCallback(
    (name: string) => {
      if (!window.confirm(`Enable namespaces on ${name}? This is permanent and cannot be undone. Each subname you create will cost $1.`)) return;
      setNamespaceStatuses((prev) => ({ ...prev, [name]: 'Enabling namespaces...' }));
      setPendingAction({ type: 'namespace', name });
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'registerNamespace',
        args: [name],
      });
    },
    [writeContract]
  );

  const toggleCard = useCallback((name: string) => {
    setOpenCard((prev) => (prev === name ? null : name));
    setOpenPanel(null);
  }, []);

  const togglePanel = useCallback(
    (name: string, panel: 'edit' | 'transfer' | 'namespace' | 'messaging') => {
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
      <div className="max-w-[720px] mx-auto px-6">
        <div className="header" style={{ background: '#4870D4', padding: '1.5rem 1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
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
    <div className="max-w-[720px] mx-auto px-6">
      <div className="header" style={{ background: '#4870D4', padding: '1.5rem 1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#fff' }}>dashboard</h1>
      </div>

      {error && (
        <span style={{ color: '#CF3748', fontSize: '0.85rem' }}>{error}</span>
      )}

      <div id="dash-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span id="names-count" style={{ color: '#8a7d5a', fontSize: '0.85rem' }}>
            {namesData ? `${namesData.total} name${namesData.total === 1 ? '' : 's'}` : ''}
          </span>
          <Link to="/register" style={{ color: '#CF3748', fontSize: '0.85rem', border: '2px solid #E8DCAB', padding: '0.3rem 0.75rem', borderRadius: '6px', textDecoration: 'none' }}>
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

        <div id="names-list">
          {namesData && (showAll ? namesData.names : namesData.names.slice(0, PAGE_SIZE)).map((n) => {
            const eName = n.name;
            const uName = encodeURIComponent(n.name);
            const isOpen = openCard === eName;
            const statusColor = '#CF3748';
            const statusLabel = 'active';
            const pillBg = 'rgba(0,230,118,0.15)';

            return (
              <div className="name-card" data-name={eName} key={eName} style={{ marginBottom: '0.5rem' }}>
                {/* Collapsed card header */}
                <div
                  className="name-card-header"
                  onClick={() => toggleCard(eName)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem 1rem', background: '#fff', border: '2px solid #E8DCAB',
                    borderRadius: isOpen ? '8px 8px 0 0' : '8px', cursor: 'pointer', transition: 'border-radius 0.2s',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <span style={{ color: '#131325', fontWeight: 700, fontSize: '0.95rem' }}>
                      {eName}<span style={{ color: '#4870D4' }}>.hazza.name</span>
                    </span>
                    {n.isNamespace && (
                      <span
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '18px', height: '18px', background: '#CF3748', color: '#fff',
                          fontSize: '0.65rem', fontWeight: 700, borderRadius: '4px', verticalAlign: 'middle', marginLeft: '0.25rem',
                        }}
                        title="Namespace"
                      >
                        N
                      </span>
                    )}
                  </div>
                  <span className="status-pill" style={{ color: statusColor, background: pillBg }}>
                    {statusLabel}
                  </span>
                </div>

                {/* Expanded detail panel */}
                {isOpen && (
                  <div
                    className="name-card-detail"
                    style={{
                      padding: '0.75rem 1rem', background: '#fff',
                      border: '2px solid #E8DCAB', borderTop: 'none', borderRadius: '0 0 8px 8px',
                    }}
                  >
                    {/* Info row */}
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: '#8a7d5a', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      <span>permanent</span>
                      <a href={`https://${eName}.hazza.name`} style={{ color: '#CF3748', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
                        view profile &uarr;
                      </a>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePanel(eName, 'edit'); }}
                        style={{ color: '#CF3748', fontSize: '0.75rem', border: '2px solid #CF3748', padding: '0.3rem 0.6rem', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontFamily: 'Fredoka,sans-serif' }}
                      >
                        edit profile
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePanel(eName, 'transfer'); }}
                        style={{ color: '#8a7d5a', fontSize: '0.75rem', border: '2px solid #E8DCAB', padding: '0.3rem 0.6rem', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontFamily: 'Fredoka,sans-serif' }}
                      >
                        transfer
                      </button>
                      <Link
                        to={`/marketplace?sell=${uName}`}
                        style={{ color: '#8a7d5a', fontSize: '0.75rem', border: '2px solid #E8DCAB', padding: '0.3rem 0.6rem', borderRadius: '6px', textDecoration: 'none' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        sell
                      </Link>
                      {!n.isNamespace && (
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePanel(eName, 'namespace'); }}
                          style={{ color: '#8a7d5a', fontSize: '0.75rem', border: '2px solid #E8DCAB', padding: '0.3rem 0.6rem', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontFamily: 'Fredoka,sans-serif' }}
                        >
                          namespace
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); shareName(eName); }}
                        style={{ color: '#8a7d5a', fontSize: '0.75rem', border: '2px solid #E8DCAB', padding: '0.3rem 0.6rem', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontFamily: 'Fredoka,sans-serif' }}
                      >
                        share
                      </button>
                      <a
                        href={`${API_BASE}/api/export/${uName}`}
                        download={`${eName}.hazza.json`}
                        style={{ color: '#8a7d5a', fontSize: '0.75rem', border: '2px solid #E8DCAB', padding: '0.3rem 0.6rem', borderRadius: '6px', textDecoration: 'none' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        export
                      </a>
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePanel(eName, 'messaging'); }}
                        style={{ color: '#4870D4', fontSize: '0.75rem', border: '2px solid #4870D4', padding: '0.3rem 0.6rem', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontFamily: 'Fredoka,sans-serif' }}
                      >
                        messaging
                      </button>
                    </div>

                    {/* Inline edit profile panel */}
                    {openPanel?.name === eName && openPanel?.panel === 'edit' && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #E8DCAB' }}>
                        <div style={{ fontSize: '0.75rem', color: '#8a7d5a', marginBottom: '0.5rem' }}>
                          Changes are onchain (Base gas ~$0.01 each)
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
                                  e.stopPropagation();
                                  setEditValues((prev) => ({
                                    ...prev,
                                    [eName]: { ...(prev[eName] || {}), [f.key]: e.target.value },
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                style={{ flex: 1, minWidth: '120px', padding: '0.3rem 0.5rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.8rem', fontFamily: 'Fredoka,sans-serif', outline: 'none' }}
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); saveField(eName, f.key); }}
                                disabled={isWriting || isConfirming}
                                style={{ padding: '0.3rem 0.6rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'Fredoka,sans-serif' }}
                              >
                                Save
                              </button>
                            </div>
                          );
                        })}
                        <div style={{ fontSize: '0.65rem', color: '#8a7d5a', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                          Avatar tip: for ENS wallets, use format <span style={{ color: '#8a7d5a' }}>eip155:8453/erc721:0xContractAddr/tokenId</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); saveAll(eName); }}
                          disabled={isWriting || isConfirming}
                          style={{ padding: '0.4rem 1rem', background: '#CF3748', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'Fredoka,sans-serif', marginBottom: '0.5rem' }}
                        >
                          Save All Fields
                        </button>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPrimary(eName); }}
                            disabled={isWriting || isConfirming}
                            style={{ padding: '0.3rem 0.6rem', background: 'transparent', color: '#8a7d5a', border: '2px solid #E8DCAB', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'Fredoka,sans-serif' }}
                          >
                            set as primary name
                          </button>
                          <Link
                            to={`/manage?name=${uName}`}
                            style={{ color: '#8a7d5a', fontSize: '0.7rem', textDecoration: 'none', marginLeft: 'auto' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            advanced settings &rarr;
                          </Link>
                        </div>
                        {editStatuses[eName] && (
                          <span style={{ fontSize: '0.75rem', color: '#8a7d5a', display: 'block', marginTop: '0.35rem' }}>
                            {editStatuses[eName]}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Messaging panel */}
                    {openPanel?.name === eName && openPanel?.panel === 'messaging' && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #4870D4' }}>
                        <div style={{ fontSize: '0.8rem', color: '#4870D4', fontWeight: 700, marginBottom: '0.75rem', fontFamily: 'Fredoka,sans-serif' }}>
                          Messaging &mdash; {eName}.hazza.name
                        </div>

                        {/* XMTP address */}
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                          <label style={{ color: '#8a7d5a', fontSize: '0.75rem', minWidth: '65px' }}>XMTP</label>
                          <input
                            type="text"
                            placeholder="0x... your XMTP address"
                            value={editValues[eName]?.['xmtp'] || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              setEditValues((prev) => ({
                                ...prev,
                                [eName]: { ...(prev[eName] || {}), xmtp: e.target.value },
                              }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ flex: 1, minWidth: '120px', padding: '0.3rem 0.5rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.8rem', fontFamily: 'Fredoka,sans-serif', outline: 'none' }}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); saveField(eName, 'xmtp'); }}
                            disabled={isWriting || isConfirming}
                            style={{ padding: '0.3rem 0.6rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'Fredoka,sans-serif' }}
                          >
                            Save
                          </button>
                        </div>

                        {/* Send DM button */}
                        {editValues[eName]?.['xmtp'] && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setChatTarget({ address: editValues[eName]?.['xmtp'] || '', name: eName, context: `Testing DM for ${eName}` });
                            }}
                            style={{ padding: '0.4rem 1rem', background: '#4870D4', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'Fredoka,sans-serif', marginBottom: '0.75rem' }}
                          >
                            Test DM
                          </button>
                        )}

                        {/* Delegate routing */}
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
                                e.stopPropagation();
                                setDelegateSettings((prev) => ({
                                  ...prev,
                                  [eName]: { ...(prev[eName] || { delegate: '', mode: 'all' }), delegate: e.target.value },
                                }));
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ flex: 1, minWidth: '120px', padding: '0.3rem 0.5rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.8rem', fontFamily: 'Fredoka,sans-serif', outline: 'none' }}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const val = delegateSettings[eName]?.delegate || '';
                                setEditStatuses((prev) => ({ ...prev, [eName]: 'Setting message.delegate...' }));
                                setPendingAction({ type: 'setText', name: eName, key: 'message.delegate' });
                                writeContract({ address: REGISTRY_ADDRESS, abi: REGISTRY_ABI, functionName: 'setText', args: [eName, 'message.delegate', val] });
                              }}
                              disabled={isWriting || isConfirming}
                              style={{ padding: '0.3rem 0.6rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'Fredoka,sans-serif' }}
                            >
                              Save
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                            <label style={{ color: '#8a7d5a', fontSize: '0.75rem', minWidth: '65px' }}>Mode</label>
                            <select
                              value={delegateSettings[eName]?.mode || 'all'}
                              onChange={(e) => {
                                e.stopPropagation();
                                setDelegateSettings((prev) => ({
                                  ...prev,
                                  [eName]: { ...(prev[eName] || { delegate: '', mode: 'all' }), mode: e.target.value },
                                }));
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ flex: 1, padding: '0.3rem', borderRadius: '6px', border: '2px solid #E8DCAB', background: '#fff', color: '#131325', fontSize: '0.8rem', fontFamily: 'DM Sans,sans-serif' }}
                            >
                              <option value="all">Receive all directly</option>
                              <option value="delegate-all">Forward all to delegate</option>
                              <option value="delegate-agents">Forward agents, keep human</option>
                            </select>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const val = delegateSettings[eName]?.mode || 'all';
                                setEditStatuses((prev) => ({ ...prev, [eName]: 'Setting message.mode...' }));
                                setPendingAction({ type: 'setText', name: eName, key: 'message.mode' });
                                writeContract({ address: REGISTRY_ADDRESS, abi: REGISTRY_ABI, functionName: 'setText', args: [eName, 'message.mode', val] });
                              }}
                              disabled={isWriting || isConfirming}
                              style={{ padding: '0.3rem 0.6rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'Fredoka,sans-serif' }}
                            >
                              Save
                            </button>
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#8a7d5a', marginTop: '0.25rem' }}>
                            Forward incoming messages to an agent or another name. Delegate must have an XMTP address set.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Inline transfer panel */}
                    {openPanel?.name === eName && openPanel?.panel === 'transfer' && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #E8DCAB' }}>
                        <div style={{ fontSize: '0.8rem', color: '#8a7d5a', marginBottom: '0.5rem' }}>
                          Transfer <strong style={{ color: '#131325' }}>{eName}.hazza.name</strong>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            placeholder="0x... recipient address"
                            value={transferInputs[eName] || ''}
                            onChange={(e) => setTransferInputs((prev) => ({ ...prev, [eName]: e.target.value }))}
                            onClick={(e) => e.stopPropagation()}
                            style={{ flex: 1, minWidth: '200px', padding: '0.4rem 0.5rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: 'Fredoka,sans-serif' }}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); doTransfer(eName, n.tokenId); }}
                            disabled={isWriting || isConfirming}
                            style={{ padding: '0.4rem 1rem', background: '#CF3748', color: '#131325', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Fredoka,sans-serif' }}
                          >
                            Transfer
                          </button>
                        </div>
                        {transferStatuses[eName] && (
                          <span style={{ fontSize: '0.8rem', color: '#8a7d5a', display: 'block', marginTop: '0.35rem' }}>
                            {transferStatuses[eName]}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Inline namespace upgrade panel */}
                    {openPanel?.name === eName && openPanel?.panel === 'namespace' && !n.isNamespace && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #E8DCAB' }}>
                        <div style={{ fontSize: '0.8rem', color: '#8a7d5a', marginBottom: '0.5rem' }}>
                          Enable namespaces on <strong style={{ color: '#131325' }}>{eName}</strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#8a7d5a', marginBottom: '0.5rem' }}>
                          Create subnames like alice.{eName}, bot.{eName}, etc. Each subname costs $1. This is a permanent change and cannot be undone.
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); doNamespace(eName); }}
                            disabled={isWriting || isConfirming}
                            style={{ padding: '0.4rem 1rem', background: '#CF3748', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Fredoka,sans-serif' }}
                          >
                            Enable Namespaces
                          </button>
                          {namespaceStatuses[eName] && (
                            <span style={{ fontSize: '0.8rem', color: '#8a7d5a' }}>
                              {namespaceStatuses[eName]}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
