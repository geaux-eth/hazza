export const REGISTRY_ADDRESS = '0xdf92cA2fc1e588F7A2ebAEA039CF3860826f4746' as const;
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
export const CHAIN_ID = 8453;
export const RELAYER_ADDRESS = '0xa6eB678F607bB811a25E2071A7AAe6F53E674e7d' as const;
export const TREASURY_ADDRESS = '0x62B7399B2ac7e938Efad06EF8746fDBA3B351900' as const;
export const SEAPORT_ADDRESS = '0x0000000000000068F116a894984e2DB1123eB395' as const;
export const BAZAAR_ADDRESS = '0x000000058f3ade587388daf827174d0e6fc97595' as const;
export const MARKETPLACE_FEE_BPS = 200;
export const NOMI_XMTP_ADDR = '0x55B251E202938E562E7384bD998215885b80162e' as const;

export const REGISTRY_ABI = [
  { name: "walletInfo", type: "function", stateMutability: "view", inputs: [{ name: "wallet", type: "address" }], outputs: [{ name: "totalRegistrations", type: "uint128" }, { name: "pricingWindowStart", type: "uint64" }, { name: "pricingWindowCount", type: "uint128" }] },
  { name: "available", type: "function", stateMutability: "view", inputs: [{ name: "name", type: "string" }], outputs: [{ type: "bool" }] },
  { name: "resolve", type: "function", stateMutability: "view", inputs: [{ name: "name", type: "string" }], outputs: [{ name: "nameOwner", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "registeredAt", type: "uint64" }, { name: "operator", type: "address" }, { name: "agentId", type: "uint256" }, { name: "agentWallet", type: "address" }] },
  { name: "price", type: "function", stateMutability: "pure", inputs: [{ name: "name", type: "string" }, { name: "charCount", type: "uint8" }], outputs: [{ type: "uint256" }] },
  { name: "quoteName", type: "function", stateMutability: "view", inputs: [{ name: "name", type: "string" }, { name: "wallet", type: "address" }, { name: "charCount", type: "uint8" }, { name: "ensImport", type: "bool" }, { name: "verifiedPass", type: "bool" }], outputs: [{ name: "totalCost", type: "uint256" }, { name: "registrationFee", type: "uint256" }] },
  { name: "reverseResolve", type: "function", stateMutability: "view", inputs: [{ name: "wallet", type: "address" }], outputs: [{ type: "string" }] },
  { name: "nameOf", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { name: "totalRegistered", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "getMembershipTier", type: "function", stateMutability: "view", inputs: [{ name: "wallet", type: "address" }], outputs: [{ type: "uint8" }] },
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "treasury", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "text", type: "function", stateMutability: "view", inputs: [{ name: "name", type: "string" }, { name: "key", type: "string" }], outputs: [{ type: "string" }] },
  { name: "textMany", type: "function", stateMutability: "view", inputs: [{ name: "name", type: "string" }, { name: "keys", type: "string[]" }], outputs: [{ type: "string[]" }] },
  { name: "addr", type: "function", stateMutability: "view", inputs: [{ name: "name", type: "string" }, { name: "coinType", type: "uint256" }], outputs: [{ type: "bytes" }] },
  { name: "contenthash", type: "function", stateMutability: "view", inputs: [{ name: "name", type: "string" }], outputs: [{ type: "bytes" }] },
  { name: "tokenURI", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { name: "primaryName", type: "function", stateMutability: "view", inputs: [{ name: "wallet", type: "address" }], outputs: [{ type: "bytes32" }] },
  { name: "setPrimaryName", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }], outputs: [] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "tokenOfOwnerByIndex", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "index", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "setText", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }, { name: "key", type: "string" }, { name: "value", type: "string" }], outputs: [] },
  { name: "setTexts", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }, { name: "keys", type: "string[]" }, { name: "values", type: "string[]" }], outputs: [] },
  { name: "setAddr", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }, { name: "coinType", type: "uint256" }, { name: "value", type: "bytes" }], outputs: [] },
  { name: "setContenthash", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }, { name: "hash", type: "bytes" }], outputs: [] },
  { name: "setOperator", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }, { name: "operator", type: "address" }], outputs: [] },
  { name: "setCustomDomain", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }, { name: "domain", type: "string" }], outputs: [] },
  { name: "removeCustomDomain", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }, { name: "domain", type: "string" }], outputs: [] },
  { name: "registerDirect", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }, { name: "nameOwner", type: "address" }, { name: "charCount", type: "uint8" }, { name: "wantAgent", type: "bool" }, { name: "agentWallet", type: "address" }, { name: "agentURI", type: "string" }, { name: "ensImport", type: "bool" }, { name: "verifiedPass", type: "bool" }], outputs: [] },
  { name: "registerDirectWithMember", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }, { name: "nameOwner", type: "address" }, { name: "charCount", type: "uint8" }, { name: "wantAgent", type: "bool" }, { name: "agentWallet", type: "address" }, { name: "agentURI", type: "string" }, { name: "ensImport", type: "bool" }, { name: "verifiedPass", type: "bool" }, { name: "memberId", type: "uint256" }], outputs: [] },
  { name: "namespaces", type: "function", stateMutability: "view", inputs: [{ name: "nameHash", type: "bytes32" }], outputs: [{ name: "admin", type: "address" }, { name: "parentTokenId", type: "uint256" }] },
  { name: "registerNamespace", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }], outputs: [] },
  { name: "issueSubname", type: "function", stateMutability: "nonpayable", inputs: [{ name: "namespace", type: "string" }, { name: "subname", type: "string" }, { name: "subnameOwner", type: "address" }], outputs: [] },
  { name: "hasClaimedFreeName", type: "function", stateMutability: "view", inputs: [{ name: "memberId", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "quoteNameWithMember", type: "function", stateMutability: "view", inputs: [{ name: "name", type: "string" }, { name: "wallet", type: "address" }, { name: "charCount", type: "uint8" }, { name: "ensImport", type: "bool" }, { name: "verifiedPass", type: "bool" }, { name: "memberId", type: "uint256" }], outputs: [{ name: "totalCost", type: "uint256" }, { name: "registrationFee", type: "uint256" }, { name: "isFreeClaim", type: "bool" }] },
  { name: "transferFrom", type: "function", stateMutability: "nonpayable", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [] },
  { name: "setBaseURI", type: "function", stateMutability: "nonpayable", inputs: [{ name: "baseURI", type: "string" }], outputs: [] },
  { name: "registerAgent", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }, { name: "agentURI", type: "string" }, { name: "agentWallet", type: "address" }], outputs: [] },
] as const;

export const USDC_ABI = [
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export const ERC721_ABI = [
  { name: "transferFrom", type: "function", stateMutability: "nonpayable", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [] },
  { name: "setApprovalForAll", type: "function", stateMutability: "nonpayable", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [] },
  { name: "isApprovedForAll", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "operator", type: "address" }], outputs: [{ type: "bool" }] },
  { name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
] as const;
