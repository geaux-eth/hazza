import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Nav from './Nav';
import Footer from './Footer';
import NomiFab from './NomiFab';
import NomiChat from './NomiChat';

export default function Layout() {
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const handler = () => setChatOpen(true);
    window.addEventListener('openNomiChat', handler);
    return () => window.removeEventListener('openNomiChat', handler);
  }, []);

  return (
    <>
      <Nav />
      <div className="container">
        <Outlet />
      </div>
      <Footer />
      <NomiFab />
      <NomiChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
