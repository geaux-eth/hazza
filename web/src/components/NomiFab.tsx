import { useState, useEffect } from 'react';
import { NOMI_AVATAR } from '../constants';

const DISMISSED_KEY = 'hazza_nomi_dismissed';

export default function NomiFab() {
  const [dismissed, setDismissed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISSED_KEY) === '1') {
      setDismissed(true);
    }
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const fab = document.getElementById('nomi-fab');
      if (fab && !fab.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  if (dismissed) return null;

  return (
    <div className="nomi-fab" id="nomi-fab">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: 96, height: 96, position: 'relative' }}
        aria-label="Nomi"
      >
        <div className="fab-bg" />
        <img src={NOMI_AVATAR} alt="Nomi" />
      </button>
      {menuOpen && (
        <div
          id="nomi-fab-menu"
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: 8,
            background: '#fff',
            border: '2px solid #4870D4',
            borderRadius: 10,
            padding: '0.4rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            minWidth: 150,
            zIndex: 9990,
          }}
        >
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('openNomiChat'));
              setMenuOpen(false);
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '0.5rem 0.75rem',
              background: 'none',
              border: 'none',
              color: '#131325',
              fontFamily: 'Fredoka, sans-serif',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              borderRadius: 6,
            }}
            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F7EBBD'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
          >
            chat with nomi
          </button>
          <button
            onClick={() => {
              try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch (_) { /* noop */ }
              setDismissed(true);
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '0.5rem 0.75rem',
              background: 'none',
              border: 'none',
              color: '#8a7d5a',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '0.8rem',
              cursor: 'pointer',
              textAlign: 'left',
              borderRadius: 6,
            }}
            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F7EBBD'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
          >
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}
