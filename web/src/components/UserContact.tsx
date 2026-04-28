import { useState, useEffect, useRef } from 'react';
import ProfileCard, { fetchIdentity, type Identity } from './ProfileCard';

export default function UserContact({ address, onMessage }: { address: string; onMessage?: (xmtpAddress: string) => void }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!address) return;
    fetchIdentity(address).then(setIdentity).catch(() => {});
  }, [address]);

  if (!address) return null;
  const truncated = address.slice(0, 6) + '...' + address.slice(-4);
  const display = identity?.display || truncated;
  const isHazza = !!identity?.primaryName;

  return (
    <>
      <span
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(o => !o); }}
        style={{
          cursor: 'pointer',
          color: isHazza ? '#4870D4' : '#8a7d5a',
          fontWeight: isHazza ? 700 : 600,
          fontFamily: "'Fredoka', sans-serif",
        }}
        title={identity?.primaryName ? `${identity.primaryName}.hazza.name` : address}
      >
        {display}
      </span>
      {open && identity && (
        <ProfileCard
          identity={identity}
          triggerRef={triggerRef}
          onClose={() => setOpen(false)}
          onMessage={onMessage}
        />
      )}
    </>
  );
}
