import { useState, useCallback, createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import ProfileNav from './ProfileNav';
import Footer from './Footer';

interface ProfileContextType {
  setProfileInfo: (info: { name: string; owner?: string; xmtp?: string }) => void;
  openChat: () => void;
  openShare: () => void;
}

export const ProfileContext = createContext<ProfileContextType>({
  setProfileInfo: () => {},
  openChat: () => {},
  openShare: () => {},
});

export function useProfileContext() {
  return useContext(ProfileContext);
}

export default function ProfileLayout() {
  const [profileInfo, setProfileInfoState] = useState<{ name: string; owner?: string; xmtp?: string }>({ name: '' });
  const [shareModal, setShareModal] = useState(false);
  const [chatRequested, setChatRequested] = useState(false);

  const setProfileInfo = useCallback((info: { name: string; owner?: string; xmtp?: string }) => {
    setProfileInfoState(info);
  }, []);

  const openChat = useCallback(() => setChatRequested(true), []);
  const openShare = useCallback(() => setShareModal(true), []);

  const copyUrl = useCallback(() => {
    const url = `https://${profileInfo.name}.hazza.name`;
    navigator.clipboard.writeText(url).then(() => {
      setTimeout(() => setShareModal(false), 1200);
    });
  }, [profileInfo.name]);

  return (
    <ProfileContext.Provider value={{ setProfileInfo, openChat, openShare }}>
      <ProfileNav
        profileName={profileInfo.name}
        ownerAddress={profileInfo.owner}
        xmtpAddress={profileInfo.xmtp}
        onMessage={openChat}
        onShare={openShare}
      />
      <div className="container">
        <Outlet context={{ chatRequested, setChatRequested }} />
      </div>
      <Footer />

      {/* Share modal */}
      {shareModal && profileInfo.name && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShareModal(false); }}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '12px', padding: '1.5rem', maxWidth: '320px', width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', color: '#131325', marginBottom: '1rem', fontFamily: 'Fredoka,sans-serif' }}>
              Share <strong style={{ color: '#4870D4' }}>{profileInfo.name}.hazza.name</strong>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${profileInfo.name}.hazza.name`)}&url=${encodeURIComponent(`https://${profileInfo.name}.hazza.name`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', gap: '0.3rem' }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#131325">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span style={{ color: '#8a7d5a', fontSize: '0.7rem', fontFamily: 'Fredoka,sans-serif' }}>Twitter</span>
              </a>
              <a
                href={`https://warpcast.com/~/compose?text=${encodeURIComponent(`Check out ${profileInfo.name}.hazza.name https://${profileInfo.name}.hazza.name`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', gap: '0.3rem' }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#4870D4">
                  <path d="M3.77 2h16.46C21.21 2 22 2.79 22 3.77v16.46c0 .98-.79 1.77-1.77 1.77H3.77C2.79 22 2 21.21 2 20.23V3.77C2 2.79 2.79 2 3.77 2zm3.48 4.3L5.6 12.26h2.18l.89 5.44h2.07l1.26-7.4 1.26 7.4h2.07l.89-5.44h2.18L16.75 6.3h-2.82l-.93 5.5-.93-5.5H8.07z" />
                </svg>
                <span style={{ color: '#8a7d5a', fontSize: '0.7rem', fontFamily: 'Fredoka,sans-serif' }}>Farcaster</span>
              </a>
            </div>
            <button
              onClick={copyUrl}
              style={{ width: '100%', padding: '0.6rem', background: '#E8DCAB', color: '#CF3748', border: '2px solid #CF3748', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Fredoka,sans-serif' }}
            >
              Copy URL
            </button>
          </div>
        </div>
      )}
    </ProfileContext.Provider>
  );
}
