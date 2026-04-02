import { createPublicClient, http, encodeFunctionData, type Address, type PublicClient } from "viem";
import { baseSepolia, base, mainnet } from "viem/chains";

// Minimal ABI — only the read functions the Worker needs
export const REGISTRY_ABI = [
  {
    name: "walletInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [
      { name: "totalRegistrations", type: "uint128" },
      { name: "pricingWindowStart", type: "uint64" },
      { name: "pricingWindowCount", type: "uint128" },
    ],
  },
  {
    name: "available",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "name", type: "string" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "resolve",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "name", type: "string" }],
    outputs: [
      { name: "nameOwner", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "registeredAt", type: "uint64" },
      { name: "operator", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "agentWallet", type: "address" },
    ],
  },
  {
    name: "price",
    type: "function",
    stateMutability: "pure",
    inputs: [
      { name: "name", type: "string" },
      { name: "charCount", type: "uint8" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "quoteName",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "string" },
      { name: "wallet", type: "address" },
      { name: "charCount", type: "uint8" },
      { name: "ensImport", type: "bool" },
      { name: "verifiedPass", type: "bool" },
    ],
    outputs: [
      { name: "totalCost", type: "uint256" },
      { name: "registrationFee", type: "uint256" },
    ],
  },
  {
    name: "reverseResolve",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "string" }],
  },
  {
    name: "resolveCustomDomain",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "domain", type: "string" }],
    outputs: [{ type: "string" }],
  },
  {
    name: "nameOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    name: "totalRegistered",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getMembershipTier",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "treasury",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  // --- Subname Resolution ---
  {
    name: "resolveSubname",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "namespace", type: "string" },
      { name: "subname", type: "string" },
    ],
    outputs: [
      { name: "subnameOwner", type: "address" },
      { name: "operator", type: "address" },
    ],
  },
  // --- Text Records ---
  {
    name: "text",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "string" },
      { name: "key", type: "string" },
    ],
    outputs: [{ type: "string" }],
  },
  {
    name: "textMany",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "string" },
      { name: "keys", type: "string[]" },
    ],
    outputs: [{ type: "string[]" }],
  },
  // --- Address Records ---
  {
    name: "addr",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "string" },
      { name: "coinType", type: "uint256" },
    ],
    outputs: [{ type: "bytes" }],
  },
  // --- Contenthash ---
  {
    name: "contenthash",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "name", type: "string" }],
    outputs: [{ type: "bytes" }],
  },
  // --- Token URI ---
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  // --- Primary Name ---
  {
    name: "primaryName",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    name: "setPrimaryName",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "name", type: "string" }],
    outputs: [],
  },
  // --- ERC-721 Enumeration ---
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "tokenOfOwnerByIndex",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  // --- Write Functions ---
  {
    name: "setText",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "setTextsDirect",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "keys", type: "string[]" },
      { name: "values", type: "string[]" },
    ],
    outputs: [],
  },
  {
    name: "setAddr",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "coinType", type: "uint256" },
      { name: "value", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "setContenthash",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "hash", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "setOperator",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "operator", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "setCustomDomain",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "domain", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "removeCustomDomain",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "domain", type: "string" },
    ],
    outputs: [],
  },
  // --- x402 Relayer ---
  {
    name: "registerDirect",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "nameOwner", type: "address" },
      { name: "charCount", type: "uint8" },
      { name: "wantAgent", type: "bool" },
      { name: "agentWallet", type: "address" },
      { name: "agentURI", type: "string" },
      { name: "ensImport", type: "bool" },
      { name: "verifiedPass", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "registerDirectWithMember",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "nameOwner", type: "address" },
      { name: "charCount", type: "uint8" },
      { name: "wantAgent", type: "bool" },
      { name: "agentWallet", type: "address" },
      { name: "agentURI", type: "string" },
      { name: "ensImport", type: "bool" },
      { name: "verifiedPass", type: "bool" },
      { name: "memberId", type: "uint256" },
    ],
    outputs: [],
  },
  // --- Namespace ---
  {
    name: "namespaces",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "nameHash", type: "bytes32" }],
    outputs: [
      { name: "admin", type: "address" },
      { name: "parentTokenId", type: "uint256" },
    ],
  },
  {
    name: "registerNamespace",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "name", type: "string" }],
    outputs: [],
  },
  {
    name: "issueSubname",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "namespace", type: "string" },
      { name: "subname", type: "string" },
      { name: "subnameOwner", type: "address" },
    ],
    outputs: [],
  },
  // --- Free Claim ---
  {
    name: "hasClaimedFreeName",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "memberId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "quoteNameWithMember",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "string" },
      { name: "wallet", type: "address" },
      { name: "charCount", type: "uint8" },
      { name: "ensImport", type: "bool" },
      { name: "verifiedPass", type: "bool" },
      { name: "memberId", type: "uint256" },
    ],
    outputs: [
      { name: "totalCost", type: "uint256" },
      { name: "registrationFee", type: "uint256" },
      { name: "isFreeClaim", type: "bool" },
    ],
  },
] as const;

