import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { parseAbi, type Address } from 'viem';
import {
  REGISTRY_ADDRESS, USDC_ADDRESS, RELAYER_ADDRESS, USDC_ABI, REGISTRY_ABI, ERC721_ABI,
  SEAPORT_ADDRESS, BAZAAR_ADDRESS, MARKETPLACE_FEE_BPS, TREASURY_ADDRESS, BOUNTY_ESCROW_ADDRESS,
} from '../config/contracts';

/** Extract readable text from XMTP message content (may be string, object with text field, etc.) */
function extractTextContent(content: unknown): string | null {
  if (!content) return null;
  if (typeof content === 'string') return content;
  if (typeof content === 'object') {
    const c = content as Record<string, unknown>;
    // Skip XMTP system/metadata messages (group membership changes, admin changes, etc.)
    if ('initiatedByInboxId' in c || 'addedInboxes' in c || 'removedInboxes' in c ||
        'metadataFieldChanges' in c || 'addedAdminInboxes' in c || 'leftInboxes' in c) {
      return null;
    }
    // XMTP content types: { text: "..." } or { content: "..." }
    if (typeof c.text === 'string') return c.text;
    if (typeof c.content === 'string') return c.content;
  }
  return null;
}

/** Try to parse a message as a structured action card from Nomi */
function parseActionCard(text: string): ActionCard | null {
  if (!text.startsWith('{"type":"')) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed.type && ['register_card', 'buy_card', 'list_card', 'transfer_card', 'set_record_card'].includes(parsed.type)) {
      return parsed as ActionCard;
    }
  } catch { /* not JSON */ }
  return null;
}

type ActionCard =
  | { type: 'register_card'; name: string; price: string; priceRaw: string; free: boolean; relayer: string; freeClaim: any }
  | { type: 'buy_card'; name: string; price: string; priceRaw: string; currency: string; orderHash?: string; seller: string; source: 'seaport' }
  | { type: 'list_card'; name: string; price: string; priceWei: string; bountyWei?: string; bountyEth?: string; netEth?: string; tokenId: string; owner: string; registryAddress: string; duration?: string }
  | { type: 'transfer_card'; name: string; tokenId: string; from: string; to: string; toName: string | null; registryAddress: string }
  | { type: 'set_record_card'; name: string; key: string; value: string; registryAddress: string }
  | { type: 'cancel_card'; name: string; orderHash: string; tokenId: string; registryAddress: string };

interface ChatMessage {
  id: string;
  content: string;
  sender: 'remote' | 'user' | 'system';
  timestamp: Date;
  card?: ActionCard | null;
}

type XmtpStatus = 'idle' | 'creating-client' | 'client-ready' | 'connecting-convo' | 'connected' | 'error';
type CardStatus = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

export interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  targetAddress: string;
  targetName: string;
  targetAvatar?: string;
  greeting?: string;
  context?: string;
  xmtpClient?: any;
}

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
const ZONE_PUBLIC = '0x000000007F8c58fbf215bF91Bda7421A806cf3ae' as const;

const SEAPORT_ABI_MINI = parseAbi([
  'function getCounter(address offerer) view returns (uint256)',
]);

const SEAPORT_CANCEL_ABI = [{
  name: 'cancel', type: 'function' as const, stateMutability: 'nonpayable' as const,
  inputs: [{ name: 'orders', type: 'tuple[]', components: [
    { name: 'offerer', type: 'address' }, { name: 'zone', type: 'address' },
    { name: 'offer', type: 'tuple[]', components: [{ name: 'itemType', type: 'uint8' }, { name: 'token', type: 'address' }, { name: 'identifierOrCriteria', type: 'uint256' }, { name: 'startAmount', type: 'uint256' }, { name: 'endAmount', type: 'uint256' }] },
    { name: 'consideration', type: 'tuple[]', components: [{ name: 'itemType', type: 'uint8' }, { name: 'token', type: 'address' }, { name: 'identifierOrCriteria', type: 'uint256' }, { name: 'startAmount', type: 'uint256' }, { name: 'endAmount', type: 'uint256' }, { name: 'recipient', type: 'address' }] },
    { name: 'orderType', type: 'uint8' }, { name: 'startTime', type: 'uint256' }, { name: 'endTime', type: 'uint256' },
    { name: 'zoneHash', type: 'bytes32' }, { name: 'salt', type: 'uint256' }, { name: 'conduitKey', type: 'bytes32' },
    { name: 'totalOriginalConsiderationItems', type: 'uint256' }, { name: 'counter', type: 'uint256' },
  ]}],
  outputs: [{ name: 'cancelled', type: 'bool' }],
}] as const;

