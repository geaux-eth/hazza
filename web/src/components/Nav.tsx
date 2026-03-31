import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDisconnect, useAccount, useSwitchChain, useChainId } from 'wagmi';
import { base } from 'wagmi/chains';

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const { disconnect } = useDisconnect();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // Auto-switch to Base when connected on wrong chain (only on initial connect)
  const hasAutoSwitched = useRef(false);
  useEffect(() => {
    if (!isConnected) {
      hasAutoSwitched.current = false;
      return;
    }
    if (isConnected && chainId !== base.id && !hasAutoSwitched.current) {
      hasAutoSwitched.current = true;
      switchChain({ chainId: base.id });
    }
  }, [isConnected, chainId, switchChain]);

  const closeMenu = () => setMenuOpen(false);

  // Close wallet dropdown on outside click
  useEffect(() => {
    if (!walletMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (walletMenuRef.current && !walletMenuRef.current.contains(e.target as Node)) {
        setWalletMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [walletMenuOpen]);

  return (
    <div className="nav-bar">
      <nav>
        <Link className="logo" to="/" onClick={closeMenu}>
          <span className="logo-icon">h</span>
        </Link>
        <button
          className="hamburger"
          id="hamburger-btn"
          aria-label="Menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          &#9776;
        </button>
        <div className={`links${menuOpen ? ' open' : ''}`} id="nav-links">
          <Link to="/register" onClick={closeMenu}>register</Link>
          <Link to="/marketplace" onClick={closeMenu}>marketplace</Link>
          <Link to="/dashboard" onClick={closeMenu}>dashboard</Link>
          <Link to="/messages" onClick={closeMenu}>messages</Link>
          <Link to="/about" onClick={closeMenu}>about</Link>
          <Link to="/docs" onClick={closeMenu}>docs</Link>
          <ConnectButton.Custom>
            {({ account, chain, openChainModal, openConnectModal, mounted }) => {
              const connected = mounted && account && chain && isConnected;
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
                <div ref={walletMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
                  <button className="nav-wallet-btn connected" onClick={() => setWalletMenuOpen(!walletMenuOpen)}>
                    {account.displayName}
                  </button>
                  {walletMenuOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: 6,
                      background: '#fff', borderRadius: 8, padding: '0.4rem 0',
                      boxShadow: '0 4px 16px rgba(19,19,37,0.15)', minWidth: 140, zIndex: 10000,
                    }}>
                      <button
                        onClick={() => { setWalletMenuOpen(false); disconnect(); }}
                        style={{
                          display: 'block', width: '100%', padding: '0.5rem 1rem',
                          background: 'none', border: 'none', textAlign: 'left',
                          fontFamily: "'Fredoka', sans-serif", fontSize: '0.85rem',
                          color: '#CF3748', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        disconnect
                      </button>
                    </div>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </nav>
    </div>
  );
}
