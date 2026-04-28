import { useState, useEffect, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDisconnect, useAccount, useSwitchChain, useChainId } from 'wagmi';
import { base } from 'wagmi/chains';
import ProfileCard, { fetchIdentity, type Identity } from './ProfileCard';

/**
 * Master profile menu that replaces the connect button when the wallet is connected.
 * Shows PFP + display name (primary hazza name > ENS > truncated 0x). Click opens
 * a master profile card with names list, view profile, dashboard, and disconnect.
 */
export default function WalletMenu() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Load identity for connected address
  useEffect(() => {
    if (!isConnected || !address) { setIdentity(null); return; }
    fetchIdentity(address).then(setIdentity).catch(() => {});
  }, [isConnected, address]);

  return (
    <ConnectButton.Custom>
      {({ account, chain, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain && isConnected;
        if (!mounted) {
          return (
            <div aria-hidden style={{ opacity: 0, pointerEvents: 'none', userSelect: 'none' }}>
              <button className="nav-wallet-btn">connect</button>
            </div>
          );
        }
        if (!connected) {
          return <button className="nav-wallet-btn" onClick={openConnectModal}>connect</button>;
        }
        if (chain?.id !== 8453) {
          return <button className="nav-wallet-btn" onClick={openChainModal}>wrong network</button>;
        }
        const display = identity?.display || (account.address.slice(0, 6) + '...' + account.address.slice(-4));
        const avatar = identity?.avatar;
        return (
          <>
            <button
              ref={triggerRef}
              className="nav-wallet-btn connected"
              onClick={() => setOpen(o => !o)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.7rem' }}
              aria-label="Master profile"
            >
              {avatar ? (
                <img src={avatar} alt={display}
                  style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #fff' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700,
                }}>
                  {display.charAt(0).toUpperCase()}
                </span>
              )}
              <span style={{ fontSize: '0.85rem' }}>{display}</span>
            </button>
            {open && identity && (
              <ProfileCard
                identity={identity}
                triggerRef={triggerRef}
                onClose={() => setOpen(false)}
                onDisconnect={() => { setOpen(false); disconnect(); }}
                onSwitchNetwork={() => { setOpen(false); switchChain({ chainId: base.id }); }}
                wrongNetwork={chain?.id !== 8453}
                isSelf
              />
            )}
          </>
        );
      }}
    </ConnectButton.Custom>
  );
}
