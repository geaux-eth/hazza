import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { REGISTRY_ADDRESS, REGISTRY_ABI } from '../config/contracts';
import { API_BASE } from '../constants';

type DnsStatus = {
  domain: string;
  verified: boolean;
  cname: string | null;
  expected: string;
  checking?: boolean;
};

type MyName = {
  name: string;
  tokenId: string;
  domains: string[];
};

export default function Domains() {
  const { address, isConnected } = useAccount();
  const [myNames, setMyNames] = useState<MyName[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState<string>('');
  const [domainInput, setDomainInput] = useState('');
  const [dnsStatuses, setDnsStatuses] = useState<Record<string, DnsStatus>>({});
  const [statusMsg, setStatusMsg] = useState<{ msg: string; isError: boolean } | null>(null);

  const { writeContract, data: txHash, isPending: txPending, error: txError } = useWriteContract();
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // Load user's names when wallet connects
  const loadNames = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/names/${address}`);
      const data = await resp.json();
      if (data.names && Array.isArray(data.names)) {
        const namesWithDomains: MyName[] = await Promise.all(
          data.names.map(async (n: { name: string; tokenId: string }) => {
            let domains: string[] = [];
            try {
              const dResp = await fetch(`${API_BASE}/api/domains/${n.name}`);
              const dData = await dResp.json();
              if (dData.domains) domains = dData.domains;
            } catch { /* ignore */ }
            return { name: n.name, tokenId: n.tokenId, domains };
          })
        );
        setMyNames(namesWithDomains);
        if (namesWithDomains.length > 0 && !selectedName) {
          setSelectedName(namesWithDomains[0].name);
        }
      }
    } catch (e) {
      console.error('Failed to load names:', e);
    }
    setLoading(false);
  }, [address]);

  useEffect(() => {
    if (isConnected && address) loadNames();
  }, [isConnected, address, loadNames]);

  // Reload after tx confirms
  useEffect(() => {
    if (txConfirmed) {
      setStatusMsg({ msg: 'Domain linked onchain!', isError: false });
      setDomainInput('');
      loadNames();
    }
  }, [txConfirmed, loadNames]);

  useEffect(() => {
    if (txError) {
      setStatusMsg({ msg: txError.message.slice(0, 200), isError: true });
    }
  }, [txError]);

  // Check DNS verification for a domain
  const checkDns = async (domain: string) => {
    if (!domain.includes('.')) return;

    setDnsStatuses(prev => ({
      ...prev,
      [domain]: { domain, verified: false, cname: null, expected: 'hazza.name', checking: true },
    }));

    try {
      const resp = await fetch(`${API_BASE}/api/domains/dns/${encodeURIComponent(domain)}`, {
        method: 'POST',
      });
      const data = await resp.json();
      setDnsStatuses(prev => ({
        ...prev,
        [domain]: { ...data, checking: false },
      }));
    } catch {
      setDnsStatuses(prev => ({
        ...prev,
        [domain]: { domain, verified: false, cname: null, expected: 'hazza.name', checking: false },
      }));
    }
  };

  // Link domain onchain
  const linkDomain = () => {
    if (!selectedName || !domainInput.trim()) return;
    const domain = domainInput.trim().toLowerCase();

    // Basic domain validation
    if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain)) {
      setStatusMsg({ msg: 'Enter a valid domain (e.g. example.com)', isError: true });
      return;
    }

    setStatusMsg(null);
    writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'setCustomDomain',
      args: [selectedName, domain],
    });
  };

  const currentNameData = myNames.find(n => n.name === selectedName);

  return (
    <>
      <div className="header">
        <h1>custom domains</h1>
      </div>

      <div className="section">
        <div className="section-title">Bring your own domain</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          Every hazza name gets a live subdomain at{' '}
          <strong style={{ color: '#131325' }}>yourname.hazza.name</strong> automatically.
          <br />
          But you can also link any domain you already own &mdash; .com, .xyz, .io, whatever &mdash; and
          it will resolve to your onchain profile. You can link up to 10 custom domains per name.
        </p>
      </div>

      <hr className="divider" />

      {/* ---- Domain Management Section ---- */}
      <div className="section">
        <div className="section-title">Manage your domains</div>

        {!isConnected ? (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>
            <p style={{ color: '#8a7d5a', marginBottom: '1rem' }}>Connect your wallet to manage custom domains</p>
            <ConnectButton />
          </div>
        ) : loading ? (
          <p style={{ color: '#8a7d5a', textAlign: 'center', padding: '1rem' }}>Loading your names...</p>
        ) : myNames.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>
            <p style={{ color: '#8a7d5a', marginBottom: '1rem' }}>You don't have any hazza names yet.</p>
            <Link
              to="/register"
              style={{
                display: 'inline-block',
                padding: '0.6rem 1.5rem',
                background: '#CF3748',
                color: '#fff',
                borderRadius: '8px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Register a name
            </Link>
          </div>
        ) : (
          <>
            {/* Name selector */}
            {myNames.length > 1 && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ color: '#8a7d5a', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Select name</label>
                <select
                  value={selectedName}
                  onChange={e => setSelectedName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '2px solid #E8DCAB',
                    borderRadius: '8px',
                    background: '#fff',
                    color: '#131325',
                    fontSize: '0.9rem',
                    fontFamily: "'Fredoka', monospace",
                  }}
                >
                  {myNames.map(n => (
                    <option key={n.name} value={n.name}>{n.name}.hazza.name</option>
                  ))}
                </select>
              </div>
            )}

            {/* Current domains */}
            {currentNameData && currentNameData.domains.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ color: '#8a7d5a', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Linked domains</div>
                <div className="info-grid">
                  {currentNameData.domains.map(domain => {
                    const status = dnsStatuses[domain];
                    return (
                      <div key={domain} className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: '0.35rem' }}>
                          <span className="value" style={{ fontWeight: 700 }}>{domain}</span>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              onClick={() => checkDns(domain)}
                              disabled={status?.checking}
                              style={{
                                padding: '0.25rem 0.6rem',
                                background: 'transparent',
                                color: '#4870D4',
                                border: '2px solid #4870D4',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: status?.checking ? 'default' : 'pointer',
                                opacity: status?.checking ? 0.5 : 1,
                              }}
                            >
                              {status?.checking ? 'Checking...' : 'Verify DNS'}
                            </button>
                            <button
                              onClick={() => {
                                if (!window.confirm(`Remove ${domain} from ${selectedName}?`)) return;
                                writeContract({
                                  address: REGISTRY_ADDRESS,
                                  abi: REGISTRY_ABI,
                                  functionName: 'removeCustomDomain',
                                  args: [selectedName, domain],
                                });
                              }}
                              disabled={txPending}
                              style={{
                                padding: '0.25rem 0.6rem',
                                background: 'transparent',
                                color: '#CF3748',
                                border: '2px solid #CF3748',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: txPending ? 'default' : 'pointer',
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        {status && !status.checking && (
                          <div style={{ fontSize: '0.8rem', color: status.verified ? '#2e7d32' : '#CF3748' }}>
                            {status.verified ? (
                              <span>CNAME verified &rarr; hazza.name</span>
                            ) : status.cname ? (
                              <span>CNAME points to <strong>{status.cname}</strong> (expected: hazza.name)</span>
                            ) : (
                              <span>No CNAME record found. Add a CNAME pointing to hazza.name.</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add domain form */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ color: '#8a7d5a', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Add a custom domain</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={domainInput}
                  onChange={e => setDomainInput(e.target.value.toLowerCase())}
                  placeholder="example.com"
                  style={{
                    flex: 1,
                    padding: '0.6rem 0.75rem',
                    border: '2px solid #E8DCAB',
                    borderRadius: '8px',
                    background: '#fff',
                    color: '#131325',
                    fontSize: '0.9rem',
                    fontFamily: "'Fredoka', monospace",
                    outline: 'none',
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') linkDomain(); }}
                />
                <button
                  onClick={linkDomain}
                  disabled={txPending || !domainInput.trim()}
                  style={{
                    padding: '0.6rem 1.25rem',
                    background: txPending ? '#E8DCAB' : '#CF3748',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: txPending ? 'default' : 'pointer',
                    fontSize: '0.9rem',
                    fontFamily: "'Fredoka', sans-serif",
                    whiteSpace: 'nowrap',
                  }}
                >
                  {txPending ? 'Linking...' : 'Link Domain'}
                </button>
              </div>
              <p style={{ color: '#8a7d5a', fontSize: '0.78rem', marginTop: '0.35rem' }}>
                Set up your DNS <strong>before</strong> linking. This calls <code style={{ color: '#CF3748' }}>setCustomDomain</code> on the contract.
              </p>
            </div>

            {/* Status message */}
            {statusMsg && (
              <div style={{
                padding: '0.6rem 0.85rem',
                background: statusMsg.isError ? '#fff5f5' : '#f0fdf4',
                border: `2px solid ${statusMsg.isError ? '#CF3748' : '#2e7d32'}`,
                borderRadius: '8px',
                color: statusMsg.isError ? '#CF3748' : '#2e7d32',
                fontSize: '0.85rem',
                marginBottom: '1rem',
              }}>
                {statusMsg.msg}
              </div>
            )}
          </>
        )}
      </div>

      <hr className="divider" />

      {/* ---- How to link ---- */}
      <div className="section">
        <div className="section-title">How to link your domain</div>
        <div className="info-grid">
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">1. Register</span>
            <span className="value">
              Get a hazza name at <Link to="/register">/register</Link>
            </span>
          </div>
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">2. Buy a domain</span>
            <span className="value">Use any registrar &mdash; Namecheap, GoDaddy, Cloudflare, etc.</span>
          </div>
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">3. Point DNS</span>
            <span className="value">
              Add a CNAME record pointing to <strong style={{ color: '#CF3748' }}>hazza.name</strong>
            </span>
          </div>
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">4. Link onchain</span>
            <span className="value">
              Use the form above or call <code style={{ color: '#CF3748' }}>setCustomDomain</code> on the contract
            </span>
          </div>
        </div>
      </div>

      <hr className="divider" />

      {/* ---- DNS Setup ---- */}
      <div className="section">
        <div className="section-title">DNS setup</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          At your domain registrar, add these DNS records:
        </p>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
          <pre style={{ color: '#8a7d5a', fontSize: '0.85rem', whiteSpace: 'pre-wrap', margin: 0 }}>
{`Type    Name    Value
CNAME   @       hazza.name
CNAME   www     hazza.name`}
          </pre>
        </div>
        <p style={{ color: '#8a7d5a', fontSize: '0.85rem', lineHeight: 1.7 }}>
          Some registrars don't support CNAME on root (@). Use an A record pointing to hazza's IP, or use
          a registrar that supports CNAME flattening (Cloudflare, etc.).
        </p>
        <div style={{ background: '#fff', border: '2px solid #E8DCAB', borderRadius: '8px', padding: '0.75rem 1rem', marginTop: '0.75rem' }}>
          <p style={{ color: '#CF3748', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            SSL / HTTPS
          </p>
          <p style={{ color: '#8a7d5a', fontSize: '0.8rem', lineHeight: 1.6, margin: 0 }}>
            For HTTPS to work on your custom domain, your domain must be proxied through Cloudflare.
            Transfer your domain&rsquo;s DNS to Cloudflare (free plan works), point it to hazza.name, and
            enable the orange cloud proxy. This lets Cloudflare issue an SSL certificate for your domain
            automatically. Without this, visitors will see a certificate error.
          </p>
        </div>
      </div>

      <hr className="divider" />

      {/* ---- What you get ---- */}
      <div className="section">
        <div className="section-title">What you get</div>
        <div className="info-grid">
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">Routing</span>
            <span className="value">Your domain resolves to your hazza profile, agent endpoint, or custom content</span>
          </div>
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">Subdomain</span>
            <span className="value">yourname.hazza.name always works &mdash; free and included</span>
          </div>
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">Onchain</span>
            <span className="value">Domain mapping is stored in the hazza contract &mdash; verifiable and permanent</span>
          </div>
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">Flexible</span>
            <span className="value">
              Point at your profile, custom HTML via{' '}
              <a href="https://netprotocol.app" style={{ fontWeight: 700 }}>Net Protocol</a>, or your own server
            </span>
          </div>
        </div>
      </div>

      <hr className="divider" />

      {/* ---- Custom site upload ---- */}
      <div className="section">
        <div className="section-title">Upload a custom site</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          Your hazza name isn&rsquo;t just a profile &mdash; it&rsquo;s a website. Upload any HTML and it
          goes live at <strong style={{ color: '#131325' }}>yourname.hazza.name</strong> instantly.
        </p>
        <div className="info-grid">
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">1. Create your page</span>
            <span className="value">Write HTML, export from a builder, or use a template</span>
          </div>
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">2. Upload to Net Protocol</span>
            <span className="value">
              Store your HTML permanently onchain via{' '}
              <a href="https://netprotocol.app" style={{ fontWeight: 700 }}>Net Protocol</a> or any HTTPS host
            </span>
          </div>
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">3. Set site.key</span>
            <span className="value">
              Set the <code style={{ color: '#CF3748' }}>site.key</code> text record to your storage key or URL
            </span>
          </div>
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">4. Done</span>
            <span className="value">Your site is live. No hosting fees. No renewals. Forever.</span>
          </div>
        </div>
        <p style={{ color: '#8a7d5a', fontSize: '0.85rem', lineHeight: 1.7, marginTop: '1rem' }}>
          CLI: <code style={{ color: '#CF3748' }}>hazza site set yourname https://your-content-url</code>
          <br />
          To revert to the default profile page:{' '}
          <code style={{ color: '#CF3748' }}>hazza site remove yourname</code>
        </p>
      </div>

      <hr className="divider" />

      {/* ---- ENS DNS Claim ---- */}
      <div className="section">
        <div className="section-title">Claim your domain on ENS</div>
        <p style={{ color: '#8a7d5a', lineHeight: 1.7, marginBottom: '1rem' }}>
          If you own a DNS domain (.com, .xyz, .io, etc.), you can{' '}
          <strong style={{ color: '#131325' }}>claim it on ENS</strong> so it also resolves to your wallet
          address. This means <strong style={{ color: '#131325' }}>yourdomain.com</strong> becomes both a
          website and an Ethereum address &mdash; people can send ETH to it directly.
        </p>
        <div className="info-grid">
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">1. Enable DNSSEC</span>
            <span className="value">
              Go to your domain registrar (Cloudflare, Namecheap, GoDaddy, etc.) and turn on DNSSEC. Most
              registrars have a one-click toggle.
            </span>
          </div>
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">2. Add a TXT record</span>
            <span className="value">
              Add a DNS TXT record on{' '}
              <strong style={{ color: '#131325' }}>_ens.yourdomain.com</strong> with the value:{' '}
              <code style={{ color: '#CF3748', wordBreak: 'break-all' }}>a=0xYOUR_WALLET_ADDRESS</code>
            </span>
          </div>
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">3. Wait for propagation</span>
            <span className="value">
              DNS changes can take up to 24 hours to propagate. DNSSEC may take longer at some registrars.
            </span>
          </div>
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">4. Claim on ENS</span>
            <span className="value">
              Go to{' '}
              <a href="https://app.ens.domains" style={{ fontWeight: 700 }}>app.ens.domains</a> and search
              for your domain. Click &ldquo;Claim&rdquo; and submit the transaction on Ethereum mainnet.
            </span>
          </div>
          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <span className="label">5. Set resolver &amp; records</span>
            <span className="value">
              Once claimed, set a resolver and add your wallet address as the ETH record. Your domain now
              resolves to your wallet in any ENS-compatible app or wallet.
            </span>
          </div>
        </div>
        <p style={{ color: '#8a7d5a', fontSize: '0.85rem', lineHeight: 1.7, marginTop: '1rem' }}>
          <strong style={{ color: '#8a7d5a' }}>Why do this?</strong> Your domain becomes a universal web3
          identity. Send ETH to <strong style={{ color: '#131325' }}>yourdomain.com</strong>, resolve it
          in wallets, and use it across any ENS-integrated app &mdash; while still serving your hazza site
          at the same URL.
        </p>
        <p style={{ color: '#8a7d5a', fontSize: '0.85rem', lineHeight: 1.7 }}>
          <strong style={{ color: '#8a7d5a' }}>Cost:</strong> DNSSEC + ENS DNS claim is free. You only pay
          Ethereum mainnet gas for the claim transaction (~$5&ndash;$15 depending on gas prices).
        </p>
      </div>

      <hr className="divider" />

      <div className="section">
        <div style={{ textAlign: 'center', margin: '2rem 0' }}>
          <Link
            to="/"
            style={{
              display: 'inline-block',
              padding: '0.75rem 2rem',
              background: '#CF3748',
              color: '#fff',
              borderRadius: '8px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Register a name
          </Link>
        </div>
      </div>
    </>
  );
}