export type Env = {
  REGISTRY_ADDRESS: string;
  USDC_ADDRESS: string;
  RPC_URL: string;
  CHAIN_ID: string;
  BASE_MAINNET_RPC: string;
  ETH_MAINNET_RPC: string;
  RELAYER_PRIVATE_KEY: string;
  RELAYER_ADDRESS: string;
  PAYMASTER_BUNDLER_RPC: string;
  GATEWAY_SIGNER_KEY: string;
  NET_LIBRARY_API_URL: string;
  SEAPORT_ADDRESS: string;
  BAZAAR_ADDRESS: string;
  BASE_USDC_ADDRESS: string;
  BATCH_EXECUTOR_ADDRESS: string;
  HAZZA_TREASURY: string;
  MARKETPLACE_FEE_BPS: string;
  WETH_ADDRESS: string;
  WATCHLIST_KV: KVNamespace;
  NOTIFICATION_WEBHOOK?: string;  // Telegram/Discord webhook for alerts
  ADMIN_API_KEY?: string;         // API key for admin endpoints
  NEYNAR_API_KEY?: string;        // Neynar API key for FID lookups
};

// Minimal ABI for Exoskeleton NFT (Base mainnet)
export const EXOSKELETON_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "tokenOfOwnerByIndex",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
] as const;

export const EXOSKELETON_ADDRESS = "0x8241BDD5009ed3F6C99737D2415994B58296Da0d" as Address;

// ERC-8004 Agent Registry (Base mainnet)
export const ERC8004_REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address;
export const ERC8004_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

export function getClient(env: Env): PublicClient {
  const chainId = Number(env.CHAIN_ID);
  const chain = chainId === 8453 ? base : baseSepolia;
  // On mainnet, prefer the paid RPC (BASE_MAINNET_RPC) over the free public endpoint
  const rpcUrl = chainId === 8453 && env.BASE_MAINNET_RPC ? env.BASE_MAINNET_RPC : env.RPC_URL;
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

export function getMainnetClient(env: Env): PublicClient {
  return createPublicClient({
    chain: base,
    transport: http(env.BASE_MAINNET_RPC),
  });
}

export function getEthMainnetClient(env: Env): PublicClient {
  return createPublicClient({
    chain: mainnet,
    transport: http(env.ETH_MAINNET_RPC),
  });
}

export function buildTx(env: Env, functionName: string, args: any[]): { to: string; data: string; chainId: number } {
  return {
    to: env.REGISTRY_ADDRESS,
    data: encodeFunctionData({ abi: REGISTRY_ABI, functionName, args }),
    chainId: Number(env.CHAIN_ID),
  };
}

export function registryAddress(env: Env): Address {
  return env.REGISTRY_ADDRESS as Address;
}
