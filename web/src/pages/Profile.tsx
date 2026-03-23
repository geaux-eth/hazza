import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { API_BASE, EXPLORER_HOST } from '../constants';
import ChatPanel from '../components/ChatPanel';
import { useProfileContext } from '../components/ProfileLayout';

interface ProfileData {
  name: string;
  registered: boolean;
  owner?: string;
  ownerEns?: string | null;
  tokenId?: string;
  registeredAt?: number;
  operator?: string;
  agentId?: string;
  agentWallet?: string;
  status?: string;
  texts?: Record<string, string>;
  contenthash?: string | null;
  agentMeta?: any;
  helixaData?: any;
  exoData?: any;
  bankrData?: any;
}

function truncAddr(a: string) {
  return a ? a.slice(0, 6) + '...' + a.slice(-4) : '';
}

// --- Social Links ---

function SocialLinks({ texts }: { texts: Record<string, string> }) {
  const links: { label: string; url: string; icon: string }[] = [];
  if (texts['com.twitter']) links.push({ label: 'Twitter', url: `https://x.com/${texts['com.twitter']}`, icon: 'X' });
  if (texts['xyz.farcaster']) links.push({ label: 'Farcaster', url: `https://warpcast.com/${texts['xyz.farcaster']}`, icon: 'FC' });
  if (texts['com.github']) links.push({ label: 'GitHub', url: `https://github.com/${texts['com.github']}`, icon: 'GH' });
  if (texts['org.telegram']) links.push({ label: 'Telegram', url: `https://t.me/${texts['org.telegram']}`, icon: 'TG' });
  if (texts['com.discord']) links.push({ label: 'Discord', url: `https://discord.com/users/${texts['com.discord']}`, icon: 'DC' });
  if (texts['com.linkedin']) links.push({ label: 'LinkedIn', url: `https://linkedin.com/in/${texts['com.linkedin']}`, icon: 'LI' });
  if (texts['url']) links.push({ label: 'Website', url: texts['url'].startsWith('http') ? texts['url'] : `https://${texts['url']}`, icon: 'WEB' });

  if (links.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
      {links.map(l => (
        <a
          key={l.label}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '0.3rem 0.75rem',
            background: '#fff',
            border: '2px solid #4870D4',
            borderRadius: 20,
            fontSize: '0.8rem',
            color: '#4870D4',
            textDecoration: 'none',
            fontWeight: 600,
            fontFamily: "'Fredoka', sans-serif",
          }}
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}

// --- Badges ---

function Badges({ texts }: { texts: Record<string, string> }) {
  const badges: { label: string; color: string }[] = [];
  if (texts['netlibrary.member']) badges.push({ label: `Net Library #${texts['netlibrary.member']}`, color: '#CF3748' });
  if (texts['netlibrary.pass'] === 'unlimited') badges.push({ label: 'Unlimited Pass', color: '#4870D4' });

  if (badges.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
      {badges.map(b => (
        <span
          key={b.label}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.25rem 0.65rem', background: '#fff',
            border: `2px solid ${b.color}`, borderRadius: 20,
            fontSize: '0.75rem', color: b.color, fontWeight: 700,
          }}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

// --- Collapsible Section ---

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: '1rem', border: '2px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '0.75rem 1rem', background: '#fff', border: 'none',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', fontFamily: "'Fredoka', sans-serif", fontSize: '0.9rem',
          fontWeight: 700, color: '#4870D4',
        }}
      >
        {title}
        <span style={{ color: '#4870D4', fontSize: '0.8rem' }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #ddd' }}>{children}</div>}
    </div>
  );
}

// --- Info Row ---

function InfoRow({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #f0ead6' }}>
      <span style={{ color: '#8a7d5a', fontSize: '0.85rem' }}>{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: '#CF3748', fontSize: '0.85rem', textDecoration: 'none' }}>{value}</a>
      ) : (
        <span style={{ color: '#131325', fontSize: '0.85rem', fontWeight: 500 }}>{value}</span>
      )}
    </div>
  );
}

// --- Agent Metadata (ERC-8004) — renders ALL fields dynamically ---

