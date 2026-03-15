import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { RELAYER_ADDRESS, USDC_ADDRESS, USDC_ABI } from '../config/contracts';
import { API_BASE } from '../constants';

const UNLIMITED_PASS_ABI = [
  { name: 'hasUnlimitedPass', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const;
const UNLIMITED_PASS_ADDRESS = '0xCe559A2A6b64504bE00aa7aA85C5C31EA93a16BB';

type Step = 'idle' | 'active' | 'done' | 'error';

interface QuoteData {
  total: string;
  totalRaw: string;
  firstRegistration?: boolean;
}

interface FreeClaimData {
  eligible: boolean;
  memberId?: number;
  memberName?: string;
  reason?: string;
}

interface EnsSuggestion {
  name: string;
  ensSource: string;
  available: boolean;
}

const nomiAvailablePhrases = [
  "Ooh! I like that one!",
  "Yep. That's a keeper.",
  "Great choice. Register it before someone else does.",
  "Love it. This one's got main character energy.",
  "Solid pick. You've got good taste.",
  "That's the one. I can feel it.",
  "Nice. Clean, memorable, yours.",
];

const nomiTakenPhrases = [
  "Dang. Try another one.",
  "Someone beat you to it. Keep searching!",
  "Taken! But there are plenty of great names left.",
  "That one's spoken for. Try a variation?",
];

function sanitizeName(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);
}

function randomPhrase(phrases: string[]): string {
  return phrases[Math.floor(Math.random() * phrases.length)];
}

function StepIndicator({ label, status }: { label: string; status: Step }) {
  const icon =
    status === 'done' ? '\u2713' :
    status === 'error' ? '\u2717' :
    status === 'active' ? '\u25CB' : '\u25CB';

  const color =
    status === 'done' ? 'text-blue' :
    status === 'error' ? 'text-red' :
    status === 'active' ? 'text-navy' : 'text-muted';

  return (
    <div className={`checkout-step flex items-center gap-2 py-1 text-sm ${status} ${color}`}>
      <span className="step-icon font-bold">{icon}</span>
      <span>{label}</span>
      {status === 'active' && <span className="animate-pulse">...</span>}
    </div>
  );
}

function SearchView() {
  const [query, setQuery] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{
    name: string;
    available: boolean;
    owner?: string;
    nomiPhrase: string;
  } | null>(null);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');

  async function handleSearch() {
    const raw = query.trim();
    const name = sanitizeName(raw);
    if (!name) {
      setResult(null);
      setSearched(true);
      return;
    }
    setChecking(true);
    setResult(null);
    setSearchError('');
    try {
      const res = await fetch(`${API_BASE}/api/available/${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.available) {
        setResult({ name, available: true, nomiPhrase: randomPhrase(nomiAvailablePhrases) });
      } else {
        const resolveRes = await fetch(`${API_BASE}/api/resolve/${encodeURIComponent(name)}`);
        const resolveData = await resolveRes.json();
        setResult({
          name,
          available: false,
          owner: resolveData.owner,
          nomiPhrase: randomPhrase(nomiTakenPhrases),
        });
      }
      setSearched(true);
    } catch {
      setResult(null);
      setSearchError('Something went wrong checking availability. Please try again.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <div className="search-box flex gap-2 max-w-md mx-auto mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="find something awesome!"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 px-4 py-3 rounded-lg border-2 border-border bg-white text-navy font-body text-base outline-none focus:border-blue"
        />
        <button
          onClick={handleSearch}
          disabled={checking}
          className="px-6 py-3 bg-red text-white font-heading font-bold rounded-lg cursor-pointer hover:bg-red-hover transition-colors disabled:opacity-50"
        >
          {checking ? '...' : 'Search'}
        </button>
      </div>

      {searchError && (
        <div className="text-center mb-4">
          <span className="text-red text-sm">{searchError}</span>
        </div>
      )}

      {result && (
        <div className="bg-white border-2 border-border rounded-xl p-6 mb-6 text-center">
          <p className="font-heading text-blue font-semibold text-sm italic mb-3">
            &ldquo;{result.nomiPhrase}&rdquo; &mdash; nomi
          </p>
          {result.available ? (
            <>
              <p className="mb-1">
                <span className="text-navy font-bold">{result.name}</span>
                <span className="text-blue">.hazza.name</span>
              </p>
              <p className="text-red text-sm mb-4">is available</p>
              <Link
                to={`/register?name=${encodeURIComponent(result.name)}`}
                className="inline-block px-8 py-2.5 bg-red text-white rounded-lg font-heading font-bold no-underline hover:bg-red-hover transition-colors"
              >
                Register
              </Link>
            </>
          ) : (
            <>
              <p className="mb-1">
                <span className="text-navy font-bold">{result.name}</span>
                <span className="text-red">.hazza.name</span>
              </p>
              <p className="text-red text-sm mb-2">is taken</p>
              {result.owner && (
                <p className="text-muted text-sm">
                  Owner:{' '}
                  <a
                    href={`https://basescan.org/address/${result.owner}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted"
                  >
                    {result.owner.slice(0, 6)}...{result.owner.slice(-4)}
                  </a>
                </p>
              )}
            </>
          )}
        </div>
      )}

      {!searched && (
        <div className="text-center mt-6">
          <p className="text-3xl mb-1">
            <strong className="text-red">
              your first name is{' '}
              <span className="text-blue font-heading">FREE</span>
            </strong>
          </p>
          <p className="text-muted text-lg">just pay gas</p>
          <p className="text-navy text-sm mt-3">additional names $5+</p>
        </div>
      )}

      {searched && !result && (
        <p className="text-center text-red text-sm">
          your name is also your web address &mdash; only letters, numbers, and hyphens work in URLs
        </p>
      )}
    </div>
  );
}

