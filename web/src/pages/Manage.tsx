import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { keccak256, toBytes, toHex } from 'viem';
import { REGISTRY_ADDRESS, REGISTRY_ABI } from '../config/contracts';
import { API_BASE, EXPLORER_HOST } from '../constants';

const NET_STORAGE_ADDRESS = '0x00000000db40fcb9f4466330982372e27fd7bbf5' as const;
const NET_STORAGE_ABI = [{
  name: 'put', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'key', type: 'bytes32' }, { name: 'text', type: 'string' }, { name: 'value', type: 'bytes' }],
  outputs: [],
}] as const;

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
  const publicClient = usePublicClient();
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
  const [existingDomains, setExistingDomains] = useState<string[]>([]);

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

  const { writeContract, writeContractAsync, data: txHash, isPending: isWriting, reset: resetWrite, error: writeError } = useWriteContract();
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
          // Fetch custom domains
          fetch(`${API_BASE}/api/domains/${encodeURIComponent(nameParam)}`)
            .then(r => r.json())
            .then(dd => { if (Array.isArray(dd.domains)) setExistingDomains(dd.domains); })
            .catch(() => {});
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

    if (pendingAction.type === 'storeSite') {
      // Storage tx confirmed — now set site.key to the CDN URL
      const cdnUrl = pendingSiteCdnUrl.current;
      if (cdnUrl) {
        setSiteKeyValue(cdnUrl);
        showMsg('Stored onchain! Now setting site.key...', false);
        resetWrite();
        setPendingAction({ type: 'setText', key: 'site.key' });
        writeContract({
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: 'setText',
          args: [nameParam, 'site.key', cdnUrl],
        });
        pendingSiteCdnUrl.current = '';
        return;
      }
    } else if (pendingAction.type === 'setText') {
      showMsg(`${pendingAction.key} saved!`, false);
    } else if (pendingAction.type === 'setPrimary') {
      showMsg('Primary name set!', false);
    } else if (pendingAction.type === 'setOperator') {
      showMsg('Operator set!', false);
    } else if (pendingAction.type === 'setCustomDomain') {
      showMsg('Custom domain set!', false);
      setDomainValue('');
      // Refetch domains
      fetch(`${API_BASE}/api/domains/${encodeURIComponent(nameParam)}`)
        .then(r => r.json())
        .then(dd => { if (Array.isArray(dd.domains)) setExistingDomains(dd.domains); })
        .catch(() => {});
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

  // Site upload state
  const [siteUploading, setSiteUploading] = useState(false);
  const [siteFileName, setSiteFileName] = useState('');
  const pendingSiteCdnUrl = useRef('');

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

  // Upload HTML file directly to Net Protocol Storage contract (user pays gas)
  const handleSiteUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      showMsg('Only .html files are supported.', true);
      return;
    }
    setSiteUploading(true);
    setSiteFileName(file.name);
    showMsg('Preparing upload...', false);
    try {
      const html = await file.text();
      const htmlBytes = new TextEncoder().encode(html);
      const base64 = btoa(String.fromCharCode(...htmlBytes));
      const dataHex = toHex(new TextEncoder().encode(base64));
      const storageKey = keccak256(toBytes(`hazza-site-${nameParam}`));
      const fileName = `${nameParam}.html`;

      // Build CDN URL using the connected wallet address
      const cdnUrl = `https://storedon.net/net/8453/storage/load/${address!.toLowerCase()}/${encodeURIComponent(fileName)}`;
      pendingSiteCdnUrl.current = cdnUrl;

      showMsg(`Storing ${(htmlBytes.length / 1024).toFixed(1)}KB onchain — confirm in your wallet`, false);
      setPendingAction({ type: 'storeSite' });
      writeContract({
        address: NET_STORAGE_ADDRESS,
        abi: NET_STORAGE_ABI,
        functionName: 'put',
        args: [storageKey, fileName, dataHex],
      });
    } catch (e: any) {
      showMsg('Upload failed: ' + (e?.message || 'unknown error'), true);
    }
    setSiteUploading(false);
  }, [nameParam, address, showMsg, writeContract]);

  // Register agent — two-step: register on 8004 directly, then confirm via API
  const handleRegisterAgent = useCallback(async () => {
    if (!agentUri.trim()) {
      showMsg('Enter an agent URI.', true);
      return;
    }
    if (agentWallet.trim() && !/^0x[a-fA-F0-9]{40}$/.test(agentWallet.trim())) {
      showMsg('Invalid agent wallet address.', true);
      return;
    }
    try {
      showMsg('Step 1/2: Registering on ERC-8004...', false);
      const ERC8004_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as `0x${string}`;
      const txHash = await writeContractAsync({
        address: ERC8004_REGISTRY,
        abi: [{ name: 'register', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentURI', type: 'string' }], outputs: [{ type: 'uint256' }] }] as const,
        functionName: 'register',
        args: [agentUri.trim()],
      });
      showMsg('Waiting for confirmation...', false);
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
      // Extract agentId from Transfer event
      let agentId: string | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === ERC8004_REGISTRY.toLowerCase() && log.topics[3]) {
          agentId = BigInt(log.topics[3]).toString();
          break;
        }
      }
      if (!agentId) {
        showMsg('Agent registered but could not read agent ID. Check basescan.', true);
        return;
      }
      showMsg(`Step 2/2: Linking Agent #${agentId} to ${nameParam}...`, false);
      const confirmRes = await fetch(`${API_BASE}/api/agent/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameParam, agentId, txHash, agentWallet: agentWallet.trim() || address }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) {
        showMsg(`Agent #${agentId} registered but linking failed: ${confirmData.error}`, true);
        return;
      }
      showMsg(`Agent #${agentId} registered and linked!`, false);
    } catch (e: any) {
      showMsg('Agent registration failed: ' + (e?.shortMessage || e?.message || 'unknown error'), true);
    }
  }, [nameParam, agentUri, agentWallet, address, writeContractAsync, publicClient, showMsg]);

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
      <div className="manage-page">
        <div id="manage-body">
          <p style={{ color: '#CF3748', textAlign: 'center' }}>
            No name specified. <Link to="/">Search for a name</Link>
          </p>
        </div>
      </div>
    );
  }

  // Batch save all profile + social text records (must be before early returns to maintain hook order)
  const handleSaveAll = useCallback(() => {
    if (!profileData) return;
    const allKeys = [
      'description', 'avatar', 'url',
      'com.twitter', 'xyz.farcaster', 'com.github', 'org.telegram', 'com.discord', 'com.linkedin',
      'xmtp', 'message.delegate', 'message.mode',
    ];
    const keys: string[] = [];
    const values: string[] = [];
    for (const k of allKeys) {
      const v = (fieldValues[k] || '').trim();
      if (v || k in fieldValues) {
        keys.push(k);
        values.push(v);
      }
    }
    // Also include badge fields
    if (helixaId.trim()) { keys.push('helixa.id'); values.push(helixaId.trim()); }
    if (netLibraryMember.trim()) { keys.push('netlibrary.member'); values.push(netLibraryMember.trim()); }
    if (netProfileKey.trim()) { keys.push('net.profile'); values.push(netProfileKey.trim()); }

    if (keys.length === 0) {
      showMsg('No fields to save.', true);
      return;
    }
    showMsg(`Saving ${keys.length} field${keys.length > 1 ? 's' : ''}...`, false);
    setPendingAction({ type: 'setText', key: 'all' });
    writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'setTexts',
      args: [nameParam, keys, values],
    });
  }, [profileData, fieldValues, helixaId, netLibraryMember, netProfileKey, nameParam, writeContract, showMsg]);

  if (loading) {
    return (
      <div className="manage-page">
        <p style={{ color: '#8a7d5a', textAlign: 'center', fontSize: '0.85rem' }}>loading...</p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="manage-page">
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
    <div className="manage-page">
      <div id="manage-body">
        <div className="header" style={{ background: '#4870D4', padding: '1rem 1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <h1 id="manage-name" style={{ color: '#fff', wordBreak: 'break-word', fontSize: '1.5rem' }}>
            {nameParam}<span style={{ color: 'rgba(255,255,255,0.7)' }}>.hazza.name</span>
          </h1>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-block', padding: '0.15rem 0.6rem',
            background: 'rgba(0,230,118,0.15)', borderRadius: 12,
            fontSize: '0.75rem', fontWeight: 600, color: '#1B7A3D',
            fontFamily: "'Fredoka', sans-serif",
          }}>
            {profileData.status}
          </span>
          <a
            href={`https://${EXPLORER_HOST}/address/${profileData.owner}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block', padding: '0.15rem 0.6rem',
              background: '#fff', border: '1px solid #E8DCAB', borderRadius: 12,
              fontSize: '0.75rem', color: '#8a7d5a', textDecoration: 'none',
              fontFamily: "'Fredoka', sans-serif",
            }}
          >
            owner: {shortOwner}
          </a>
        </div>

        {!isConnected && (
          <div id="connect-section" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <p style={{ color: '#8a7d5a' }}>connect your wallet to manage this name</p>
            <div style={{ marginTop: '1rem' }}>
              <ConnectButton />
            </div>
          </div>
        )}

        {isConnected && !canManage && (
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <p style={{ color: '#CF3748', fontSize: '0.85rem' }}>Connected wallet is not the owner or operator of this name.</p>
          </div>
        )}

        {/* Status message */}
        {statusMsg && (
          <div id="manage-status" style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.85rem', marginBottom: '1rem', color: statusMsg.isError ? '#CF3748' : '#1B7A3D', fontFamily: "'Fredoka', sans-serif" }}>
            {statusMsg.msg}
          </div>
        )}

        {/* Edit section — all text records */}
        {canManage && (
          <div id="edit-section">
            <div style={{ background: '#FFF3CD', border: '1px solid #E8DCAB', borderRadius: '8px', padding: '0.6rem 0.75rem', marginBottom: '1rem', fontSize: '0.75rem', color: '#856404' }}>
              Changes are saved onchain via a Base transaction (~$0.01 gas).
            </div>

            {/* Profile */}
            <div className="section">
              <div className="section-title">Profile</div>
              <FieldInput label="Bio" inputKey="description" placeholder="A short bio..." fieldValues={fieldValues} setFieldValues={setFieldValues} />
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <label style={{ color: '#8a7d5a', fontSize: '0.85rem', minWidth: '80px' }}>Avatar</label>
                <input
                  type="text"
                  placeholder="https://... image URL"
                  value={fieldValues.avatar || ''}
                  onChange={(e) => setFieldValues((prev) => ({ ...prev, avatar: e.target.value }))}
                  maxLength={2048}
                  style={{ flex: 1, minWidth: '150px', padding: '0.4rem 0.6rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }}
                />
                <button
                  onClick={openNftPicker}
                  style={{ padding: '0.4rem 0.6rem', background: '#fff', color: '#8a7d5a', border: '2px solid #E8DCAB', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: "'Fredoka',sans-serif", whiteSpace: 'nowrap' }}
                  title="Browse your NFTs"
                >
                  NFTs
                </button>
              </div>
              {/* NFT Picker */}
              {nftPickerOpen && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#8a7d5a', fontSize: '0.8rem' }}>Select an NFT as your avatar</span>
                    <button onClick={() => setNftPickerOpen(false)} style={{ background: 'transparent', border: 'none', color: '#8a7d5a', fontSize: '1.2rem', cursor: 'pointer' }}>&times;</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(70px,1fr))', gap: '0.4rem' }}>
                    {nfts.map((nft, i) => (
                      <img
                        key={i}
                        src={nft.image}
                        onClick={() => selectNft(nft.image)}
                        style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '6px', border: '2px solid transparent', display: 'block', cursor: 'pointer' }}
                        onMouseOver={(e) => { (e.target as HTMLImageElement).style.borderColor = '#CF3748'; }}
                        onMouseOut={(e) => { (e.target as HTMLImageElement).style.borderColor = 'transparent'; }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        alt={nft.name || `${nft.collection} #${nft.tokenId}`}
                        title={nft.name || `${nft.collection} #${nft.tokenId}`}
                      />
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', color: '#8a7d5a', fontSize: '0.75rem', marginTop: '0.4rem' }}>{nftPickerStatus}</div>
                </div>
              )}
              <FieldInput label="Website" inputKey="url" placeholder="https://..." fieldValues={fieldValues} setFieldValues={setFieldValues} />
            </div>

            {/* Socials */}
            <div className="section">
              <div className="section-title">Socials</div>
              <FieldInput label="Twitter" inputKey="com.twitter" placeholder="@handle" fieldValues={fieldValues} setFieldValues={setFieldValues} />
              <FieldInput label="Farcaster" inputKey="xyz.farcaster" placeholder="@handle" fieldValues={fieldValues} setFieldValues={setFieldValues} />
              <FieldInput label="GitHub" inputKey="com.github" placeholder="username" fieldValues={fieldValues} setFieldValues={setFieldValues} />
              <FieldInput label="Telegram" inputKey="org.telegram" placeholder="username" fieldValues={fieldValues} setFieldValues={setFieldValues} />
              <FieldInput label="Discord" inputKey="com.discord" placeholder="username#1234" fieldValues={fieldValues} setFieldValues={setFieldValues} />
              <FieldInput label="LinkedIn" inputKey="com.linkedin" placeholder="username" fieldValues={fieldValues} setFieldValues={setFieldValues} />
              <FieldInput label="XMTP" inputKey="xmtp" placeholder="0x... XMTP-enabled address" fieldValues={fieldValues} setFieldValues={setFieldValues} />
              <p style={{ color: '#8a7d5a', fontSize: '0.7rem', marginTop: '-0.25rem' }}>
                Set your XMTP address to enable private DMs on your profile.{' '}
                <a href="https://xmtp.org" style={{ color: '#4870D4' }} target="_blank" rel="noopener noreferrer">What is XMTP?</a>
              </p>
            </div>

            {/* Message Routing */}
            <div className="section">
              <div className="section-title">Message Routing</div>
              <FieldInput label="Delegate" inputKey="message.delegate" placeholder="hazza name or 0x address" fieldValues={fieldValues} setFieldValues={setFieldValues} />
              <p style={{ color: '#8a7d5a', fontSize: '0.7rem', marginTop: '-0.25rem', marginBottom: '0.5rem' }}>
                Forward incoming messages to another name or address (e.g. your agent).
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ color: '#8a7d5a', fontSize: '0.85rem', minWidth: '80px' }}>Mode</label>
                <select
                  value={fieldValues['message.mode'] || 'all'}
                  onChange={(e) => setFieldValues((prev: Record<string, string>) => ({ ...prev, 'message.mode': e.target.value }))}
                  disabled={isWriting || isConfirming}
                  style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '2px solid #E8DCAB', background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: "'DM Sans',sans-serif" }}
                >
                  <option value="all">Receive all messages directly</option>
                  <option value="delegate-all">Forward all messages to delegate</option>
                  <option value="delegate-agents">Forward agent messages to delegate, keep human messages</option>
                </select>
              </div>
            </div>

            {/* Badges & Identity */}
            <div className="section">
              <div className="section-title">Badges</div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <label style={{ color: '#8a7d5a', fontSize: '0.85rem', minWidth: '80px' }}>Helixa ID</label>
                <input type="text" placeholder="e.g. 57" value={helixaId} onChange={(e) => setHelixaId(e.target.value)}
                  style={{ flex: 1, minWidth: '80px', padding: '0.4rem 0.6rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <label style={{ color: '#8a7d5a', fontSize: '0.85rem', minWidth: '80px' }}>Net Library</label>
                <input type="text" placeholder="member #" value={netLibraryMember} onChange={(e) => setNetLibraryMember(e.target.value)}
                  style={{ flex: 1, minWidth: '80px', padding: '0.4rem 0.6rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <label style={{ color: '#8a7d5a', fontSize: '0.85rem', minWidth: '80px' }}>Net Profile</label>
                <input type="text" placeholder="storage key" value={netProfileKey} onChange={(e) => setNetProfileKey(e.target.value)}
                  style={{ flex: 1, minWidth: '80px', padding: '0.4rem 0.6rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }} />
              </div>
              <p style={{ color: '#8a7d5a', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                Exoskeleton and Unlimited Pass badges are auto-detected from your wallet.
              </p>
            </div>

            {/* Save All button */}
            <button
              onClick={handleSaveAll}
              disabled={isWriting || isConfirming}
              style={{ width: '100%', padding: '0.65rem', background: '#CF3748', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', fontFamily: "'Fredoka',sans-serif", marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(207,55,72,0.25)' }}
            >
              {isWriting || isConfirming ? 'Saving...' : 'Save All Records'}
            </button>
          </div>
        )}

        {/* Advanced Settings */}
        {canManage && (
          <div>
            <div className="section-title" style={{ color: '#8a7d5a', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Advanced</div>

            {/* Primary Name */}
            <div className="section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#131325', fontFamily: "'Fredoka',sans-serif" }}>Primary Name</div>
                  <p style={{ color: '#8a7d5a', fontSize: '0.75rem', margin: '0.15rem 0 0' }}>Set as your wallet's reverse-resolved name</p>
                </div>
                <button onClick={handleSetPrimary} disabled={isWriting || isConfirming}
                  style={{ padding: '0.35rem 0.75rem', background: '#CF3748', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'Fredoka',sans-serif", whiteSpace: 'nowrap' }}>
                  Set Primary
                </button>
              </div>
            </div>

            {/* Operator */}
            <div className="section">
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#131325', fontFamily: "'Fredoka',sans-serif", marginBottom: '0.25rem' }}>Operator</div>
              <p style={{ color: '#8a7d5a', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>Grant another address permission to manage records</p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="text" placeholder="0x..." value={operatorValue} onChange={(e) => setOperatorValue(e.target.value)}
                  style={{ flex: 1, padding: '0.4rem 0.6rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: "'Fredoka',monospace", outline: 'none' }} />
                <button onClick={handleSaveOperator} disabled={isWriting || isConfirming}
                  style={{ padding: '0.35rem 0.75rem', background: '#CF3748', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'Fredoka',sans-serif" }}>Set</button>
              </div>
            </div>

            {/* Custom Domain */}
            <div className="section">
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#131325', fontFamily: "'Fredoka',sans-serif", marginBottom: '0.25rem' }}>Custom Domain</div>
              <p style={{ color: '#8a7d5a', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>Link a domain to resolve to this name (max 10)</p>
              {existingDomains.length > 0 && (
                <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {existingDomains.map(d => (
                    <span key={d} style={{ display: 'inline-block', padding: '0.2rem 0.5rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '4px', fontSize: '0.75rem', color: '#166534', fontFamily: "'Fredoka',sans-serif" }}>
                      {d}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="text" placeholder="example.com" value={domainValue} onChange={(e) => setDomainValue(e.target.value)}
                  style={{ flex: 1, padding: '0.4rem 0.6rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }} />
                <button onClick={handleSaveDomain} disabled={isWriting || isConfirming}
                  style={{ padding: '0.35rem 0.75rem', background: '#CF3748', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'Fredoka',sans-serif" }}>Add</button>
              </div>
            </div>

            {/* Onchain Website */}
            <div className="section">
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#131325', fontFamily: "'Fredoka',sans-serif", marginBottom: '0.25rem' }}>Onchain Website</div>
              <p style={{ color: '#8a7d5a', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>
                Replace your profile with a custom HTML page — stored permanently onchain via <a href="https://netprotocol.app" target="_blank" rel="noopener noreferrer" style={{ color: '#4870D4' }}>Net Protocol</a>
              </p>

              {/* Upload area */}
              <div
                style={{ border: '2px dashed #E8DCAB', borderRadius: '8px', padding: '1rem', textAlign: 'center', cursor: siteUploading ? 'wait' : 'pointer', background: '#FFFDF5', marginBottom: '0.5rem', transition: 'border-color 0.2s' }}
                onClick={() => { if (!siteUploading) document.getElementById('site-file-input')?.click(); }}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#4870D4'; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = '#E8DCAB'; }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = '#E8DCAB';
                  const file = e.dataTransfer.files[0];
                  if (file) handleSiteUpload(file);
                }}
              >
                <input id="site-file-input" type="file" accept=".html,.htm" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSiteUpload(f); e.target.value = ''; }} />
                {siteUploading ? (
                  <span style={{ color: '#4870D4', fontSize: '0.8rem', fontFamily: "'Fredoka',sans-serif" }}>Uploading {siteFileName}...</span>
                ) : (
                  <>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📄</div>
                    <div style={{ color: '#131325', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Fredoka',sans-serif" }}>
                      Drop an HTML file here or click to upload
                    </div>
                    <div style={{ color: '#8a7d5a', fontSize: '0.7rem', marginTop: '0.25rem' }}>Stored on Base forever via Net Protocol — the larger the file, the more it costs in gas</div>
                  </>
                )}
              </div>

              {/* Or paste a URL/key manually */}
              <details style={{ marginTop: '0.25rem' }}>
                <summary style={{ color: '#8a7d5a', fontSize: '0.7rem', cursor: 'pointer', fontFamily: "'Fredoka',sans-serif" }}>
                  Or paste a URL / storage key manually
                </summary>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.4rem' }}>
                  <input type="text" placeholder="https://... or storage key" value={siteKeyValue} onChange={(e) => setSiteKeyValue(e.target.value)} maxLength={2048}
                    style={{ flex: 1, padding: '0.4rem 0.6rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }} />
                  <button onClick={handleSaveSiteKey} disabled={isWriting || isConfirming}
                    style={{ padding: '0.35rem 0.75rem', background: '#CF3748', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'Fredoka',sans-serif" }}>Set</button>
                </div>
              </details>

              {/* Current site indicator */}
              {siteKeyValue && (
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#22c55e', fontSize: '0.75rem' }}>●</span>
                  <span style={{ color: '#8a7d5a', fontSize: '0.7rem', fontFamily: "'Fredoka',sans-serif" }}>
                    Custom site active — <a href={`https://${nameParam}.hazza.name`} target="_blank" rel="noopener noreferrer" style={{ color: '#4870D4' }}>view live</a>
                  </span>
                  <button onClick={() => { setSiteKeyValue(''); handleSaveSiteKey(); }} style={{ marginLeft: 'auto', padding: '0.2rem 0.5rem', background: 'transparent', color: '#CF3748', border: '1px solid #CF3748', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', fontFamily: "'Fredoka',sans-serif" }}>Remove</button>
                </div>
              )}
            </div>

            {/* Agent */}
            <div className="section">
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#131325', fontFamily: "'Fredoka',sans-serif", marginBottom: '0.25rem' }}>Agent Identity</div>
              {profileData?.texts?.['agent.8004id'] ? (
                <>
                  <div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '8px', padding: '0.5rem 0.75rem', marginBottom: '0.5rem' }}>
                    <p style={{ color: '#166534', fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>Agent #{profileData.texts['agent.8004id']}</p>
                    {profileData.texts['agent.wallet'] && <p style={{ color: '#8a7d5a', fontSize: '0.7rem', margin: '0.2rem 0 0' }}>Wallet: {profileData.texts['agent.wallet']}</p>}
                    {profileData.texts['agent.status'] && <p style={{ color: '#8a7d5a', fontSize: '0.7rem', margin: '0.2rem 0 0' }}>Status: {profileData.texts['agent.status']}</p>}
                  </div>
                  <p style={{ color: '#8a7d5a', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>Manage agent metadata in Text Records above.</p>
                </>
              ) : (
                <>
                  <p style={{ color: '#8a7d5a', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>Give this name a discoverable onchain agent identity.</p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                    <label style={{ color: '#8a7d5a', fontSize: '0.8rem', minWidth: '65px' }}>URI</label>
                    <input type="text" placeholder={`https://${nameParam}.hazza.name`} value={agentUri} onChange={(e) => setAgentUri(e.target.value)} maxLength={2048}
                      style={{ flex: 1, minWidth: '150px', padding: '0.4rem 0.6rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <label style={{ color: '#8a7d5a', fontSize: '0.8rem', minWidth: '65px' }}>Wallet</label>
                    <input type="text" placeholder="0x... (defaults to your wallet)" value={agentWallet} onChange={(e) => setAgentWallet(e.target.value)}
                      style={{ flex: 1, minWidth: '150px', padding: '0.4rem 0.6rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: "'Fredoka',monospace", outline: 'none' }} />
                  </div>
                  <button onClick={handleRegisterAgent} disabled={isWriting || isConfirming}
                    style={{ padding: '0.35rem 0.75rem', background: '#CF3748', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'Fredoka',sans-serif" }}>
                    Register an Agent
                  </button>
                </>
              )}
            </div>

            {/* API Access */}
            <div className="section">
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#131325', fontFamily: "'Fredoka',sans-serif", marginBottom: '0.25rem' }}>API Access</div>
              <p style={{ color: '#8a7d5a', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>
                Generate an API key for programmatic access. See <Link to="/docs#write-api" style={{ color: '#4870D4' }}>docs</Link>.
              </p>
              <button onClick={handleGenerateKey} disabled={apiKeyLoading}
                style={{ padding: '0.35rem 0.75rem', background: '#CF3748', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'Fredoka',sans-serif" }}>
                {apiKeyLoading ? 'Generating...' : 'Generate Key'}
              </button>
              {apiKeyVisible && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#fff', border: '2px solid #CF3748', borderRadius: '8px' }}>
                  {apiKeyValue && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <code style={{ color: '#CF3748', fontSize: '0.75rem', wordBreak: 'break-all', flex: 1 }}>{apiKeyValue}</code>
                      <button onClick={handleCopyKey}
                        style={{ padding: '0.25rem 0.5rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>Copy</button>
                    </div>
                  )}
                  {apiKeyNote && <p style={{ color: '#8a7d5a', fontSize: '0.75rem', lineHeight: 1.5 }}>{apiKeyNote}</p>}
                </div>
              )}
            </div>

            {/* Offers */}
            {isOwner && offersLoaded && offers.length > 0 && (
              <div className="section">
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#131325', fontFamily: "'Fredoka',sans-serif", marginBottom: '0.5rem' }}>Offers</div>
                {offers.map((o, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #E8DCAB' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#CF3748', fontSize: '0.85rem' }}>{o.price} {o.currency || 'ETH'}</span>
                      {o.broker && <span style={{ fontSize: '0.6rem', background: '#E8DCAB', color: '#CF3748', padding: '0.1rem 0.3rem', borderRadius: '4px', marginLeft: '0.3rem' }}>brokered</span>}
                      <div style={{ fontSize: '0.7rem', color: '#8a7d5a' }}>
                        {o.offerer ? `${o.offerer.slice(0, 6)}...${o.offerer.slice(-4)}` : '?'} · {o.expiresAt ? new Date(o.expiresAt * 1000).toLocaleDateString() : '\u2014'}
                      </div>
                    </div>
                    <Link to="/marketplace?tab=offers" style={{ padding: '0.3rem 0.6rem', background: '#CF3748', color: '#fff', borderRadius: '6px', fontWeight: 700, fontSize: '0.7rem', textDecoration: 'none' }}>View</Link>
                  </div>
                ))}
              </div>
            )}

            {/* Transfer */}
            {isOwner && (
              <div className="section">
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#CF3748', fontFamily: "'Fredoka',sans-serif", marginBottom: '0.25rem' }}>Transfer</div>
                <p style={{ color: '#8a7d5a', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>Transfer ownership to another wallet. This is irreversible.</p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="text" placeholder="0x... recipient" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}
                    style={{ flex: 1, minWidth: '180px', padding: '0.4rem 0.6rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }} />
                  <button onClick={handleTransfer} disabled={isWriting || isConfirming}
                    style={{ padding: '0.35rem 0.75rem', background: '#4870D4', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'Fredoka',sans-serif" }}>Transfer</button>
                </div>
                {transferStatus && <p style={{ fontSize: '0.75rem', marginTop: '0.4rem', color: '#8a7d5a' }}>{transferStatus}</p>}
              </div>
            )}
          </div>
        )}

        {/* View profile link */}
        <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
          <a href={`https://${nameParam}.hazza.name`} style={{ color: '#8a7d5a', fontSize: '0.8rem' }} target="_blank" rel="noopener noreferrer">
            view profile &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}

// Input-only field row (no individual save button)
function FieldInput({
  label, inputKey, placeholder, fieldValues, setFieldValues,
}: {
  label: string; inputKey: string; placeholder: string;
  fieldValues: Record<string, string>;
  setFieldValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
      <label style={{ color: '#8a7d5a', fontSize: '0.85rem', minWidth: '80px' }}>{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={fieldValues[inputKey] || ''}
        onChange={(e) => setFieldValues((prev) => ({ ...prev, [inputKey]: e.target.value }))}
        style={{ flex: 1, minWidth: '150px', padding: '0.4rem 0.6rem', border: '2px solid #E8DCAB', borderRadius: '6px', background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: "'Fredoka',sans-serif", outline: 'none' }}
      />
    </div>
  );
}
