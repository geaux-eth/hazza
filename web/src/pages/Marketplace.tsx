import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseEther, formatEther, formatUnits, type Address } from 'viem';
import {
  REGISTRY_ADDRESS, SEAPORT_ADDRESS, BAZAAR_ADDRESS,
  MARKETPLACE_FEE_BPS, TREASURY_ADDRESS, ERC721_ABI, USDC_ADDRESS,
  BOUNTY_ESCROW_ADDRESS,
} from '../config/contracts';
import { API_BASE } from '../constants';
import ChatPanel from '../components/ChatPanel';
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as const;
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
const ZONE_PUBLIC = '0x000000007F8c58fbf215bF91Bda7421A806cf3ae' as const;
const BATCH_EXECUTOR_ADDRESS = '' as const; // Set if deployed

// --- ABIs ---

const SEAPORT_ABI = [
  { name: 'fulfillOrder', type: 'function', stateMutability: 'payable',
    inputs: [{ name: 'order', type: 'tuple', components: [
      { name: 'parameters', type: 'tuple', components: [
        { name: 'offerer', type: 'address' }, { name: 'zone', type: 'address' },
        { name: 'offer', type: 'tuple[]', components: [{ name: 'itemType', type: 'uint8' }, { name: 'token', type: 'address' }, { name: 'identifierOrCriteria', type: 'uint256' }, { name: 'startAmount', type: 'uint256' }, { name: 'endAmount', type: 'uint256' }] },
        { name: 'consideration', type: 'tuple[]', components: [{ name: 'itemType', type: 'uint8' }, { name: 'token', type: 'address' }, { name: 'identifierOrCriteria', type: 'uint256' }, { name: 'startAmount', type: 'uint256' }, { name: 'endAmount', type: 'uint256' }, { name: 'recipient', type: 'address' }] },
        { name: 'orderType', type: 'uint8' }, { name: 'startTime', type: 'uint256' }, { name: 'endTime', type: 'uint256' },
        { name: 'zoneHash', type: 'bytes32' }, { name: 'salt', type: 'uint256' }, { name: 'conduitKey', type: 'bytes32' }, { name: 'totalOriginalConsiderationItems', type: 'uint256' }
      ]},
      { name: 'signature', type: 'bytes' }
    ]}, { name: 'fulfillerConduitKey', type: 'bytes32' }],
    outputs: [{ name: 'fulfilled', type: 'bool' }]
  },
  { name: 'cancel', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'orders', type: 'tuple[]', components: [
      { name: 'offerer', type: 'address' }, { name: 'zone', type: 'address' },
      { name: 'offer', type: 'tuple[]', components: [{ name: 'itemType', type: 'uint8' }, { name: 'token', type: 'address' }, { name: 'identifierOrCriteria', type: 'uint256' }, { name: 'startAmount', type: 'uint256' }, { name: 'endAmount', type: 'uint256' }] },
      { name: 'consideration', type: 'tuple[]', components: [{ name: 'itemType', type: 'uint8' }, { name: 'token', type: 'address' }, { name: 'identifierOrCriteria', type: 'uint256' }, { name: 'startAmount', type: 'uint256' }, { name: 'endAmount', type: 'uint256' }, { name: 'recipient', type: 'address' }] },
      { name: 'orderType', type: 'uint8' }, { name: 'startTime', type: 'uint256' }, { name: 'endTime', type: 'uint256' },
      { name: 'zoneHash', type: 'bytes32' }, { name: 'salt', type: 'uint256' }, { name: 'conduitKey', type: 'bytes32' }, { name: 'totalOriginalConsiderationItems', type: 'uint256' },
      { name: 'counter', type: 'uint256' }
    ]}],
    outputs: [{ name: 'cancelled', type: 'bool' }]
  },
  { name: 'getCounter', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'offerer', type: 'address' }], outputs: [{ type: 'uint256' }]
  },
] as const;

const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const;

const BAZAAR_SUBMIT_ABI = [{
  name: 'submit', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'submission', type: 'tuple', components: [
    { name: 'parameters', type: 'tuple', components: [
      { name: 'offerer', type: 'address' }, { name: 'zone', type: 'address' },
      { name: 'offer', type: 'tuple[]', components: [{ name: 'itemType', type: 'uint8' }, { name: 'token', type: 'address' }, { name: 'identifierOrCriteria', type: 'uint256' }, { name: 'startAmount', type: 'uint256' }, { name: 'endAmount', type: 'uint256' }] },
      { name: 'consideration', type: 'tuple[]', components: [{ name: 'itemType', type: 'uint8' }, { name: 'token', type: 'address' }, { name: 'identifierOrCriteria', type: 'uint256' }, { name: 'startAmount', type: 'uint256' }, { name: 'endAmount', type: 'uint256' }, { name: 'recipient', type: 'address' }] },
      { name: 'orderType', type: 'uint8' }, { name: 'startTime', type: 'uint256' }, { name: 'endTime', type: 'uint256' },
      { name: 'zoneHash', type: 'bytes32' }, { name: 'salt', type: 'uint256' }, { name: 'conduitKey', type: 'bytes32' }, { name: 'totalOriginalConsiderationItems', type: 'uint256' }
    ]},
    { name: 'counter', type: 'uint256' },
    { name: 'signature', type: 'bytes' }
  ]}], outputs: []
}] as const;

const BATCH_EXECUTOR_ABI = [
  { name: 'executeBatch', type: 'function', stateMutability: 'payable',
    inputs: [
      { name: 'tokens', type: 'tuple[]', components: [
        { name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'spender', type: 'address' }
      ]},
      { name: 'calls', type: 'tuple[]', components: [
        { name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }
      ]}
    ],
    outputs: [{ name: 'results', type: 'tuple[]', components: [
      { name: 'success', type: 'bool' }, { name: 'returnData', type: 'bytes' }
    ]}]
  },
] as const;


const BOUNTY_ESCROW_ABI = [
  { name: 'registerBounty', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'bountyAmount', type: 'uint256' }],
    outputs: []
  },
  { name: 'registerBounty', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'bountyAmount', type: 'uint256' }, { name: 'agent', type: 'address' }],
    outputs: []
  },
  { name: 'cancelBounty', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: []
  },
] as const;

// --- Types ---

interface Listing {
  orderHash: string;
  name: string;
  price: string;
  currency: string;
  seller: string;
  listingExpiry: number;
  isNamespace: boolean;
  profileUrl: string;
  tokenId?: string;
  bountyAmount?: string;
}

interface CartItem {
  id: string;
  type: 'Buy' | 'List';
  name: string;
  price: string;
  currency: string;
  orderHash?: string;
  tokenId?: string;
}

interface WatchItem {
  orderHash: string;
  name: string;
  price: string;
  currency: string;
}

interface UserName {
  name: string;
  tokenId: string;
  status: string;
}

interface Offer {
  name: string;
  offerer: string;
  owner: string;
  price: string;
  currency: string;
  expiresAt: number;
  orderComponents?: any;
  signature?: string;
  broker?: boolean;
}

interface CollectionOffer {
  orderHash: string;
  offerer: string;
  price: string;
  currency: string;
  expirationDate: number;
}

interface Sale {
  name: string;
  price: number;
  currency: string;
  buyer: string;
  seller: string;
  timestamp: number;
}

interface BoardMessage {
  text: string;
  author: string;
  authorName?: string;
  timestamp: number;
}

interface ProgressStep {
  text: string;
  status: 'active' | 'done' | 'error';
}

// --- Helpers ---

function truncAddr(a: string) { return a ? a.slice(0, 6) + '...' + a.slice(-4) : ''; }
function formatDate(ts: number) { return ts ? new Date(ts * 1000).toLocaleDateString() : '\u2014'; }
function generateSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}

// --- Seaport EIP-712 ---

const SEAPORT_DOMAIN = {
  name: 'Seaport' as const,
  version: '1.6' as const,
  chainId: 8453,
  verifyingContract: SEAPORT_ADDRESS,
};

const SEAPORT_EIP712_TYPES = {
  OrderComponents: [
    { name: 'offerer', type: 'address' },
    { name: 'zone', type: 'address' },
    { name: 'offer', type: 'OfferItem[]' },
    { name: 'consideration', type: 'ConsiderationItem[]' },
    { name: 'orderType', type: 'uint8' },
    { name: 'startTime', type: 'uint256' },
    { name: 'endTime', type: 'uint256' },
    { name: 'zoneHash', type: 'bytes32' },
    { name: 'salt', type: 'uint256' },
    { name: 'conduitKey', type: 'bytes32' },
    { name: 'counter', type: 'uint256' },
  ],
  OfferItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' },
  ],
  ConsiderationItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' },
    { name: 'recipient', type: 'address' },
  ],
} as const;

// --- Tab type ---

type TabKey = 'browse' | 'mynames' | 'offers' | 'sales' | 'forum' | 'donate';

// ============================================================
// Sub-components
// ============================================================

// --- Share Modal ---

function ShareModal({ name, onClose }: { name: string; onClose: () => void }) {
  const url = `https://${name}.hazza.name`;
  const text = `Check out ${name}.hazza.name`;
  const [copied, setCopied] = useState(false);

  function copyUrl() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(onClose, 1200);
    });
  }

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: 12, padding: '1.5rem', maxWidth: 320, width: '90%', textAlign: 'center' }}>
        <div style={{ fontSize: '1rem', color: '#131325', marginBottom: '1rem', fontFamily: "Fredoka, sans-serif" }}>
          Share <strong style={{ color: '#CF3748' }}>{name}.hazza.name</strong>
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', gap: '0.3rem' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="#131325">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span style={{ color: '#8a7d5a', fontSize: '0.7rem', fontFamily: 'Fredoka, sans-serif' }}>Twitter</span>
          </a>
          <a
            href={`https://warpcast.com/~/compose?text=${encodeURIComponent(text + ' ' + url)}`}
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', gap: '0.3rem' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="#4870D4">
              <path d="M3.77 2h16.46C21.21 2 22 2.79 22 3.77v16.46c0 .98-.79 1.77-1.77 1.77H3.77C2.79 22 2 21.21 2 20.23V3.77C2 2.79 2.79 2 3.77 2zm3.48 4.3L5.6 12.26h2.18l.89 5.44h2.07l1.26-7.4 1.26 7.4h2.07l.89-5.44h2.18L16.75 6.3h-2.82l-.93 5.5-.93-5.5H8.07z"/>
            </svg>
            <span style={{ color: '#8a7d5a', fontSize: '0.7rem', fontFamily: 'Fredoka, sans-serif' }}>Farcaster</span>
          </a>
        </div>
        <button
          onClick={copyUrl}
          style={{
            width: '100%', padding: '0.6rem',
            background: copied ? '#CF3748' : '#E8DCAB',
            color: copied ? '#131325' : '#CF3748',
            border: '2px solid #CF3748', borderRadius: 8,
            fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
            fontFamily: 'Fredoka, sans-serif'
          }}
        >
          {copied ? 'Copied!' : 'Copy URL'}
        </button>
      </div>
    </div>
  );
}

