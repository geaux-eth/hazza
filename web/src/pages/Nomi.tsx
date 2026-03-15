import { useState } from 'react';
import { NOMI_AVATAR } from '../constants';
import NomiChat from '../components/NomiChat';

export default function Nomi() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <style>{`
        @keyframes nomi-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      `}</style>

      <div className="max-w-[720px] mx-auto px-6 pb-12">
        <div className="header" style={{ background: '#4870D4', padding: '1.5rem 1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <h1 style={{ color: '#fff' }} className="font-heading text-4xl font-bold text-center">nomi</h1>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img
            src={NOMI_AVATAR}
            alt="Nomi"
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              border: '3px solid #4870D4',
              animation: 'nomi-float 3s ease-in-out infinite',
            }}
          />
          <p style={{ fontFamily: "'Fredoka', sans-serif", color: '#131325', fontSize: '1.1rem', marginTop: '1rem' }}>
            hey, i'm nomi.
          </p>
          <p style={{ fontFamily: "'Fredoka', sans-serif", color: '#8a7d5a', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            i help people find and use their hazza names.
          </p>
        </div>

        <div style={{
          background: '#F7EBBD',
          border: '2px solid #E8DCAB',
          borderRadius: '10px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}>
          <p style={{
            fontFamily: "'Fredoka', sans-serif",
            color: '#131325',
            fontSize: '1rem',
            lineHeight: '1.6',
            margin: '0',
          }}>
            i know everything about hazza names. registering, pricing, text records, the marketplace, agent endpoints, onchain websites... ask me anything.
          </p>
        </div>

        <div className="section">
          <div className="section-title" style={{ color: '#CF3748', fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.75rem' }}>
            What I can help with
          </div>
          <div className="info-grid" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px solid #E8DCAB' }}>
              <span className="label" style={{ fontWeight: 600, color: '#131325', fontFamily: "'Fredoka', sans-serif", fontSize: '0.9rem', minWidth: '120px' }}>Registration</span>
              <span className="value" style={{ color: '#8a7d5a', fontSize: '0.9rem', textAlign: 'right' }}>Find available names, check pricing, walk you through the process</span>
            </div>
            <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px solid #E8DCAB' }}>
              <span className="label" style={{ fontWeight: 600, color: '#131325', fontFamily: "'Fredoka', sans-serif", fontSize: '0.9rem', minWidth: '120px' }}>Text records</span>
              <span className="value" style={{ color: '#8a7d5a', fontSize: '0.9rem', textAlign: 'right' }}>Set up your avatar, socials, website, agent endpoint</span>
            </div>
            <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px solid #E8DCAB' }}>
              <span className="label" style={{ fontWeight: 600, color: '#131325', fontFamily: "'Fredoka', sans-serif", fontSize: '0.9rem', minWidth: '120px' }}>Marketplace</span>
              <span className="value" style={{ color: '#8a7d5a', fontSize: '0.9rem', textAlign: 'right' }}>List names, make offers, browse what's available</span>
            </div>
            <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px solid #E8DCAB' }}>
              <span className="label" style={{ fontWeight: 600, color: '#131325', fontFamily: "'Fredoka', sans-serif", fontSize: '0.9rem', minWidth: '120px' }}>Onchain sites</span>
              <span className="value" style={{ color: '#8a7d5a', fontSize: '0.9rem', textAlign: 'right' }}>Deploy a website to your hazza name via Net Protocol</span>
            </div>
            <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px solid #E8DCAB' }}>
              <span className="label" style={{ fontWeight: 600, color: '#131325', fontFamily: "'Fredoka', sans-serif", fontSize: '0.9rem', minWidth: '120px' }}>Agent setup</span>
              <span className="value" style={{ color: '#8a7d5a', fontSize: '0.9rem', textAlign: 'right' }}>Register an ERC-8004 agent identity for your name</span>
            </div>
            <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0' }}>
              <span className="label" style={{ fontWeight: 600, color: '#131325', fontFamily: "'Fredoka', sans-serif", fontSize: '0.9rem', minWidth: '120px' }}>ENS/DNS</span>
              <span className="value" style={{ color: '#8a7d5a', fontSize: '0.9rem', textAlign: 'right' }}>Point your hazza name to a traditional domain</span>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', margin: '2rem 0' }}>
          <button
            onClick={() => setChatOpen(true)}
            style={{
              display: 'inline-block',
              padding: '0.75rem 2rem',
              background: 'linear-gradient(180deg, #d94356 0%, #CF3748 100%)',
              color: '#fff',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '1rem',
              textDecoration: 'none',
              transition: 'transform 0.2s',
              boxShadow: '0 2px 8px rgba(207,55,72,0.3)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Chat with Nomi
          </button>
          <p style={{ color: '#8a7d5a', fontSize: '0.8rem', marginTop: '0.5rem' }}>peer-to-peer via XMTP</p>
        </div>

        <div style={{
          background: '#F7EBBD',
          border: '2px solid #E8DCAB',
          borderRadius: '10px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}>
          <p style={{
            fontFamily: "'Fredoka', sans-serif",
            color: '#131325',
            fontSize: '0.95rem',
            lineHeight: '1.6',
            margin: '0',
          }}>
            fun fact: i live onchain. my identity, my memory, my capabilities &mdash; all stored on Base through Net Protocol. i'm not just a chatbot, i'm a registered ERC-8004 agent.
          </p>
          <p style={{
            fontFamily: "'Fredoka', sans-serif",
            color: '#8a7d5a',
            fontSize: '0.85rem',
            marginTop: '0.5rem',
          }}>
            &mdash; nomi
          </p>
        </div>
      </div>

      <NomiChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
