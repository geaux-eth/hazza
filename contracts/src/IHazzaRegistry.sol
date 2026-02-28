// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IHazzaRegistry {
    struct NameRecord {
        address owner;
        uint256 tokenId;
        uint64 registeredAt;
        address operator;
        uint256 agentId;
        address agentWallet;
    }

    event NameRegistered(
        string indexed indexedName,
        string name,
        address indexed owner,
        uint256 tokenId,
        uint256 price
    );
    event AgentRegistered(
        string indexed indexedName,
        string name,
        uint256 agentId,
        address agentWallet
    );
    event OperatorSet(string indexed indexedName, string name, address operator);
    event CustomDomainSet(string indexed indexedName, string name, string domain);
    event CustomDomainRemoved(string indexed indexedName, string name, string domain);
    event ApiKeyGenerated(string indexed indexedName, string name, bytes32 keyHash);
    event ApiKeyRevoked(bytes32 indexed keyHash);

    function commit(bytes32 commitHash) external;
    function register(
        string calldata name,
        address owner,
        bytes32 salt,
        bool wantAgent,
        address agentWallet,
        string calldata agentURI
    ) external;
    function registerDirect(string calldata name) external;
    function setOperator(string calldata name, address operator) external;
    function setCustomDomain(string calldata name, string calldata domain) external;
    function removeCustomDomain(string calldata name, string calldata domain) external;
    function generateApiKey(string calldata name, bytes32 salt) external returns (bytes32);
    function revokeApiKey(bytes32 keyHash) external;
    function registerAgent(
        string calldata name,
        string calldata agentURI,
        address agentWallet
    ) external;

    function available(string calldata name) external view returns (bool);
    function price(string calldata name) external view returns (uint256);
    function resolve(string calldata name) external view returns (NameRecord memory);
    function nameOf(uint256 tokenId) external view returns (string memory);
}
