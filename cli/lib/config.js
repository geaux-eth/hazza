const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'hazza');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  baseUrl: 'https://hazza.name',
  rpcUrl: 'https://sepolia.base.org',
  registryAddress: '0x2ab93c016F534C49e85c8E9E3E9aA8D45867ed7A',
  usdcAddress: '0x06A096A051906dEDd05Ef22dCF61ca1199bb038c',
  chainId: '84532',
};

const VALID_KEYS = ['wallet', 'baseUrl', 'rpcUrl', 'registryAddress', 'usdcAddress', 'chainId'];

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
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(clean, null, 2) + '\n');
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
