// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IHazzaRegistry {
    // --- Events ---
    event NameRegistered(string name, address indexed owner, uint256 indexed tokenId, uint256 price);
    event AgentRegistered(string name, uint256 indexed agentId, address indexed agentWallet);
    event OperatorSet(string name, address indexed operator);
    event CustomDomainSet(string name, string domain);
    event CustomDomainRemoved(string name, string domain);
    event ApiKeyGenerated(string name, bytes32 indexed keyHash);
    event ApiKeyRevoked(bytes32 indexed keyHash);
    event PrimaryNameSet(address indexed wallet, string name);
    event RelayerUpdated(address indexed relayer, bool authorized, uint256 commissionBps);
    event TreasuryUpdated(address indexed newTreasury);
    event NamespaceRegistered(string name, address indexed admin);
    event SubnameIssued(string namespace, string subname, address indexed owner);
    event SubnameRevoked(string namespace, string subname);
    event NamespaceTransferred(string namespace, address indexed newAdmin);
    event FreeNameClaimed(string name, address indexed owner, uint256 indexed memberId, uint256 indexed tokenId);
    event TextChanged(bytes32 indexed nameHash, string key, string value);
    event AddrChanged(bytes32 indexed nameHash, uint256 coinType, bytes value);
    event ContenthashChanged(bytes32 indexed nameHash, bytes hash);

    // --- Read ---
    function available(string calldata name) external view returns (bool);
    function price(string calldata name, uint8 charCount) external pure returns (uint256);
    function quoteName(string calldata name, address wallet, uint8 charCount, bool ensImport, bool verifiedPass)
        external view returns (uint256 totalCost, uint256 registrationFee);
    function quoteNameWithMember(string calldata name, address wallet, uint8 charCount, bool ensImport, bool verifiedPass, uint256 memberId)
        external view returns (uint256 totalCost, uint256 registrationFee, bool isFreeClaim);
    function resolve(string calldata name)
        external view returns (address nameOwner, uint256 tokenId, uint64 registeredAt, address operator, uint256 agentId, address agentWallet);
    function reverseResolve(address wallet) external view returns (string memory);
    function nameOf(uint256 tokenId) external view returns (string memory);
    function totalRegistered() external view returns (uint256);
    function resolveCustomDomain(string calldata domain) external view returns (string memory);
    function hasClaimedFreeName(uint256 memberId) external view returns (bool);
    function getMembershipTier(address wallet) external view returns (uint8);
    function verifyApiKey(bytes32 rawKey) external view returns (bytes32);

    // --- Text Records ---
    function text(string calldata name, string calldata key) external view returns (string memory);
    function textMany(string calldata name, string[] calldata keys) external view returns (string[] memory);
    function addr(string calldata name, uint256 coinType) external view returns (bytes memory);
    function contenthash(string calldata name) external view returns (bytes memory);

    // --- Write ---
    function registerDirect(string calldata name, address nameOwner, uint8 charCount, bool wantAgent, address agentWallet, string calldata agentURI, bool ensImport, bool verifiedPass) external;
    function registerDirectWithMember(string calldata name, address nameOwner, uint8 charCount, bool wantAgent, address agentWallet, string calldata agentURI, bool ensImport, bool verifiedPass, uint256 memberId) external;
    function setOperator(string calldata name, address operator) external;
    function setCustomDomain(string calldata name, string calldata domain) external;
    function removeCustomDomain(string calldata name, string calldata domain) external;
    function setText(string calldata name, string calldata key, string calldata value) external;
    function setAddr(string calldata name, uint256 coinType, bytes calldata value) external;
    function setContenthash(string calldata name, bytes calldata hash) external;
    function setPrimaryName(string calldata name) external;
    function generateApiKey(string calldata name, bytes32 salt) external returns (bytes32);

    // --- Namespaces ---
    function registerNamespace(string calldata name) external;
    function issueSubname(string calldata namespace, string calldata subname, address subnameOwner) external;
}
