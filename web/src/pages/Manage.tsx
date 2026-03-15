import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { REGISTRY_ADDRESS, REGISTRY_ABI } from '../config/contracts';
import { API_BASE } from '../constants';

type ProfileData = {
  registered: boolean;
  owner: string;
  operator?: string;
  tokenId: string;
  status: string;
  texts: Record<string, string>;
};

type MyName = {
  name: string;
  tokenId: string;
};

type Offer = {
  price: string;
  currency?: string;
  offerer?: string;
  expiresAt?: number;
  broker?: boolean;
};

type NftItem = {
  name?: string;
  collection: string;
  tokenId: string;
  image: string;
};

export default function Manage() {
  const [searchParams] = useSearchParams();
  const rawNameParam = searchParams.get('name') || '';
  const nameParam = rawNameParam.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ msg: string; isError: boolean } | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isOperator, setIsOperator] = useState(false);
  const [myNames, setMyNames] = useState<MyName[]>([]);
  const [myNamesTotal, setMyNamesTotal] = useState(0);
  const [myNamesLoading, setMyNamesLoading] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoaded, setOffersLoaded] = useState(false);

  // NFT picker state
  const [nftPickerOpen, setNftPickerOpen] = useState(false);
  const [nfts, setNfts] = useState<NftItem[]>([]);
  const [nftPickerStatus, setNftPickerStatus] = useState('');

  // Field values for text records
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  // Operator field
  const [operatorValue, setOperatorValue] = useState('');

  // Custom domain field
  const [domainValue, setDomainValue] = useState('');

  // Website / site key field
  const [siteKeyValue, setSiteKeyValue] = useState('');

  // Agent fields
  const [agentUri, setAgentUri] = useState('');
  const [agentWallet, setAgentWallet] = useState('');

  // Badges fields
  const [helixaId, setHelixaId] = useState('');
  const [netLibraryMember, setNetLibraryMember] = useState('');
  const [netProfileKey, setNetProfileKey] = useState('');

  // API key
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [apiKeyNote, setApiKeyNote] = useState('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  // Transfer
  const [transferTo, setTransferTo] = useState('');
  const [transferStatus, setTransferStatus] = useState('');

  const { writeContract, data: txHash, isPending: isWriting, reset: resetWrite, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const [pendingAction, setPendingAction] = useState<{
    type: string;
    key?: string;
  } | null>(null);

  const showMsg = useCallback((msg: string, isError: boolean) => {
    setStatusMsg({ msg, isError });
    if (!isError) setTimeout(() => setStatusMsg(null), 4000);
  }, []);

  // Load profile
  useEffect(() => {
    if (!nameParam) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${API_BASE}/api/profile/${encodeURIComponent(nameParam)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.registered) {
          setProfileData(null);
        } else {
          setProfileData(data);
          // Fill field values from profile texts
          const t = data.texts || {};
          setFieldValues({
            description: t.description || '',
            avatar: t.avatar || '',
            url: t.url || '',
            'com.twitter': t['com.twitter'] || '',
            'xyz.farcaster': t['xyz.farcaster'] || '',
            'com.github': t['com.github'] || '',
            'org.telegram': t['org.telegram'] || '',
            'com.discord': t['com.discord'] || '',
            'com.linkedin': t['com.linkedin'] || '',
            xmtp: t.xmtp || '',
          });
          // Fill badge fields
          if (t['helixa.id']) setHelixaId(t['helixa.id']);
          if (t['netlibrary.member']) setNetLibraryMember(t['netlibrary.member']);
          if (t['net.profile']) setNetProfileKey(t['net.profile']);
          if (t['site.key']) setSiteKeyValue(t['site.key']);
        }
      })
      .catch(() => {
        showMsg('Error loading profile.', true);
      })
      .finally(() => setLoading(false));
  }, [nameParam, showMsg]);

  // Check ownership
  useEffect(() => {
    if (!profileData || !address) {
      setIsOwner(false);
      setIsOperator(false);
      return;
    }
    const ownerMatch = address.toLowerCase() === profileData.owner.toLowerCase();
    const operatorMatch = profileData.operator
      ? address.toLowerCase() === profileData.operator.toLowerCase()
      : false;
    setIsOwner(ownerMatch);
    setIsOperator(operatorMatch);
  }, [profileData, address]);

  // Load my names
  useEffect(() => {
    if (!address || (!isOwner && !isOperator)) return;
    setMyNamesLoading(true);
    fetch(`${API_BASE}/api/names/${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((data) => {
        setMyNames(data.names || []);
        setMyNamesTotal(data.total || 0);
      })
      .catch(() => {})
      .finally(() => setMyNamesLoading(false));
  }, [address, isOwner, isOperator]);

  // Load offers
  useEffect(() => {
    if (!nameParam || !isOwner) return;
    fetch(`${API_BASE}/api/marketplace/offers/${encodeURIComponent(nameParam)}`)
      .then((r) => r.json())
      .then((data) => {
        setOffers(data.offers || []);
        setOffersLoaded(true);
      })
      .catch(() => {
        setOffersLoaded(true);
      });
  }, [nameParam, isOwner]);

  // Handle confirmed transactions
  useEffect(() => {
    if (!isConfirmed || !pendingAction) return;

    if (pendingAction.type === 'setText') {
      showMsg(`${pendingAction.key} saved!`, false);
    } else if (pendingAction.type === 'setPrimary') {
      showMsg('Primary name set!', false);
    } else if (pendingAction.type === 'setOperator') {
      showMsg('Operator set!', false);
    } else if (pendingAction.type === 'setCustomDomain') {
      showMsg('Custom domain set!', false);
    } else if (pendingAction.type === 'registerAgent') {
      showMsg('Agent registered!', false);
    } else if (pendingAction.type === 'transfer') {
      setTransferStatus('Transferred! Redirecting...');
      setTimeout(() => navigate('/dashboard'), 2000);
    }

    setPendingAction(null);
    resetWrite();
  }, [isConfirmed, pendingAction, resetWrite, showMsg, navigate]);

  // Handle write errors (tx rejection, revert, etc.)
  useEffect(() => {
    if (!writeError || !pendingAction) return;
    const errMsg = (writeError as any).shortMessage || writeError.message || 'Transaction failed';
    const friendlyMsg = errMsg.includes('User rejected') || errMsg.includes('user rejected')
      ? 'Transaction rejected'
      : errMsg;

    if (pendingAction.type === 'transfer') {
      setTransferStatus(friendlyMsg);
      setTimeout(() => setTransferStatus(''), 5000);
    } else {
      showMsg(friendlyMsg, true);
    }

    setPendingAction(null);
    resetWrite();
  }, [writeError, pendingAction, resetWrite, showMsg]);

  // Save a text record
  const saveField = useCallback(
    (key: string, inputKey: string) => {
      const value = fieldValues[inputKey]?.trim() || '';
      showMsg(`Saving ${key}...`, false);
      setPendingAction({ type: 'setText', key });
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'setText',
        args: [nameParam, key, value],
      });
    },
    [fieldValues, nameParam, writeContract, showMsg]
  );

  // Save a badge field (uses setText)
  const saveBadgeField = useCallback(
    (key: string, value: string) => {
      showMsg(`Saving ${key}...`, false);
      setPendingAction({ type: 'setText', key });
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'setText',
        args: [nameParam, key, value.trim()],
      });
    },
    [nameParam, writeContract, showMsg]
  );

  // Set primary name
  const handleSetPrimary = useCallback(() => {
    showMsg('Setting primary name...', false);
    setPendingAction({ type: 'setPrimary' });
    writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'setPrimaryName',
      args: [nameParam],
    });
  }, [nameParam, writeContract, showMsg]);

  // Set operator
  const handleSaveOperator = useCallback(() => {
    if (!operatorValue.trim() || !/^0x[a-fA-F0-9]{40}$/.test(operatorValue.trim())) {
      showMsg('Invalid address.', true);
      return;
    }
    showMsg('Setting operator...', false);
    setPendingAction({ type: 'setOperator' });
    writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'setOperator',
      args: [nameParam, operatorValue.trim() as `0x${string}`],
    });
  }, [nameParam, operatorValue, writeContract, showMsg]);

  // Set custom domain
  const handleSaveDomain = useCallback(() => {
    if (!domainValue.trim()) {
      showMsg('Enter a domain.', true);
      return;
    }
    showMsg('Setting custom domain...', false);
    setPendingAction({ type: 'setCustomDomain' });
    writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'setCustomDomain',
      args: [nameParam, domainValue.trim()],
    });
  }, [nameParam, domainValue, writeContract, showMsg]);

  // Save site key (text record)
  const handleSaveSiteKey = useCallback(() => {
    showMsg('Saving site.key...', false);
    setPendingAction({ type: 'setText', key: 'site.key' });
    writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'setText',
      args: [nameParam, 'site.key', siteKeyValue.trim()],
    });
  }, [nameParam, siteKeyValue, writeContract, showMsg]);

  // Register agent
  const handleRegisterAgent = useCallback(() => {
    if (!agentUri.trim()) {
      showMsg('Enter an agent URI.', true);
      return;
    }
    if (agentWallet.trim() && !/^0x[a-fA-F0-9]{40}$/.test(agentWallet.trim())) {
      showMsg('Invalid agent wallet address.', true);
      return;
    }
    showMsg('Registering agent...', false);
    setPendingAction({ type: 'registerAgent' });
    writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'registerAgent',
      args: [
        nameParam,
        agentUri.trim(),
        (agentWallet.trim() || '0x0000000000000000000000000000000000000000') as `0x${string}`,
      ],
    });
  }, [nameParam, agentUri, agentWallet, writeContract, showMsg]);

  // Generate API Key (off-chain via worker)
  const { signMessageAsync } = useSignMessage();
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

  const handleGenerateKey = useCallback(async () => {
    if (!address) return;
    setApiKeyLoading(true);
    showMsg('Sign the message in your wallet to generate an API key...', false);

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const message = `generate-api-key:${nameParam}:${timestamp}`;
      const signature = await signMessageAsync({ message });

      showMsg('Generating key...', false);
      const res = await fetch(`${API_BASE}/api/keys/${nameParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, signature, timestamp }),
      });

      const data = await res.json();
      if (!res.ok) {
        showMsg(data.error || 'Failed to generate API key', true);
        setApiKeyLoading(false);
        return;
      }

      setApiKeyValue(data.key);
      setApiKeyNote('Copy this key now — it cannot be shown again. Use it as a Bearer token in the Authorization header.');
      setApiKeyVisible(true);
      showMsg('API key generated!', false);
    } catch (err: any) {
      if (err?.name !== 'UserRejectedRequestError' && !err?.message?.includes('User rejected')) {
        showMsg('Failed to generate API key: ' + (err?.shortMessage || err?.message || 'Unknown error'), true);
      } else {
        showMsg('Signature rejected', true);
      }
    }
    setApiKeyLoading(false);
  }, [address, nameParam, signMessageAsync, showMsg]);

  // Copy API key
  const handleCopyKey = useCallback(() => {
    if (apiKeyValue) {
      navigator.clipboard.writeText(apiKeyValue).then(() => showMsg('Copied!', false));
    }
  }, [apiKeyValue, showMsg]);

  // Transfer name
  const handleTransfer = useCallback(() => {
    const to = transferTo.trim();
    if (!to || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
      setTransferStatus('Enter a valid wallet address (0x...)');
      return;
    }
    if (address && to.toLowerCase() === address.toLowerCase()) {
      setTransferStatus('Cannot transfer to yourself');
      return;
    }
    if (!profileData) return;
    if (!window.confirm(`Transfer ${nameParam}.hazza.name to ${to.slice(0, 6)}...${to.slice(-4)}? This is irreversible.`)) return;
    setTransferStatus('Sending transfer...');
    setPendingAction({ type: 'transfer' });
    writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'transferFrom',
      args: [address as `0x${string}`, to as `0x${string}`, BigInt(profileData.tokenId)],
    });
  }, [transferTo, address, profileData, nameParam, writeContract]);

  // NFT picker
  const openNftPicker = useCallback(() => {
    if (!address) {
      showMsg('Connect your wallet first.', true);
      return;
    }
    setNftPickerOpen(true);
    setNfts([]);
    setNftPickerStatus('Loading NFTs...');
    fetch(`${API_BASE}/api/nfts/${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.nfts || data.nfts.length === 0) {
          setNftPickerStatus('No NFTs found in your wallet.');
          return;
        }
        setNftPickerStatus(`${data.nfts.length} NFT${data.nfts.length === 1 ? '' : 's'} found`);
        setNfts(data.nfts);
      })
      .catch(() => {
        setNftPickerStatus('Error loading NFTs.');
      });
  }, [address, showMsg]);

  const selectNft = useCallback(
    (imageUrl: string) => {
      setFieldValues((prev) => ({ ...prev, avatar: imageUrl }));
      setNftPickerOpen(false);
      showMsg('Avatar URL set. Click Save to store it onchain.', false);
    },
    [showMsg]
  );

  // --- Render ---

  if (!nameParam) {
    return (
      <div className="max-w-[720px] mx-auto px-6">
        <div id="manage-body">
          <p style={{ color: '#CF3748', textAlign: 'center' }}>
            No name specified. <Link to="/">Search for a name</Link>
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-[720px] mx-auto px-6">
        <p style={{ color: '#8a7d5a', textAlign: 'center', fontSize: '0.85rem' }}>loading...</p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="max-w-[720px] mx-auto px-6">
        <div id="manage-body">
          <p style={{ color: '#CF3748', textAlign: 'center' }}>
            {nameParam}.hazza.name is not registered.{' '}
            <Link to={`/register?name=${encodeURIComponent(nameParam)}`}>Register it</Link>
          </p>
        </div>
      </div>
    );
  }

  const shortOwner = profileData.owner.slice(0, 6) + '...' + profileData.owner.slice(-4);
  const canManage = isOwner || isOperator;

  return (
    <div className="max-w-[720px] mx-auto px-6">
      <div id="manage-body">
        <div className="header" style={{ borderBottom: '2px solid #E8DCAB' }}>
          <h1 id="manage-name" style={{ wordBreak: 'break-word' }}>
            {nameParam}.hazza.name
          </h1>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: '#8a7d5a' }}>Status</span>{' '}
            <span style={{ color: '#131325' }}>{profileData.status}</span>
          </div>
          <div>
            <span style={{ color: '#8a7d5a' }}>Owner</span>{' '}
            <span style={{ color: '#131325' }}>{shortOwner}</span>
          </div>
        </div>

        {!isConnected && (
          <div id="connect-section" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <p style={{ color: '#8a7d5a' }}>connect your wallet to manage this name</p>
            <p style={{ color: '#8a7d5a', fontSize: '0.85rem' }}>
              tap <strong style={{ color: '#CF3748' }}>connect</strong> in the menu above
            </p>
            <div style={{ marginTop: '1rem' }}>
              <ConnectButton />
            </div>
          </div>
        )}

        {isConnected && !canManage && (
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <p style={{ color: '#CF3748' }}>Connected wallet is not the owner or operator of this name.</p>
          </div>
        )}

        {/* Status message */}
        {statusMsg && (
          <div id="manage-status" style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.9rem', marginBottom: '1rem', color: statusMsg.isError ? '#CF3748' : '#2e7d32' }}>
            {statusMsg.msg}
          </div>
        )}

        {/* My Names */}
        {canManage && myNames.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div className="section">
              <div className="section-title">My Names</div>
              <div id="my-names-list">
                {myNamesLoading && (
                  <span style={{ color: '#8a7d5a', fontSize: '0.85rem' }}>Loading...</span>
                )}
                {myNames.map((n) => {
                  const isCurrent = n.name === nameParam;
                  return (
                    <div
                      key={n.name}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.5rem 0.75rem', background: '#fff',
                        border: `2px solid ${isCurrent ? '#CF3748' : '#E8DCAB'}`,
                        borderRadius: '6px', marginBottom: '0.35rem',
                      }}
                    >
                      <a
                        href={`https://${n.name}.hazza.name`}
                        style={{ color: '#131325', fontWeight: isCurrent ? 700 : 400, fontSize: '0.9rem', textDecoration: 'none' }}
                      >
                        {n.name}<span style={{ color: '#4870D4' }}>.hazza.name</span>
                      </a>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {!isCurrent ? (
                          <Link
                            to={`/manage?name=${encodeURIComponent(n.name)}`}
                            style={{ color: '#8a7d5a', fontSize: '0.75rem', border: '2px solid #E8DCAB', padding: '0.15rem 0.5rem', borderRadius: '4px', textDecoration: 'none' }}
                          >
                            Manage
                          </Link>
                        ) : (
                          <span style={{ color: '#CF3748', fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>Current</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {myNamesTotal > 50 && (
                  <span style={{ color: '#8a7d5a', fontSize: '0.8rem' }}>
                    Showing 50 of {myNamesTotal} names
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit section */}
        {canManage && (
          <div id="edit-section">
            <p style={{ color: '#8a7d5a', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Setting text records costs Base gas (~$0.01 per transaction). Changes are onchain and permanent.
            </p>

            {/* Profile section */}
            <div className="section">
              <div className="section-title">Profile</div>

              {/* Bio */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <label style={{ color: '#8a7d5a', fontSize: '0.85rem', minWidth: '80px' }}>Bio</label>
                <input
                  type="text"
                  placeholder="A short bio..."
                  value={fieldValues.description || ''}
                  onChange={(e) => setFieldValues((prev) => ({ ...prev, description: e.target.value }))}
                  maxLength={500}
                  style={{ flex: 1, minWidth: '150px', padding: '0.5rem 0.75rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.9rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }}
                />
                <button
                  onClick={() => saveField('description', 'description')}
                  disabled={isWriting || isConfirming}
                  style={{ padding: '0.5rem 1rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Fredoka',sans-serif", whiteSpace: 'nowrap' }}
                >
                  Save
                </button>
              </div>

              {/* Avatar with NFT picker */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <label style={{ color: '#8a7d5a', fontSize: '0.85rem', minWidth: '80px' }}>Avatar</label>
                <input
                  type="text"
                  placeholder="https://... image URL"
                  value={fieldValues.avatar || ''}
                  onChange={(e) => setFieldValues((prev) => ({ ...prev, avatar: e.target.value }))}
                  maxLength={2048}
                  style={{ flex: 1, minWidth: '150px', padding: '0.5rem 0.75rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.9rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }}
                />
                <button
                  onClick={() => saveField('avatar', 'avatar')}
                  disabled={isWriting || isConfirming}
                  style={{ padding: '0.5rem 1rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Fredoka',sans-serif", whiteSpace: 'nowrap' }}
                >
                  Save
                </button>
                <button
                  onClick={openNftPicker}
                  style={{ padding: '0.5rem 0.75rem', background: '#fff', color: '#8a7d5a', border: '2px solid #E8DCAB', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: "'Fredoka',sans-serif", whiteSpace: 'nowrap' }}
                  title="Browse your NFTs"
                >
                  NFTs
                </button>
              </div>

              {/* NFT Picker */}
              {nftPickerOpen && (
                <div style={{ marginBottom: '1rem', padding: '1rem', background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ color: '#8a7d5a', fontSize: '0.85rem' }}>Select an NFT as your avatar</span>
                    <button
                      onClick={() => setNftPickerOpen(false)}
                      style={{ background: 'transparent', border: 'none', color: '#8a7d5a', fontSize: '1.2rem', cursor: 'pointer', padding: '0 0.25rem' }}
                    >
                      &times;
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(80px,1fr))', gap: '0.5rem' }}>
                    {nfts.map((nft, i) => (
                      <div
                        key={i}
                        style={{ cursor: 'pointer', position: 'relative' }}
                        title={nft.name || `${nft.collection} #${nft.tokenId}`}
                      >
                        <img
                          src={nft.image}
                          onClick={() => selectNft(nft.image)}
                          style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '2px solid transparent', display: 'block' }}
                          onMouseOver={(e) => { (e.target as HTMLImageElement).style.borderColor = '#CF3748'; }}
                          onMouseOut={(e) => { (e.target as HTMLImageElement).style.borderColor = 'transparent'; }}
                          onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                          alt={nft.name || `${nft.collection} #${nft.tokenId}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    {nftPickerStatus}
                  </div>
                </div>
              )}

              {/* Website */}
              <FieldRow label="Website" recordKey="url" inputKey="url" placeholder="https://..." fieldValues={fieldValues} setFieldValues={setFieldValues} saveField={saveField} disabled={isWriting || isConfirming} maxLength={2048} />
            </div>

            {/* Socials section */}
            <div className="section">
              <div className="section-title">Socials</div>
              <FieldRow label="Twitter" recordKey="com.twitter" inputKey="com.twitter" placeholder="@handle" fieldValues={fieldValues} setFieldValues={setFieldValues} saveField={saveField} disabled={isWriting || isConfirming} maxLength={500} />
              <FieldRow label="Farcaster" recordKey="xyz.farcaster" inputKey="xyz.farcaster" placeholder="@handle" fieldValues={fieldValues} setFieldValues={setFieldValues} saveField={saveField} disabled={isWriting || isConfirming} maxLength={500} />
              <FieldRow label="GitHub" recordKey="com.github" inputKey="com.github" placeholder="username" fieldValues={fieldValues} setFieldValues={setFieldValues} saveField={saveField} disabled={isWriting || isConfirming} maxLength={500} />
              <FieldRow label="Telegram" recordKey="org.telegram" inputKey="org.telegram" placeholder="username" fieldValues={fieldValues} setFieldValues={setFieldValues} saveField={saveField} disabled={isWriting || isConfirming} maxLength={500} />
              <FieldRow label="Discord" recordKey="com.discord" inputKey="com.discord" placeholder="username#1234" fieldValues={fieldValues} setFieldValues={setFieldValues} saveField={saveField} disabled={isWriting || isConfirming} maxLength={500} />
              <FieldRow label="LinkedIn" recordKey="com.linkedin" inputKey="com.linkedin" placeholder="username" fieldValues={fieldValues} setFieldValues={setFieldValues} saveField={saveField} disabled={isWriting || isConfirming} maxLength={500} />
              <FieldRow label="XMTP" recordKey="xmtp" inputKey="xmtp" placeholder="0x... XMTP-enabled address" fieldValues={fieldValues} setFieldValues={setFieldValues} saveField={saveField} disabled={isWriting || isConfirming} maxLength={500} />
              <p style={{ color: '#8a7d5a', fontSize: '0.7rem', marginTop: '-0.25rem', marginBottom: '0.5rem' }}>
                Set your XMTP address to enable private DMs on your profile.{' '}
                <a href="https://xmtp.org" style={{ color: '#4870D4' }} target="_blank" rel="noopener noreferrer">What is XMTP?</a>
              </p>
            </div>

            {/* Message Routing section */}
            <div className="section">
              <div className="section-title">Message Routing</div>
              <FieldRow label="Delegate" recordKey="message.delegate" inputKey="message.delegate" placeholder="hazza name or 0x address" fieldValues={fieldValues} setFieldValues={setFieldValues} saveField={saveField} disabled={isWriting || isConfirming} maxLength={500} />
              <p style={{ color: '#8a7d5a', fontSize: '0.7rem', marginTop: '-0.25rem', marginBottom: '0.5rem' }}>
                Forward incoming messages to another name or address (e.g. your agent).
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ color: '#8a7d5a', fontSize: '0.85rem', minWidth: '80px' }}>Mode</label>
                <select
                  value={fieldValues['message.mode'] || 'all'}
                  onChange={(e) => setFieldValues((prev: Record<string, string>) => ({ ...prev, 'message.mode': e.target.value }))}
                  disabled={isWriting || isConfirming}
                  style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid #d4c896', background: '#FFF9E6', color: '#131325', fontSize: '0.85rem', fontFamily: "'DM Sans',sans-serif" }}
                >
                  <option value="all">Receive all messages directly</option>
                  <option value="delegate-all">Forward all messages to delegate</option>
                  <option value="delegate-agents">Forward agent messages to delegate, keep human messages</option>
                </select>
                <button
                  onClick={() => saveField('message.mode', 'message.mode')}
                  disabled={isWriting || isConfirming || !fieldValues['message.mode']}
                  style={{ padding: '0.4rem 0.75rem', background: '#CF3748', color: '#F7EBBD', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Fredoka',sans-serif" }}
                >
                  Save
                </button>
              </div>
              <p style={{ color: '#8a7d5a', fontSize: '0.7rem', marginTop: '-0.25rem', marginBottom: '0.5rem' }}>
                Controls how incoming messages are routed when a delegate is set.
              </p>
            </div>
          </div>
        )}

        {/* Actions section */}
        {canManage && (
          <div id="actions-section">
            <hr className="divider" />

            {/* Primary Name */}
            <div className="section">
              <div className="section-title">Primary Name</div>
              <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Set this as the primary name for your wallet (reverse resolution).
              </p>
              <button
                onClick={handleSetPrimary}
                disabled={isWriting || isConfirming}
                style={{ padding: '0.5rem 1.5rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif" }}
              >
                Set as Primary
              </button>
            </div>

            <hr className="divider" />

            {/* Operator */}
            <div className="section">
              <div className="section-title">Operator</div>
              <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Grant another address permission to manage this name's records.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="0x..."
                  value={operatorValue}
                  onChange={(e) => setOperatorValue(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.9rem', fontFamily: "'Fredoka',monospace", outline: 'none' }}
                />
                <button
                  onClick={handleSaveOperator}
                  disabled={isWriting || isConfirming}
                  style={{ padding: '0.5rem 1rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif" }}
                >
                  Set
                </button>
              </div>
            </div>

            <hr className="divider" />

            {/* Custom Domain */}
            <div className="section">
              <div className="section-title">Custom Domain</div>
              <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Link a custom domain to resolve to this name (max 10 per name).
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="example.com"
                  value={domainValue}
                  onChange={(e) => setDomainValue(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.9rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }}
                />
                <button
                  onClick={handleSaveDomain}
                  disabled={isWriting || isConfirming}
                  style={{ padding: '0.5rem 1rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif" }}
                >
                  Set
                </button>
              </div>
            </div>

            <hr className="divider" />

            {/* Website */}
            <div className="section">
              <div className="section-title">Website</div>
              <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Host a custom website on your subdomain via <a href="https://netprotocol.app">Net Protocol</a>. Upload HTML to Net Protocol, then paste the storage key here.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="my-site-key"
                  value={siteKeyValue}
                  onChange={(e) => setSiteKeyValue(e.target.value)}
                  maxLength={2048}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.9rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }}
                />
                <button
                  onClick={handleSaveSiteKey}
                  disabled={isWriting || isConfirming}
                  style={{ padding: '0.5rem 1rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif" }}
                >
                  Set
                </button>
              </div>
              <p style={{ color: '#8a7d5a', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                Your subdomain will serve the HTML directly instead of the profile page.
              </p>
            </div>

            <hr className="divider" />

            {/* AI Agent (ERC-8004) */}
            <div className="section">
              <div className="section-title">AI Agent (ERC-8004)</div>
              <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Register an AI agent for this name. Once registered, the agent ID is permanent.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ color: '#8a7d5a', fontSize: '0.85rem', minWidth: '80px' }}>Agent URI</label>
                <input
                  type="text"
                  placeholder="https://... agent metadata"
                  value={agentUri}
                  onChange={(e) => setAgentUri(e.target.value)}
                  maxLength={2048}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.9rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label style={{ color: '#8a7d5a', fontSize: '0.85rem', minWidth: '80px' }}>Wallet</label>
                <input
                  type="text"
                  placeholder="0x... (optional)"
                  value={agentWallet}
                  onChange={(e) => setAgentWallet(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.9rem', fontFamily: "'Fredoka',monospace", outline: 'none' }}
                />
              </div>
              <button
                onClick={handleRegisterAgent}
                disabled={isWriting || isConfirming}
                style={{ padding: '0.5rem 1.5rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif" }}
              >
                Register Agent
              </button>
            </div>

            <hr className="divider" />

            {/* Badges & Identity */}
            <div className="section">
              <div className="section-title">Badges & Identity</div>
              <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Link your onchain identity to display badges and data on your profile.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ color: '#8a7d5a', fontSize: '0.85rem', minWidth: '110px' }}>Helixa ID</label>
                <input
                  type="text"
                  placeholder="e.g. 57"
                  value={helixaId}
                  onChange={(e) => setHelixaId(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.9rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }}
                />
                <button
                  onClick={() => saveBadgeField('helixa.id', helixaId)}
                  disabled={isWriting || isConfirming}
                  style={{ padding: '0.5rem 0.75rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Fredoka',sans-serif" }}
                >
                  Save
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ color: '#8a7d5a', fontSize: '0.85rem', minWidth: '110px' }}>Net Library #</label>
                <input
                  type="text"
                  placeholder="e.g. 1"
                  value={netLibraryMember}
                  onChange={(e) => setNetLibraryMember(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.9rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }}
                />
                <button
                  onClick={() => saveBadgeField('netlibrary.member', netLibraryMember)}
                  disabled={isWriting || isConfirming}
                  style={{ padding: '0.5rem 0.75rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Fredoka',sans-serif" }}
                >
                  Save
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ color: '#8a7d5a', fontSize: '0.85rem', minWidth: '110px' }}>Net Profile Key</label>
                <input
                  type="text"
                  placeholder="storedon.net URL or key"
                  value={netProfileKey}
                  onChange={(e) => setNetProfileKey(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.9rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }}
                />
                <button
                  onClick={() => saveBadgeField('net.profile', netProfileKey)}
                  disabled={isWriting || isConfirming}
                  style={{ padding: '0.5rem 0.75rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Fredoka',sans-serif" }}
                >
                  Save
                </button>
              </div>
              <p style={{ color: '#8a7d5a', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                Exoskeleton ownership is auto-detected from your wallet. Unlimited Pass badge appears automatically.
              </p>
            </div>

            <hr className="divider" />

            {/* API Access */}
            <div className="section">
              <div className="section-title">API Access</div>
              <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Generate an API key to manage this name programmatically.
                Bots, CLIs, and other services can use the key to set text records, update your domain, and more &mdash; no wallet needed.
              </p>
              <button
                onClick={handleGenerateKey}
                disabled={apiKeyLoading}
                style={{ padding: '0.5rem 1.5rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif" }}
              >
                {apiKeyLoading ? 'Generating...' : 'Generate API Key'}
              </button>
              {apiKeyVisible && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#fff', border: '2px solid #CF3748', borderRadius: '8px' }}>
                  {apiKeyValue && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <code style={{ color: '#CF3748', fontSize: '0.8rem', wordBreak: 'break-all', flex: 1 }}>
                        {apiKeyValue}
                      </code>
                      <button
                        onClick={handleCopyKey}
                        style={{ padding: '0.3rem 0.75rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                  {apiKeyNote && (
                    <p style={{ color: '#8a7d5a', fontSize: '0.8rem', lineHeight: 1.5 }}>
                      {apiKeyNote}
                    </p>
                  )}
                </div>
              )}
              <p style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                See <Link to="/docs#write-api">API docs</Link> for endpoints and examples.
              </p>
            </div>

            <hr className="divider" />

            {/* Offers */}
            {isOwner && offersLoaded && (
              <>
                <div className="section">
                  <div className="section-title">Offers</div>
                  <div id="name-offers-list">
                    {offers.length === 0 ? (
                      <p style={{ color: '#8a7d5a', fontSize: '0.85rem' }}>No offers on this name yet.</p>
                    ) : (
                      offers.map((o, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '0.6rem 0', borderBottom: '1px solid #E8DCAB',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 700, color: '#CF3748' }}>
                              {o.price} {o.currency || 'ETH'}
                            </span>
                            {o.broker && (
                              <span style={{ fontSize: '0.65rem', background: '#E8DCAB', color: '#CF3748', padding: '0.1rem 0.3rem', borderRadius: '4px', marginLeft: '0.3rem' }}>
                                brokered
                              </span>
                            )}
                            <div style={{ fontSize: '0.75rem', color: '#8a7d5a' }}>
                              From: {o.offerer ? `${o.offerer.slice(0, 6)}...${o.offerer.slice(-4)}` : '?'} · Expires: {o.expiresAt ? new Date(o.expiresAt * 1000).toLocaleDateString() : '\u2014'}
                            </div>
                          </div>
                          <Link
                            to="/marketplace?tab=offers"
                            style={{ padding: '0.4rem 1rem', background: '#CF3748', color: '#fff', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none' }}
                          >
                            View
                          </Link>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <hr className="divider" />
              </>
            )}

            {/* Transfer */}
            {isOwner && (
              <>
                <div className="section">
                  <div className="section-title">Transfer</div>
                  <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    Transfer ownership of this name to another wallet. This is irreversible.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="0x... recipient address"
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                      style={{ flex: 1, minWidth: '200px', padding: '0.5rem 0.75rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.9rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }}
                    />
                    <button
                      onClick={handleTransfer}
                      disabled={isWriting || isConfirming}
                      style={{ padding: '0.5rem 1.5rem', background: '#CF3748', color: '#131325', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif" }}
                    >
                      Transfer
                    </button>
                  </div>
                  {transferStatus && (
                    <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#8a7d5a' }}>
                      {transferStatus}
                    </p>
                  )}
                </div>
                <hr className="divider" />
              </>
            )}
          </div>
        )}

        {/* View profile link */}
        <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
          <a
            href={nameParam ? `https://${nameParam}.hazza.name` : '#'}
            style={{ color: '#8a7d5a', fontSize: '0.85rem' }}
            target="_blank"
            rel="noopener noreferrer"
          >
            view page &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}

// Reusable field row component matching the managePage fieldRow pattern
function FieldRow({
  label,
  recordKey,
  inputKey,
  placeholder,
  fieldValues,
  setFieldValues,
  saveField,
  disabled,
  maxLength,
}: {
  label: string;
  recordKey: string;
  inputKey: string;
  placeholder: string;
  fieldValues: Record<string, string>;
  setFieldValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saveField: (key: string, inputKey: string) => void;
  disabled: boolean;
  maxLength?: number;
}) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
      <label style={{ color: '#8a7d5a', fontSize: '0.85rem', minWidth: '80px' }}>{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={fieldValues[inputKey] || ''}
        onChange={(e) => setFieldValues((prev) => ({ ...prev, [inputKey]: e.target.value }))}
        maxLength={maxLength}
        style={{ flex: 1, minWidth: '150px', padding: '0.5rem 0.75rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.9rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }}
      />
      <button
        onClick={() => saveField(recordKey, inputKey)}
        disabled={disabled}
        style={{ padding: '0.5rem 1rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Fredoka',sans-serif", whiteSpace: 'nowrap' }}
      >
        Save
      </button>
    </div>
  );
}
