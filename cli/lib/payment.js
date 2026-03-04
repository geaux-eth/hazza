const { execSync } = require('child_process');
const config = require('./config');
const output = require('./output');

function castAvailable() {
  try {
    execSync('cast --version', { stdio: 'pipe' });
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
  const cmd = `cast ${args}`;
  try {
    const result = execSync(cmd, {
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
  const txHash = cast(
    `send ${usdcAddress} "transfer(address,uint256)" ${to} ${amount} --rpc-url ${rpc} --json`,
  );
  try {
    const parsed = JSON.parse(txHash);
    return parsed.transactionHash || parsed.hash;
  } catch {
    // cast sometimes returns just the hash
    return txHash;
  }
}

// Approve USDC spending
function approveUSDC(spender, amount, rpcUrl) {
  requireCast();
  const usdcAddress = config.get('usdcAddress');
  const rpc = rpcUrl || getRpcUrl();
  output.info(`Approving ${formatUSDC(amount)} USDC...`);
  const txHash = cast(
    `send ${usdcAddress} "approve(address,uint256)" ${spender} ${amount} --rpc-url ${rpc} --json`,
  );
  try {
    const parsed = JSON.parse(txHash);
    return parsed.transactionHash || parsed.hash;
  } catch {
    return txHash;
  }
}

// Call a contract function (write)
function contractSend(contractAddr, sig, args, rpcUrl) {
  requireCast();
  const rpc = rpcUrl || getRpcUrl();
  const argsStr = args.join(' ');
  const txHash = cast(
    `send ${contractAddr} "${sig}" ${argsStr} --rpc-url ${rpc} --json`,
  );
  try {
    const parsed = JSON.parse(txHash);
    return parsed.transactionHash || parsed.hash;
  } catch {
    return txHash;
  }
}

// Call a contract function (read)
function contractCall(contractAddr, sig, args, rpcUrl) {
  requireCast();
  const rpc = rpcUrl || getRpcUrl();
  const argsStr = args.join(' ');
  return cast(`call ${contractAddr} "${sig}" ${argsStr} --rpc-url ${rpc}`);
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
