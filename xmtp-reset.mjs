// XMTP Installation Reset — run this to revoke all XMTP installations for your wallet
// Usage: node xmtp-reset.mjs
// You'll need to paste your wallet private key (used ONLY locally to sign the revocation)

import { createInterface } from 'readline';
import { Client } from '@xmtp/node-sdk';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

async function main() {
  console.log('\n=== XMTP Installation Reset ===\n');
  console.log('This will revoke ALL your XMTP installations so you can connect fresh.');
  console.log('Your private key is used ONLY locally to sign the revocation message.\n');

  const key = await ask('Paste your wallet private key (0x...): ');
  if (!key.startsWith('0x') || key.length < 60) {
    console.error('Invalid key format');
    process.exit(1);
  }

  const { privateKeyToAccount } = await import('viem/accounts');
  const { toBytes } = await import('viem');

  const account = privateKeyToAccount(key);
  console.log(`\nWallet: ${account.address}`);

  const signer = {
    type: 'EOA',
    getIdentifier: () => ({
      identifierKind: 0, // Ethereum
      identifier: account.address.toLowerCase(),
    }),
    signMessage: async (message) => {
      const sig = await account.signMessage({
        message: { raw: typeof message === 'string' ? toBytes(message) : message },
      });
      return toBytes(sig);
    },
  };

  console.log('Creating XMTP client (without registering)...');
  const dbPath = `./xmtp-reset-${Date.now()}`;

  const client = await Client.create(signer, {
    env: 'production',
    dbPath,
    disableAutoRegister: true,
  });

  const state = await client.inboxState(true);
  console.log(`\nInbox ID: ${state.inboxId}`);
  console.log(`Installations: ${state.installations.length}`);

  if (state.installations.length === 0) {
    console.log('No installations to revoke!');
    process.exit(0);
  }

  for (const inst of state.installations) {
    console.log(`  - ${Buffer.from(inst.id).toString('hex').substring(0, 16)}...`);
  }

  const confirm = await ask(`\nRevoke all ${state.installations.length} installations? (yes/no): `);
  if (confirm.toLowerCase() !== 'yes') {
    console.log('Cancelled.');
    process.exit(0);
  }

  console.log('Revoking...');
  const allIds = state.installations.map(i => i.id);
  await client.revokeInstallations(allIds);

  const newState = await client.inboxState(true);
  console.log(`\nDone! Installations remaining: ${newState.installations.length}`);
  console.log('You can now connect to XMTP from hazza.name.');

  // Cleanup temp DB
  const { rmSync } = await import('fs');
  try { rmSync(dbPath, { recursive: true }); } catch {}
  try { rmSync(dbPath + '-shm'); } catch {}
  try { rmSync(dbPath + '-wal'); } catch {}

  rl.close();
  process.exit(0);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
