import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAccount, useWalletClient } from 'wagmi';

interface ChatMessage {
  id: string;
  content: string;
  sender: 'remote' | 'user' | 'system';
  timestamp: Date;
}

type XmtpStatus = 'idle' | 'creating-client' | 'client-ready' | 'connecting-convo' | 'connected' | 'error';

export interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  targetAddress: string;
  targetName: string;
  targetAvatar?: string;
  greeting?: string;
  /** Context label shown in header, e.g. "marketplace inquiry" */
  context?: string;
}

export default function ChatPanel({
  isOpen, onClose, targetAddress, targetName, targetAvatar, greeting, context,
}: ChatPanelProps) {
  const defaultGreeting = useMemo(() => greeting || `gm. you're chatting with ${targetName}.`, [greeting, targetName]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'greeting', content: defaultGreeting, sender: 'remote', timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [xmtpStatus, setXmtpStatus] = useState<XmtpStatus>('idle');
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<any>(null);
  const clientRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const xmtpAttemptedRef = useRef(false);
  const prevTargetRef = useRef(targetAddress);
  const prevAddressRef = useRef<string | undefined>(undefined);

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

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
  const addMsg = useCallback((text: string, sender: 'remote' | 'user' | 'system') => {
    const seq = ++msgCounterRef.current;
    setMessages((prev) => [
      ...prev,
      { id: `${sender}-${Date.now()}-${seq}`, content: text, sender, timestamp: new Date() },
    ]);
  }, []);

  // Stop stream helper
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      try { streamRef.current.return?.(); } catch (_e) { /* */ }
      streamRef.current = null;
    }
  }, []);

  // Close client helper
  const closeClient = useCallback(() => {
    stopStream();
    conversationRef.current = null;
    if (clientRef.current) {
      try { clientRef.current.close?.(); } catch (_e) { /* */ }
      clientRef.current = null;
    }
  }, [stopStream]);

  // Reset when wallet address changes — full teardown
  useEffect(() => {
    if (address !== prevAddressRef.current) {
      prevAddressRef.current = address;
      closeClient();
      xmtpAttemptedRef.current = false;
      setXmtpStatus('idle');
      setMessages([
        { id: 'greeting', content: defaultGreeting, sender: 'remote', timestamp: new Date() },
      ]);
    }
  }, [address, closeClient, defaultGreeting]);

  // Reset when target changes — keep client, just reset conversation
  useEffect(() => {
    if (targetAddress !== prevTargetRef.current) {
      prevTargetRef.current = targetAddress;
      xmtpAttemptedRef.current = false;
      setMessages([
        { id: 'greeting', content: defaultGreeting, sender: 'remote', timestamp: new Date() },
      ]);
      stopStream();
      conversationRef.current = null;
      // If client exists, go straight to connecting conversation; otherwise start fresh
      if (clientRef.current) {
        setXmtpStatus('client-ready');
      } else {
        setXmtpStatus('idle');
      }
    }
  }, [targetAddress, defaultGreeting, stopStream]);

  // Phase 1: Create XMTP client (depends on wallet, not target)
  const createClient = useCallback(async () => {
    if (!isConnected || !walletClient || !address) {
      if (!xmtpAttemptedRef.current) {
        addMsg('connect a wallet to chat. tap connect in the menu above.', 'system');
        xmtpAttemptedRef.current = true;
      }
      return;
    }

    setXmtpStatus('creating-client');
    addMsg('setting up XMTP... check your wallet to sign.', 'system');

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
          const hexMsg = '0x' + Array.from(new TextEncoder().encode(textMsg))
            .map((b) => b.toString(16).padStart(2, '0')).join('');
          const sig = await walletClient.request({
            method: 'personal_sign',
            params: [hexMsg as `0x${string}`],
          } as any);
          return new Uint8Array(
            ((sig as string).slice(2).match(/.{2}/g) || []).map((b: string) => parseInt(b, 16))
          );
        },
      };

      const storageKey = `hazza-xmtp-dbkey-${address}`;
      let dbKeyHex = localStorage.getItem(storageKey);
      let dbEncryptionKey: Uint8Array;
      if (dbKeyHex) {
        dbEncryptionKey = new Uint8Array(dbKeyHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
      } else {
        dbEncryptionKey = crypto.getRandomValues(new Uint8Array(32));
        localStorage.setItem(storageKey, Array.from(dbEncryptionKey).map(b => b.toString(16).padStart(2, '0')).join(''));
      }
      const client = await (xmtp.Client.create as any)(signer, dbEncryptionKey, { env: 'production' });
      clientRef.current = client;

      setXmtpStatus('client-ready');
      addMsg('connected to XMTP. messages are encrypted and saved onchain.', 'system');
    } catch (err: any) {
      console.error('XMTP client creation failed:', err);
      setXmtpStatus('error');
      addMsg('XMTP error: ' + (err.message || err), 'system');
    }
  }, [isConnected, walletClient, address, addMsg]);

  // Phase 2: Create conversation (depends on client + targetAddress)
  const createConversation = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !targetAddress) return;

    setXmtpStatus('connecting-convo');

    try {
      const convo = await (client.conversations as any).newDm(targetAddress);
      conversationRef.current = convo;

      const existing = await convo.messages();
      const inboxId = client.inboxId;

      const mapped: ChatMessage[] = [];
      for (let i = 0; i < existing.length; i++) {
        const m = existing[i];
        if (m.contentType && m.contentType.typeId === 'text') {
          mapped.push({
            id: m.id || `msg-${i}`,
            content: typeof m.content === 'string' ? m.content : String(m.content),
            sender: m.senderInboxId !== inboxId ? 'remote' : 'user',
            timestamp: m.sentAt || new Date(),
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

      streamRef.current = await convo.stream();
      (async () => {
        try {
          for await (const msg of streamRef.current) {
            if (msg && msg.senderInboxId !== inboxId && msg.contentType?.typeId === 'text') {
              const chatMsg: ChatMessage = {
                id: msg.id || `stream-${Date.now()}`,
                content: typeof msg.content === 'string' ? msg.content : String(msg.content),
                sender: 'remote',
                timestamp: msg.sentAt || new Date(),
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

  // Auto-create client when panel opens and wallet is connected
  useEffect(() => {
    if (isOpen && isConnected && walletClient && address && xmtpStatus === 'idle' && targetAddress) {
      createClient();
    }
  }, [isOpen, isConnected, walletClient, address, xmtpStatus, targetAddress, createClient]);

  // Auto-create conversation when client is ready
  useEffect(() => {
    if (isOpen && xmtpStatus === 'client-ready' && targetAddress && clientRef.current) {
      createConversation();
    }
  }, [isOpen, xmtpStatus, targetAddress, createConversation]);

  // Cleanup on unmount — close client and stop stream
  useEffect(() => {
    return () => {
      stopStream();
      if (clientRef.current) {
        try { clientRef.current.close?.(); } catch (_e) { /* */ }
        clientRef.current = null;
      }
    };
  }, [stopStream]);

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
      addMsg('connecting to XMTP... please wait', 'system');
      return;
    }

    conversationRef.current.send(text).catch((err: any) => {
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
    switch (xmtpStatus) {
      case 'creating-client':
      case 'connecting-convo': return 'connecting...';
      case 'client-ready': return 'connecting...';
      case 'connected': return 'online';
      case 'error': return 'error';
      default: return 'tap to chat';
    }
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
          background: #fff; color: #131325; font-size: 0.88rem; font-family: 'DM Sans', sans-serif;
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
            {messages.map((msg) => (
              <div key={msg.id} className={`ch-msg ${msg.sender}`}>{msg.content}</div>
            ))}
            {xmtpStatus === 'error' && (
              <div className="ch-msg system" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#4870D4', textDecoration: 'underline' }}>
                  open XMTP chat in new tab
                </a>
                <button className="ch-retry-btn" onClick={handleRetry}>
                  retry
                </button>
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