const BAZAAR_SUBMIT_ABI = [{
  name: 'submit', type: 'function' as const, stateMutability: 'nonpayable' as const,
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

const BOUNTY_ESCROW_ABI = parseAbi([
  'function registerBounty(uint256 tokenId, uint256 bountyAmount) external',
]);

function generateSalt(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
}

export default function ChatPanel({
  isOpen, onClose, targetAddress, targetName, targetAvatar, greeting, context, xmtpClient,
}: ChatPanelProps) {
  const defaultGreeting = useMemo(() => greeting || `gm. you're chatting with ${targetName}.`, [greeting, targetName]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'greeting', content: defaultGreeting, sender: 'remote', timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [xmtpStatus, setXmtpStatus] = useState<XmtpStatus>('idle');
  const [cardStatuses, setCardStatuses] = useState<Record<string, { status: CardStatus; error?: string; txHash?: string }>>({});
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<any>(null);
  const clientRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const crossOriginErrorRef = useRef(false);
  const prevTargetRef = useRef(targetAddress);
  const prevAddressRef = useRef<string | undefined>(undefined);

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const scrollToBottom = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && textareaRef.current) textareaRef.current.focus();
  }, [isOpen]);

  const msgCounterRef = useRef(0);
  const addMsg = useCallback((text: string, sender: 'remote' | 'user' | 'system', card?: ActionCard | null) => {
    const seq = ++msgCounterRef.current;
    setMessages((prev) => [
      ...prev,
      { id: `${sender}-${Date.now()}-${seq}`, content: text, sender, timestamp: new Date(), card },
    ]);
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      try { streamRef.current.return?.(); } catch (_e) { /* */ }
      streamRef.current = null;
    }
  }, []);

  const closeClient = useCallback(() => {
    stopStream();
    conversationRef.current = null;
    if (clientRef.current) {
      try { clientRef.current.close?.(); } catch (_e) { /* */ }
      clientRef.current = null;
    }
  }, [stopStream]);

  useEffect(() => {
    if (address !== prevAddressRef.current) {
      prevAddressRef.current = address;
      closeClient();

      setXmtpStatus('idle');
      setMessages([
        { id: 'greeting', content: defaultGreeting, sender: 'remote', timestamp: new Date() },
      ]);
    }
  }, [address, closeClient, defaultGreeting]);

  useEffect(() => {
    if (targetAddress !== prevTargetRef.current) {
      prevTargetRef.current = targetAddress;

      setMessages([
        { id: 'greeting', content: defaultGreeting, sender: 'remote', timestamp: new Date() },
      ]);
      stopStream();
      conversationRef.current = null;
      if (clientRef.current) {
        setXmtpStatus('client-ready');
      } else {
        setXmtpStatus('idle');
      }
    }
  }, [targetAddress, defaultGreeting, stopStream]);

  useEffect(() => {
    if (xmtpClient && !clientRef.current) {
      clientRef.current = xmtpClient;
      setXmtpStatus('client-ready');
    }
  }, [xmtpClient]);

  const createClient = useCallback(async () => {
    if (xmtpClient) {
      clientRef.current = xmtpClient;
      setXmtpStatus('client-ready');
      return;
    }

    if (!isConnected || !walletClient || !address) {

      return;
    }

    setXmtpStatus('creating-client');

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
      clientRef.current = client;

      setXmtpStatus('client-ready');
    } catch (err: any) {
      console.error('XMTP client creation failed:', err);
      setXmtpStatus('error');
      const msg = err.message || String(err);
      if (msg.includes('cannot be accessed from origin') || msg.includes('Worker')) {
        crossOriginErrorRef.current = true;
        addMsg('in-page XMTP chat isn\'t available yet — use the direct link below to message ' + targetName + '.', 'system');
      } else {
        addMsg('XMTP error: ' + msg, 'system');
      }
    }
  }, [isConnected, walletClient, address, addMsg, xmtpClient]);

  const createConversation = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !targetAddress) return;

    setXmtpStatus('connecting-convo');

    try {
      const xmtp = await import('@xmtp/browser-sdk');
      const dm = await client.conversations.createDmWithIdentifier({
        identifier: targetAddress,
        identifierKind: xmtp.IdentifierKind.Ethereum,
      });
      conversationRef.current = dm;

      const existing = await dm.messages();
      const inboxId = client.inboxId;

      const mapped: ChatMessage[] = [];
      for (let i = 0; i < existing.length; i++) {
        const m = existing[i];
        const text = extractTextContent(m.content);
        if (text) {
          const card = parseActionCard(text);
          mapped.push({
            id: m.id || `msg-${i}`,
            content: card ? '' : text,
            sender: m.senderInboxId !== inboxId ? 'remote' : 'user',
            timestamp: m.sentAt || new Date(),
            card,
          });
        }
      }

      if (mapped.length > 0) {
        setMessages([
          { id: 'greeting', content: defaultGreeting, sender: 'remote', timestamp: new Date(0) },
          ...mapped,
        ]);
      }

      setXmtpStatus('connected');

      streamRef.current = await dm.stream();
      (async () => {
        try {
          for await (const msg of streamRef.current) {
            const streamText = msg?.content ? extractTextContent(msg.content) : null;
            if (streamText && msg.senderInboxId !== inboxId) {
              const card = parseActionCard(streamText);
              const chatMsg: ChatMessage = {
                id: msg.id || `stream-${Date.now()}`,
                content: card ? '' : streamText,
                sender: 'remote',
                timestamp: msg.sentAt || new Date(),
                card,
              };
              setMessages((prev) => prev.some((m) => m.id === chatMsg.id) ? prev : [...prev, chatMsg]);
            }
          }
        } catch (_e) { /* stream ended */ }
      })();
    } catch (err: any) {
      console.error('XMTP conversation failed:', err);
      setXmtpStatus('error');
      addMsg('XMTP error: ' + (err.message || err), 'system');
    }
  }, [targetAddress, defaultGreeting, addMsg]);

  useEffect(() => {
    if (isOpen && isConnected && walletClient && address && xmtpStatus === 'idle' && targetAddress) {
      createClient();
    }
  }, [isOpen, isConnected, walletClient, address, xmtpStatus, targetAddress, createClient]);

  useEffect(() => {
    if (isOpen && xmtpStatus === 'client-ready' && targetAddress && clientRef.current) {
      createConversation();
    }
  }, [isOpen, xmtpStatus, targetAddress, createConversation]);

  useEffect(() => {
    return () => {
      stopStream();
      if (clientRef.current && !xmtpClient) {
        try { clientRef.current.close?.(); } catch (_e) { /* */ }
        clientRef.current = null;
      }
    };
  }, [stopStream, xmtpClient]);

  // --- Card action handlers ---

  const setCardStatus = useCallback((cardId: string, status: CardStatus, extra?: { error?: string; txHash?: string }) => {
    setCardStatuses(prev => ({ ...prev, [cardId]: { status, ...extra } }));
  }, []);

  const handleRegister = useCallback(async (card: Extract<ActionCard, { type: 'register_card' }>, cardId: string) => {
    if (!walletClient || !address || !publicClient) return;
    setCardStatus(cardId, 'pending');

    try {
      if (card.free) {
        // Free registration — just POST to x402, no USDC transfer needed
        const res = await fetch('https://hazza.name/x402/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: card.name, owner: address }),
        });
        const data = await res.json();
        if (res.ok) {
          setCardStatus(cardId, 'success', { txHash: data.registrationTx });
          addMsg(`${card.name}.hazza.name is yours! view your profile at ${card.name}.hazza.name`, 'system');
        } else {
          setCardStatus(cardId, 'error', { error: data.error || 'registration failed' });
        }
      } else {
        // Paid registration — transfer USDC to relayer, then POST with payment header
        setCardStatus(cardId, 'confirming');
        const amount = BigInt(card.priceRaw);

        const txHash = await walletClient.writeContract({
          address: USDC_ADDRESS as Address,
          abi: USDC_ABI,
          functionName: 'transfer',
          args: [card.relayer as Address, amount],
        });

        // Wait for USDC transfer confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== 'success') {
          setCardStatus(cardId, 'error', { error: 'USDC transfer failed' });
          return;
        }

        // Now POST to x402 with payment header
        const payment = btoa(JSON.stringify({ scheme: 'exact', txHash, from: address }));
        const res = await fetch('https://hazza.name/x402/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-PAYMENT': payment,
          },
          body: JSON.stringify({ name: card.name, owner: address }),
        });
        const data = await res.json();
        if (res.ok) {
          setCardStatus(cardId, 'success', { txHash: data.registrationTx || txHash });
          addMsg(`${card.name}.hazza.name is yours! view your profile at ${card.name}.hazza.name`, 'system');
        } else {
          setCardStatus(cardId, 'error', { error: data.error || 'registration failed after payment' });
        }
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setCardStatus(cardId, 'error', { error: err.shortMessage || err.message || 'transaction failed' });
    }
  }, [walletClient, address, publicClient, setCardStatus, addMsg]);

  const handleBuy = useCallback(async (card: Extract<ActionCard, { type: 'buy_card' }>, cardId: string) => {
    if (!walletClient || !address || !publicClient) return;
    setCardStatus(cardId, 'pending');

    try {
      if (card.source === 'seaport' && card.orderHash) {
        // Get fulfillment data from API
        const res = await fetch('https://hazza.name/api/marketplace/fulfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderHash: card.orderHash, buyerAddress: address }),
        });
        const data = await res.json();
        if (!res.ok) {
          setCardStatus(cardId, 'error', { error: data.error || 'failed to get buy data' });
          return;
        }

        setCardStatus(cardId, 'confirming');

        // Execute approval transactions if needed
        if (data.approvals?.length > 0) {
          for (const approval of data.approvals) {
            const approveTx = await walletClient.sendTransaction({
              to: approval.to as Address,
              data: approval.data as `0x${string}`,
              value: BigInt(approval.value || '0'),
            });
            await publicClient.waitForTransactionReceipt({ hash: approveTx });
          }
        }

        // Execute fulfillment
        const txHash = await walletClient.sendTransaction({
          to: data.fulfillment.to as Address,
          data: data.fulfillment.data as `0x${string}`,
          value: BigInt(data.fulfillment.value || '0'),
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        if (receipt.status === 'success') {
          setCardStatus(cardId, 'success', { txHash });
          addMsg(`you now own ${card.name}.hazza.name!`, 'system');
        } else {
          setCardStatus(cardId, 'error', { error: 'purchase transaction failed' });
        }
      } else {
        setCardStatus(cardId, 'error', { error: 'invalid listing data — missing order' });
      }
    } catch (err: any) {
      console.error('Buy error:', err);
      setCardStatus(cardId, 'error', { error: err.shortMessage || err.message || 'transaction failed' });
    }
  }, [walletClient, address, publicClient, setCardStatus, addMsg]);

  const handleList = useCallback(async (card: Extract<ActionCard, { type: 'list_card' }>, cardId: string) => {
    if (!walletClient || !address || !publicClient) return;
    setCardStatus(cardId, 'pending');

    try {
      // Step 1: Approve Seaport to transfer the NFT (setApprovalForAll)
      const isApproved = await publicClient.readContract({
        address: REGISTRY_ADDRESS as Address,
        abi: ERC721_ABI,
        functionName: 'isApprovedForAll',
        args: [address, SEAPORT_ADDRESS as Address],
      });
      if (!isApproved) {
        setCardStatus(cardId, 'confirming');
        const approveTx = await walletClient.writeContract({
          address: REGISTRY_ADDRESS as Address,
          abi: ERC721_ABI,
          functionName: 'setApprovalForAll',
          args: [SEAPORT_ADDRESS as Address, true],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }

      // Step 2: Get Seaport counter
      const counter = await publicClient.readContract({
        address: SEAPORT_ADDRESS as Address,
        abi: SEAPORT_ABI_MINI,
        functionName: 'getCounter',
        args: [address],
      }) as bigint;

      // Step 3: Build Seaport order — seller offers NFT, consideration splits payment
      const priceWei = BigInt(card.priceWei);
      const feeAmount = (priceWei * BigInt(MARKETPLACE_FEE_BPS)) / 10000n;
      const bountyWei = card.bountyWei ? BigInt(card.bountyWei) : 0n;
      if (bountyWei + feeAmount >= priceWei) {
        setCardStatus(cardId, 'error', { error: 'bounty cannot exceed listing price' });
        return;
      }
      const sellerAmount = priceWei - feeAmount - bountyWei;
      const dur = card.duration ? parseInt(card.duration) : 0;
      const endTime = dur === 0
        ? BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
        : BigInt(Math.floor(Date.now() / 1000) + dur);

      const offer = [{
        itemType: 2, token: REGISTRY_ADDRESS as Address,
        identifierOrCriteria: BigInt(card.tokenId), startAmount: 1n, endAmount: 1n,
      }];

      const consideration: any[] = [{
        itemType: 0, token: '0x0000000000000000000000000000000000000000' as Address,
        identifierOrCriteria: 0n, startAmount: sellerAmount, endAmount: sellerAmount, recipient: address,
      }];
      if (feeAmount > 0n) {
        consideration.push({
          itemType: 0, token: '0x0000000000000000000000000000000000000000' as Address,
          identifierOrCriteria: 0n, startAmount: feeAmount, endAmount: feeAmount, recipient: TREASURY_ADDRESS as Address,
        });
      }
      if (bountyWei > 0n && BOUNTY_ESCROW_ADDRESS) {
        consideration.push({
          itemType: 0, token: '0x0000000000000000000000000000000000000000' as Address,
          identifierOrCriteria: 0n, startAmount: bountyWei, endAmount: bountyWei, recipient: BOUNTY_ESCROW_ADDRESS as Address,
        });
      }

      const salt = generateSalt();

      // Step 4: EIP-712 sign the order
      setCardStatus(cardId, 'confirming');
      const signature = await walletClient.signTypedData({
        domain: SEAPORT_DOMAIN,
        types: SEAPORT_EIP712_TYPES,
        primaryType: 'OrderComponents',
        message: {
          offerer: address, zone: ZONE_PUBLIC, offer, consideration,
          orderType: 2, startTime: 0n, endTime,
          zoneHash: ZERO_BYTES32, salt, conduitKey: ZERO_BYTES32, counter,
        },
      });

      // Step 5: Submit to Bazaar — this makes the listing appear on hazza marketplace AND netprotocol.app/bazaar
      const txHash = await walletClient.writeContract({
        address: BAZAAR_ADDRESS as Address,
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
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === 'success') {
        // Register bounty on escrow contract if bounty specified
        if (bountyWei > 0n && BOUNTY_ESCROW_ADDRESS) {
          try {
            const bountyHash = await walletClient.writeContract({
              address: BOUNTY_ESCROW_ADDRESS as Address,
              abi: BOUNTY_ESCROW_ABI,
              functionName: 'registerBounty',
              args: [BigInt(card.tokenId), bountyWei],
            });
            await publicClient.waitForTransactionReceipt({ hash: bountyHash });
          } catch (e: any) {
            console.warn('Bounty registration failed (listing still active):', e.message);
            addMsg(`warning: listing is live but bounty registration failed. the ${card.bountyEth} ETH agent bounty was not registered.`, 'system');
          }
        }
        setCardStatus(cardId, 'success', { txHash });
        const bountyMsg = card.bountyEth && card.bountyEth !== '0' ? ` with ${card.bountyEth} ETH agent bounty.` : '.';
        addMsg(`${card.name}.hazza.name is now listed for ${card.price}${bountyMsg} live on hazza.name/marketplace and netprotocol.app/bazaar.`, 'system');
      } else {
        setCardStatus(cardId, 'error', { error: 'listing transaction failed' });
      }
    } catch (err: any) {
      console.error('List error:', err);
      setCardStatus(cardId, 'error', { error: err.shortMessage || err.message || 'transaction failed' });
    }
  }, [walletClient, address, publicClient, setCardStatus, addMsg]);

  const handleTransfer = useCallback(async (card: Extract<ActionCard, { type: 'transfer_card' }>, cardId: string) => {
    if (!walletClient || !address || !publicClient) return;
    setCardStatus(cardId, 'pending');

    try {
      setCardStatus(cardId, 'confirming');
      const txHash = await walletClient.writeContract({
        address: card.registryAddress as Address,
        abi: REGISTRY_ABI,
        functionName: 'safeTransferFrom',
        args: [address as Address, card.to as Address, BigInt(card.tokenId)],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === 'success') {
        setCardStatus(cardId, 'success', { txHash });
        addMsg(`${card.name}.hazza.name has been transferred to ${card.toName || card.to.slice(0, 8) + '...'}!`, 'system');
      } else {
        setCardStatus(cardId, 'error', { error: 'transfer transaction failed' });
      }
    } catch (err: any) {
      console.error('Transfer error:', err);
      setCardStatus(cardId, 'error', { error: err.shortMessage || err.message || 'transaction failed' });
    }
  }, [walletClient, address, publicClient, setCardStatus, addMsg]);

  const handleSetRecord = useCallback(async (card: Extract<ActionCard, { type: 'set_record_card' }>, cardId: string) => {
    if (!walletClient || !address || !publicClient) return;
    setCardStatus(cardId, 'pending');

    try {
      setCardStatus(cardId, 'confirming');
      const txHash = await walletClient.writeContract({
        address: card.registryAddress as Address,
        abi: REGISTRY_ABI,
        functionName: 'setText',
        args: [card.name, card.key, card.value],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === 'success') {
        setCardStatus(cardId, 'success', { txHash });
        addMsg(`${card.key} updated for ${card.name}.hazza.name!`, 'system');
      } else {
        setCardStatus(cardId, 'error', { error: 'set record transaction failed' });
      }
    } catch (err: any) {
      console.error('Set record error:', err);
      setCardStatus(cardId, 'error', { error: err.shortMessage || err.message || 'transaction failed' });
    }
  }, [walletClient, address, publicClient, setCardStatus, addMsg]);

  const handleCancel = useCallback(async (card: Extract<ActionCard, { type: 'cancel_card' }>, cardId: string) => {
    if (!walletClient || !address || !publicClient) return;
    setCardStatus(cardId, 'pending');

    try {
      // Fetch the listing from the worker to get the full order components
      const res = await fetch(`/api/marketplace/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderHash: card.orderHash }),
      });
      const data = await res.json() as any;
      if (!res.ok) {
        setCardStatus(cardId, 'error', { error: data.error || 'failed to prepare cancel' });
        return;
      }

      // Send the cancel tx via the user's wallet
      setCardStatus(cardId, 'confirming');
      const txHash = await walletClient.sendTransaction({
        to: data.cancel.to as Address,
        data: data.cancel.data as `0x${string}`,
        value: 0n,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === 'success') {
        setCardStatus(cardId, 'success', { txHash });
        addMsg(`${card.name}.hazza.name listing has been cancelled.`, 'system');
      } else {
        setCardStatus(cardId, 'error', { error: 'cancel transaction failed' });
      }
    } catch (err: any) {
      console.error('Cancel error:', err);
      setCardStatus(cardId, 'error', { error: err.shortMessage || err.message || 'transaction failed' });
    }
  }, [walletClient, address, publicClient, setCardStatus, addMsg]);

  const handleCardAction = useCallback((card: ActionCard, cardId: string) => {
    switch (card.type) {
      case 'register_card': handleRegister(card, cardId); break;
      case 'buy_card': handleBuy(card, cardId); break;
      case 'list_card': handleList(card, cardId); break;
      case 'transfer_card': handleTransfer(card, cardId); break;
      case 'set_record_card': handleSetRecord(card, cardId); break;
      case 'cancel_card': handleCancel(card, cardId); break;
    }
  }, [handleRegister, handleBuy, handleList, handleTransfer, handleSetRecord, handleCancel]);

  function handleRetry() {
    setXmtpStatus('idle');
    xmtpAttemptedRef.current = false;
  }

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    addMsg(text, 'user');
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    if (xmtpStatus !== 'connected' || !conversationRef.current) {
      return;
    }

    conversationRef.current.sendText(text).catch((err: any) => {
      addMsg('failed to send: ' + err.message, 'system');
    });
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 80) + 'px';
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function getStatusText(): string {
    if (!isConnected) return 'connect wallet to chat';
    switch (xmtpStatus) {
      case 'creating-client': return 'signing in...';
      case 'client-ready':
      case 'connecting-convo': return 'connecting...';
      case 'connected': return 'online';
      case 'error': return 'error';
      default: return 'ready';
    }
  }

  // --- Card rendering ---

  function renderCard(card: ActionCard, msgId: string) {
    const cs = cardStatuses[msgId] || { status: 'idle' as CardStatus };
    const disabled = !isConnected || !walletClient || cs.status === 'pending' || cs.status === 'confirming' || cs.status === 'success';

    const buttonLabel = (() => {
      if (cs.status === 'pending') return 'preparing...';
      if (cs.status === 'confirming') return 'confirm in wallet...';
      if (cs.status === 'success') return 'done!';
      if (cs.status === 'error') return 'retry';
      switch (card.type) {
        case 'register_card': return card.free ? 'register (free)' : `register (${card.price})`;
        case 'buy_card': return `buy (${card.price})`;
        case 'list_card': return `list for ${card.price}`;
        case 'transfer_card': return 'transfer';
        case 'set_record_card': return `set ${card.key}`;
        case 'cancel_card': return 'cancel listing';
      }
    })();

    const title = (() => {
      switch (card.type) {
        case 'register_card': return `register ${card.name}.hazza.name`;
        case 'buy_card': return `buy ${card.name}.hazza.name`;
        case 'list_card': return `list ${card.name}.hazza.name`;
        case 'transfer_card': return `transfer ${card.name}.hazza.name`;
        case 'set_record_card': return `update ${card.key}`;
        case 'cancel_card': return `cancel ${card.name}.hazza.name listing`;
      }
    })();

    const details = (() => {
      switch (card.type) {
        case 'register_card':
          return card.free ? 'free registration (gas only ~$0.01)' : `${card.price} — pay once, own forever`;
        case 'buy_card':
          return `${card.price} from ${card.seller.slice(0, 6)}...${card.seller.slice(-4)}`;
        case 'list_card':
          if (card.bountyEth && card.bountyEth !== '0') {
            return `sale price: ${card.price}\nagent bounty: ${card.bountyEth} ETH\nyou receive: ${card.netEth} ETH\nlisted on hazza + bazaar`;
          }
          return `${card.price} — no agent bounty\nlisted on hazza + bazaar`;
        case 'transfer_card':
          return `to ${card.toName ? card.toName + '.hazza.name' : card.to.slice(0, 8) + '...' + card.to.slice(-4)}`;
        case 'set_record_card':
          return `${card.key} = "${card.value}"`;
        case 'cancel_card':
          return `this will cancel and delist ${card.name}.hazza.name from the marketplace`;
      }
    })();

    const iconColor = cs.status === 'success' ? '#22c55e' : cs.status === 'error' ? '#ef4444' : '#4870D4';

    return (
      <div className="ch-action-card" style={{
        alignSelf: 'flex-start', maxWidth: '85%', background: '#fff',
        border: `2px solid ${iconColor}`, borderRadius: 12,
        padding: '0.7rem 0.85rem', fontFamily: "'DM Sans', sans-serif",
        boxShadow: '0 2px 8px rgba(19,19,37,0.1)',
      }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#131325', marginBottom: 4, fontFamily: "'Fredoka', sans-serif" }}>
          {title}
        </div>
        <div style={{ fontSize: '0.78rem', color: '#666', marginBottom: 8, whiteSpace: 'pre-line' }}>
          {details}
        </div>
        {cs.status === 'error' && cs.error && (
          <div style={{ fontSize: '0.72rem', color: '#ef4444', marginBottom: 6 }}>{cs.error}</div>
        )}
        {cs.status === 'success' && cs.txHash && (
          <a
            href={`https://basescan.org/tx/${cs.txHash}`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '0.72rem', color: '#4870D4', display: 'block', marginBottom: 6 }}
          >
            view on basescan
          </a>
        )}
        <button
          onClick={() => handleCardAction(card, msgId)}
          disabled={disabled && cs.status !== 'error'}
          style={{
            width: '100%', padding: '0.45rem', background: disabled && cs.status !== 'error'
              ? (cs.status === 'success' ? '#22c55e' : '#ccc')
              : 'linear-gradient(180deg, #d94356 0%, #CF3748 100%)',
            color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700,
            fontFamily: "'Fredoka', sans-serif", fontSize: '0.82rem', cursor: disabled && cs.status !== 'error' ? 'default' : 'pointer',
            boxShadow: disabled ? 'none' : '0 2px 6px rgba(207,55,72,0.25)',
            transition: 'transform 0.15s',
          }}
        >
          {buttonLabel}
        </button>
      </div>
    );
  }

  if (!isOpen) return null;

  const fallbackUrl = `https://xmtp.chat/production/dm/${targetAddress}`;

  return (
    <>
      <style>{`
        .chat-panel-backdrop {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(19,19,37,0.6); z-index: 10001;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.25s; pointer-events: none;
        }
        .chat-panel-backdrop.open { opacity: 1; pointer-events: auto; }
        .chat-panel {
          width: 380px; max-width: calc(100vw - 2rem); height: 420px; max-height: calc(100vh - 3rem);
          background: #F7EBBD; border-radius: 16px; border: 3px solid #CF3748;
          box-shadow: 0 12px 48px rgba(19,19,37,0.25);
          z-index: 10002; display: flex; flex-direction: column;
          transform: scale(0.9); opacity: 0; transition: transform 0.25s ease, opacity 0.25s ease;
        }
        .chat-panel-backdrop.open .chat-panel { transform: scale(1); opacity: 1; }
        @media (max-width: 600px) {
          .chat-panel-backdrop { align-items: flex-start; padding-top: 4rem; }
          .chat-panel { height: 40vh; max-height: 300px; max-width: calc(100vw - 1.5rem); width: calc(100vw - 1.5rem); }
        }
        .chat-panel-header {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.75rem 1rem; background: linear-gradient(135deg, #d94356 0%, #CF3748 100%);
          border-radius: 13px 13px 0 0; flex-shrink: 0;
        }
        .chat-panel-header img { width: 36px; height: 36px; border-radius: 50%; border: 2px solid #fff; background: #FFDAB9; }
        .chat-panel-header .ch-name { color: #fff; font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 1rem; }
        .chat-panel-header .ch-status { color: rgba(255,255,255,0.7); font-size: 0.75rem; font-family: 'DM Sans', sans-serif; }
        .chat-panel-header .ch-context { color: rgba(255,255,255,0.6); font-size: 0.65rem; font-family: 'DM Sans', sans-serif; font-style: italic; }
        .chat-panel-header .ch-close {
          background: none; border: none; color: #fff; font-size: 1.3rem; cursor: pointer;
          padding: 0.25rem; line-height: 1; opacity: 0.8; transition: opacity 0.15s; margin-left: auto;
        }
        .chat-panel-header .ch-close:hover { opacity: 1; }
        .chat-panel-messages {
          flex: 1; overflow-y: auto; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.5rem;
        }
        .chat-panel-messages::-webkit-scrollbar { width: 4px; }
        .chat-panel-messages::-webkit-scrollbar-thumb { background: #E8DCAB; border-radius: 2px; }
        .ch-msg {
          max-width: 80%; padding: 0.6rem 0.85rem; border-radius: 12px;
          font-size: 0.88rem; line-height: 1.45; word-break: break-word;
        }
        .ch-msg.remote {
          align-self: flex-start; background: #fff; color: #131325;
          border: 2px solid #E8DCAB; border-bottom-left-radius: 4px;
          box-shadow: 0 1px 4px rgba(19,19,37,0.06); font-family: 'Fredoka', sans-serif;
        }
        .ch-msg.user {
          align-self: flex-end; background: linear-gradient(135deg, #d94356 0%, #CF3748 100%);
          color: #fff; border-bottom-right-radius: 4px;
          box-shadow: 0 1px 4px rgba(207,55,72,0.2); font-family: 'DM Sans', sans-serif;
        }
        .ch-msg.system {
          align-self: center; background: transparent; color: #8a7d5a;
          font-size: 0.78rem; text-align: center; font-family: 'DM Sans', sans-serif; padding: 0.25rem 0;
        }
        .chat-panel-input {
          display: flex; gap: 0.5rem; padding: 0.6rem 0.75rem;
          border-top: 2px solid #E8DCAB; background: #fff; flex-shrink: 0;
          border-radius: 0 0 13px 13px;
        }
        .chat-panel-input textarea {
          flex: 1; padding: 0.45rem 0.65rem; border: 2px solid #E8DCAB; border-radius: 8px;
          background: #fff; color: #131325; font-size: 16px; font-family: 'DM Sans', sans-serif;
          outline: none; resize: none; min-height: 36px; max-height: 72px;
          box-shadow: inset 0 1px 3px rgba(19,19,37,0.06); transition: border-color 0.2s;
        }
        .chat-panel-input textarea:focus { border-color: #4870D4; }
        .chat-panel-input button {
          padding: 0.45rem 0.85rem; background: linear-gradient(180deg, #d94356 0%, #CF3748 100%);
          color: #fff; border: none; border-radius: 8px; font-weight: 700;
          font-family: 'Fredoka', sans-serif; font-size: 0.85rem; cursor: pointer;
          box-shadow: 0 2px 6px rgba(207,55,72,0.25); transition: transform 0.15s; align-self: flex-end;
        }
        .chat-panel-input button:hover { transform: translateY(-1px); }
        .chat-panel-input button:disabled { opacity: 0.5; cursor: default; transform: none; }
        .ch-retry-btn {
          background: none; border: 2px solid #4870D4; color: #4870D4; border-radius: 6px;
          padding: 0.3rem 0.75rem; font-size: 0.78rem; font-weight: 700; cursor: pointer;
          font-family: 'DM Sans', sans-serif; margin-top: 0.25rem;
        }
        .ch-retry-btn:hover { background: #4870D4; color: #fff; }
      `}</style>

      <div
        className={`chat-panel-backdrop${isOpen ? ' open' : ''}`}
        onClick={onClose}
      >
        <div className="chat-panel" onClick={(e) => e.stopPropagation()}>
          <div className="chat-panel-header">
            {targetAvatar && <img src={targetAvatar} alt={targetName} />}
            <div>
              <div className="ch-name">{targetName}</div>
              <div className="ch-status">{getStatusText()}</div>
              {context && <div className="ch-context">{context}</div>}
            </div>
            <button className="ch-close" onClick={onClose}>&times;</button>
          </div>

          <div className="chat-panel-messages" ref={messagesRef}>
            {messages.map((msg) => {
              if (msg.card) {
                return <div key={msg.id}>{renderCard(msg.card, msg.id)}</div>;
              }
              return (
                <div key={msg.id} className={`ch-msg ${msg.sender}`}>{msg.content}</div>
              );
            })}
            {xmtpStatus === 'error' && (
              <div className="ch-msg system" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#4870D4', textDecoration: 'underline' }}>
                  open XMTP chat in new tab
                </a>
                {!crossOriginErrorRef.current && (
                  <button className="ch-retry-btn" onClick={handleRetry}>
                    retry
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="chat-panel-input">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder={`message ${targetName}...`}
              rows={1}
            />
            <button onClick={handleSend} disabled={!input.trim()}>send</button>
          </div>
        </div>
      </div>
    </>
  );
}
