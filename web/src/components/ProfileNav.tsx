import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

interface ProfileNavProps {
  profileName: string;
  ownerAddress?: string;
  xmtpAddress?: string;
  onMessage?: () => void;
  onShare?: () => void;
}

export default function ProfileNav({ profileName, ownerAddress, xmtpAddress, onMessage, onShare }: ProfileNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { address } = useAccount();
  const closeMenu = () => setMenuOpen(false);

  const isOwner = address && ownerAddress && address.toLowerCase() === ownerAddress.toLowerCase();

  return (
    <div className="nav-bar">
      <nav>
        <a className="logo" href="https://hazza.name" onClick={closeMenu}>
          <span className="logo-icon">h</span>
        </a>
        <button
          className="hamburger"
          aria-label="Menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          &#9776;
        </button>
        <div className={`links${menuOpen ? ' open' : ''}`}>
          {isOwner ? (
            <>
              <a
                href={`https://hazza.name/manage?name=${encodeURIComponent(profileName)}`}
                onClick={closeMenu}
              >
                manage
              </a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); closeMenu(); onShare?.(); }}
              >
                share
              </a>
            </>
          ) : (
            <>
              {xmtpAddress && (
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); closeMenu(); onMessage?.(); }}
                  style={{ color: '#4870D4', fontWeight: 600 }}
                >
                  message
                </a>
              )}
              <a
                href={`https://hazza.name/marketplace?offer=${encodeURIComponent(profileName)}`}
                onClick={closeMenu}
              >
                offer
              </a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); closeMenu(); onShare?.(); }}
              >
                share
              </a>
            </>
          )}
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
              const connected = mounted && account && chain;
              if (!mounted) {
                return (
                  <div aria-hidden style={{ opacity: 0, pointerEvents: 'none' as const, userSelect: 'none' as const }}>
                    <button className="nav-wallet-btn">connect</button>
                  </div>
                );
              }
              if (!connected) {
                return (
                  <button className="nav-wallet-btn" onClick={openConnectModal}>
                    connect
                  </button>
                );
              }
              if (chain?.id !== 8453) {
                return (
                  <button className="nav-wallet-btn" onClick={openChainModal}>
                    wrong network
                  </button>
                );
              }
              return (
                <button className="nav-wallet-btn connected" onClick={openAccountModal}>
                  {account.displayName}
                </button>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </nav>
    </div>
  );
}
