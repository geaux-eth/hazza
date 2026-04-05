const config = require('./config');

function getBaseUrl() {
  return config.get('baseUrl') || 'https://hazza.name';
}

async function request(path, opts = {}) {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (res.status === 402) {
    const body = await res.json().catch(() => ({}));
    return { status: 402, ...body };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

async function get(path) {
  return request(path);
}

async function post(path, data, headers = {}) {
  return request(path, {
    method: 'POST',
    body: JSON.stringify(data),
    headers,
  });
}

// API endpoints
async function checkAvailable(name) { return get(`/api/available/${name}`); }
async function resolve(name) { return get(`/api/resolve/${name}`); }
async function quote(name, wallet) {
  let path = `/api/quote/${name}?`;
  if (wallet) path += `wallet=${wallet}&`;
  return get(path.replace(/[&?]$/, ''));
}
async function freeClaim(address) { return get(`/api/free-claim/${address}`); }
async function profile(name) { return get(`/api/profile/${name}`); }
async function getText(name, key) { return get(`/api/text/${name}/${key}`); }
async function names(address) { return get(`/api/names/${address}`); }
async function stats() { return get(`/api/stats`); }
async function metadata(name) { return get(`/api/metadata/${name}`); }

async function registerX402(data, paymentHeader) {
  const headers = {};
  if (paymentHeader) headers['X-PAYMENT'] = paymentHeader;
  return post('/x402/register', data, headers);
}

// Contact resolution
async function contact(name) { return get(`/api/contact/${name}`); }

// Marketplace endpoints
async function marketListings() { return get('/api/marketplace/listings'); }
async function marketOffers() { return get('/api/marketplace/offers'); }
async function marketSales() { return get('/api/marketplace/sales'); }

async function board() { return get('/api/board'); }

// x402 text records
async function setTextX402(name, data, paymentHeader) {
  const headers = {};
  if (paymentHeader) headers['X-PAYMENT'] = paymentHeader;
  return post(`/x402/text/${name}`, data, headers);
}
async function setTextBatchX402(name, data, paymentHeader) {
  const headers = {};
  if (paymentHeader) headers['X-PAYMENT'] = paymentHeader;
  return post(`/x402/text/${name}/batch`, data, headers);
}

// Agent endpoints
async function agentRegister(data) { return post('/api/agent/register', data); }
async function agentConfirm(data) { return post('/api/agent/confirm', data); }

// Marketplace helpers
async function marketListHelper(data) { return post('/api/marketplace/list-helper', data); }

module.exports = {
  get, post, request,
  checkAvailable, resolve, quote, freeClaim,
  profile, getText, names, stats, metadata,
  registerX402, setTextX402, setTextBatchX402,
  agentRegister, agentConfirm,
  contact, board,
  marketListings, marketOffers, marketSales, marketListHelper,
};