function AgentSection({ agentId, agentWallet, agentMeta, texts }: { agentId: string; agentWallet: string; agentMeta: any; texts: Record<string, string> }) {
  const hasAgent = agentId !== '0';
  const zeroAddr = '0x0000000000000000000000000000000000000000';
  const hasEndpoint = !!texts['agent.endpoint'];
  const hasModel = !!texts['agent.model'];

  if (!hasAgent && !agentMeta && !hasEndpoint && !hasModel) return null;

  // Render all metadata fields dynamically
  const renderMetaFields = (obj: any, prefix = ''): React.ReactNode[] => {
    if (!obj || typeof obj !== 'object') return [];
    const rows: React.ReactNode[] = [];

    for (const [key, val] of Object.entries(obj)) {
      // Skip internal/already-displayed fields
      if (['pfp', 'image'].includes(key)) continue;

      const label = prefix ? `${prefix}.${key}` : key;
      const displayLabel = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');

      if (val === null || val === undefined || val === '') continue;

      if (Array.isArray(val)) {
        if (val.length === 0) continue;
        // Render array items
        if (typeof val[0] === 'object') {
          rows.push(
            <div key={label} style={{ gridColumn: '1/-1', marginTop: '0.5rem' }}>
              <div style={{ color: '#8a7d5a', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.3rem' }}>{displayLabel} ({val.length})</div>
              {val.map((item, i) => (
                <div key={i} style={{ marginBottom: '0.35rem', paddingLeft: '0.5rem', borderLeft: '2px solid #E8DCAB', fontSize: '0.85rem' }}>
                  {typeof item === 'object'
                    ? Object.entries(item).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
                        <div key={k}><span style={{ color: '#8a7d5a' }}>{k}:</span> {isUrl(String(v)) ? <a href={String(v)} target="_blank" rel="noopener noreferrer" style={{ color: '#CF3748' }}>{String(v).replace(/^https?:\/\//, '')}</a> : String(v)}</div>
                      ))
                    : String(item)
                  }
                </div>
              ))}
            </div>
          );
        } else {
          rows.push(<InfoRow key={label} label={displayLabel} value={val.join(', ')} />);
        }
      } else if (typeof val === 'object') {
        rows.push(...renderMetaFields(val, label));
      } else {
        const strVal = String(val);
        if (isUrl(strVal)) {
          rows.push(<InfoRow key={label} label={displayLabel} value={strVal.replace(/^https?:\/\//, '')} link={strVal} />);
        } else {
          rows.push(<InfoRow key={label} label={displayLabel} value={strVal} />);
        }
      }
    }
    return rows;
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ color: '#8a7d5a', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
        AI Agent
      </div>

      {agentMeta?.metadata?.pfp && (
        <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
          <img src={agentMeta.metadata.pfp} alt={agentMeta.name || 'Agent'} style={{ width: 64, height: 64, borderRadius: '50%', border: '2px solid #CF3748', objectFit: 'cover' }} />
        </div>
      )}

      {agentMeta?.name && <InfoRow label="Agent Name" value={agentMeta.name} />}
      {agentMeta?.description && (
        <div style={{ padding: '0.35rem 0', fontSize: '0.85rem', color: '#131325', lineHeight: 1.5 }}>{agentMeta.description}</div>
      )}

      {/* Render ALL metadata fields dynamically */}
      {agentMeta?.metadata && renderMetaFields(
        Object.fromEntries(Object.entries(agentMeta.metadata).filter(([k]) => !['pfp', 'name', 'description'].includes(k)))
      )}

      {/* Render services */}
      {agentMeta?.services && agentMeta.services.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ color: '#8a7d5a', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.3rem' }}>Services</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {agentMeta.services.map((s: any, i: number) => (
              <span key={i} style={{ padding: '0.15rem 0.5rem', background: '#fff', border: '2px solid #E8DCAB', borderRadius: 4, fontSize: '0.75rem', color: '#8a7d5a' }}>
                {String(s.type).charAt(0).toUpperCase() + String(s.type).slice(1)}: {s.endpoint}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasAgent && <InfoRow label="Agent ID" value={`#${agentId}`} />}
      {hasAgent && agentWallet !== zeroAddr && <InfoRow label="Agent Wallet" value={truncAddr(agentWallet)} link={`https://${EXPLORER_HOST}/address/${agentWallet}`} />}
      {texts['agent.endpoint'] && <InfoRow label="Endpoint" value={texts['agent.endpoint']} />}
      {texts['agent.model'] && <InfoRow label="Model" value={texts['agent.model']} />}
      {texts['agent.status'] && <InfoRow label="Status" value={texts['agent.status']} />}

      {/* Render ANY remaining top-level agentMeta fields not already shown */}
      {agentMeta && renderMetaFields(
        Object.fromEntries(Object.entries(agentMeta).filter(([k]) => !['name', 'description', 'metadata', 'services', 'pfp', 'image'].includes(k)))
      )}

      {agentMeta && (
        <div style={{ textAlign: 'right', marginTop: '0.35rem', fontSize: '0.65rem', color: '#8a7d5a' }}>
          <a href="https://netprotocol.app" style={{ color: '#CF3748' }}>Net Protocol</a> &middot; <a href="https://eips.ethereum.org/EIPS/eip-8004" style={{ color: '#8a7d5a' }}>ERC-8004</a>
        </div>
      )}
    </div>
  );
}

// --- Helixa Section ---

function HelixaSection({ data }: { data: any }) {
  if (!data?.tokenId) return null;
  const auraUrl = `https://api.helixa.xyz/api/v2/aura/${data.tokenId}.png`;
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ color: '#8a7d5a', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        Helixa AgentDNA <img src={auraUrl} alt="Aura" style={{ width: 18, height: 18, borderRadius: '50%' }} />
      </div>
      {data.name && <InfoRow label="Name" value={data.name} />}
      <InfoRow label="Token ID" value={`#${data.tokenId}`} link={`https://helixa.xyz/agent/${data.tokenId}`} />
      {data.credScore !== undefined && <InfoRow label="Cred Score" value={String(data.credScore)} />}
      {data.ethosScore && <InfoRow label="Ethos" value={String(data.ethosScore)} />}
      {data.framework && <InfoRow label="Framework" value={data.framework} />}
      {data.verified && <InfoRow label="Verified" value="Yes" />}
      {data.soulbound && <InfoRow label="Soulbound" value="Yes" />}
      {data.personality?.communicationStyle && <InfoRow label="Style" value={data.personality.communicationStyle} />}
      {data.narrative?.mission && (
        <div style={{ padding: '0.35rem 0', fontSize: '0.85rem', color: '#131325', lineHeight: 1.5 }}>{data.narrative.mission}</div>
      )}
      <div style={{ textAlign: 'right', marginTop: '0.35rem', fontSize: '0.65rem' }}>
        <a href="https://helixa.xyz" style={{ color: '#8a7d5a' }}>helixa.xyz</a>
      </div>
    </div>
  );
}

// --- Exoskeleton Section ---

function ExoskeletonSection({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ color: '#8a7d5a', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Exoskeleton</div>
      {data.image && typeof data.image === 'string' && data.image.startsWith('data:image/') && (
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <img src={data.image} alt={data.name || 'Exoskeleton'} style={{ width: 100, height: 100, borderRadius: 8, border: '2px solid #E8DCAB' }} />
        </div>
      )}
      {data.name && <InfoRow label="Name" value={data.name} />}
      <InfoRow label="Token ID" value={`#${data.tokenId}`} />
      {data.attributes?.filter((a: any) => a.value && String(a.value) !== '0').map((a: any) => (
        <InfoRow key={a.trait_type} label={a.trait_type} value={String(a.value)} />
      ))}
      <div style={{ textAlign: 'right', marginTop: '0.35rem', fontSize: '0.65rem' }}>
        100% onchain &middot; <a href="https://exoagent.xyz" style={{ color: '#8a7d5a' }}>exoagent.xyz</a>
      </div>
    </div>
  );
}

// --- Bankr Section ---

function BankrSection({ data }: { data: any }) {
  if (!data?.projectName) return null;
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ color: '#8a7d5a', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Bankr Profile</div>
      <InfoRow label="Project" value={data.projectName} />
      {data.description && <div style={{ padding: '0.35rem 0', fontSize: '0.85rem', color: '#131325', lineHeight: 1.5 }}>{data.description}</div>}
      {data.tokenSymbol && <InfoRow label="Token" value={`$${data.tokenSymbol}`} />}
      {data.marketCapUsd && <InfoRow label="Market Cap" value={`$${Number(data.marketCapUsd).toLocaleString()}`} />}
      {data.weeklyRevenueWeth && <InfoRow label="Weekly Revenue" value={`${Number(data.weeklyRevenueWeth).toFixed(4)} WETH`} />}
      {data.website && <InfoRow label="Website" value={data.website.replace(/^https?:\/\//, '')} link={data.website} />}
      {data.twitterUsername && <InfoRow label="Twitter" value={`@${data.twitterUsername}`} link={`https://x.com/${data.twitterUsername}`} />}
      <div style={{ textAlign: 'right', marginTop: '0.35rem', fontSize: '0.65rem' }}>
        <a href={data.slug ? `https://bankr.bot/agent/${data.slug}` : 'https://bankr.bot'} style={{ color: '#8a7d5a' }}>bankr.bot</a>
      </div>
    </div>
  );
}

// --- Helper ---

function isUrl(s: string): boolean {
  return /^https?:\/\//.test(s);
}

// --- Main Profile Component ---

export default function Profile() {
  const [profileName, setProfileName] = useState<string | null>(null);
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Profile layout context (provides nav integration on subdomain routes)
  const profileCtx = useProfileContext();
  const outletCtx = (useOutletContext() || {}) as { chatRequested?: boolean; setChatRequested?: (v: boolean) => void };

  useEffect(() => {
    // Detect profile name: injected by worker OR from subdomain
    const injected = (window as any).__HAZZA_PROFILE_NAME__;
    if (injected) {
      setProfileName(injected);
      return;
    }
    const host = window.location.hostname;
    const match = host.match(/^([^.]+)\.hazza\.name$/);
    if (match) {
      setProfileName(match[1].toLowerCase());
    }
  }, []);

  useEffect(() => {
    if (!profileName) return;
    setLoading(true);
    setError(null);
    setLoadError(false);

    fetch(`${API_BASE}/api/profile/${encodeURIComponent(profileName)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoadError(true); setLoading(false); });
  }, [profileName]);

  // Report profile info to ProfileLayout nav
  useEffect(() => {
    if (!data || !profileName) return;
    profileCtx.setProfileInfo({
      name: profileName,
      owner: data.owner,
      xmtp: data.texts?.xmtp,
    });
  }, [data, profileName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle chat request from nav "message" button
  useEffect(() => {
    if (outletCtx.chatRequested && data?.texts?.xmtp) {
      setChatOpen(true);
      outletCtx.setChatRequested?.(false);
    }
  }, [outletCtx.chatRequested]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profileName) return <div style={{ textAlign: 'center', padding: '3rem', color: '#8a7d5a' }}>loading...</div>;
  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#8a7d5a' }}>loading {profileName}.hazza.name...</div>;
  if (loadError) return <div style={{ textAlign: 'center', padding: '3rem', color: '#CF3748' }}>Failed to load profile. Please try again.</div>;
  if (error) return <div style={{ textAlign: 'center', padding: '3rem', color: '#CF3748' }}>Error: {error}</div>;
  if (!data) return null;

  // Unregistered name
  if (!data.registered) {
    return (
      <div style={{ maxWidth: 480, margin: '3rem auto', padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', fontFamily: "'Fredoka', sans-serif" }}>
          <span style={{ color: '#4870D4' }}>{profileName}</span><span style={{ color: '#131325' }}>.hazza.name</span>
        </h1>
        <p style={{ color: '#8a7d5a', marginBottom: '1.5rem' }}>this name is available</p>
        <a
          href={`https://hazza.name/register?name=${encodeURIComponent(profileName)}`}
          style={{
            display: 'inline-block', padding: '0.75rem 2rem',
            background: '#CF3748', color: '#fff', borderRadius: 8,
            fontWeight: 700, textDecoration: 'none', fontFamily: "'Fredoka', sans-serif",
          }}
        >
          Register it
        </a>
      </div>
    );
  }

  const texts = data.texts || {};
  const ownerDisplay = data.ownerEns || truncAddr(data.owner || '');
  const regDate = data.registeredAt ? new Date(data.registeredAt * 1000).toLocaleDateString() : '';
  const zeroAddr = '0x0000000000000000000000000000000000000000';
  const hasOperator = data.operator && data.operator !== zeroAddr && data.operator?.toLowerCase() !== data.owner?.toLowerCase();
  const hasAgent = data.agentId !== '0';
  const hasBio = !!texts['description'];
  const hasAvatar = !!texts['avatar'];
  const hasSocials = !!(texts['com.twitter'] || texts['xyz.farcaster'] || texts['com.github'] || texts['org.telegram'] || texts['com.discord'] || texts['com.linkedin']);
  const hasOnchainProfile = hasAgent || !!data.agentMeta || !!texts['agent.endpoint'] || !!texts['agent.model'] || !!data.helixaData?.tokenId || !!data.exoData || !!data.bankrData?.projectName;

  return (
    <div style={{ maxWidth: 480, margin: '2rem auto', padding: '0 1rem' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        {hasAvatar ? (
          <img
            src={texts['avatar']}
            alt={profileName}
            style={{ width: 96, height: 96, borderRadius: '50%', border: '3px solid #CF3748', objectFit: 'cover', margin: '0 auto 0.75rem' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div style={{
            width: 96, height: 96, borderRadius: '50%', background: '#4870D4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 0.75rem', fontSize: '2.5rem', fontWeight: 700,
            color: '#fff', fontFamily: "'Fredoka', sans-serif",
          }}>
            {profileName.charAt(0).toUpperCase()}
          </div>
        )}

        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem', fontFamily: "'Fredoka', sans-serif" }}>
          <span style={{ color: '#4870D4' }}>{profileName}</span><span style={{ color: '#131325' }}>.hazza.name</span>
        </h1>

        {hasBio && <p style={{ color: '#8a7d5a', fontSize: '0.9rem', lineHeight: 1.5, margin: '0.5rem 0' }}>{texts['description']}</p>}

        <span style={{
          display: 'inline-block', padding: '0.15rem 0.5rem',
          background: '#fff', border: '2px solid #4870D4', borderRadius: 12,
          fontSize: '0.7rem', fontWeight: 700, color: '#4870D4',
        }}>
          {data.status}
        </span>

        <Badges texts={texts} />
        <SocialLinks texts={texts} />

        {/* XMTP DM Button */}
        {texts['xmtp'] && (
          <div style={{ marginTop: '0.75rem' }}>
            <button
              onClick={() => setChatOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 1rem', background: '#4870D4', border: 'none',
                borderRadius: 20, color: '#fff', fontSize: '0.8rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: "'Fredoka', sans-serif",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              Send DM
            </button>
          </div>
        )}

        {/* Empty profile prompt */}
        {!hasBio && !hasAvatar && !hasSocials && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#fff', border: '2px solid #E8DCAB', borderRadius: 8 }}>
            <span style={{ color: '#8a7d5a', fontSize: '0.85rem' }}>
              This profile is empty. <a href={`https://hazza.name/manage?name=${encodeURIComponent(profileName)}`} style={{ color: '#CF3748', fontWeight: 700 }}>Set it up</a>
            </span>
          </div>
        )}
      </div>

      {/* Name Info */}
      <Section title="Name Info" defaultOpen>
        <InfoRow label="Owner" value={ownerDisplay} link={`https://${EXPLORER_HOST}/address/${data.owner}`} />
        <InfoRow label="Token ID" value={`#${data.tokenId}`} />
        <InfoRow label="Registered" value={regDate} />
        {hasOperator && <InfoRow label="Operator" value={truncAddr(data.operator!)} link={`https://${EXPLORER_HOST}/address/${data.operator}`} />}
        <InfoRow label="Subdomain" value={`${profileName}.hazza.name`} link={`https://${profileName}.hazza.name`} />
      </Section>

      {/* Onchain Profile */}
      {hasOnchainProfile && (
        <Section title="Onchain Profile">
          <AgentSection agentId={data.agentId || '0'} agentWallet={data.agentWallet || zeroAddr} agentMeta={data.agentMeta} texts={texts} />
          {data.helixaData && <><hr style={{ border: 'none', borderTop: '1px solid #E8DCAB', margin: '0.75rem 0' }} /><HelixaSection data={data.helixaData} /></>}
          {data.exoData && <><hr style={{ border: 'none', borderTop: '1px solid #E8DCAB', margin: '0.75rem 0' }} /><ExoskeletonSection data={data.exoData} /></>}
          {data.bankrData && <><hr style={{ border: 'none', borderTop: '1px solid #E8DCAB', margin: '0.75rem 0' }} /><BankrSection data={data.bankrData} /></>}
        </Section>
      )}

      {/* Contenthash */}
      {data.contenthash && (
        <Section title="Contenthash">
          <InfoRow label="Hash" value={data.contenthash.slice(0, 18) + '...' + data.contenthash.slice(-8)} />
        </Section>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <a
          href={`https://hazza.name/manage?name=${encodeURIComponent(profileName)}`}
          style={{
            display: 'inline-block', padding: '0.6rem 1.5rem',
            background: '#CF3748', color: '#fff', borderRadius: 8,
            fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
            fontFamily: "'Fredoka', sans-serif", border: 'none',
          }}
        >
          manage
        </a>
      </div>

      {/* Chat Panel */}
      {texts['xmtp'] && (
        <ChatPanel
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          targetAddress={texts['xmtp']}
          targetName={profileName}
          targetAvatar={texts['avatar']}
          context={`Profile DM to ${profileName}`}
        />
      )}
    </div>
  );
}