// --- Offer Modal ---

function OfferModal({ name, address, walletClient, publicClient, onClose }: {
  name: string;
  address: Address;
  walletClient: any;
  publicClient: any;
  onClose: () => void;
}) {
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('604800');
  const [status, setStatus] = useState('');
  const [statusColor, setStatusColor] = useState('#8a7d5a');
  const [submitting, setSubmitting] = useState(false);

  async function makeOffer() {
    if (!price || parseFloat(price) <= 0) { alert('Enter a valid offer amount'); return; }
    const dur = parseInt(duration);
    if (isNaN(dur) || dur <= 0) { alert('Invalid duration'); return; }

    if (!window.confirm(`Submit offer of ${price} WETH for ${name}? This will approve WETH spending.`)) return;

    setSubmitting(true);
    setStatus('Looking up name...');
    setStatusColor('#8a7d5a');

    try {
      // Get tokenId
      const resolveRes = await fetch(`${API_BASE}/api/resolve/${encodeURIComponent(name)}`);
      const resolveData = await resolveRes.json();
      if (!resolveData.tokenId) throw new Error('Name not found');
      const tokenId = resolveData.tokenId;
      const nameOwner = resolveData.owner;

      const priceWei = parseEther(price);
      const feeAmount = (priceWei * BigInt(MARKETPLACE_FEE_BPS)) / 10000n;
      const sellerAmount = priceWei - feeAmount;
      const now = Math.floor(Date.now() / 1000);
      const endTime = BigInt(now + dur);

      // Check WETH balance
      setStatus('Checking WETH balance...');
      const wethBal = await publicClient.readContract({
        address: WETH_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [address],
      }) as bigint;
      if (wethBal < priceWei) {
        const needed = formatEther(priceWei);
        const have = formatEther(wethBal);
        throw new Error(`Insufficient WETH: need ${needed}, have ${have}. Wrap ETH to WETH first.`);
      }

      // Approve WETH to Seaport if needed
      setStatus('Checking WETH approval...');
      const currentAllowance = await publicClient.readContract({
        address: WETH_ADDRESS, abi: ERC20_ABI, functionName: 'allowance', args: [address, SEAPORT_ADDRESS],
      }) as bigint;
      if (currentAllowance < priceWei) {
        setStatus('Approve WETH for Seaport...');
        const hash = await walletClient.writeContract({
          address: WETH_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [SEAPORT_ADDRESS, priceWei],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }

      // Get counter
      setStatus('Preparing order...');
      const counter = await publicClient.readContract({
        address: SEAPORT_ADDRESS, abi: SEAPORT_ABI, functionName: 'getCounter', args: [address],
      }) as bigint;

      // Build offer order
      const offer = [{
        itemType: 1, token: WETH_ADDRESS, identifierOrCriteria: 0n, startAmount: priceWei, endAmount: priceWei,
      }];
      const consideration: any[] = [
        { itemType: 2, token: REGISTRY_ADDRESS, identifierOrCriteria: BigInt(tokenId), startAmount: 1n, endAmount: 1n, recipient: address },
        { itemType: 1, token: WETH_ADDRESS, identifierOrCriteria: 0n, startAmount: sellerAmount, endAmount: sellerAmount, recipient: nameOwner as Address },
      ];
      if (feeAmount > 0n) {
        consideration.push({
          itemType: 1, token: WETH_ADDRESS, identifierOrCriteria: 0n, startAmount: feeAmount, endAmount: feeAmount, recipient: TREASURY_ADDRESS,
        });
      }

      const salt = BigInt(generateSalt());

      // EIP-712 sign
      setStatus('Sign the offer in your wallet...');
      const signature = await walletClient.signTypedData({
        domain: SEAPORT_DOMAIN,
        types: SEAPORT_EIP712_TYPES,
        primaryType: 'OrderComponents',
        message: {
          offerer: address,
          zone: '0x0000000000000000000000000000000000000000' as Address,
          offer,
          consideration,
          orderType: 0,
          startTime: BigInt(now),
          endTime,
          zoneHash: ZERO_BYTES32,
          salt,
          conduitKey: ZERO_BYTES32,
          counter,
        },
      });

      // Submit to API
      setStatus('Submitting offer...');
      const orderComponentsData = {
        offerer: address,
        zone: '0x0000000000000000000000000000000000000000',
        offer: offer.map(o => ({ itemType: o.itemType, token: o.token, identifierOrCriteria: o.identifierOrCriteria.toString(), startAmount: o.startAmount.toString(), endAmount: o.endAmount.toString() })),
        consideration: consideration.map((c: any) => ({ itemType: c.itemType, token: c.token, identifierOrCriteria: c.identifierOrCriteria.toString(), startAmount: c.startAmount.toString(), endAmount: c.endAmount.toString(), recipient: c.recipient })),
        orderType: 0,
        startTime: BigInt(now).toString(),
        endTime: endTime.toString(),
        zoneHash: ZERO_BYTES32,
        salt: salt.toString(),
        conduitKey: ZERO_BYTES32,
        counter: counter.toString(),
        totalOriginalConsiderationItems: consideration.length.toString(),
      };

      const res = await fetch(`${API_BASE}/api/marketplace/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, offerer: address, price, currency: 'WETH', signature,
          orderComponents: orderComponentsData,
          expiresAt: now + dur,
          sellerAmount: sellerAmount.toString(),
          feeAmount: feeAmount.toString(),
          tokenId,
        }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setStatusColor('#2e7d32');
      setStatus('Offer submitted! The owner will be notified.');
      setTimeout(onClose, 2000);
    } catch (e: any) {
      setStatusColor('#CF3748');
      setStatus('Error: ' + (e.shortMessage || e.message || e));
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: 12, padding: '1.5rem', maxWidth: 360, width: '90%' }}>
        <div style={{ fontSize: '1rem', color: '#131325', marginBottom: '1rem', fontWeight: 700, fontFamily: 'Fredoka, sans-serif' }}>
          Make Offer for <span style={{ color: '#CF3748' }}>{name}.hazza.name</span>
        </div>
        <label style={{ display: 'block', fontSize: '0.8rem', color: '#8a7d5a', marginBottom: '0.25rem' }}>Offer Amount (WETH)</label>
        <input
          type="number" value={price} onChange={e => setPrice(e.target.value)}
          placeholder="0.01" step="any" min="0"
          style={{ width: '100%', padding: '0.5rem', background: '#F7EBBD', border: '2px solid #E8DCAB', borderRadius: 6, color: '#131325', fontSize: '0.9rem', fontFamily: 'Fredoka, sans-serif', marginBottom: '0.75rem', boxSizing: 'border-box' }}
        />
        <div style={{ fontSize: '0.7rem', color: '#8a7d5a', marginBottom: '0.75rem' }}>Offers use WETH (wrapped ETH). You must have WETH in your wallet.</div>
        <label style={{ display: 'block', fontSize: '0.8rem', color: '#8a7d5a', marginBottom: '0.25rem' }}>Expires</label>
        <select
          value={duration} onChange={e => setDuration(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', background: '#F7EBBD', border: '2px solid #E8DCAB', borderRadius: 6, color: '#131325', fontSize: '0.85rem', fontFamily: 'Fredoka, sans-serif', marginBottom: '0.75rem', boxSizing: 'border-box' }}
        >
          <option value="86400">1 day</option>
          <option value="259200">3 days</option>
          <option value="604800">7 days</option>
          <option value="2592000">30 days</option>
        </select>
        <div style={{ fontSize: '0.75rem', color: '#8a7d5a', marginBottom: '1rem' }}>{MARKETPLACE_FEE_BPS > 0 ? `${MARKETPLACE_FEE_BPS / 100}% marketplace fee.` : 'No marketplace fee.'} Seller receives payment in WETH.</div>
        <button
          onClick={makeOffer} disabled={submitting}
          style={{ width: '100%', padding: '0.6rem', background: '#CF3748', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Fredoka, sans-serif', opacity: submitting ? 0.7 : 1 }}
        >
          Sign &amp; Submit Offer
        </button>
        {status && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', textAlign: 'center', color: statusColor }}>{status}</div>
        )}
      </div>
    </div>
  );
}

// --- Browse Tab ---

function BrowseTab({
  address, cart, setCart, watchlist, setWatchlist, listings, loadListings, setOfferModalName, switchTab, onContactSeller,
}: {
  address?: Address;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  watchlist: WatchItem[];
  setWatchlist: React.Dispatch<React.SetStateAction<WatchItem[]>>;
  listings: Listing[];
  loadListings: () => Promise<void>;
  setOfferModalName: (name: string | null) => void;
  switchTab: (tab: TabKey) => void;
  onContactSeller?: (name: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [typeFilter, setTypeFilter] = useState('all');
  const [buyStatus, setBuyStatus] = useState('');
  const [watchCounts, setWatchCounts] = useState<Record<string, number>>({});
  const [bountyInfo, setBountyInfo] = useState<Record<string, string>>({});

  const walletClient = useWalletClient();
  const publicClient = usePublicClient();

  useEffect(() => {
    loadListings().finally(() => setLoading(false));
  }, [loadListings]);

  // Load watch counts (batched)
  useEffect(() => {
    if (listings.length === 0) return;
    Promise.all(
      listings.map(l =>
        fetch(`${API_BASE}/api/marketplace/watch/${l.orderHash}`)
          .then(r => r.json())
          .then(d => ({ orderHash: l.orderHash, count: d.count || 0 }))
          .catch(() => ({ orderHash: l.orderHash, count: 0 }))
      )
    ).then(results => {
      const counts: Record<string, number> = {};
      results.forEach(r => { if (r.count > 0) counts[r.orderHash] = r.count; });
      setWatchCounts(counts);
    });
  }, [listings]);

  // Extract bounty info from worker-enriched listings
  useEffect(() => {
    const bounties: Record<string, string> = {};
    listings.forEach(l => {
      if ((l as any).bounty) bounties[l.orderHash] = (l as any).bounty.amount;
    });
    setBountyInfo(bounties);
  }, [listings]);

  const filtered = useMemo(() => {
    let result = listings.filter(l => {
      if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter === 'namespace' && !l.isNamespace) return false;
      if (typeFilter === 'regular' && l.isNamespace) return false;
      if (typeFilter === 'bounty' && !bountyInfo[l.orderHash]) return false;
      return true;
    });
    result = [...result].sort((a, b) => {
      if (sortBy === 'price-low') return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
      if (sortBy === 'price-high') return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0);
      if (sortBy === 'name-az') return a.name.localeCompare(b.name);
      return 0;
    });
    return result;
  }, [listings, search, sortBy, typeFilter, bountyInfo]);

  const isWatched = (orderHash: string) => watchlist.some(w => w.orderHash === orderHash);

  function toggleWatch(l: Listing) {
    setWatchlist(prev => {
      const idx = prev.findIndex(w => w.orderHash === l.orderHash);
      if (idx >= 0) {
        if (address) fetch(`${API_BASE}/api/marketplace/watch`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderHash: l.orderHash, address }) }).catch(() => {});
        return prev.filter((_, i) => i !== idx);
      } else {
        if (address) fetch(`${API_BASE}/api/marketplace/watch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderHash: l.orderHash, address }) }).catch(() => {});
        return [...prev, { orderHash: l.orderHash, name: l.name, price: l.price, currency: l.currency }];
      }
    });
  }

  function addToCart(l: Listing) {
    const item: CartItem = { id: `buy-${l.orderHash}`, type: 'Buy', name: l.name, price: l.price, currency: l.currency, orderHash: l.orderHash };
    setCart(prev => prev.find(c => c.id === item.id) ? prev : [...prev, item]);
  }

  async function buyListing(listing: Listing) {
    if (!address || !walletClient.data || !publicClient) return;
    if (address.toLowerCase() === listing.seller.toLowerCase()) {
      alert("You can't buy your own listing.");
      return;
    }
    setBuyStatus('Preparing transaction...');
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderHash: listing.orderHash, buyerAddress: address }),
      });
      const data = await res.json();
      if (data.error) return alert('Cannot buy: ' + data.error);

      if (data.approvals?.length) {
        setBuyStatus('Approving tokens...');
        for (const a of data.approvals) {
          const hash = await walletClient.data.sendTransaction({ to: a.to as Address, data: a.data as `0x${string}`, value: BigInt(a.value || '0') });
          await publicClient.waitForTransactionReceipt({ hash });
        }
      }

      setBuyStatus('Confirming purchase...');
      const hash = await walletClient.data.sendTransaction({
        to: data.fulfillment.to as Address,
        data: data.fulfillment.data as `0x${string}`,
        value: BigInt(data.fulfillment.value || '0'),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      setBuyStatus('');
      if (receipt.status === 'success') {
        alert(`Purchase successful! ${listing.name}.hazza.name is now yours.\n\nTx: ${hash}`);
        loadListings();
      } else {
        alert('Transaction reverted. Check the block explorer for details.');
      }
    } catch (e: any) {
      setBuyStatus('');
      alert('Buy failed: ' + (e.shortMessage || e.message || e));
    }
  }

  if (loading) return <p style={{ color: '#8a7d5a', textAlign: 'center' }}>Loading listings...</p>;

  return (
    <div>
      {/* Filters */}
      <div id="mp-filters" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'nowrap', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          onKeyUp={e => { if (e.key === 'Enter') { /* filtered already reactive */ } }}
          placeholder="search names..."
          style={{ flex: '1 1 auto', minWidth: 0, padding: '0.5rem 0.75rem', border: '2px solid #E8DCAB', borderRadius: 6, background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: "'Fredoka', sans-serif", outline: 'none' }}
        />
        <button
          onClick={() => {/* search is reactive */}}
          style={{ flexShrink: 0, height: 32, padding: '0 0.6rem', background: '#4870D4', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontFamily: "'Fredoka', sans-serif", fontWeight: 600 }}
          aria-label="Search"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><circle cx="10" cy="10" r="7"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
        </button>
        <select
          value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: '0.4rem', border: '2px solid #E8DCAB', borderRadius: 6, background: '#fff', color: '#131325', fontSize: '0.8rem', fontFamily: "'Fredoka', sans-serif" }}
        >
          <option value="newest">newest</option>
          <option value="price-low">price: low</option>
          <option value="price-high">price: high</option>
          <option value="name-az">A-Z</option>
        </select>
        <select
          value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: '0.4rem', border: '2px solid #E8DCAB', borderRadius: 6, background: '#fff', color: '#131325', fontSize: '0.8rem', fontFamily: "'Fredoka', sans-serif" }}
        >
          <option value="all">all</option>
          <option value="namespace">namespaces</option>
          <option value="regular">regular</option>
          <option value="bounty">has bounty</option>
        </select>
      </div>

      {/* Buy status */}
      {buyStatus && (
        <div id="buy-status" style={{ textAlign: 'center', color: '#8a7d5a', fontSize: '0.85rem', padding: '0.5rem', marginBottom: '0.5rem' }}>{buyStatus}</div>
      )}

      {/* Listings */}
      <div id="listings-container">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>No names listed yet.</p>
            <p><a href="#" onClick={e => { e.preventDefault(); switchTab('mynames'); }}>list a name</a></p>
          </div>
        ) : (
          <div className="listing-grid">
            {filtered.map(l => {
              const badgeClass = l.currency === 'USDC' ? 'badge-usdc' : 'badge-eth';
              const watched = isWatched(l.orderHash);
              return (
                <div className="listing-card" key={l.orderHash}>
                  <div className="listing-name">
                    <a href={l.profileUrl}>{l.name}</a>
                    {l.isNamespace && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, background: '#CF3748', color: '#fff', fontSize: '0.6rem', fontWeight: 700, borderRadius: 3, verticalAlign: 'middle', marginLeft: '0.2rem' }} title="Namespace">N</span>
                    )}
                  </div>
                  <div className="listing-meta">Seller: {truncAddr(l.seller)} &middot; Expires: {formatDate(l.listingExpiry)}</div>
                  <div className="listing-price">{l.price}<span className={`currency-badge ${badgeClass}`}>{l.currency}</span></div>
                  {bountyInfo[l.orderHash] && (
                    <div style={{ fontSize: '0.75rem', color: '#4870D4', fontWeight: 600, marginBottom: '0.3rem' }}>
                      <span style={{ display: 'inline-block', background: '#4870D4', color: '#fff', padding: '1px 6px', borderRadius: 4, fontSize: '0.65rem', marginRight: 4 }}>BOUNTY</span>
                      {bountyInfo[l.orderHash]} ETH
                    </div>
                  )}
                  <div className="listing-actions">
                    <button className="btn-buy" onClick={() => buyListing(l)}>Buy</button>
                    <button className="btn-buy" style={{ background: 'transparent', border: '2px solid #E8DCAB', color: '#CF3748', flex: 0, padding: '0.6rem 0.75rem', fontSize: '0.75rem' }} onClick={() => setOfferModalName(l.name)}>Offer</button>
                    {onContactSeller && (
                      <button className="btn-buy" style={{ background: 'transparent', border: '2px solid #4870D4', color: '#4870D4', flex: 0, padding: '0.6rem 0.75rem', fontSize: '0.75rem' }} onClick={() => onContactSeller(l.name)}>Message</button>
                    )}
                    <button className="btn-buy" style={{ background: 'transparent', border: '2px solid #E8DCAB', color: '#8a7d5a', flex: 0, padding: '0.6rem 0.75rem' }} onClick={() => addToCart(l)}>+</button>
                    <button className={`btn-watch${watched ? ' saved' : ''}`} onClick={() => toggleWatch(l)}>{watched ? '\u2605' : '\u2606'}</button>
                  </div>
                  {watchCounts[l.orderHash] > 0 && (
                    <div className="watch-count">in {watchCounts[l.orderHash]} watchlist{watchCounts[l.orderHash] > 1 ? 's' : ''}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// --- My Names Tab ---

function MyNamesTab({ address, switchTab }: { address?: Address; switchTab: (tab: TabKey) => void }) {
  const [names, setNames] = useState<UserName[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sellFormName, setSellFormName] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [sellDuration, setSellDuration] = useState('2592000');
  const [bountyAmount, setBountyAmount] = useState('');
  const [listing, setListing] = useState(false);
  const [shareModalName, setShareModalName] = useState<string | null>(null);

  const walletClient = useWalletClient();
  const publicClient = usePublicClient();

  const loadNames = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/names/${address}`);
      const data = await res.json();
      setNames(data.names || []);
    } catch {
      setError('Failed to load names');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { loadNames(); }, [loadNames]);

  async function createListing(name: string, tokenId: string) {
    if (!address || !walletClient.data || !publicClient) return;
    if (!tokenId || tokenId === 'undefined') {
      alert('Token ID not found. Please select a name from My Names first.');
      return;
    }
    if (!sellPrice || parseFloat(sellPrice) <= 0) { alert('Enter a valid price'); return; }

    setListing(true);
    try {
      // Check approval
      const isApproved = await publicClient.readContract({
        address: REGISTRY_ADDRESS, abi: ERC721_ABI, functionName: 'isApprovedForAll',
        args: [address, SEAPORT_ADDRESS],
      });
      if (!isApproved) {
        const hash = await walletClient.data.writeContract({
          address: REGISTRY_ADDRESS, abi: ERC721_ABI, functionName: 'setApprovalForAll',
          args: [SEAPORT_ADDRESS, true],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }

      // Get counter
      const counter = await publicClient.readContract({
        address: SEAPORT_ADDRESS, abi: SEAPORT_ABI, functionName: 'getCounter', args: [address],
      }) as bigint;

      // Build order — consideration splits: seller gets (price - fee),
      // treasury gets fee. Bounty is deposited separately via escrow contract.
      const priceWei = parseEther(sellPrice);
      const feeAmount = (priceWei * BigInt(MARKETPLACE_FEE_BPS)) / 10000n;
      const bountyWei = bountyAmount && parseFloat(bountyAmount) > 0 ? parseEther(bountyAmount) : 0n;
      if (bountyWei + feeAmount >= priceWei) {
        alert('Bounty amount must be less than the listing price.');
        setListing(false);
        return;
      }
      const sellerAmount = priceWei - feeAmount - bountyWei;
      const dur = parseInt(sellDuration);
      const endTime = dur === 0
        ? BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
        : BigInt(Math.floor(Date.now() / 1000) + dur);

      const offer = [{
        itemType: 2, token: REGISTRY_ADDRESS, identifierOrCriteria: BigInt(tokenId), startAmount: 1n, endAmount: 1n,
      }];

      const consideration: any[] = [{
        itemType: 0, token: '0x0000000000000000000000000000000000000000' as Address,
        identifierOrCriteria: 0n, startAmount: sellerAmount, endAmount: sellerAmount, recipient: address,
      }];
      if (feeAmount > 0n) {
        consideration.push({
          itemType: 0, token: '0x0000000000000000000000000000000000000000' as Address,
          identifierOrCriteria: 0n, startAmount: feeAmount, endAmount: feeAmount, recipient: TREASURY_ADDRESS,
        });
      }
      if (bountyWei > 0n && BOUNTY_ESCROW_ADDRESS) {
        consideration.push({
          itemType: 0, token: '0x0000000000000000000000000000000000000000' as Address,
          identifierOrCriteria: 0n, startAmount: bountyWei, endAmount: bountyWei, recipient: BOUNTY_ESCROW_ADDRESS,
        });
      }
      const salt = BigInt(generateSalt());

      // EIP-712 sign
      const signature = await walletClient.data.signTypedData({
        domain: SEAPORT_DOMAIN,
        types: SEAPORT_EIP712_TYPES,
        primaryType: 'OrderComponents',
        message: {
          offerer: address, zone: ZONE_PUBLIC, offer, consideration,
          orderType: 2, startTime: 0n, endTime,
          zoneHash: ZERO_BYTES32, salt, conduitKey: ZERO_BYTES32, counter,
        },
      });

      // Submit to Bazaar
      const hash = await walletClient.data.writeContract({
        address: BAZAAR_ADDRESS,
        abi: BAZAAR_SUBMIT_ABI,
        functionName: 'submit',
        args: [{
          parameters: {
            offerer: address, zone: ZONE_PUBLIC,
            offer: offer.map(o => ({ ...o })),
            consideration: consideration.map((c: any) => ({ ...c })),
            orderType: 2, startTime: 0n, endTime,
            zoneHash: ZERO_BYTES32, salt, conduitKey: ZERO_BYTES32,
            totalOriginalConsiderationItems: BigInt(consideration.length),
          },
          counter, signature,
        }],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        // Register bounty metadata on escrow contract (no ETH — bounty comes from Seaport consideration split)
        if (bountyWei > 0n && BOUNTY_ESCROW_ADDRESS) {
          try {
            const bountyHash = await walletClient.data.writeContract({
              address: BOUNTY_ESCROW_ADDRESS as Address,
              abi: BOUNTY_ESCROW_ABI,
              functionName: 'registerBounty',
              args: [BigInt(tokenId), bountyWei],
            });
            await publicClient.waitForTransactionReceipt({ hash: bountyHash });
          } catch (e: any) {
            console.warn('Bounty registration failed (listing still active):', e.message);
            alert(`Warning: your listing is live, but bounty registration failed. The agent bounty of ${bountyAmount} ETH was NOT registered. You can add it later from your listings.`);
          }
        }
        alert(`Listed! ${name}.hazza.name is now for sale at ${sellPrice} ETH.${bountyAmount && parseFloat(bountyAmount) > 0 ? ` Agent bounty: ${bountyAmount} ETH.` : ''}\n\nTx: ${hash}\n\nThis listing appears on hazza.name/marketplace and netprotocol.app/bazaar.`);
        setSellFormName(null);
        setSellPrice('');
        setBountyAmount('');
      } else {
        alert('Submission reverted. Check block explorer.');
      }
    } catch (e: any) {
      alert('Listing failed: ' + (e.shortMessage || e.message || e));
    } finally {
      setListing(false);
    }
  }

  if (!address) {
    return (
      <div className="empty-state">
        <p style={{ color: '#8a7d5a' }}>connect your wallet to see your names</p>
        <p style={{ color: '#8a7d5a', fontSize: '0.85rem' }}>tap <strong style={{ color: '#CF3748' }}>connect</strong> in the menu above</p>
      </div>
    );
  }

  if (loading) return <p style={{ color: '#8a7d5a', textAlign: 'center' }}>Loading your names...</p>;
  if (error) return <div className="empty-state"><p>Failed to load names: {error}</p></div>;

  if (names.length === 0) {
    return (
      <div className="empty-state">
        <p style={{ fontFamily: "'Fredoka', sans-serif", color: '#131325', fontSize: '1rem' }}>no names yet? let&apos;s fix that.</p>
        <a href="/register" className="btn-buy" style={{ display: 'inline-block', width: 'auto', padding: '0.6rem 1.5rem', textDecoration: 'none' }}>register your first name &mdash; it&apos;s free!</a>
        <p style={{ fontFamily: "'Fredoka', sans-serif", color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.75rem' }}>&mdash; nomi</p>
      </div>
    );
  }

  return (
    <div id="mynames-container">
      {names.map(n => (
        <div key={n.name}>
          <div className="name-card">
            <div className="name-card-info">
              <div className="name-card-name">
                <span style={{ color: '#4870D4' }}>{n.name}</span><span style={{ color: '#131325' }}>.hazza.name</span>
                {' '}<span className={`status-badge status-${n.status}`}>{n.status}</span>
              </div>
              <div className="name-card-detail">Token #{n.tokenId}</div>
            </div>
            <div className="name-card-actions">
              <a href={`https://${encodeURIComponent(n.name)}.hazza.name`}>view</a>
              <a href={`/manage?name=${encodeURIComponent(n.name)}`}>manage</a>
              <button onClick={() => setSellFormName(sellFormName === n.name ? null : n.name)}>list</button>
              <button onClick={() => setShareModalName(n.name)}>share</button>
            </div>
          </div>

          {/* Sell form */}
          {sellFormName === n.name && (
            <div className="sell-form">
              <label>Price (ETH)</label>
              <input
                type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                placeholder="0.01" step="any" min="0"
              />
              <div style={{ fontSize: 11, color: '#8a7d5a', margin: '-4px 0 8px' }}>{MARKETPLACE_FEE_BPS > 0 ? `${MARKETPLACE_FEE_BPS / 100}% marketplace fee` : 'no marketplace fee'} — seller receives {MARKETPLACE_FEE_BPS > 0 ? `${100 - MARKETPLACE_FEE_BPS / 100}%` : '100%'}</div>
              <label>Duration</label>
              <select value={sellDuration} onChange={e => setSellDuration(e.target.value)}>
                <option value="604800">7 days</option>
                <option value="2592000">30 days</option>
                <option value="7776000">90 days</option>
                <option value="0">No expiry</option>
              </select>
              <label>Agent Bounty (ETH) <span style={{ fontWeight: 400, color: '#8a7d5a' }}>— optional</span></label>
              <input
                type="number" value={bountyAmount} onChange={e => setBountyAmount(e.target.value)}
                placeholder="0" step="any" min="0"
              />
              <div style={{ fontSize: 11, color: '#8a7d5a', margin: '-4px 0 8px' }}>deducted from sale proceeds — the agent earns this when your name sells</div>
              <button className="btn-sell" onClick={() => createListing(n.name, n.tokenId)} disabled={listing}>
                {listing ? 'Listing...' : 'List for Sale'}
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Share modal */}
      {shareModalName && <ShareModal name={shareModalName} onClose={() => setShareModalName(null)} />}
    </div>
  );
}

// --- Offers Tab ---

function OffersTab({ address, setOfferModalName }: { address?: Address; setOfferModalName: (name: string | null) => void }) {
  const [individualOffers, setIndividualOffers] = useState<Offer[]>([]);
  const [collectionOffers, setCollectionOffers] = useState<CollectionOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptPanelHash, setAcceptPanelHash] = useState<string | null>(null);
  const [acceptNames, setAcceptNames] = useState<UserName[]>([]);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [acceptStatus, setAcceptStatus] = useState<Record<string, string>>({});

  const walletClient = useWalletClient();
  const publicClient = usePublicClient();

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const [collRes, indivRes] = await Promise.all([
        fetch(`${API_BASE}/api/marketplace/offers`).then(r => r.json()).catch(() => ({ offers: [] })),
        fetch(`${API_BASE}/api/marketplace/all-offers`).then(r => r.json()).catch(() => ({ offers: [] })),
      ]);
      setCollectionOffers(collRes.offers || []);
      setIndividualOffers(indivRes.offers || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOffers(); }, [loadOffers]);

  async function acceptNameOffer(name: string, offererAddr: string) {
    if (!address || !walletClient.data || !publicClient) return;

    try {
      const res = await fetch(`${API_BASE}/api/marketplace/offers/${encodeURIComponent(name)}`);
      if (!res.ok) return alert('This offer is no longer available.');
      const data = await res.json();
      const offer = (data.offers || []).find((o: any) => o.offerer === offererAddr.toLowerCase());
      if (!offer) return alert('This offer is no longer available.');

      // Check if offer has expired
      if (offer.expiresAt) {
        const now = Math.floor(Date.now() / 1000);
        if (now >= offer.expiresAt) return alert('This offer has expired.');
      }
      // Also check orderComponents endTime
      if (offer.orderComponents?.endTime) {
        const endTime = Number(offer.orderComponents.endTime);
        const now = Math.floor(Date.now() / 1000);
        if (endTime > 0 && now >= endTime) return alert('This offer has expired.');
      }

      if (!confirm(`Accept offer of ${offer.price} WETH for ${name}.hazza.name? This transfers your name to the buyer.`)) return;

      const oc = offer.orderComponents;
      if (!oc || !offer.signature) return alert('Invalid offer data \u2014 missing order components');

      // Approve NFT
      const isApproved = await publicClient.readContract({
        address: REGISTRY_ADDRESS, abi: ERC721_ABI, functionName: 'isApprovedForAll',
        args: [address, SEAPORT_ADDRESS],
      });
      if (!isApproved) {
        const hash = await walletClient.data.writeContract({
          address: REGISTRY_ADDRESS, abi: ERC721_ABI, functionName: 'setApprovalForAll',
          args: [SEAPORT_ADDRESS, true],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }

      // Build order
      const order = {
        parameters: {
          offerer: oc.offerer as Address, zone: oc.zone as Address,
          offer: oc.offer.map((o: any) => ({ itemType: o.itemType, token: o.token as Address, identifierOrCriteria: BigInt(o.identifierOrCriteria), startAmount: BigInt(o.startAmount), endAmount: BigInt(o.endAmount) })),
          consideration: oc.consideration.map((c: any) => ({ itemType: c.itemType, token: c.token as Address, identifierOrCriteria: BigInt(c.identifierOrCriteria), startAmount: BigInt(c.startAmount), endAmount: BigInt(c.endAmount), recipient: c.recipient as Address })),
          orderType: oc.orderType,
          startTime: BigInt(oc.startTime), endTime: BigInt(oc.endTime),
          zoneHash: oc.zoneHash as `0x${string}`, salt: BigInt(oc.salt),
          conduitKey: oc.conduitKey as `0x${string}`,
          totalOriginalConsiderationItems: BigInt(oc.totalOriginalConsiderationItems),
        },
        signature: offer.signature as `0x${string}`,
      };

      try {
        const hash = await walletClient.data.writeContract({
          address: SEAPORT_ADDRESS, abi: SEAPORT_ABI, functionName: 'fulfillOrder',
          args: [order as any, ZERO_BYTES32],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === 'success') {
          alert(`Sale complete! ${name}.hazza.name transferred for ${offer.price} WETH.\nTx: ${hash}`);
          loadOffers();
        } else {
          alert('Transaction reverted. The offer may have been cancelled or expired.');
        }
      } catch (fulfillErr: any) {
        const msg = fulfillErr.shortMessage || fulfillErr.message || String(fulfillErr);
        if (msg.includes('User rejected') || msg.includes('user rejected')) {
          alert('Transaction rejected.');
        } else {
          alert('This offer could not be accepted. It may have been cancelled or expired.\n\nDetails: ' + msg);
        }
      }
    } catch (e: any) {
      alert('Accept failed: ' + (e.shortMessage || e.message || e));
    }
  }

  async function cancelMyOffer(name: string) {
    if (!address || !walletClient.data) return;
    if (!confirm(`Cancel your offer on ${name}.hazza.name?`)) return;
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const msg = `cancel-offer:${name.toLowerCase()}:${address.toLowerCase()}:${timestamp}`;
      const signature = await walletClient.data.signMessage({ message: msg });
      const res = await fetch(`${API_BASE}/api/marketplace/offer`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, offerer: address, signature, timestamp }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      loadOffers();
    } catch (e: any) {
      alert('Failed to cancel: ' + (e.shortMessage || e.message || e));
    }
  }

  async function showAcceptOffer(orderHash: string) {
    if (!address) return;
    if (acceptPanelHash === orderHash) { setAcceptPanelHash(null); return; }
    setAcceptPanelHash(orderHash);
    setAcceptLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/names/${address}`);
      const data = await res.json();
      setAcceptNames((data.names || []).filter((n: UserName) => n.status === 'active'));
    } catch {
      setAcceptNames([]);
    } finally {
      setAcceptLoading(false);
    }
  }

  async function acceptCollectionOffer(orderHash: string, name: string, tokenId: string) {
    if (!address || !walletClient.data || !publicClient) return;

    // Check if the collection offer has expired client-side
    const matchingOffer = collectionOffers.find(o => o.orderHash === orderHash);
    if (matchingOffer?.expirationDate) {
      const now = Math.floor(Date.now() / 1000);
      if (now >= matchingOffer.expirationDate) {
        const key = orderHash.slice(0, 10);
        setAcceptStatus(prev => ({ ...prev, [key]: 'This offer has expired.' }));
        return;
      }
    }

    if (!confirm(`Sell ${name}.hazza.name into this offer? This transfers ownership immediately.`)) return;

    const key = orderHash.slice(0, 10);
    setAcceptStatus(prev => ({ ...prev, [key]: 'Preparing transaction...' }));

    try {
      const res = await fetch(`${API_BASE}/api/marketplace/fulfill-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderHash, tokenId, sellerAddress: address }),
      });
      const data = await res.json();
      if (data.error) { setAcceptStatus(prev => ({ ...prev, [key]: data.error })); return; }

      // Execute approvals
      if (data.approvals?.length) {
        setAcceptStatus(prev => ({ ...prev, [key]: 'Approving NFT transfer...' }));
        for (const a of data.approvals) {
          const hash = await walletClient.data.sendTransaction({ to: a.to as Address, data: a.data as `0x${string}`, value: BigInt(a.value || '0') });
          await publicClient.waitForTransactionReceipt({ hash });
        }
      }

      // Execute fulfillment
      setAcceptStatus(prev => ({ ...prev, [key]: 'Confirming sale...' }));
      const hash = await walletClient.data.sendTransaction({
        to: data.fulfillment.to as Address, data: data.fulfillment.data as `0x${string}`,
        value: BigInt(data.fulfillment.value || '0'),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setAcceptStatus(prev => ({ ...prev, [key]: `Sold! ${name}.hazza.name transferred.` }));
        alert(`Sale complete! ${name}.hazza.name has been sold.\n\nTx: ${hash}`);
        loadOffers();
      } else {
        setAcceptStatus(prev => ({ ...prev, [key]: 'Transaction reverted. The offer may have been cancelled or expired.' }));
      }
    } catch (e: any) {
      const msg = e.shortMessage || e.message || String(e);
      if (msg.includes('User rejected') || msg.includes('user rejected')) {
        setAcceptStatus(prev => ({ ...prev, [key]: 'Transaction rejected.' }));
      } else {
        setAcceptStatus(prev => ({ ...prev, [key]: 'This offer could not be accepted. It may have been cancelled or expired.' }));
      }
    }
  }

  if (loading) return <p style={{ color: '#8a7d5a', textAlign: 'center' }}>Loading offers...</p>;

  return (
    <div>
      {/* Direct offer input */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          type="text" id="offer-name-input" placeholder="make an offer on any name..."
          style={{ flex: 1, padding: '0.5rem 0.75rem', border: '2px solid #E8DCAB', borderRadius: 6, background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: "'Fredoka', sans-serif", outline: 'none' }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const input = e.currentTarget;
              const n = input.value.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '');
              if (n) setOfferModalName(n); else alert('Enter a name');
            }
          }}
        />
        <button
          onClick={() => {
            const el = document.getElementById('offer-name-input') as HTMLInputElement;
            const n = el?.value.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '') || '';
            if (n) setOfferModalName(n); else alert('Enter a name');
          }}
          style={{ padding: '0.5rem 1rem', background: '#CF3748', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: "'Fredoka', sans-serif", whiteSpace: 'nowrap' }}
        >
          Make Offer
        </button>
      </div>

      <div id="offers-container">
        {/* Individual name offers */}
        {individualOffers.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#131325', marginBottom: '0.75rem' }}>Name Offers</div>
            {individualOffers.map((o, i) => {
              const isOwner = address && o.owner === address.toLowerCase();
              const isSender = address && o.offerer === address.toLowerCase();
              return (
                <div className="offer-card" key={`${o.name}-${o.offerer}-${i}`}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 700 }}>
                      <span style={{ color: '#4870D4' }}>{o.name}</span><span style={{ color: '#131325' }}>.hazza.name</span>
                      {o.broker && <span style={{ fontSize: '0.65rem', background: '#E8DCAB', color: '#CF3748', padding: '0.1rem 0.3rem', borderRadius: 4, verticalAlign: 'middle', marginLeft: 4 }}>brokered</span>}
                    </div>
                    <div style={{ fontSize: '0.95rem', color: '#CF3748', fontWeight: 700, marginTop: '0.2rem' }}>{o.price} {o.currency || 'ETH'}</div>
                    <div style={{ fontSize: '0.8rem', color: '#8a7d5a' }}>From: {truncAddr(o.offerer)} &middot; Expires: {formatDate(o.expiresAt)}</div>
                  </div>
                  {isOwner && (
                    <button className="btn-buy" style={{ flex: 0, whiteSpace: 'nowrap', padding: '0.5rem 1rem', fontSize: '0.8rem' }} onClick={() => acceptNameOffer(o.name, o.offerer)}>Accept</button>
                  )}
                  {isSender && (
                    <button className="btn-buy" style={{ flex: 0, whiteSpace: 'nowrap', padding: '0.5rem 1rem', fontSize: '0.8rem', background: '#fff', border: '2px solid #CF3748', color: '#CF3748' }} onClick={() => cancelMyOffer(o.name)}>Cancel</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Collection offers info */}
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fff', border: '2px solid #E8DCAB', borderRadius: 8, fontSize: '0.85rem', color: '#8a7d5a' }}>
          <p style={{ margin: '0 0 0.25rem 0' }}>Collection offers apply to <strong style={{ color: '#131325' }}>any</strong> hazza name. If you own a name, you can accept an offer to sell it instantly.</p>
          <p style={{ margin: 0, color: '#8a7d5a', fontSize: '0.8rem' }}>Collection offers are made via Seaport on <a href="https://netprotocol.app/bazaar" style={{ color: '#CF3748' }} target="_blank" rel="noopener noreferrer">Net Protocol Bazaar</a>.</p>
        </div>

        {individualOffers.length === 0 && collectionOffers.length === 0 && (
          <div className="empty-state"><p>No offers yet. Click <strong style={{ color: '#CF3748' }}>Offer</strong> on any listing to make one.</p></div>
        )}

        {/* Collection offers */}
        {collectionOffers.map((o, idx) => {
          const panelKey = o.orderHash.slice(0, 10);
          return (
            <div key={`${o.orderHash}-${idx}`}>
              <div className="offer-card">
                <div>
                  <div style={{ fontWeight: 700, color: '#131325' }}>
                    {o.price} {o.currency || 'ETH'}
                    {' '}<span style={{ fontSize: '0.65rem', background: '#E8DCAB', color: '#8a7d5a', padding: '0.1rem 0.3rem', borderRadius: 4, verticalAlign: 'middle' }}>collection</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#8a7d5a' }}>From: {truncAddr(o.offerer)} &middot; Expires: {formatDate(o.expirationDate)}</div>
                </div>
                {address && (
                  <button className="btn-buy" style={{ flex: 0, whiteSpace: 'nowrap', padding: '0.5rem 1rem', fontSize: '0.8rem' }} onClick={() => showAcceptOffer(o.orderHash)}>Accept</button>
                )}
              </div>
              {/* Accept panel - select name to sell */}
              {acceptPanelHash === o.orderHash && (
                <div style={{ width: '100%', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  {acceptLoading ? (
                    <p style={{ color: '#8a7d5a', fontSize: '0.8rem' }}>Loading your names...</p>
                  ) : acceptNames.length === 0 ? (
                    <p style={{ color: '#8a7d5a', fontSize: '0.8rem' }}>You don&apos;t own any active names to sell.</p>
                  ) : (
                    <>
                      <div style={{ fontSize: '0.8rem', color: '#8a7d5a', marginBottom: '0.4rem' }}>Select a name to sell:</div>
                      {acceptNames.map(n => (
                        <button
                          key={n.name}
                          onClick={() => acceptCollectionOffer(o.orderHash, n.name, n.tokenId)}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.4rem 0.6rem', marginBottom: '0.3rem', background: '#fff', border: '2px solid #E8DCAB', borderRadius: 6, color: '#131325', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'Fredoka, sans-serif' }}
                        >
                          <span style={{ color: '#4870D4' }}>{n.name}</span><span style={{ color: '#131325' }}>.hazza.name</span> <span style={{ color: '#8a7d5a', fontSize: '0.7rem' }}>#{n.tokenId}</span>
                        </button>
                      ))}
                    </>
                  )}
                  {acceptStatus[panelKey] && (
                    <p style={{ fontSize: '0.8rem', color: acceptStatus[panelKey].startsWith('Sold') ? '#CF3748' : '#8a7d5a', fontWeight: acceptStatus[panelKey].startsWith('Sold') ? 700 : 400 }}>{acceptStatus[panelKey]}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Sales Tab ---

function SalesTab() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/marketplace/sales`);
        const data = await res.json();
        setSales(data.sales || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p style={{ color: '#8a7d5a', textAlign: 'center' }}>Loading sales...</p>;
  if (sales.length === 0) return <div className="empty-state"><p>No sales recorded yet.</p></div>;

  // Chart data
  const chartSales = sales.slice(0, 20).reverse();
  const maxPrice = Math.max(...chartSales.map(s => s.price), 1);

  return (
    <div id="sales-container">
      {/* Price history chart */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.8rem', color: '#8a7d5a', marginBottom: '0.5rem' }}>Price History (last {chartSales.length} sales)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100, padding: '0.25rem 0', borderBottom: '1px solid #E8DCAB' }}>
          {chartSales.map((s, i) => {
            const pct = Math.max(4, (s.price / maxPrice) * 100);
            const color = s.currency === 'USDC' ? '#2775ca' : '#CF3748';
            return (
              <div
                key={i}
                title={`${s.name}: ${s.price} ${s.currency}`}
                style={{ flex: 1, minWidth: 8, maxWidth: 32, height: `${pct}%`, background: color, borderRadius: '3px 3px 0 0', cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseOver={e => (e.currentTarget.style.opacity = '0.7')}
                onMouseOut={e => (e.currentTarget.style.opacity = '1')}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#8a7d5a', marginTop: '0.2rem' }}>
          {chartSales.length > 0 && (
            <>
              <span>{formatDate(chartSales[0].timestamp)}</span>
              <span>{formatDate(chartSales[chartSales.length - 1].timestamp)}</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem', fontSize: '0.7rem' }}>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#CF3748', borderRadius: 2, verticalAlign: 'middle' }} /> ETH</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#2775ca', borderRadius: 2, verticalAlign: 'middle' }} /> USDC</span>
        </div>
      </div>

      {/* Sales table */}
      <table className="sales-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Price</th>
            <th>Buyer</th>
            <th>Seller</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s, i) => (
            <tr key={i}>
              <td><a href={`https://${encodeURIComponent(s.name)}.hazza.name`}>{s.name}</a></td>
              <td style={{ fontWeight: 700 }}>{s.price} {s.currency}</td>
              <td>{truncAddr(s.buyer)}</td>
              <td>{truncAddr(s.seller)}</td>
              <td>{formatDate(s.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Forum Tab ---

function ForumTab({ address, onContactAuthor }: { address?: Address; onContactAuthor?: (authorName: string) => void }) {
  const [messages, setMessages] = useState<BoardMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});

  const walletClient = useWalletClient();

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/board`);
      const data = await res.json();
      const msgs: BoardMessage[] = data.messages || [];
      setMessages(msgs);

      // Resolve names for authors without authorName
      const unknownAuthors = [...new Set(msgs.filter(m => !m.authorName && m.author).map(m => m.author))];
      for (const addr of unknownAuthors.slice(0, 20)) {
        fetch(`${API_BASE}/api/reverse/${encodeURIComponent(addr)}`)
          .then(r => r.json())
          .then(d => {
            if (d.name) {
              setResolvedNames(prev => ({ ...prev, [addr.toLowerCase()]: d.name }));
            }
          })
          .catch(() => {});
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  async function postMessage() {
    if (!address || !walletClient.data || !text.trim()) return;
    if (text.length > 500) { alert('Message too long (max 500 characters)'); return; }

    setPosting(true);
    try {
      const sig = await walletClient.data.signMessage({ message: `hazza board post: ${text.trim()}` });
      const res = await fetch(`${API_BASE}/api/board`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), author: address, signature: sig }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to post');
      }
      setText('');
      loadMessages();
    } catch (e: any) {
      alert('Post failed: ' + (e.message || e));
    } finally {
      setPosting(false);
    }
  }

  if (loading) return <p style={{ color: '#8a7d5a', textAlign: 'center' }}>Loading messages...</p>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          Public forum for the hazza marketplace. Messages are stored onchain via{' '}
          <a href="https://netprotocol.app" style={{ color: '#CF3748' }} target="_blank" rel="noopener noreferrer">Net Protocol</a>.
        </p>

        {/* Compose */}
        {address ? (
          <div id="board-compose" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <textarea
                id="board-msg-input"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Write a message..."
                rows={2}
                style={{ flex: 1, padding: '0.5rem 0.75rem', border: '2px solid #E8DCAB', borderRadius: 6, background: '#fff', color: '#131325', fontSize: '0.85rem', fontFamily: "'Fredoka', sans-serif", outline: 'none', resize: 'vertical' }}
              />
              <button
                id="board-send-btn"
                onClick={postMessage}
                disabled={posting}
                style={{ padding: '0.5rem 1rem', background: '#CF3748', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: "'Fredoka', sans-serif", whiteSpace: 'nowrap', alignSelf: 'flex-end' }}
              >
                {posting ? 'Posting...' : 'Post'}
              </button>
            </div>
            <p style={{ color: '#8a7d5a', fontSize: '0.7rem', marginTop: '0.35rem' }}>Posts are public and permanent. Your wallet address is visible.</p>
          </div>
        ) : (
          <div id="board-connect-prompt" style={{ textAlign: 'center', padding: '0.5rem', color: '#8a7d5a', fontSize: '0.85rem' }}>
            Connect your wallet to post messages.
          </div>
        )}
      </div>

      {/* Messages */}
      <div id="board-messages">
        {messages.length === 0 ? (
          <div className="empty-state"><p>No messages yet. Be the first to post!</p></div>
        ) : (
          messages.map((m, i) => {
            const date = m.timestamp
              ? new Date(m.timestamp).toLocaleDateString() + ' ' + new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';
            return (
              <div key={i} style={{ padding: '0.75rem', background: '#F7EBBD', border: '2px solid #E8DCAB', borderRadius: 8, marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {(() => {
                      const displayName = m.authorName || resolvedNames[m.author?.toLowerCase()];
                      if (displayName) {
                        const isHazza = !!m.authorName;
                        return (
                          <>
                            {isHazza ? (
                              <a
                                href={`https://${encodeURIComponent(displayName)}.hazza.name`}
                                style={{ textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem', fontFamily: "'Fredoka', sans-serif" }}
                                title={m.author}
                              >
                                <span style={{ color: '#4870D4' }}>{displayName}</span><span style={{ color: '#131325' }}>.hazza</span>
                              </a>
                            ) : (
                              <a
                                href={`https://etherscan.io/address/${m.author}`}
                                style={{ color: '#131325', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', fontFamily: "'Fredoka', sans-serif" }}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={m.author}
                              >
                                {displayName}
                              </a>
                            )}
                            {onContactAuthor && isHazza && (
                              <button
                                onClick={() => onContactAuthor(displayName)}
                                style={{ background: 'transparent', border: '2px solid #4870D4', color: '#4870D4', padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Fredoka', sans-serif" }}
                              >
                                DM
                              </button>
                            )}
                          </>
                        );
                      }
                      return <span style={{ color: '#8a7d5a', fontSize: '0.8rem', fontFamily: 'monospace' }} title={m.author}>{truncAddr(m.author)}</span>;
                    })()}
                  </span>
                  <span style={{ color: '#8a7d5a', fontSize: '0.7rem' }}>{date}</span>
                </div>
                <p style={{ color: '#8a7d5a', fontSize: '0.85rem', lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>{m.text}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================
// Donate Tab
// ============================================================

function DonateTab({ address, walletClient, publicClient }: { address?: Address; walletClient: any; publicClient: any }) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'ETH' | 'USDC'>('ETH');
  const [showModal, setShowModal] = useState(false);
  const [donating, setDonating] = useState(false);
  const [donateStatus, setDonateStatus] = useState('');

  const isValid = amount && parseFloat(amount) > 0;

  async function handleDonate() {
    if (!address || !walletClient || !isValid) return;
    setDonating(true);
    setDonateStatus('');
    try {
      let hash: string;
      if (currency === 'ETH') {
        hash = await walletClient.sendTransaction({
          to: TREASURY_ADDRESS,
          value: parseEther(amount),
        });
      } else {
        hash = await walletClient.writeContract({
          address: USDC_ADDRESS,
          abi: [{ name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] }] as const,
          functionName: 'transfer',
          args: [TREASURY_ADDRESS, BigInt(Math.round(parseFloat(amount) * 1e6))],
        });
      }
      await publicClient!.waitForTransactionReceipt({ hash });
      setDonateStatus('thank you!');
      setAmount('');
      setTimeout(() => { setShowModal(false); setDonateStatus(''); }, 2000);
    } catch (e: any) {
      if (e.shortMessage?.includes('rejected') || e.message?.includes('rejected')) {
        setDonateStatus('');
      } else {
        setDonateStatus('failed: ' + (e.shortMessage || e.message));
      }
    } finally {
      setDonating(false);
    }
  }

  return (
    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <p style={{ fontFamily: "'Fredoka', sans-serif", color: '#131325', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          support hazza
        </p>
        <p style={{ color: '#8a7d5a', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          hazza doesn't charge marketplace fees. if you find this project useful and want to help keep it running, consider making a donation. every bit helps.
        </p>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '0.7rem 2rem', background: '#CF3748', color: '#fff',
            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem',
            cursor: 'pointer', fontFamily: "'Fredoka', sans-serif",
          }}
        >
          donate
        </button>
      </div>

      {/* Donate Modal */}
      {showModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(19,19,37,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10001, padding: '1rem',
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 12, padding: '1.5rem',
            width: '100%', maxWidth: 360, boxShadow: '0 8px 32px rgba(19,19,37,0.2)',
          }}>
            <h3 style={{ fontFamily: "'Fredoka', sans-serif", color: '#131325', fontSize: '1.1rem', marginBottom: '1rem', textAlign: 'center' }}>
              donate to hazza
            </h3>

            {/* Currency toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                onClick={() => { setCurrency('ETH'); setAmount(''); }}
                style={{
                  flex: 1, padding: '0.5rem', border: '2px solid', borderRadius: 6,
                  borderColor: currency === 'ETH' ? '#4870D4' : '#E8DCAB',
                  background: currency === 'ETH' ? '#4870D4' : '#fff',
                  color: currency === 'ETH' ? '#fff' : '#131325',
                  fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                }}
              >ETH</button>
              <button
                onClick={() => { setCurrency('USDC'); setAmount(''); }}
                style={{
                  flex: 1, padding: '0.5rem', border: '2px solid', borderRadius: 6,
                  borderColor: currency === 'USDC' ? '#4870D4' : '#E8DCAB',
                  background: currency === 'USDC' ? '#4870D4' : '#fff',
                  color: currency === 'USDC' ? '#fff' : '#131325',
                  fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                }}
              >USDC</button>
            </div>

            {/* Amount input */}
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={currency === 'ETH' ? '0.00' : '0.00'}
              step="any"
              min="0"
              style={{
                width: '100%', padding: '0.75rem', border: '2px solid #E8DCAB',
                borderRadius: 8, background: '#F7EBBD', color: '#131325',
                fontSize: '1.1rem', fontFamily: "'Fredoka', sans-serif",
                textAlign: 'center', outline: 'none', boxSizing: 'border-box',
                marginBottom: '1rem',
              }}
            />

            {/* Donate button */}
            {!address ? (
              <p style={{ color: '#8a7d5a', fontSize: '0.8rem', textAlign: 'center' }}>connect your wallet first</p>
            ) : (
              <button
                onClick={handleDonate}
                disabled={!isValid || donating}
                style={{
                  width: '100%', padding: '0.7rem', border: 'none', borderRadius: 8,
                  fontWeight: 700, fontSize: '0.95rem', cursor: isValid && !donating ? 'pointer' : 'not-allowed',
                  fontFamily: "'Fredoka', sans-serif",
                  background: isValid && !donating ? '#CF3748' : '#E8DCAB',
                  color: isValid && !donating ? '#fff' : '#8a7d5a',
                  opacity: donating ? 0.7 : 1,
                }}
              >
                {donating ? 'sending...' : isValid ? `donate ${amount} ${currency}` : 'enter an amount'}
              </button>
            )}

            {donateStatus && (
              <p style={{
                marginTop: '0.75rem', fontSize: '0.85rem', textAlign: 'center',
                color: donateStatus === 'thank you!' ? '#4870D4' : '#CF3748',
                fontFamily: "'Fredoka', sans-serif", fontWeight: 600,
              }}>
                {donateStatus}
              </p>
            )}

            {/* Close */}
            <button
              onClick={() => setShowModal(false)}
              style={{
                display: 'block', margin: '1rem auto 0', background: 'none',
                border: 'none', color: '#8a7d5a', fontSize: '0.8rem',
                cursor: 'pointer', fontFamily: "'Fredoka', sans-serif",
              }}
            >
              close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Marketplace Page
// ============================================================

export default function Marketplace() {
  const { address } = useAccount();
  const walletClient = useWalletClient();
  const publicClient = usePublicClient();
  const [activeTab, setActiveTab] = useState<TabKey>('browse');
  const [offerModalName, setOfferModalName] = useState<string | null>(null);
  const [chatTarget, setChatTarget] = useState<{ address: string; name: string; context?: string } | null>(null);

  // Cart state (shared across components)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('hazza_cart') || '[]'); } catch { return []; }
  });
  const [watchlist, setWatchlist] = useState<WatchItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('hazza_watchlist') || '[]'); } catch { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [executing, setExecuting] = useState(false);

  // Persist cart / watchlist
  useEffect(() => { localStorage.setItem('hazza_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('hazza_watchlist', JSON.stringify(watchlist)); }, [watchlist]);

  // Filter out stale cart items when listings load
  useEffect(() => {
    if (listings.length === 0) return;
    const activeOrderHashes = new Set(listings.map(l => l.orderHash));
    setCart(prev => {
      const filtered = prev.filter(item => item.type !== 'Buy' || !item.orderHash || activeOrderHashes.has(item.orderHash));
      return filtered.length !== prev.length ? filtered : prev;
    });
  }, [listings]);

  // Report watchlist to server on connect
  useEffect(() => {
    if (address && watchlist.length > 0) {
      watchlist.forEach(w => {
        fetch(`${API_BASE}/api/marketplace/watch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderHash: w.orderHash, address }) }).catch(() => {});
      });
    }
  }, [address, watchlist]);

  const loadListings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/listings`);
      const data = await res.json();
      setListings(data.listings || []);
    } catch {
      // ignore
    }
  }, []);

  // URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const sellName = params.get('sell');
    const buyHash = params.get('buy');
    if (sellName) {
      setActiveTab('mynames');
    } else if (buyHash) {
      setActiveTab('browse');
    } else if (tabParam && ['browse', 'mynames', 'offers', 'sales', 'forum', 'donate'].includes(tabParam)) {
      setActiveTab(tabParam as TabKey);
    }
  }, []);

  function removeFromCart(id: string) {
    setCart(prev => prev.filter(c => c.id !== id));
  }

  function addWatchlistToCart(w: WatchItem) {
    const item: CartItem = { id: `buy-${w.orderHash}`, type: 'Buy', name: w.name, price: w.price, currency: w.currency, orderHash: w.orderHash };
    setCart(prev => prev.find(c => c.id === item.id) ? prev : [...prev, item]);
  }

  const cartTotal = useMemo(() => {
    let eth = 0, usdc = 0;
    cart.forEach(c => {
      if (c.currency === 'ETH') eth += parseFloat(c.price) || 0;
      else usdc += parseFloat(c.price) || 0;
    });
    const parts: string[] = [];
    if (eth > 0) parts.push(`${eth.toFixed(4)} ETH`);
    if (usdc > 0) parts.push(`${usdc.toFixed(2)} USDC`);
    return parts.join(' + ') || '';
  }, [cart]);

  // --- Execute Cart ---
  async function executeCart() {
    if (cart.length === 0 || !address || !walletClient.data || !publicClient) return;
    setExecuting(true);
    setProgressSteps([]);

    const buys = cart.filter(c => c.type === 'Buy');

    // Process buys
    if (buys.length > 0) {
      const batchStep: ProgressStep = { text: `Preparing ${buys.length} purchase${buys.length > 1 ? 's' : ''}...`, status: 'active' };
      setProgressSteps(prev => [...prev, batchStep]);

      try {
        // Fetch all fulfillment txs in parallel
        const fulfillResults = await Promise.all(buys.map(b =>
          fetch(`${API_BASE}/api/marketplace/fulfill`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderHash: b.orderHash, buyerAddress: address }),
          }).then(r => r.json())
        ));

        const fulfillmentCalls: { target: string; value: bigint; data: string }[] = [];
        const validBuys: CartItem[] = [];
        const tokenNeeds: Record<string, { token: string; spender: string; amount: bigint }> = {};
        let totalEthValue = 0n;

        for (let j = 0; j < fulfillResults.length; j++) {
          const fr = fulfillResults[j];
          if (fr.error) {
            setProgressSteps(prev => [...prev, { text: `\u2717 ${buys[j].name}: ${fr.error}`, status: 'error' as const }]);
            continue;
          }
          if (fr.approvals) fr.approvals.forEach((a: any) => {
            if (a.spender && a.amount && a.amount !== '0') {
              const key = a.to.toLowerCase() + ':' + a.spender.toLowerCase();
              if (!tokenNeeds[key]) tokenNeeds[key] = { token: a.to, spender: a.spender, amount: 0n };
              tokenNeeds[key].amount += BigInt(a.amount);
            }
          });
          const fValue = BigInt(fr.fulfillment.value || '0');
          totalEthValue += fValue;
          fulfillmentCalls.push({ target: fr.fulfillment.to, value: fValue, data: fr.fulfillment.data });
          validBuys.push(buys[j]);
        }

        if (validBuys.length > 0) {
          // Balance check
          setProgressSteps(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], text: 'Checking balances...' };
            return updated;
          });

          const insufficientFunds: string[] = [];
          if (totalEthValue > 0n) {
            const ethBal = await publicClient.getBalance({ address });
            if (ethBal < totalEthValue) {
              insufficientFunds.push(`ETH: need ${formatEther(totalEthValue)}, have ${formatEther(ethBal)}`);
            }
          }
          const tokenPullsList = Object.values(tokenNeeds);
          for (const tn of tokenPullsList) {
            try {
              const bal = await publicClient.readContract({ address: tn.token as Address, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }) as bigint;
              if (bal < tn.amount) {
                let sym = 'token';
                let dec = 18;
                try { sym = await publicClient.readContract({ address: tn.token as Address, abi: ERC20_ABI, functionName: 'symbol' }) as string; } catch {}
                try { dec = Number(await publicClient.readContract({ address: tn.token as Address, abi: ERC20_ABI, functionName: 'decimals' })); } catch {}
                insufficientFunds.push(`${sym}: need ${formatUnits(tn.amount, dec)}, have ${formatUnits(bal, dec)}`);
              }
            } catch {
              // proceed
            }
          }

          if (insufficientFunds.length > 0) {
            setProgressSteps(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { text: `\u2717 Insufficient funds: ${insufficientFunds.join(', ')}`, status: 'error' };
              return updated;
            });
            setExecuting(false);
            return;
          }

          // Batch or single execution
          if (BATCH_EXECUTOR_ADDRESS && validBuys.length > 1) {
            // Approve tokens for batch executor
            if (tokenPullsList.length > 0) {
              setProgressSteps(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], text: 'Approving tokens for batch...' };
                return updated;
              });
              for (const tp of tokenPullsList) {
                try {
                  const currentAllowance = await publicClient.readContract({ address: tp.token as Address, abi: ERC20_ABI, functionName: 'allowance', args: [address, BATCH_EXECUTOR_ADDRESS as Address] }) as bigint;
                  if (currentAllowance < tp.amount) {
                    const hash = await walletClient.data.writeContract({ address: tp.token as Address, abi: ERC20_ABI, functionName: 'approve', args: [BATCH_EXECUTOR_ADDRESS as Address, tp.amount] });
                    await publicClient.waitForTransactionReceipt({ hash });
                  }
                } catch {}
              }
            }

            setProgressSteps(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { ...updated[updated.length - 1], text: `Confirm batch purchase (${validBuys.length} names)...` };
              return updated;
            });

            const batchTokens = tokenPullsList.map(tp => ({ token: tp.token as Address, amount: tp.amount, spender: tp.spender as Address }));
            const batchCalls = fulfillmentCalls.map(fc => ({ target: fc.target as Address, value: fc.value, data: fc.data as `0x${string}` }));

            const hash = await walletClient.data.writeContract({
              address: BATCH_EXECUTOR_ADDRESS as Address,
              abi: BATCH_EXECUTOR_ABI,
              functionName: 'executeBatch',
              args: [batchTokens, batchCalls],
              value: totalEthValue,
            });
            await publicClient.waitForTransactionReceipt({ hash });

            setProgressSteps(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { text: '\u2713 Batch transaction confirmed', status: 'done' };
              return updated;
            });

            for (const vb of validBuys) {
              setProgressSteps(prev => [...prev, { text: `\u2713 Bought: ${vb.name}`, status: 'done' as const }]);
              removeFromCart(vb.id);
            }
          } else {
            // Single buy execution
            for (const buyItem of validBuys) {
              setProgressSteps(prev => [...prev, { text: `Buy: ${buyItem.name}...`, status: 'active' as const }]);
              try {
                // Re-fetch fulfillment for single execution
                const res = await fetch(`${API_BASE}/api/marketplace/fulfill`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderHash: buyItem.orderHash, buyerAddress: address }),
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);

                if (data.approvals?.length) {
                  for (const a of data.approvals) {
                    const hash = await walletClient.data.sendTransaction({ to: a.to as Address, data: a.data as `0x${string}`, value: BigInt(a.value || '0') });
                    await publicClient.waitForTransactionReceipt({ hash });
                  }
                }

                const hash = await walletClient.data.sendTransaction({
                  to: data.fulfillment.to as Address,
                  data: data.fulfillment.data as `0x${string}`,
                  value: BigInt(data.fulfillment.value || '0'),
                });
                const receipt = await publicClient.waitForTransactionReceipt({ hash });

                if (receipt.status === 'success') {
                  setProgressSteps(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { text: `\u2713 Bought: ${buyItem.name}`, status: 'done' };
                    return updated;
                  });
                  removeFromCart(buyItem.id);
                } else {
                  setProgressSteps(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { text: `\u2717 Buy: ${buyItem.name} \u2014 reverted`, status: 'error' };
                    return updated;
                  });
                }
              } catch (e: any) {
                setProgressSteps(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { text: `\u2717 Buy: ${buyItem.name} \u2014 ${e.message || 'failed'}`, status: 'error' };
                  return updated;
                });
              }
            }
          }
        }
      } catch (e: any) {
        setProgressSteps(prev => [...prev, { text: `\u2717 Batch prepare failed: ${e.message || 'error'}`, status: 'error' as const }]);
      }
    }

    setExecuting(false);
    loadListings();
  }

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
  }

  function renderCartItems() {
    if (cart.length === 0) {
      return <p style={{ color: '#8a7d5a', textAlign: 'center', padding: '2rem 0' }}>Cart is empty</p>;
    }
    const activeOrderHashes = new Set(listings.map(l => l.orderHash));
    return (
      <>
        {cart.map(item => {
          const isExpired = item.type === 'Buy' && item.orderHash && !activeOrderHashes.has(item.orderHash);
          return (
            <div className="cart-item" key={item.id} style={isExpired ? { opacity: 0.5 } : undefined}>
              <div className="cart-item-info">
                <div className="cart-item-type">{item.type}</div>
                <div className="cart-item-name">{item.name}</div>
                <div className="cart-item-price">{item.price} {item.currency}</div>
                {isExpired && <div style={{ color: '#CF3748', fontSize: '0.7rem', fontWeight: 600 }}>listing expired</div>}
              </div>
              <button className="cart-item-remove" onClick={() => removeFromCart(item.id)}>{'\u2715'}</button>
            </div>
          );
        })}
      </>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="header" style={{ background: '#4870D4', padding: '1rem 1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#fff' }}>marketplace</h1>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ position: 'relative' }}>
        <button className={`tab${activeTab === 'browse' ? ' active' : ''}`} data-tab="browse" onClick={() => switchTab('browse')}>browse</button>
        <button className={`tab${activeTab === 'mynames' ? ' active' : ''}`} data-tab="mynames" onClick={() => switchTab('mynames')}>my names</button>
        <button className={`tab${activeTab === 'offers' ? ' active' : ''}`} data-tab="offers" onClick={() => switchTab('offers')}>offers</button>
        <button className={`tab${activeTab === 'sales' ? ' active' : ''}`} data-tab="sales" onClick={() => switchTab('sales')}>recent sales</button>
        <button className={`tab${activeTab === 'forum' ? ' active' : ''}`} data-tab="forum" onClick={() => switchTab('forum')}>forum</button>
        <button className={`tab${activeTab === 'donate' ? ' active' : ''}`} data-tab="donate" onClick={() => switchTab('donate')}>donate</button>
      </div>

      {/* Tab panels */}
      <div className={`tab-panel${activeTab === 'browse' ? ' active' : ''}`} id="panel-browse">
        {activeTab === 'browse' && (
          <BrowseTab
            address={address}
            cart={cart} setCart={setCart}
            watchlist={watchlist} setWatchlist={setWatchlist}
            listings={listings} loadListings={loadListings}
            setOfferModalName={setOfferModalName}
            switchTab={switchTab}
            onContactSeller={async (name) => {
              try {
                const contactUrl = address ? `${API_BASE}/api/contact/${name}?sender=${address}` : `${API_BASE}/api/contact/${name}`;
                const res = await fetch(contactUrl);
                const data = await res.json();
                if (data.contactAddress) {
                  setChatTarget({ address: data.contactAddress, name, context: `re: ${name} listing` });
                } else {
                  alert(`${name} has no XMTP address set. They can't receive messages yet.`);
                }
              } catch { alert('Failed to resolve contact info.'); }
            }}
          />
        )}
      </div>

      <div className={`tab-panel${activeTab === 'mynames' ? ' active' : ''}`} id="panel-mynames">
        {activeTab === 'mynames' && <MyNamesTab address={address} switchTab={switchTab} />}
      </div>

      <div className={`tab-panel${activeTab === 'offers' ? ' active' : ''}`} id="panel-offers">
        {activeTab === 'offers' && <OffersTab address={address} setOfferModalName={setOfferModalName} />}
      </div>

      <div className={`tab-panel${activeTab === 'sales' ? ' active' : ''}`} id="panel-sales">
        {activeTab === 'sales' && <SalesTab />}
      </div>

      <div className={`tab-panel${activeTab === 'forum' ? ' active' : ''}`} id="panel-forum">
        {activeTab === 'forum' && (
          <ForumTab
            address={address}
            onContactAuthor={async (authorName) => {
              try {
                const contactUrl = address ? `${API_BASE}/api/contact/${authorName}?sender=${address}` : `${API_BASE}/api/contact/${authorName}`;
                const res = await fetch(contactUrl);
                const data = await res.json();
                if (data.contactAddress) {
                  setChatTarget({ address: data.contactAddress, name: authorName, context: `re: forum post by ${authorName}` });
                } else {
                  alert(`${authorName} has no XMTP address set. They can't receive messages yet.`);
                }
              } catch { alert('Failed to resolve contact info.'); }
            }}
          />
        )}
      </div>

      <div className={`tab-panel${activeTab === 'donate' ? ' active' : ''}`} id="panel-donate">
        {activeTab === 'donate' && <DonateTab address={address} walletClient={walletClient.data} publicClient={publicClient} />}
      </div>

      {/* Cart FAB */}
      <button
        className="cart-fab"
        id="cart-fab"
        onClick={() => setCartOpen(true)}
        style={{ display: cart.length > 0 ? 'flex' : 'none' }}
      >
        {'\uD83D\uDED2'}<span className="badge" id="cart-badge">{cart.length}</span>
      </button>

      {/* Cart Drawer */}
      <div className={`cart-drawer${cartOpen ? ' open' : ''}`} id="cart-drawer">
        <div className="cart-drawer-header">
          <h3>Cart</h3>
          <button className="cart-drawer-close" onClick={() => setCartOpen(false)}>&times;</button>
        </div>
        <div className="cart-items" id="cart-items-list">
          {renderCartItems()}
        </div>
        {/* Saved/watchlist */}
        {watchlist.length > 0 && (
          <div className="cart-saved-section" id="cart-saved-section" style={{ padding: '0 1.25rem' }}>
            <div className="cart-saved-title">Saved for Later</div>
            <div id="cart-saved-list">
              {watchlist.map(w => (
                <div className="cart-item" key={w.orderHash}>
                  <div className="cart-item-info">
                    <div className="cart-item-name">{w.name}</div>
                    <div className="cart-item-price">{w.price} {w.currency}</div>
                  </div>
                  <button
                    className="btn-buy"
                    style={{ flex: 0, padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
                    onClick={() => addWatchlistToCart(w)}
                  >
                    + cart
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="cart-footer">
          <div className="cart-total" id="cart-total">{cartTotal ? `Total: ${cartTotal}` : ''}</div>
          {/* Progress bar */}
          {progressSteps.length > 0 && (
            <div className="progress-bar" id="cart-progress">
              {progressSteps.map((step, i) => (
                <div key={i} className={`progress-step ${step.status}`}>{step.text}</div>
              ))}
            </div>
          )}
          <button
            className="btn-execute"
            id="btn-execute-all"
            onClick={executeCart}
            disabled={cart.length === 0 || executing}
          >
            Execute All
          </button>
        </div>
      </div>

      {/* Offer Modal */}
      {offerModalName && address && walletClient.data && publicClient && (
        <OfferModal
          name={offerModalName}
          address={address}
          walletClient={walletClient.data}
          publicClient={publicClient}
          onClose={() => setOfferModalName(null)}
        />
      )}

      {/* Chat Panel — contact seller / forum DM */}
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
