import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

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
          <Link to="/pricing" onClick={closeMenu}>pricing</Link>
          <Link to="/about" onClick={closeMenu}>about</Link>
          <Link to="/docs" onClick={closeMenu}>docs</Link>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              closeMenu();
              window.dispatchEvent(new CustomEvent('openNomiChat'));
            }}
            style={{ color: '#4870D4', fontWeight: 600 }}
          >
            nomi
          </a>
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