const PENDING_PAYMENT_PREFIX = 'hazza-pending-payment-';

function getPendingPayment(name: string): string | null {
  try {
    return localStorage.getItem(PENDING_PAYMENT_PREFIX + name);
  } catch { return null; }
}
function setPendingPayment(name: string, txHash: string): void {
  try { localStorage.setItem(PENDING_PAYMENT_PREFIX + name, txHash); } catch { /* */ }
}
function clearPendingPayment(name: string): void {
  try { localStorage.removeItem(PENDING_PAYMENT_PREFIX + name); } catch { /* */ }
}

function CheckoutView({ name }: { name: string }) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [freeClaim, setFreeClaim] = useState<FreeClaimData | null>(null);
  const [ensSuggestion, setEnsSuggestion] = useState<EnsSuggestion | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [relayerAddr, setRelayerAddr] = useState<string>(RELAYER_ADDRESS);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [hasPass, setHasPass] = useState(false);
  const [step1, setStep1] = useState<Step>('idle');
  const [step2, setStep2] = useState<Step>('idle');
  const [step3, setStep3] = useState<Step>('idle');
  const [status, setStatus] = useState<{ msg: string; error: boolean } | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [refundStatus, setRefundStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [refundMsg, setRefundMsg] = useState('');

  // Check for pending payment on mount
  useEffect(() => {
    const stored = getPendingPayment(name);
    if (stored) {
      setPendingTxHash(stored);
    }
  }, [name]);

  const isFree = useMemo(() => {
    return freeClaim?.eligible || quote?.firstRegistration || false;
  }, [freeClaim, quote]);

  const totalCostRaw = useMemo(() => {
    if (isFree) return 0n;
    return BigInt(quote?.totalRaw || '0');
  }, [isFree, quote]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/available/${encodeURIComponent(name)}`);
        const data = await res.json();
        if (!cancelled) setNameAvailable(data.available);
      } catch {
        if (!cancelled) setNameAvailable(false);
      }
    })();
    return () => { cancelled = true; };
  }, [name]);

  useEffect(() => {
    if (!isConnected || !address) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/free-claim/${address}`);
        const data = await res.json();
        if (!cancelled) setFreeClaim(data);
      } catch { /* non-fatal */ }
    })();

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/ens-names/${address}`);
        const data = await res.json();
        if (!cancelled && data.suggestions?.length > 0) {
          setEnsSuggestion(data.suggestions[0]);
        }
      } catch { /* non-fatal */ }
    })();

    // Check Unlimited Pass ownership on-chain
    if (publicClient) {
      (async () => {
        try {
          const result = await publicClient.readContract({
            address: UNLIMITED_PASS_ADDRESS,
            abi: UNLIMITED_PASS_ABI,
            functionName: 'hasUnlimitedPass',
            args: [address],
          });
          if (!cancelled) setHasPass(result as boolean);
        } catch { /* non-fatal */ }
      })();
    }

    return () => { cancelled = true; };
  }, [isConnected, address, publicClient]);

  const loadQuote = useCallback(async () => {
    if (!address || !name) return;
    try {
      let quoteUrl = `${API_BASE}/api/quote/${encodeURIComponent(name)}?wallet=${address}&years=1`;
      if (hasPass) quoteUrl += '&verifiedPass=true';
      const res = await fetch(quoteUrl);
      const data: QuoteData = await res.json();
      setQuote(data);

      if (!data.firstRegistration && BigInt(data.totalRaw || '0') > 0n) {
        try {
          const x402Res = await fetch(`${API_BASE}/x402/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, owner: address, years: 1, ...(hasPass ? { hasPass: true } : {}) }),
          });
          if (x402Res.status === 402) {
            const x402Data = await x402Res.json();
            const apiPayTo = x402Data.accepts?.[0]?.payTo;
            const KNOWN_RELAYERS = [RELAYER_ADDRESS.toLowerCase()];
            const validatedRelayer = (apiPayTo && KNOWN_RELAYERS.includes(apiPayTo.toLowerCase()))
              ? apiPayTo
              : RELAYER_ADDRESS;
            setRelayerAddr(validatedRelayer);
          }
        } catch { /* use default relayer */ }
      }
    } catch { /* quote load failed */ }
  }, [address, name, hasPass]);

  useEffect(() => {
    if (isConnected && address && nameAvailable) {
      loadQuote();
    }
  }, [isConnected, address, nameAvailable, loadQuote]);

  const {
    writeContract: transferUsdc,
    data: transferHash,
    isPending: transferPending,
    reset: resetTransfer,
    error: transferError,
  } = useWriteContract();

  const { isSuccess: transferConfirmed, isLoading: transferConfirming } =
    useWaitForTransactionReceipt({ hash: transferHash });

  const submitRegistration = useCallback(async (txHash: string) => {
    setStep1('done');
    setStep2('active');
    setStatus({ msg: 'Registering your name...', error: false });
    setBusy(true);

    const payment = btoa(JSON.stringify({
      scheme: 'exact',
      txHash,
      from: address,
    }));

    try {
      const res = await fetch(`${API_BASE}/x402/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT': payment,
        },
        body: JSON.stringify({ name, owner: address, years: 1, ...(hasPass ? { hasPass: true } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'Registration failed');
      setStep2('done');
      setStep3('done');
      setSuccess(true);
      clearPendingPayment(name);
      setPendingTxHash(null);
    } catch (e: any) {
      setStep2('error');
      setStatus({ msg: e.message || 'Registration failed', error: true });
      setBusy(false);
      setRetryCount((c) => c + 1);
      // Keep the pending payment in localStorage so user can retry
    }
  }, [address, name, hasPass]);

  const submittedHashRef = useRef<string | null>(null);
  useEffect(() => {
    if (!transferConfirmed || !transferHash) return;
    if (submittedHashRef.current === transferHash) return; // prevent double-submit
    submittedHashRef.current = transferHash;
    // Persist payment tx hash before attempting registration
    setPendingPayment(name, transferHash);
    setPendingTxHash(transferHash);
    submitRegistration(transferHash);
  }, [transferConfirmed, transferHash, name, submitRegistration]);

  async function handleRetry() {
    if (!pendingTxHash || !address) return;
    setStep2('idle');
    setStatus(null);
    await submitRegistration(pendingTxHash);
  }

  async function handleRefund() {
    if (!pendingTxHash || !address) return;
    setRefundStatus('pending');
    setRefundMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: pendingTxHash, wallet: address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refund request failed');
      setRefundStatus('success');
      setRefundMsg(data.message || 'Refund sent successfully');
      clearPendingPayment(name);
      setPendingTxHash(null);
      setStep1('idle');
      setStep2('idle');
      setStatus(null);
      setBusy(false);
    } catch (e: any) {
      setRefundStatus('error');
      setRefundMsg(e.message || 'Refund failed');
    }
  }

  async function handleCheckout() {
    if (!address) return;
    setBusy(true);
    setStatus(null);
    resetTransfer();

    try {
      if (isFree) {
        setStep1('done');
        setStep2('active');
        setStatus({ msg: 'Registering your free name...', error: false });

        const res = await fetch(`${API_BASE}/x402/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, owner: address, years: 1, ...(hasPass ? { hasPass: true } : {}) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.detail || 'Registration failed');
        setStep2('done');
        setStep3('done');
        setSuccess(true);
        return;
      }

      if (totalCostRaw === 0n) {
        setStatus({ msg: 'Price not loaded. Refresh and try again.', error: true });
        setBusy(false);
        return;
      }

      setStep1('active');
      setStatus({ msg: 'Confirm USDC transfer in your wallet...', error: false });

      transferUsdc({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [relayerAddr as `0x${string}`, totalCostRaw],
      });
    } catch (e: any) {
      setStatus({ msg: e.reason || e.message || 'Transaction failed', error: true });
      setBusy(false);
    }
  }

  useEffect(() => {
    if (transferPending) {
      setStep1('active');
      setStatus({ msg: 'Confirm USDC transfer in your wallet...', error: false });
    }
    if (transferConfirming) {
      setStatus({ msg: 'Waiting for confirmation...', error: false });
    }
  }, [transferPending, transferConfirming]);

  // Handle wallet rejection or transfer error
  useEffect(() => {
    if (!transferError) return;
    const msg = (transferError as any).shortMessage || transferError.message || 'Transfer failed';
    const friendly = msg.includes('User rejected') || msg.includes('user rejected')
      ? 'Transaction rejected'
      : msg;
    setStatus({ msg: friendly, error: true });
    setStep1('idle');
    setBusy(false);
    resetTransfer();
  }, [transferError, resetTransfer]);

  if (nameAvailable === null) {
    return (
      <p className="text-center text-muted py-8">Checking availability...</p>
    );
  }

  if (nameAvailable === false) {
    return (
      <div className="text-center py-8">
        <p className="text-red mb-2">
          {name}.hazza.name is already taken.
        </p>
        <Link to="/register" className="text-blue font-bold hover:underline">
          Try another name
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center mt-8 p-6 bg-white border-2 border-red rounded-xl">
        <p className="text-blue font-bold text-2xl mb-2">registered!</p>
        <p className="text-navy font-bold text-lg mb-4">{name}.hazza.name</p>
        <a
          href={`https://${name}.hazza.name`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-8 py-3 bg-red text-white rounded-lg font-heading font-bold no-underline hover:bg-red-hover transition-colors mb-3"
        >
          view {name}.hazza.name
        </a>
        <p className="font-heading text-muted text-sm mt-2">&mdash; nomi approves.</p>
        <div className="mt-3">
          <Link to="/dashboard" className="text-muted text-sm hover:underline">
            go to dashboard &rarr;
          </Link>
        </div>
        <div className="mt-5 pt-4 border-t border-border">
          <Link
            to="/register"
            className="inline-block px-6 py-2.5 bg-transparent text-red border-2 border-red rounded-lg font-heading font-bold no-underline hover:bg-red hover:text-white transition-colors text-sm"
          >
            register another name
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {freeClaim?.eligible && (
        <div className="mb-4 p-3 bg-white border-2 border-red rounded-lg text-center text-muted text-sm">
          {freeClaim.reason === 'first-registration' ? (
            <span><strong className="text-red">Your first name is free!</strong> Just pay gas.</span>
          ) : (
            <span>
              <strong className="text-red">1 free hazza name!</strong>{' '}
              Net Library {freeClaim.memberName || ''} + Unlimited Pass
            </span>
          )}
        </div>
      )}

      {ensSuggestion && (
        <div className="mb-4 p-3 bg-white border-2 border-border rounded-lg text-center">
          <span className="text-muted text-sm">
            Your ENS: <strong className="text-navy">{ensSuggestion.ensSource}</strong>
          </span>
          <br />
          {ensSuggestion.available ? (
            <span>
              <span className="text-red font-bold">{ensSuggestion.name}.hazza.name</span> is available!{' '}
              <Link
                to={`/register?name=${encodeURIComponent(ensSuggestion.name)}`}
                className="inline-block px-3 py-1 bg-red text-white rounded-md font-bold text-xs no-underline ml-2"
              >
                Claim it
              </Link>
            </span>
          ) : (
            <span className="text-muted text-sm">
              {ensSuggestion.name}.hazza.name is already registered
            </span>
          )}
        </div>
      )}

      <div className="text-center mb-2">
        <h2 className="text-navy font-bold text-2xl break-words">{name}.hazza.name</h2>
      </div>

      {!isConnected && (
        <div className="text-center mb-6">
          <p className="text-muted text-sm mb-1">your first name is free &mdash; just pay gas</p>
          <p className="text-navy text-xs">additional names $5+</p>
          <p className="text-muted text-sm mt-4">
            tap <strong className="text-red">Connect</strong> in the menu to continue
          </p>
        </div>
      )}

      {isConnected && (
        <div className="mt-6">
          <div className="bg-white border-2 border-border rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-muted">Total</span>
              <span className="text-navy font-bold text-xl">
                {isFree ? (
                  <span className="text-red">FREE + gas</span>
                ) : quote ? (
                  <>
                    ${quote.total} USDC
                    {hasPass && (
                      <span className="text-red text-sm font-normal ml-2">(20% Unlimited Pass discount)</span>
                    )}
                  </>
                ) : (
                  <span className="text-muted text-sm">loading...</span>
                )}
              </span>
            </div>
          </div>

          <div className="text-center mb-6">
            <button
              onClick={handleCheckout}
              disabled={busy || (!isFree && totalCostRaw === 0n)}
              className="px-10 py-3 bg-red text-white border-none rounded-lg font-heading font-bold text-base cursor-pointer hover:bg-red-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Register Name
            </button>
          </div>

          {(step1 !== 'idle' || step2 !== 'idle') && (
            <div className="space-y-1 mb-4">
              <StepIndicator label="transfer USDC" status={step1} />
              <StepIndicator label="register name" status={step2} />
              <StepIndicator label="done" status={step3} />
            </div>
          )}

          {status && (
            <p className={`text-center text-sm p-3 rounded-lg ${status.error ? 'text-red' : 'text-muted'}`}>
              {status.msg}
            </p>
          )}

          {/* Resume/Retry registration with existing payment */}
          {pendingTxHash && step2 !== 'active' && !success && (
            <div className="mt-4 p-4 bg-white border-2 border-red rounded-xl text-center">
              <p className="text-navy text-sm mb-1">
                {step2 === 'error' ? 'Registration failed, but your payment was recorded.' : 'You have a pending payment for this name.'}
              </p>
              <p className="text-muted text-xs mb-3 break-all">
                Payment tx: {pendingTxHash.slice(0, 10)}...{pendingTxHash.slice(-8)}
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={handleRetry}
                  disabled={busy}
                  className="px-6 py-2.5 bg-red text-white border-none rounded-lg font-heading font-bold text-sm cursor-pointer hover:bg-red-hover transition-colors disabled:opacity-50"
                >
                  {step2 === 'error' ? 'Retry Registration' : 'Resume Registration'}
                </button>
                {retryCount >= 2 && (
                  <button
                    onClick={handleRefund}
                    disabled={busy || refundStatus === 'pending'}
                    className="px-6 py-2.5 bg-transparent text-red border-2 border-red rounded-lg font-heading font-bold text-sm cursor-pointer hover:bg-red hover:text-white transition-colors disabled:opacity-50"
                  >
                    {refundStatus === 'pending' ? 'Requesting...' : 'Request Refund'}
                  </button>
                )}
              </div>
              {refundStatus === 'idle' && retryCount >= 2 && (
                <p className="text-muted text-xs mt-3 leading-relaxed">
                  Requesting a refund verifies your payment on-chain and confirms the registration didn't go through.
                  Once validated, the team is notified and your USDC is returned to the wallet above — typically within a few hours.
                </p>
              )}
              {refundStatus === 'success' && (
                <p className="text-blue text-sm mt-3">{refundMsg}</p>
              )}
              {refundStatus === 'error' && (
                <p className="text-red text-sm mt-3">{refundMsg}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Register() {
  const [searchParams] = useSearchParams();
  const rawName = searchParams.get('name') || '';
  const nameParam = sanitizeName(rawName);

  return (
    <div className="max-w-[720px] mx-auto px-6">
      <div className="bg-blue rounded-xl p-6 mb-6 mt-4">
        <h1 className="text-white font-heading text-3xl font-bold">register</h1>
      </div>

      {nameParam ? <CheckoutView name={nameParam} /> : <SearchView />}
    </div>
  );
}
