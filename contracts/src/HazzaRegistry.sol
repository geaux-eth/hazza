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
        uint64 expiresAt;
        address operator;
        uint256 agentId;
        address agentWallet;
        uint256 originalPrice; // stored for challenge system (2x claim)
    }

    struct Commitment {
        address committer;
        uint64 timestamp;
    }

    struct ChallengeApproval {
        address claimant;
        uint64 deadline;
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
        uint64 firstRegistrationTime;
        uint64 pricingWindowStart;
        uint128 pricingWindowCount;
    }

    /// @dev Internal struct to reduce stack depth in _registerName
    struct RegistrationConfig {
        address nameOwner;
        uint256 numYears;
        uint8 charCount;       // ENSIP-15 grapheme cluster count (0 = use byte length)
        bool wantAgent;
        address agentWallet;
        bool ensImport;        // ENS-verified import: 50% discount + challenge immunity
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
    mapping(address => mapping(uint256 => uint256)) public dailyRegistrations; // wallet => day => count

    // Challenge system
    mapping(bytes32 => ChallengeApproval) public challengeApprovals;

    // ENS-verified names (immune to challenges)
    mapping(bytes32 => bool) public ensVerified;

    // Namespaces
    mapping(bytes32 => Namespace) public namespaces;
    mapping(bytes32 => mapping(bytes32 => SubnameRecord)) public subnames;
    mapping(bytes32 => mapping(bytes32 => string)) private _subnameStrings;

    // =========================================================================
    //                            CONSTANTS
    // =========================================================================

    uint256 public constant MIN_COMMIT_AGE = 60;
    uint256 public constant MAX_COMMIT_AGE = 86400;

    // Pricing (USDC 6 decimals)
    uint256 public constant PRICE_3_CHAR = 100e6;   // $100
    uint256 public constant PRICE_4_CHAR = 25e6;    // $25
    uint256 public constant PRICE_5_PLUS = 5e6;     // $5
    uint256 public constant RENEWAL_FEE = 2e6;      // $2/year
    uint256 public constant REDEMPTION_FEE = 10e6;   // $10 penalty
    uint256 public constant NAMESPACE_PRICE = 20e6;  // $20
    uint256 public constant SUBNAME_PRICE = 1e6;     // $1 per agent subname

    // Time
    uint256 public constant YEAR = 365 days;
    uint256 public constant GRACE_PERIOD = 30 days;
    uint256 public constant REDEMPTION_PERIOD = 30 days;
    uint256 public constant PRICING_WINDOW = 90 days;

    // Name constraints
    uint256 public constant MIN_NAME_LENGTH = 3;
    uint256 public constant MAX_NAME_LENGTH = 63;

    // Rate limits — non-members
    uint256 public constant DAILY_LIMIT_NONMEMBER_EARLY = 1;   // days 1-7
    uint256 public constant DAILY_LIMIT_NONMEMBER_LATER = 3;   // days 8+
    uint256 public constant TOTAL_LIMIT_NONMEMBER = 10;

    // Rate limits — Net Library members
    uint256 public constant DAILY_LIMIT_MEMBER_EARLY = 3;      // days 1-7
    uint256 public constant TOTAL_LIMIT_MEMBER = 30;

    uint256 public constant EARLY_PERIOD = 7 days;

    // =========================================================================
    //                              EVENTS
    // =========================================================================

    event NameRegistered(string name, address indexed owner, uint256 indexed tokenId, uint256 price, uint64 expiresAt);
    event NameRenewed(string name, uint256 indexed tokenId, uint64 newExpiresAt, uint256 numYears);
    event NameReleased(string name, uint256 indexed tokenId);
    event NameChallenged(string name, address indexed claimant, address indexed previousOwner, uint256 claimPrice);
    event ChallengeApproved(string name, address indexed claimant, uint64 deadline);
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
    error NameExpired();
    error NameNotExpired();
    error NotInGracePeriod();
    error NotInRedemptionPeriod();
    error RateLimitExceeded();
    error WalletLimitExceeded();
    error ChallengeNotApproved();
    error ChallengeExpired();
    error NameNotRegistered();
    error NotNamespaceAdmin();
    error NamespaceAlreadyExists();
    error NamespaceNotFound();
    error SubnameAlreadyExists();
    error SubnameNotFound();
    error NameIsNamespace();
    error ChallengeBlockedENS();
    error InvalidCharCount();

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
        uint256 numYears,
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
            numYears: numYears,
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
        uint256 numYears,
        uint8 charCount,
        bool wantAgent,
        address agentWallet,
        string calldata agentURI,
        bool ensImport,
        bool verifiedPass
    ) external onlyRelayerOrOwner nonReentrant {
        _registerName(name, agentURI, RegistrationConfig({
            nameOwner: nameOwner,
            numYears: numYears,
            charCount: charCount,
            wantAgent: wantAgent,
            agentWallet: agentWallet,
            ensImport: ensImport,
            verifiedPass: verifiedPass,
            relayer: msg.sender
        }));
    }

    function _registerName(
        string calldata name,
        string calldata agentURI,
        RegistrationConfig memory c
    ) internal {
        if (c.nameOwner == address(0)) revert ZeroAddress();
        if (c.numYears == 0) c.numYears = 1;

        // Validate: strict ASCII for public path, permissive UTF-8 for relayer
        if (c.relayer == address(0)) {
            _validateNameStrict(name);
        } else {
            _validateNamePermissive(name, c.charCount);
        }

        bytes32 nameHash = keccak256(bytes(name));

        // Check availability (including expired+released names)
        {
            NameRecord memory existing = _names[nameHash];
            if (existing.tokenId != 0) {
                if (!_isReleased(existing)) revert NameNotAvailable();
                _burn(existing.tokenId);
                delete tokenToName[existing.tokenId];
            }
        }

        // Rate limiting (applied to name recipient, not relayer)
        _enforceRateLimit(c.nameOwner, c.verifiedPass);

        // Calculate price — registration fee only, renewal is paid separately later
        uint256 charLen = c.charCount > 0 ? uint256(c.charCount) : bytes(name).length;
        uint256 basePrice = _basePriceByLength(charLen);
        uint256 totalCost = _adjustedPrice(basePrice, c.nameOwner, c.ensImport, c.verifiedPass);

        // Collect payment (from msg.sender — the payer)
        _collectPayment(totalCost, c.relayer);

        // Mint NFT
        uint256 tokenId = _nextTokenId++;
        _safeMint(c.nameOwner, tokenId);

        // Compute expiry once
        uint64 expiresAt = uint64(block.timestamp + (c.numYears * YEAR));

        // Store record
        _names[nameHash] = NameRecord({
            tokenId: tokenId,
            registeredAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            operator: c.nameOwner,
            agentId: 0,
            agentWallet: address(0),
            originalPrice: basePrice
        });
        _nameStrings[nameHash] = name;
        tokenToName[tokenId] = nameHash;

        // Mark ENS-verified names as challenge-immune
        if (c.ensImport) {
            ensVerified[nameHash] = true;
        }

        // Update wallet info & daily count
        _updateWalletInfo(c.nameOwner);

        emit NameRegistered(name, c.nameOwner, tokenId, totalCost, expiresAt);

        // Optional ERC-8004 agent registration
        if (c.wantAgent) {
            _registerAgent(nameHash, name, agentURI, c.agentWallet, c.nameOwner);
        }
    }

    function _updateWalletInfo(address wallet) internal {
        WalletInfo storage info = walletInfo[wallet];
        info.totalRegistrations++;
        if (info.firstRegistrationTime == 0) {
            info.firstRegistrationTime = uint64(block.timestamp);
        }
        if (info.pricingWindowStart == 0 || block.timestamp - info.pricingWindowStart > PRICING_WINDOW) {
            info.pricingWindowStart = uint64(block.timestamp);
            info.pricingWindowCount = 1;
        } else {
            info.pricingWindowCount++;
        }
        uint256 today = block.timestamp / 1 days;
        dailyRegistrations[wallet][today]++;
    }

    // =========================================================================
    //                        RENEWAL & EXPIRY
    // =========================================================================

    /// @notice Renew a name for additional years
    function renew(string calldata name, uint256 numYears) external nonReentrant {
        if (numYears == 0) numYears = 1;
        bytes32 nameHash = keccak256(bytes(name));
        NameRecord storage record = _names[nameHash];
        if (record.tokenId == 0) revert NameNotRegistered();
        if (_isReleased(record)) revert NameNotRegistered();

        uint256 cost = RENEWAL_FEE * numYears;
        bool sent = usdc.transferFrom(msg.sender, treasury, cost);
        if (!sent) revert TransferFailed();

        // Extend from current expiry (or from now if in grace/redemption)
        uint64 base = record.expiresAt > uint64(block.timestamp)
            ? record.expiresAt
            : uint64(block.timestamp);
        record.expiresAt = base + uint64(numYears * YEAR);

        emit NameRenewed(name, record.tokenId, record.expiresAt, numYears);
    }

    /// @notice Reclaim a name during redemption period (extra $10 penalty)
    function redeem(string calldata name, uint256 numYears) external nonReentrant {
        if (numYears == 0) numYears = 1;
        bytes32 nameHash = keccak256(bytes(name));
        NameRecord storage record = _names[nameHash];
        if (record.tokenId == 0) revert NameNotRegistered();
        if (!_isInRedemption(record)) revert NotInRedemptionPeriod();
        if (ownerOf(record.tokenId) != msg.sender) revert NotNameOwner();

        uint256 cost = REDEMPTION_FEE + (RENEWAL_FEE * numYears);
        bool sent = usdc.transferFrom(msg.sender, treasury, cost);
        if (!sent) revert TransferFailed();

        record.expiresAt = uint64(block.timestamp + (numYears * YEAR));
        emit NameRenewed(name, record.tokenId, record.expiresAt, numYears);
    }

    /// @notice Check if a name is active (not expired)
    function isActive(string calldata name) external view returns (bool) {
        bytes32 nameHash = keccak256(bytes(name));
        NameRecord memory record = _names[nameHash];
        return record.tokenId != 0 && record.expiresAt > uint64(block.timestamp);
    }

    /// @notice Check if a name is in grace period (expired but restorable at normal price)
    function isInGracePeriod(string calldata name) external view returns (bool) {
        return _isInGrace(_names[keccak256(bytes(name))]);
    }

    /// @notice Check if a name is in redemption period (needs penalty fee)
    function isInRedemptionPeriod(string calldata name) external view returns (bool) {
        return _isInRedemption(_names[keccak256(bytes(name))]);
    }

    function _isInGrace(NameRecord memory r) internal view returns (bool) {
        if (r.tokenId == 0) return false;
        uint256 exp = r.expiresAt;
        return block.timestamp > exp && block.timestamp <= exp + GRACE_PERIOD;
    }

    function _isInRedemption(NameRecord memory r) internal view returns (bool) {
        if (r.tokenId == 0) return false;
        uint256 exp = r.expiresAt;
        return block.timestamp > exp + GRACE_PERIOD
            && block.timestamp <= exp + GRACE_PERIOD + REDEMPTION_PERIOD;
    }

    function _isReleased(NameRecord memory r) internal view returns (bool) {
        if (r.tokenId == 0) return false;
        return block.timestamp > r.expiresAt + GRACE_PERIOD + REDEMPTION_PERIOD;
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

    function _enforceRateLimit(address wallet, bool verifiedPass) internal view {
        uint8 tier = verifiedPass ? 2 : _getMembershipTier(wallet);
        WalletInfo memory info = walletInfo[wallet];
        uint256 today = block.timestamp / 1 days;
        uint256 todayCount = dailyRegistrations[wallet][today];

        if (tier == 2) {
            // Unlimited Pass — no limits
            return;
        }

        if (tier == 1) {
            // Net Library member
            if (info.totalRegistrations >= TOTAL_LIMIT_MEMBER) revert WalletLimitExceeded();
            if (info.firstRegistrationTime != 0
                && block.timestamp - info.firstRegistrationTime < EARLY_PERIOD
                && todayCount >= DAILY_LIMIT_MEMBER_EARLY) {
                revert RateLimitExceeded();
            }
            // After early period: unlimited daily
        } else {
            // Non-member
            if (info.totalRegistrations >= TOTAL_LIMIT_NONMEMBER) revert WalletLimitExceeded();
            if (info.firstRegistrationTime != 0
                && block.timestamp - info.firstRegistrationTime < EARLY_PERIOD) {
                if (todayCount >= DAILY_LIMIT_NONMEMBER_EARLY) revert RateLimitExceeded();
            } else {
                if (todayCount >= DAILY_LIMIT_NONMEMBER_LATER) revert RateLimitExceeded();
            }
        }
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
        uint256 numYears,
        uint8 charCount,
        bool ensImport,
        bool verifiedPass
    ) external view returns (uint256 totalCost, uint256 registrationFee, uint256 renewalFee) {
        if (numYears == 0) numYears = 1;
        uint256 charLen = charCount > 0 ? uint256(charCount) : bytes(name).length;
        uint256 base = _basePriceByLength(charLen);
        registrationFee = _adjustedPrice(base, wallet, ensImport, verifiedPass);
        renewalFee = RENEWAL_FEE * numYears;
        totalCost = registrationFee; // renewal is paid separately, not bundled
    }

    // =========================================================================
    //                        PAYMENT HANDLING
    // =========================================================================

    function _collectPayment(uint256 amount, address relayer) internal {
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

    /// @notice Reverse resolve: address → primary HAZZA name
    function reverseResolve(address wallet) external view returns (string memory) {
        bytes32 nameHash = primaryName[wallet];
        if (nameHash == bytes32(0)) return "";
        NameRecord memory record = _names[nameHash];
        // Only return if name is still active and owned by this wallet
        if (record.tokenId == 0 || record.expiresAt < uint64(block.timestamp)) return "";
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
    //                       NAME CHALLENGE SYSTEM
    // =========================================================================

    /// @notice Admin approves a name challenge after off-chain identity verification
    function approveChallenge(string calldata name, address claimant, uint64 deadline)
        external onlyOwner
    {
        bytes32 nameHash = keccak256(bytes(name));
        if (_names[nameHash].tokenId == 0) revert NameNotRegistered();
        if (ensVerified[nameHash]) revert ChallengeBlockedENS();
        challengeApprovals[nameHash] = ChallengeApproval({
            claimant: claimant,
            deadline: deadline
        });
        emit ChallengeApproved(name, claimant, deadline);
    }

    /// @notice Execute an approved challenge — claimant pays 2x original price
    function executeChallenge(string calldata name) external nonReentrant {
        bytes32 nameHash = keccak256(bytes(name));
        ChallengeApproval memory approval = challengeApprovals[nameHash];
        if (approval.claimant != msg.sender) revert ChallengeNotApproved();
        if (block.timestamp > approval.deadline) revert ChallengeExpired();

        NameRecord storage record = _names[nameHash];
        if (record.tokenId == 0) revert NameNotRegistered();

        address currentOwner = ownerOf(record.tokenId);
        uint256 claimPrice = record.originalPrice * 2;

        // Claimant pays: compensation goes to current holder
        uint256 allowed = usdc.allowance(msg.sender, address(this));
        if (allowed < claimPrice) revert InsufficientPayment();
        bool sent = usdc.transferFrom(msg.sender, currentOwner, claimPrice);
        if (!sent) revert TransferFailed();

        // Transfer NFT to claimant
        _transfer(currentOwner, msg.sender, record.tokenId);

        // Update record
        record.operator = msg.sender;
        record.expiresAt = uint64(block.timestamp + YEAR); // fresh 1 year

        // Clear challenge
        delete challengeApprovals[nameHash];

        emit NameChallenged(name, msg.sender, currentOwner, claimPrice);
    }

    /// @notice Cancel a pending challenge approval
    function cancelChallenge(string calldata name) external onlyOwner {
        delete challengeApprovals[keccak256(bytes(name))];
    }

    // =========================================================================
    //                          NAMESPACES
    // =========================================================================

    /// @notice Register a namespace (must already own the HAZZA name)
    function registerNamespace(string calldata name) external nonReentrant {
        bytes32 nameHash = keccak256(bytes(name));
        _requireActiveNameOwner(nameHash);
        if (namespaces[nameHash].admin != address(0)) revert NamespaceAlreadyExists();

        // Pay namespace fee
        bool sent = usdc.transferFrom(msg.sender, treasury, NAMESPACE_PRICE);
        if (!sent) revert TransferFailed();

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
        bytes32 nameHash = keccak256(bytes(name));
        NameRecord memory record = _names[nameHash];
        if (record.tokenId == 0) return true;
        return _isReleased(record);
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
        uint64 expiresAt,
        address operator,
        uint256 agentId,
        address agentWallet
    ) {
        bytes32 nameHash = keccak256(bytes(name));
        NameRecord memory record = _names[nameHash];
        if (record.tokenId == 0) return (address(0), 0, 0, 0, address(0), 0, address(0));
        return (
            ownerOf(record.tokenId),
            record.tokenId,
            record.registeredAt,
            record.expiresAt,
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
        relayers[relayer] = authorized;
        relayerCommission[relayer] = commissionBps;
        emit RelayerUpdated(relayer, authorized, commissionBps);
    }

    function setMembershipContracts(address _membership, address _pass) external onlyOwner {
        if (_membership != address(0)) netLibraryMembership = IERC721Balance(_membership);
        if (_pass != address(0)) unlimitedPass = IERC721Balance(_pass);
    }

    // =========================================================================
    //                         ERC-721 OVERRIDES
    // =========================================================================

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
        if (record.expiresAt < uint64(block.timestamp)) revert NameExpired();
        if (ownerOf(record.tokenId) != msg.sender) revert NotNameOwner();
    }
}
