import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ShareModalProps {
  name: string;          // hazza name without .hazza.name
  displayName?: string;  // What to show in the share text (defaults to name)
  onClose: () => void;
}

/**
 * Share modal — preview of the OG card + X / Farcaster / Copy Link buttons.
 *
 * The link shared is just https://<name>.hazza.name. The image that previews
 * comes from the page's og:image meta tag (which points to /api/og/:name).
 * Users can override the share image by setting the `share.image` text record.
 */
export default function ShareModal({ name, displayName, onClose }: ShareModalProps) {
  const profileUrl = `https://${name}.hazza.name`;
  const ogImageUrl = `https://hazza.name/api/og/${encodeURIComponent(name)}`;
  const shareText = `${displayName || name}.hazza.name — onchain identity on Base`;
  const [copied, setCopied] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onX = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const onFarcaster = () => {
    // Warpcast compose: text + embedded URL (Farcaster fetches OG tags from the URL for the preview card)
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(profileUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard might be blocked */ }
  };

  const ff = "'Fredoka', sans-serif";

  const modal = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000000,
        background: 'rgba(19,19,37,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', border: '3px solid #4870D4', borderRadius: 14,
          maxWidth: 540, width: '100%',
          padding: '1.1rem 1.1rem 0.9rem',
          fontFamily: ff, color: '#131325',
          boxShadow: '0 12px 32px rgba(19,19,37,0.25)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Share {name}.hazza.name</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent', border: 'none', color: '#8a7d5a',
              fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', padding: '0 0.25rem',
            }}
          >×</button>
        </div>

        {/* Preview */}
        <div style={{
          width: '100%', aspectRatio: '1200 / 630',
          borderRadius: 10, border: '2px solid #E8DCAB', overflow: 'hidden',
          background: '#F7EBBD',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '0.75rem',
        }}>
          {!imgLoaded && (
            <span style={{ color: '#8a7d5a', fontSize: '0.8rem' }}>generating preview...</span>
          )}
          <img
            src={ogImageUrl}
            alt={`${name} share card`}
            onLoad={() => setImgLoaded(true)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              display: imgLoaded ? 'block' : 'none',
            }}
          />
        </div>

        <p style={{ fontSize: '0.75rem', color: '#8a7d5a', margin: '0 0 0.75rem' }}>
          This is what people will see when they share <strong>{profileUrl}</strong>. To customize the preview image, set a <code style={{ background: '#f5f0e0', padding: '0 0.2rem', borderRadius: 3 }}>share.image</code> text record on this name.
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={onX}
            style={{
              flex: 1, minWidth: 110, padding: '0.55rem',
              background: '#131325', color: '#fff', border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: ff,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Share on X
          </button>
          <button
            onClick={onFarcaster}
            style={{
              flex: 1, minWidth: 110, padding: '0.55rem',
              background: '#7c65c1', color: '#fff', border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: ff,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 1000 1000" fill="currentColor"><path d="M257.778 155.556h484.444v688.889h-71.111V528.889h-.697c-7.86-87.291-81.232-155.556-170.526-155.556s-162.666 68.265-170.526 155.556h-.697v315.556h-71.111z"/><path d="M128.889 253.333l28.889 97.778h24.444v395.556c-12.273 0-22.222 9.949-22.222 22.222v26.667h-4.444c-12.273 0-22.222 9.949-22.222 22.222v26.667h248.889v-26.667c0-12.273-9.949-22.222-22.222-22.222h-4.444v-26.667c0-12.273-9.949-22.222-22.222-22.222l-13.333 0V253.333zM675.556 746.667c-12.273 0-22.222 9.949-22.222 22.222v26.667h-4.444c-12.273 0-22.222 9.949-22.222 22.222v26.667h248.889v-26.667c0-12.273-9.949-22.222-22.222-22.222h-4.444v-26.667c0-12.273-9.949-22.222-22.222-22.222V351.111h24.444l28.889-97.778H688.889v493.334z"/></svg>
            Cast on Farcaster
          </button>
          <button
            onClick={onCopy}
            style={{
              flex: 1, minWidth: 110, padding: '0.55rem',
              background: copied ? '#4ade80' : '#4870D4', color: '#fff', border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: ff,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            }}
          >
            {copied ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
