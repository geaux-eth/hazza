// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IERC8004Registry {
    function register(string calldata agentURI) external returns (uint256);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

interface IERC721Balance {
    function balanceOf(address owner) external view returns (uint256);
}

contract HazzaRegistry is ERC721, Ownable, ReentrancyGuard {
    // =========================================================================
    //                              TYPES
    // =========================================================================

    struct NameRecord {
        uint256 tokenId;
        uint64 registeredAt;
        address operator;
        uint256 agentId;
        address agentWallet;
    }

    struct Commitment {
        address committer;
        uint64 timestamp;
    }

    struct Namespace {
        address admin;
        uint256 parentTokenId;
    }

    struct SubnameRecord {
        address owner;
        uint64 registeredAt;
        address operator;
        uint256 agentId;
        address agentWallet;
    }

    struct WalletInfo {
        uint128 totalRegistrations;
        uint64 pricingWindowStart;
        uint128 pricingWindowCount;
    }

    /// @dev Internal struct to reduce stack depth in _registerName
    struct RegistrationConfig {
        address nameOwner;
        uint8 charCount;       // ENSIP-15 grapheme cluster count (0 = use byte length)
        bool wantAgent;
        address agentWallet;
        bool ensImport;        // ENS-verified import: 50% discount
        bool verifiedPass;     // Cross-wallet Unlimited Pass verification by relayer
        address relayer;
    }

    // =========================================================================
    //                              STATE
    // =========================================================================

    IERC20 public immutable usdc;
    IERC8004Registry public immutable agentRegistry;
    address public treasury;

    // Membership NFT contracts (configurable — Unlimited Pass not yet deployed)
    IERC721Balance public netLibraryMembership;
    IERC721Balance public unlimitedPass;

    uint256 private _nextTokenId = 1;

    // Token metadata
    string private _baseTokenURI;

    // Core name storage
    mapping(bytes32 => NameRecord) private _names;
    mapping(bytes32 => string) private _nameStrings;
    mapping(uint256 => bytes32) public tokenToName;

    // Commit-reveal
    mapping(bytes32 => Commitment) public commitments;

    // API keys
    mapping(bytes32 => bytes32) public apiKeys;

    // Custom domains
    mapping(bytes32 => bytes32) public customDomains;
    mapping(bytes32 => string) private _domainStrings;

    // Reverse resolution
    mapping(address => bytes32) public primaryName;

    // Relayers (Cheryl, etc.)
    mapping(address => bool) public relayers;
    mapping(address => uint256) public relayerCommission; // basis points (2500 = 25%)

    // Rate limiting
    mapping(address => WalletInfo) public walletInfo;
    // (removed dailyRegistrations — progressive pricing is the sole anti-squat mechanism)

    // Namespaces
    mapping(bytes32 => Namespace) public namespaces;
    mapping(bytes32 => mapping(bytes32 => SubnameRecord)) public subnames;
    mapping(bytes32 => mapping(bytes32 => string)) private _subnameStrings;

    // Free name claims tracked by Net Library member ID (not wallet)
    // Prevents abuse via NFT transfer: same memberId can only claim once
    mapping(uint256 => bool) public memberFreeClaimed;

    // Text records: nameHash => key => value
    mapping(bytes32 => mapping(string => string)) private _texts;

    // Address records (ENS coinType): nameHash => coinType => address bytes
    mapping(bytes32 => mapping(uint256 => bytes)) private _addrs;

    // Contenthash: nameHash => contenthash bytes
    mapping(bytes32 => bytes) private _contenthashes;

    // =========================================================================
    //                            CONSTANTS
    // =========================================================================

    uint256 public constant MIN_COMMIT_AGE = 60;
    uint256 public constant MAX_COMMIT_AGE = 86400;

    // Pricing (USDC 6 decimals) — flat $5, pay once, available forever
    uint256 public constant PRICE_3_CHAR = 5e6;     // $5
    uint256 public constant PRICE_4_CHAR = 5e6;     // $5
    uint256 public constant PRICE_5_PLUS = 5e6;     // $5
    uint256 public constant NAMESPACE_PRICE = 0;      // Free to enable
    uint256 public constant SUBNAME_PRICE = 1e6;     // $1 per agent subname

    // Time
    uint256 public constant PRICING_WINDOW = 90 days;

    // Name constraints
    uint256 public constant MIN_NAME_LENGTH = 3;
    uint256 public constant MAX_NAME_LENGTH = 63;

    // No daily/total registration limits — progressive pricing is the sole anti-squat mechanism

    // =========================================================================
    //                              EVENTS
    // =========================================================================

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
    event ENSImported(string name, address indexed owner, string ensName);
    event FreeNameClaimed(string name, address indexed owner, uint256 indexed memberId, uint256 indexed tokenId);
    event TextChanged(bytes32 indexed nameHash, string key, string value);
    event AddrChanged(bytes32 indexed nameHash, uint256 coinType, bytes value);
    event ContenthashChanged(bytes32 indexed nameHash, bytes hash);

    // =========================================================================
    //                              ERRORS
    // =========================================================================

    error NameNotAvailable();
    error NameTooShort();
    error NameTooLong();
    error InvalidCharacter();
    error LeadingHyphen();
    error TrailingHyphen();
    error ConsecutiveHyphens();
    error CommitmentTooNew();
    error CommitmentTooOld();
    error CommitmentNotFound();
    error NotNameOwner();
    error NotRelayer();
    error InsufficientPayment();
    error TransferFailed();
    error ApiKeyNotFound();
    error AgentAlreadyRegistered();
    error InvalidAgentWallet();
    error ZeroAddress();
    error NameNotRegistered();
    error NotNamespaceAdmin();
    error NamespaceAlreadyExists();
    error NamespaceNotFound();
    error SubnameAlreadyExists();
    error SubnameNotFound();
    error NameIsNamespace();
    error InvalidCharCount();
    error FreeClaimAlreadyUsed();

    // =========================================================================
    //                           CONSTRUCTOR
    // =========================================================================

    constructor(
        address _usdc,
        address _agentRegistry,
        address _treasury,
        address _netLibraryMembership,
        address _unlimitedPass
    ) ERC721("HAZZA Name", "HAZZA") Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        agentRegistry = IERC8004Registry(_agentRegistry);
        treasury = _treasury;
        if (_netLibraryMembership != address(0)) {
            netLibraryMembership = IERC721Balance(_netLibraryMembership);
        }
        if (_unlimitedPass != address(0)) {
            unlimitedPass = IERC721Balance(_unlimitedPass);
        }
    }

    // =========================================================================
    //                         MODIFIERS
    // =========================================================================

    modifier onlyRelayerOrOwner() {
        if (msg.sender != owner() && !relayers[msg.sender]) revert NotRelayer();
        _;
    }

    // =========================================================================
    //                         REGISTRATION
    // =========================================================================

    /// @notice Step 1 of commit-reveal: submit a commitment hash
    function commit(bytes32 commitHash) external {
        require(commitments[commitHash].timestamp == 0, "Commitment exists");
        commitments[commitHash] = Commitment({
            committer: msg.sender,
            timestamp: uint64(block.timestamp)
        });
    }

    /// @notice Step 2 of commit-reveal: reveal and register (ASCII names only)
    function register(
        string calldata name,
        address nameOwner,
        bytes32 salt,
        bool wantAgent,
        address agentWallet,
        string calldata agentURI
    ) external nonReentrant {
        bytes32 commitHash = keccak256(abi.encodePacked(name, nameOwner, salt));
        Commitment memory c = commitments[commitHash];
        if (c.timestamp == 0) revert CommitmentNotFound();
        if (block.timestamp - c.timestamp < MIN_COMMIT_AGE) revert CommitmentTooNew();
        if (block.timestamp - c.timestamp > MAX_COMMIT_AGE) revert CommitmentTooOld();
        delete commitments[commitHash];

        _registerName(name, agentURI, RegistrationConfig({
            nameOwner: nameOwner,
            charCount: 0, // ASCII: use byte length
            wantAgent: wantAgent,
            agentWallet: agentWallet,
            ensImport: false,
            verifiedPass: false,
            relayer: address(0)
        }));
    }

    /// @notice Direct registration (relayer / owner only — for x402 Worker and Cheryl)
    /// @dev Supports ENSIP-15 Unicode names via charCount, ENS import discounts, cross-wallet pass
    function registerDirect(
        string calldata name,
        address nameOwner,
        uint8 charCount,
        bool wantAgent,
        address agentWallet,
        string calldata agentURI,
        bool ensImport,
        bool verifiedPass
    ) external onlyRelayerOrOwner nonReentrant {
        _registerName(name, agentURI, RegistrationConfig({
            nameOwner: nameOwner,
            charCount: charCount,
            wantAgent: wantAgent,
            agentWallet: agentWallet,
            ensImport: ensImport,
            verifiedPass: verifiedPass,
            relayer: msg.sender
        }));
    }

    /// @notice Direct registration with Net Library member ID for free claim tracking
    /// @dev memberId > 0 triggers free claim (if not already used). memberId = 0 behaves like registerDirect.
    function registerDirectWithMember(
        string calldata name,
        address nameOwner,
        uint8 charCount,
        bool wantAgent,
        address agentWallet,
        string calldata agentURI,
        bool ensImport,
        bool verifiedPass,
        uint256 memberId
    ) external onlyRelayerOrOwner nonReentrant {
        bool isFreeClaim = false;
        if (memberId > 0) {
            if (memberFreeClaimed[memberId]) revert FreeClaimAlreadyUsed();
            memberFreeClaimed[memberId] = true; // CEI: set before registration
            isFreeClaim = true;
        }
        _registerNameWithMember(name, agentURI, RegistrationConfig({
            nameOwner: nameOwner,
            charCount: charCount,
            wantAgent: wantAgent,
            agentWallet: agentWallet,
            ensImport: ensImport,
            verifiedPass: verifiedPass,
            relayer: msg.sender
        }), isFreeClaim, memberId);
    }

    function _registerName(
        string calldata name,
        string calldata agentURI,
        RegistrationConfig memory c
    ) internal {
        _registerNameWithMember(name, agentURI, c, false, 0);
    }

    function _registerNameWithMember(
        string calldata name,
        string calldata agentURI,
        RegistrationConfig memory c,
        bool isFreeClaim,
        uint256 memberId
    ) internal {
        if (c.nameOwner == address(0)) revert ZeroAddress();

        // Validate: strict ASCII for public path, permissive UTF-8 for relayer
        if (c.relayer == address(0)) {
            _validateNameStrict(name);
        } else {
            _validateNamePermissive(name, c.charCount);
        }

        bytes32 nameHash = keccak256(bytes(name));

        // Check availability — names are permanent, no expiry
        if (_names[nameHash].tokenId != 0) revert NameNotAvailable();

        // Rate limiting (applied to name recipient, not relayer)


        // Calculate price
        uint256 charLen = c.charCount > 0 ? uint256(c.charCount) : bytes(name).length;
        uint256 basePrice = _basePriceByLength(charLen);
        uint256 totalCost;

        if (isFreeClaim) {
            totalCost = 0;
            // No payment collected for free claims
        } else {
            totalCost = _adjustedPrice(basePrice, c.nameOwner, c.ensImport, c.verifiedPass);
            _collectPayment(totalCost, c.relayer);
        }

        // Assign token ID (but mint AFTER all state writes to prevent reentrancy)
        uint256 tokenId = _nextTokenId++;

        // Store record — pay once, available forever
        _names[nameHash] = NameRecord({
            tokenId: tokenId,
            registeredAt: uint64(block.timestamp),
            operator: c.nameOwner,
            agentId: 0,
            agentWallet: address(0)
        });
        _nameStrings[nameHash] = name;
        tokenToName[tokenId] = nameHash;

        // Update wallet info & daily count
        _updateWalletInfo(c.nameOwner);

        emit NameRegistered(name, c.nameOwner, tokenId, totalCost);
        if (isFreeClaim) {
            emit FreeNameClaimed(name, c.nameOwner, memberId, tokenId);
        }

        // Optional ERC-8004 agent registration
        if (c.wantAgent) {
            _registerAgent(nameHash, name, agentURI, c.agentWallet, c.nameOwner);
        }

        // Mint NFT LAST — _safeMint calls onERC721Received which could re-enter
        _safeMint(c.nameOwner, tokenId);
    }

    function _updateWalletInfo(address wallet) internal {
        WalletInfo storage info = walletInfo[wallet];
        info.totalRegistrations++;
        if (info.pricingWindowStart == 0 || block.timestamp - info.pricingWindowStart > PRICING_WINDOW) {
            info.pricingWindowStart = uint64(block.timestamp);
            info.pricingWindowCount = 1;
        } else {
            info.pricingWindowCount++;
        }
    }

    // =========================================================================
    //                       RATE LIMITING & PRICING
    // =========================================================================

    function _getMembershipTier(address wallet) internal view returns (uint8) {
        // 2 = Unlimited Pass, 1 = NL Member, 0 = Non-member
        if (address(unlimitedPass) != address(0) && unlimitedPass.balanceOf(wallet) > 0) return 2;
        if (address(netLibraryMembership) != address(0) && netLibraryMembership.balanceOf(wallet) > 0) return 1;
        return 0;
    }


    /// @notice Base price by character count (ENSIP-15 grapheme clusters)
    function _basePriceByLength(uint256 charLen) internal pure returns (uint256) {
        if (charLen <= 3) return PRICE_3_CHAR;
        if (charLen == 4) return PRICE_4_CHAR;
        return PRICE_5_PLUS;
    }

    function _adjustedPrice(
        uint256 basePrice,
        address wallet,
        bool ensImport,
        bool verifiedPass
    ) internal view returns (uint256) {
        WalletInfo memory info = walletInfo[wallet];

        // First registration is free for everyone (just pay gas)
        if (info.totalRegistrations == 0) return 0;

        // Get count in current pricing window
        uint256 count = info.pricingWindowCount;
        if (info.pricingWindowStart != 0 && block.timestamp - info.pricingWindowStart > PRICING_WINDOW) {
            count = 0; // window expired, reset
        }

        // Progressive multiplier based on names registered in window
        uint256 adjusted;
        if (count < 3) {
            adjusted = basePrice;               // names 1-3: base
        } else if (count < 5) {
            adjusted = (basePrice * 25) / 10;   // names 4-5: 2.5x
        } else if (count < 7) {
            adjusted = basePrice * 5;            // names 6-7: 5x
        } else {
            adjusted = basePrice * 10;           // names 8+: 10x
        }

        // 20% discount for Unlimited Pass holders (on-chain or relayer-verified)
        if (verifiedPass || _getMembershipTier(wallet) == 2) {
            adjusted = (adjusted * 80) / 100;
        }

        // 50% discount for ENS-verified imports (stacks multiplicatively)
        if (ensImport) {
            adjusted = adjusted / 2;
        }

        return adjusted;
    }

    /// @notice Get the total cost to register a name (for UI/CLI display)
    /// @param charCount ENSIP-15 grapheme count (0 = use byte length for ASCII names)
    /// @param ensImport true if ENS-verified import (50% discount)
    /// @param verifiedPass true if cross-wallet Unlimited Pass verified
    function quoteName(
        string calldata name,
        address wallet,
        uint8 charCount,
        bool ensImport,
        bool verifiedPass
    ) external view returns (uint256 totalCost, uint256 registrationFee) {
        uint256 charLen = charCount > 0 ? uint256(charCount) : bytes(name).length;
        uint256 base = _basePriceByLength(charLen);
        registrationFee = _adjustedPrice(base, wallet, ensImport, verifiedPass);
        totalCost = registrationFee;
    }

    /// @notice Check if a Net Library member has already claimed their free name
    function hasClaimedFreeName(uint256 memberId) external view returns (bool) {
        return memberFreeClaimed[memberId];
    }

    /// @notice Quote with free claim check for Net Library members with Unlimited Pass
    /// @param memberId Net Library member ID (0 = no free claim check)
    function quoteNameWithMember(
        string calldata name,
        address wallet,
        uint8 charCount,
        bool ensImport,
        bool verifiedPass,
        uint256 memberId
    ) external view returns (uint256 totalCost, uint256 registrationFee, bool isFreeClaim) {
        uint256 charLen = charCount > 0 ? uint256(charCount) : bytes(name).length;
        uint256 base = _basePriceByLength(charLen);
        if (memberId > 0 && !memberFreeClaimed[memberId]) {
            registrationFee = 0;
            isFreeClaim = true;
        } else {
            registrationFee = _adjustedPrice(base, wallet, ensImport, verifiedPass);
        }
        totalCost = registrationFee;
    }

    // =========================================================================
    //                        PAYMENT HANDLING
    // =========================================================================

    function _collectPayment(uint256 amount, address relayer) internal {
        if (amount == 0) return; // Nothing to collect (first registration free)

        uint256 allowed = usdc.allowance(msg.sender, address(this));
        if (allowed < amount) revert InsufficientPayment();

        if (relayer != address(0) && relayerCommission[relayer] > 0) {
            // Split: commission to relayer, rest to treasury
            uint256 commission = (amount * relayerCommission[relayer]) / 10000;
            uint256 toTreasury = amount - commission;

            bool s1 = usdc.transferFrom(msg.sender, treasury, toTreasury);
            if (!s1) revert TransferFailed();
            bool s2 = usdc.transferFrom(msg.sender, relayer, commission);
            if (!s2) revert TransferFailed();
        } else {
            bool sent = usdc.transferFrom(msg.sender, treasury, amount);
            if (!sent) revert TransferFailed();
        }
    }

    // =========================================================================
    //                        NAME MANAGEMENT
    // =========================================================================

    function setOperator(string calldata name, address operator) external {
        bytes32 nameHash = keccak256(bytes(name));
        _requireActiveNameOwner(nameHash);
        if (operator == address(0)) revert ZeroAddress();
        _names[nameHash].operator = operator;
        emit OperatorSet(name, operator);
    }

    function setCustomDomain(string calldata name, string calldata domain) external {
        bytes32 nameHash = keccak256(bytes(name));
        _requireActiveNameOwner(nameHash);
        bytes32 domainHash = keccak256(bytes(domain));
        bytes32 existing = customDomains[domainHash];
        require(existing == bytes32(0) || existing == nameHash, "Domain already mapped");
        customDomains[domainHash] = nameHash;
        _domainStrings[domainHash] = domain;
        emit CustomDomainSet(name, domain);
    }

    function removeCustomDomain(string calldata name, string calldata domain) external {
        bytes32 nameHash = keccak256(bytes(name));
        _requireActiveNameOwner(nameHash);
        bytes32 domainHash = keccak256(bytes(domain));
        delete customDomains[domainHash];
        delete _domainStrings[domainHash];
        emit CustomDomainRemoved(name, domain);
    }

    // =========================================================================
    //                         TEXT RECORDS
    // =========================================================================

    function setText(string calldata name, string calldata key, string calldata value) external {
        bytes32 nameHash = keccak256(bytes(name));
        _requireActiveNameOwnerOrOperator(nameHash);
        _texts[nameHash][key] = value;
        emit TextChanged(nameHash, key, value);
    }

    function text(string calldata name, string calldata key) external view returns (string memory) {
        return _texts[keccak256(bytes(name))][key];
    }

    function textMany(string calldata name, string[] calldata keys) external view returns (string[] memory values) {
        bytes32 nameHash = keccak256(bytes(name));
        values = new string[](keys.length);
        for (uint256 i = 0; i < keys.length; i++) {
            values[i] = _texts[nameHash][keys[i]];
        }
    }

    // =========================================================================
    //                       ADDRESS RECORDS
    // =========================================================================

    function setAddr(string calldata name, uint256 coinType, bytes calldata value) external {
        bytes32 nameHash = keccak256(bytes(name));
        _requireActiveNameOwnerOrOperator(nameHash);
        _addrs[nameHash][coinType] = value;
        emit AddrChanged(nameHash, coinType, value);
    }

    function addr(string calldata name, uint256 coinType) external view returns (bytes memory) {
        return _addrs[keccak256(bytes(name))][coinType];
    }

    // =========================================================================
    //                         CONTENTHASH
    // =========================================================================

    function setContenthash(string calldata name, bytes calldata hash) external {
        bytes32 nameHash = keccak256(bytes(name));
        _requireActiveNameOwnerOrOperator(nameHash);
        _contenthashes[nameHash] = hash;
        emit ContenthashChanged(nameHash, hash);
    }

    function contenthash(string calldata name) external view returns (bytes memory) {
        return _contenthashes[keccak256(bytes(name))];
    }

    // =========================================================================
    //                       REVERSE RESOLUTION
    // =========================================================================

    /// @notice Set your primary HAZZA name (for reverse resolution)
    function setPrimaryName(string calldata name) external {
        bytes32 nameHash = keccak256(bytes(name));
        _requireActiveNameOwner(nameHash);
        primaryName[msg.sender] = nameHash;
        emit PrimaryNameSet(msg.sender, name);
    }

    /// @notice Clear your primary name
    function clearPrimaryName() external {
        delete primaryName[msg.sender];
        emit PrimaryNameSet(msg.sender, "");
    }

    /// @notice Reverse resolve: address → primary hazza name
    function reverseResolve(address wallet) external view returns (string memory) {
        bytes32 nameHash = primaryName[wallet];
        if (nameHash == bytes32(0)) return "";
        NameRecord memory record = _names[nameHash];
        if (record.tokenId == 0) return "";
        if (ownerOf(record.tokenId) != wallet) return "";
        return _nameStrings[nameHash];
    }

    // =========================================================================
    //                           API KEYS
    // =========================================================================

    function generateApiKey(string calldata name, bytes32 salt) external returns (bytes32) {
        bytes32 nameHash = keccak256(bytes(name));
        _requireActiveNameOwner(nameHash);

        bytes32 rawKey = keccak256(abi.encodePacked(name, msg.sender, salt, block.timestamp));
        bytes32 keyHash = keccak256(abi.encodePacked(rawKey));
        apiKeys[keyHash] = nameHash;

        emit ApiKeyGenerated(name, keyHash);
        return rawKey;
    }

    function revokeApiKey(bytes32 keyHash) external {
        bytes32 nameHash = apiKeys[keyHash];
        if (nameHash == bytes32(0)) revert ApiKeyNotFound();
        _requireActiveNameOwner(nameHash);
        delete apiKeys[keyHash];
        emit ApiKeyRevoked(keyHash);
    }

    function verifyApiKey(bytes32 rawKey) external view returns (bytes32) {
        bytes32 keyHash = keccak256(abi.encodePacked(rawKey));
        bytes32 nameHash = apiKeys[keyHash];
        if (nameHash == bytes32(0)) revert ApiKeyNotFound();
        return nameHash;
    }

    // =========================================================================
    //                         ERC-8004 AGENT
    // =========================================================================

    function registerAgent(string calldata name, string calldata agentURI, address agentWallet) external {
        bytes32 nameHash = keccak256(bytes(name));
        _requireActiveNameOwner(nameHash);
        if (_names[nameHash].agentId != 0) revert AgentAlreadyRegistered();
        address nftOwner = ownerOf(_names[nameHash].tokenId);
        _registerAgent(nameHash, name, agentURI, agentWallet, nftOwner);
    }

    function _registerAgent(
        bytes32 nameHash,
        string memory name,
        string calldata agentURI,
        address agentWallet,
        address nftRecipient
    ) internal {
        address wallet = agentWallet == address(0) ? nftRecipient : agentWallet;
        if (wallet == address(0)) revert InvalidAgentWallet();

        uint256 agentId = agentRegistry.register(agentURI);
        agentRegistry.transferFrom(address(this), nftRecipient, agentId);

        _names[nameHash].agentId = agentId;
        _names[nameHash].agentWallet = wallet;
        emit AgentRegistered(name, agentId, wallet);
    }

    // =========================================================================
    //                          NAMESPACES
    // =========================================================================

    /// @notice Register a namespace (must already own the HAZZA name). Free, permanent, cannot be undone.
    function registerNamespace(string calldata name) external nonReentrant {
        bytes32 nameHash = keccak256(bytes(name));
        _requireActiveNameOwner(nameHash);
        if (namespaces[nameHash].admin != address(0)) revert NamespaceAlreadyExists();

        namespaces[nameHash] = Namespace({
            admin: msg.sender,
            parentTokenId: _names[nameHash].tokenId
        });
        emit NamespaceRegistered(name, msg.sender);
    }

    /// @notice Issue a subname under a namespace
    function issueSubname(
        string calldata namespace,
        string calldata subname,
        address subnameOwner
    ) external nonReentrant {
        bytes32 nsHash = keccak256(bytes(namespace));
        if (namespaces[nsHash].admin != msg.sender) revert NotNamespaceAdmin();
        if (subnameOwner == address(0)) revert ZeroAddress();

        bytes32 subHash = keccak256(bytes(subname));
        if (subnames[nsHash][subHash].owner != address(0)) revert SubnameAlreadyExists();

        // $1 per subname
        bool sent = usdc.transferFrom(msg.sender, treasury, SUBNAME_PRICE);
        if (!sent) revert TransferFailed();

        subnames[nsHash][subHash] = SubnameRecord({
            owner: subnameOwner,
            registeredAt: uint64(block.timestamp),
            operator: subnameOwner,
            agentId: 0,
            agentWallet: address(0)
        });
        _subnameStrings[nsHash][subHash] = subname;
        emit SubnameIssued(namespace, subname, subnameOwner);
    }

    /// @notice Revoke a subname (namespace admin only)
    function revokeSubname(string calldata namespace, string calldata subname) external {
        bytes32 nsHash = keccak256(bytes(namespace));
        if (namespaces[nsHash].admin != msg.sender) revert NotNamespaceAdmin();
        bytes32 subHash = keccak256(bytes(subname));
        if (subnames[nsHash][subHash].owner == address(0)) revert SubnameNotFound();

        delete subnames[nsHash][subHash];
        delete _subnameStrings[nsHash][subHash];
        emit SubnameRevoked(namespace, subname);
    }

    /// @notice Transfer namespace admin to a new address
    function transferNamespace(string calldata namespace, address newAdmin) external {
        bytes32 nsHash = keccak256(bytes(namespace));
        if (namespaces[nsHash].admin != msg.sender) revert NotNamespaceAdmin();
        if (newAdmin == address(0)) revert ZeroAddress();
        namespaces[nsHash].admin = newAdmin;
        emit NamespaceTransferred(namespace, newAdmin);
    }

    /// @notice Resolve a subname
    function resolveSubname(string calldata namespace, string calldata subname)
        external view returns (address subnameOwner, address operator)
    {
        bytes32 nsHash = keccak256(bytes(namespace));
        bytes32 subHash = keccak256(bytes(subname));
        SubnameRecord memory sub = subnames[nsHash][subHash];
        return (sub.owner, sub.operator);
    }

    // =========================================================================
    //                            VIEWS
    // =========================================================================

    /// @notice Check if a name is available for registration
    function available(string calldata name) external view returns (bool) {
        return _names[keccak256(bytes(name))].tokenId == 0;
    }

    /// @notice Get the base USDC price for a name (before multipliers)
    /// @param charCount ENSIP-15 grapheme count (0 = use byte length)
    function price(string calldata name, uint8 charCount) public pure returns (uint256) {
        uint256 charLen = charCount > 0 ? uint256(charCount) : bytes(name).length;
        return _basePriceByLength(charLen);
    }

    /// @notice Resolve a name to its full record
    function resolve(string calldata name) external view returns (
        address nameOwner,
        uint256 tokenId,
        uint64 registeredAt,
        address operator,
        uint256 agentId,
        address agentWallet
    ) {
        bytes32 nameHash = keccak256(bytes(name));
        NameRecord memory record = _names[nameHash];
        if (record.tokenId == 0) return (address(0), 0, 0, address(0), 0, address(0));
        return (
            ownerOf(record.tokenId),
            record.tokenId,
            record.registeredAt,
            record.operator,
            record.agentId,
            record.agentWallet
        );
    }

    function nameOf(uint256 tokenId) external view returns (string memory) {
        return _nameStrings[tokenToName[tokenId]];
    }

    function resolveCustomDomain(string calldata domain) external view returns (string memory) {
        bytes32 domainHash = keccak256(bytes(domain));
        return _nameStrings[customDomains[domainHash]];
    }

    function totalRegistered() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function getMembershipTier(address wallet) external view returns (uint8) {
        return _getMembershipTier(wallet);
    }

    // =========================================================================
    //                            ADMIN
    // =========================================================================

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setRelayer(address relayer, bool authorized, uint256 commissionBps) external onlyOwner {
        require(commissionBps <= 5000, "Commission too high");
        relayers[relayer] = authorized;
        relayerCommission[relayer] = commissionBps;
        emit RelayerUpdated(relayer, authorized, commissionBps);
    }

    function setMembershipContracts(address _membership, address _pass) external onlyOwner {
        if (_membership != address(0)) netLibraryMembership = IERC721Balance(_membership);
        if (_pass != address(0)) unlimitedPass = IERC721Balance(_pass);
    }

    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    // =========================================================================
    //                         ERC-721 OVERRIDES
    // =========================================================================

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        bytes32 nameHash = tokenToName[tokenId];
        string memory name = _nameStrings[nameHash];
        if (bytes(_baseTokenURI).length == 0) return "";
        return string.concat(_baseTokenURI, name);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);

        if (from != address(0) && to != address(0)) {
            bytes32 nameHash = tokenToName[tokenId];
            _names[nameHash].operator = to;
            // Clear primary name if transferring away
            if (primaryName[from] == nameHash) {
                delete primaryName[from];
            }
        }

        return from;
    }

    // =========================================================================
    //                          VALIDATION
    // =========================================================================

    /// @dev Strict ASCII validation for public commit-reveal path
    function _validateNameStrict(string calldata name) internal pure {
        bytes memory b = bytes(name);
        uint256 len = b.length;

        if (len < MIN_NAME_LENGTH) revert NameTooShort();
        if (len > MAX_NAME_LENGTH) revert NameTooLong();
        if (b[0] == 0x2D) revert LeadingHyphen();
        if (b[len - 1] == 0x2D) revert TrailingHyphen();

        bool prevHyphen = false;
        for (uint256 i = 0; i < len; i++) {
            bytes1 c = b[i];
            if (c == 0x2D) {
                if (prevHyphen) revert ConsecutiveHyphens();
                prevHyphen = true;
            } else if ((c >= 0x30 && c <= 0x39) || (c >= 0x61 && c <= 0x7A)) {
                prevHyphen = false;
            } else {
                revert InvalidCharacter();
            }
        }
    }

    /// @dev Permissive UTF-8 validation for relayer path (ENSIP-15 normalized offchain)
    function _validateNamePermissive(string calldata name, uint8 charCount) internal pure {
        uint256 len = bytes(name).length;
        if (len == 0) revert NameTooShort();
        if (len > 255) revert NameTooLong();
        // Enforce MIN_NAME_LENGTH on effective character count
        uint256 effectiveLen = charCount > 0 ? uint256(charCount) : len;
        if (effectiveLen < MIN_NAME_LENGTH) revert NameTooShort();
    }

    function _requireActiveNameOwner(bytes32 nameHash) internal view {
        NameRecord memory record = _names[nameHash];
        if (record.tokenId == 0) revert NameNotRegistered();
        if (ownerOf(record.tokenId) != msg.sender) revert NotNameOwner();
    }

    function _requireActiveNameOwnerOrOperator(bytes32 nameHash) internal view {
        NameRecord memory record = _names[nameHash];
        if (record.tokenId == 0) revert NameNotRegistered();
        require(ownerOf(record.tokenId) == msg.sender || record.operator == msg.sender, "Not authorized");
    }
}
