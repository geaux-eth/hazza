import { createPublicClient, http, type Address, type PublicClient } from "viem";
import { baseSepolia, base } from "viem/chains";

// Minimal ABI — only the read functions the Worker needs
export const REGISTRY_ABI = [
  {
    name: "available",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "name", type: "string" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "isActive",
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
      { name: "expiresAt", type: "uint64" },
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
      { name: "numYears", type: "uint256" },
      { name: "charCount", type: "uint8" },
      { name: "ensImport", type: "bool" },
      { name: "verifiedPass", type: "bool" },
    ],
    outputs: [
      { name: "totalCost", type: "uint256" },
      { name: "registrationFee", type: "uint256" },
      { name: "renewalFee", type: "uint256" },
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
  // --- Status ---
  {
    name: "isInGracePeriod",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "name", type: "string" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "isInRedemptionPeriod",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "name", type: "string" }],
    outputs: [{ type: "bool" }],
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
] as const;

export type Env = {
  REGISTRY_ADDRESS: string;
  RPC_URL: string;
  CHAIN_ID: string;
};

export function getClient(env: Env): PublicClient {
  const chainId = Number(env.CHAIN_ID);
  const chain = chainId === 8453 ? base : baseSepolia;
  return createPublicClient({
    chain,
    transport: http(env.RPC_URL),
  });
}

export function registryAddress(env: Env): Address {
  return env.REGISTRY_ADDRESS as Address;
}
