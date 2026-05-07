import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useSwitchChain, useChainId } from 'wagmi';
import { base } from 'wagmi/chains';
import WalletMenu from './WalletMenu';

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
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
          <Link to="/register" onClick={closeMenu}>discover</Link>
          <Link to="/marketplace" onClick={closeMenu}>marketplace</Link>
          <Link to="/dashboard" onClick={closeMenu}>dashboard</Link>
          <Link to="/messages" onClick={closeMenu}>messages</Link>
          <Link to="/about" onClick={closeMenu}>about</Link>
          <Link to="/docs" onClick={closeMenu}>docs</Link>
          <WalletMenu />
        </div>
      </nav>
    </div>
  );
}
