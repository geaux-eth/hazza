import { NOMI_AVATAR } from '../constants';

export default function NomiFab() {
  return (
    <div className="nomi-fab" id="nomi-fab">
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('openNomiChat'))}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: 96, height: 96, position: 'relative' }}
        aria-label="Chat with Nomi"
      >
        <div className="fab-bg" />
        <img src={NOMI_AVATAR} alt="Nomi" />
      </button>
    </div>
  );
}

