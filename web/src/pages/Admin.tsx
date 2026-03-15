import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { REGISTRY_ADDRESS, REGISTRY_ABI } from '../config/contracts';

const FALLBACK_OWNER = '0x96168ACf7f3925e7A9eAA08Ddb21e59643da8097';

export default function Admin() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [baseURI, setBaseURI] = useState('https://hazza.name/api/metadata/');
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const [contractOwner, setContractOwner] = useState<string>('');
  useEffect(() => {
    if (publicClient) {
      publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: [{ name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }],
        functionName: 'owner',
      }).then(o => setContractOwner((o as string).toLowerCase()))
        .catch(() => setContractOwner(FALLBACK_OWNER.toLowerCase()));
    }
  }, [publicClient]);

  const ownerAddr = contractOwner || FALLBACK_OWNER.toLowerCase();
  const isOwner = address?.toLowerCase() === ownerAddr;

  if (!address) {
    return (
      <div style={{ maxWidth: 500, margin: '4rem auto', padding: '1rem', fontFamily: 'sans-serif' }}>
        <h2>Admin</h2>
        <p>Connect your wallet first.</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div style={{ maxWidth: 500, margin: '4rem auto', padding: '1rem', fontFamily: 'sans-serif' }}>
        <h2>Admin</h2>
        <p>Not authorized. Connected: {address}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 500, margin: '4rem auto', padding: '1rem', fontFamily: 'sans-serif' }}>
      <h2>Set Base URI</h2>
      <p style={{ color: '#666', margin: '1rem 0' }}>
        Sets the tokenURI base for NFT metadata. tokenURI(id) returns baseURI + name.
      </p>
      <input
        type="text"
        value={baseURI}
        onChange={(e) => setBaseURI(e.target.value)}
        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', borderRadius: 8, border: '1px solid #ccc', marginBottom: '1rem' }}
      />
      <button
        onClick={() => writeContract({
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: 'setBaseURI',
          args: [baseURI],
        })}
        disabled={isPending || isConfirming}
        style={{ padding: '0.75rem 1.5rem', background: '#CF3748', color: '#fff', border: 'none', borderRadius: 8, fontSize: '1rem', cursor: 'pointer' }}
      >
        {isPending ? 'Confirm in wallet...' : isConfirming ? 'Confirming...' : 'Set Base URI'}
      </button>

      {txHash && (
        <p style={{ marginTop: '1rem', wordBreak: 'break-all' }}>
          Tx: <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer">{txHash}</a>
        </p>
      )}
      {isSuccess && <p style={{ color: 'green', marginTop: '0.5rem' }}>Confirmed!</p>}
      {error && <p style={{ color: 'red', marginTop: '0.5rem' }}>{error.message}</p>}
    </div>
  );
}
