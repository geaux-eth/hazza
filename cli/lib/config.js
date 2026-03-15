const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'hazza');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  baseUrl: 'https://hazza.name',
  rpcUrl: 'https://mainnet.base.org',
  registryAddress: '0xaA27d926F057B72D006883785FC03DB1d9d6E3AC',
  usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  treasuryAddress: '0x62B7399B2ac7e938Efad06EF8746fDBA3B351900',
  chainId: '8453',
};

const VALID_KEYS = ['wallet', 'baseUrl', 'rpcUrl', 'registryAddress', 'usdcAddress', 'treasuryAddress', 'chainId'];

// Runtime overrides (from --rpc-url, --wallet flags)
const overrides = {};

function override(key, value) { overrides[key] = value; }

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function load() {
  ensureDir();
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return { ...DEFAULTS, ...data };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(config) {
  ensureDir();
  const clean = {};
  for (const [k, v] of Object.entries(config)) {
    if (v !== undefined && v !== null && v !== DEFAULTS[k]) {
      clean[k] = v;
    }
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(clean, null, 2) + '\n', { mode: 0o600 });
}

function get(key) {
  if (overrides[key] !== undefined) return overrides[key];
  return load()[key];
}

function set(key, value) {
  if (!VALID_KEYS.includes(key)) {
    throw new Error(`Invalid config key: ${key}. Valid: ${VALID_KEYS.join(', ')}`);
  }
  const cfg = load();
  cfg[key] = value;
  save(cfg);
}

module.exports = { load, save, get, set, override, VALID_KEYS, DEFAULTS, CONFIG_FILE };
