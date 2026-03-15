const { execFileSync } = require('child_process');
const config = require('./config');
const output = require('./output');

function castAvailable() {
  try {
    execFileSync('cast', ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function requireCast() {
  if (!castAvailable()) {
    throw new Error('cast (Foundry) is required for onchain transactions. Install: https://getfoundry.sh');
  }
}

function getWallet() {
  const wallet = config.get('wallet');
  if (!wallet) {
    throw new Error('No wallet configured. Run: hazza config set wallet <address>');
  }
  return wallet;
}

function getRpcUrl() {
  return config.get('rpcUrl');
}

function cast(args, opts = {}) {
  // Accept either a string (split into array) or an array of args
  const argsArray = Array.isArray(args) ? args : args.split(/\s+/);
  try {
    const result = execFileSync('cast', argsArray, {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
      timeout: 120000,
      ...opts,
    });
    return result.trim();
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString().trim() : '';
    throw new Error(stderr || e.message);
  }
}

// Send USDC to an address (for x402 payment)
function transferUSDC(to, amount, rpcUrl) {
  requireCast();
  const usdcAddress = config.get('usdcAddress');
  const rpc = rpcUrl || getRpcUrl();
  // amount is in raw units (6 decimals for USDC)
  output.info(`Sending ${formatUSDC(amount)} USDC to ${to}...`);
  const txResult = cast(
    ['send', usdcAddress, 'transfer(address,uint256)', to, String(amount), '--rpc-url', rpc, '--json'],
  );
  let txHash;
  try {
    const parsed = JSON.parse(txResult);
    txHash = parsed.transactionHash || parsed.hash;
  } catch {
    // cast sometimes returns just the hash
    txHash = txResult;
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new Error('Invalid transaction hash returned: ' + txHash);
  }
  return txHash;
}

// Approve USDC spending
function approveUSDC(spender, amount, rpcUrl) {
  requireCast();
  const usdcAddress = config.get('usdcAddress');
  const rpc = rpcUrl || getRpcUrl();
  output.info(`Approving ${formatUSDC(amount)} USDC...`);
  const txResult = cast(
    ['send', usdcAddress, 'approve(address,uint256)', spender, String(amount), '--rpc-url', rpc, '--json'],
  );
  let txHash;
  try {
    const parsed = JSON.parse(txResult);
    txHash = parsed.transactionHash || parsed.hash;
  } catch {
    txHash = txResult;
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new Error('Invalid transaction hash returned: ' + txHash);
  }
  return txHash;
}

// Call a contract function (write)
function contractSend(contractAddr, sig, args, rpcUrl) {
  requireCast();
  const rpc = rpcUrl || getRpcUrl();
  const txResult = cast(
    ['send', contractAddr, sig, ...args.map(String), '--rpc-url', rpc, '--json'],
  );
  let txHash;
  try {
    const parsed = JSON.parse(txResult);
    txHash = parsed.transactionHash || parsed.hash;
  } catch {
    txHash = txResult;
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new Error('Invalid transaction hash returned: ' + txHash);
  }
  return txHash;
}

// Call a contract function (read)
function contractCall(contractAddr, sig, args, rpcUrl) {
  requireCast();
  const rpc = rpcUrl || getRpcUrl();
  return cast(['call', contractAddr, sig, ...args.map(String), '--rpc-url', rpc]);
}

// Build x402 payment header
function makePaymentHeader(txHash, from) {
  const payload = JSON.stringify({ scheme: 'exact', txHash, from });
  return Buffer.from(payload).toString('base64');
}

function formatUSDC(rawAmount) {
  const n = BigInt(rawAmount);
  const whole = n / 1000000n;
  const frac = n % 1000000n;
  if (frac === 0n) return `$${whole}`;
  return `$${whole}.${frac.toString().padStart(6, '0').replace(/0+$/, '')}`;
}

module.exports = {
  castAvailable, requireCast, getWallet, getRpcUrl,
  cast, transferUSDC, approveUSDC, contractSend, contractCall,
  makePaymentHeader, formatUSDC,
};
