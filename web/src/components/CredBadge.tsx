interface CredBadgeProps {
  score: number;
  tokenId?: number | string | null;
  size?: number;
  title?: string;
}

export function credColor(score: number): string {
  if (score >= 80) return '#4ade80';
  if (score >= 60) return '#fbbf24';
  if (score >= 40) return '#fb923c';
  return '#ef4444';
}

export function credTier(score: number): string {
  if (score >= 91) return 'Preferred';
  if (score >= 76) return 'Prime';
  if (score >= 51) return 'Qualified';
  if (score >= 26) return 'Marginal';
  return 'Junk';
}

export default function CredBadge({ score, tokenId, size = 44, title }: CredBadgeProps) {
  const color = credColor(score);
  const tier = credTier(score);
  const numberFontSize = Math.round(size * 0.34);
  const credFontSize = Math.max(6, Math.round(size * 0.16));
  const logoSize = Math.round(size * 0.22);
  const numberLineHeight = Math.round(size * 0.42);

  const inner = (
    <div
      title={title || `Helixa Cred ${score} · ${tier}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        color: '#fff',
        position: 'relative',
        flexShrink: 0,
        boxShadow: `0 0 0 2px rgba(255,255,255,0.6), 0 0 8px ${color}66`,
        fontFamily: "'Fredoka', sans-serif",
        userSelect: 'none',
      }}
    >
      {/* Number — sits in top half, baseline near vertical center */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '50%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: numberFontSize,
          lineHeight: 1,
          paddingBottom: Math.round(size * 0.02),
        }}
      >
        {Math.round(score)}
      </div>
      {/* CRED — top of letters at the vertical centerline */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: credFontSize,
          fontWeight: 700,
          letterSpacing: 0.5,
          lineHeight: 1,
        }}
      >
        CRED
      </div>
      {/* Helixa logo — below CRED */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: Math.round(size * 0.08),
          display: 'flex',
          justifyContent: 'center',
          height: logoSize,
        }}
      >
        <img
          src="/helixa-logo.png"
          alt=""
          width={logoSize}
          height={logoSize}
          style={{
            width: logoSize,
            height: logoSize,
            mixBlendMode: 'screen',
            display: 'block',
          }}
        />
      </div>
    </div>
  );

  if (tokenId) {
    return (
      <a
        href={`https://helixa.xyz/agent/${tokenId}`}
        target="_blank"
        rel="noreferrer"
        style={{ display: 'inline-block', textDecoration: 'none', lineHeight: 0 }}
      >
        {inner}
      </a>
    );
  }
  return inner;
}
