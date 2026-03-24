// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "forge-std/interfaces/IERC721.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title HazzaBountyEscrowV5
/// @notice Upgradeable escrow for agent bounties on hazza name marketplace sales.
/// @dev UUPS upgradeable. Bounty ETH comes from the sale via Seaport consideration.
///      The seller never puts up their own ETH — the bounty is split from the buyer's
///      payment when the sale completes.
///
///      Flow:
///      1. Seller lists name on Seaport with consideration: seller gets (price - bounty),
///         escrow contract gets bounty
///      2. Seller calls registerBounty(tokenId, bountyAmount) — records the bounty metadata
///         (NO ETH transfer — just registers the expected amount and seller)
///      3. Agent registers on the bounty (or seller assigns one)
///      4. Sale happens on any Seaport-compatible marketplace — Seaport sends bounty ETH
///         to this contract as part of the consideration split
///      5. Agent calls claimBounty() — proves NFT transferred, gets paid
///      6. If no agent facilitated: seller calls withdrawBounty() after agent expires
///
///      Agent management:
///      - Seller can assign/kick/switch agents at any time
///      - Open bounties: agents self-register with 24h expiry, no consecutive re-registration
///      - Seller-assigned agents have no expiry
///
///      Security:
///      - UUPS proxy (upgradeable, same address forever)
///      - Pausable (emergency stop)
///      - ReentrancyGuard on all state-changing functions
///      - Pull-over-push for payouts
///      - Per-bounty ETH accounting (no shared pool)
///      - receive() accepts ETH only from Seaport
contract HazzaBountyEscrowV5 is UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuard {

    // =========================================================================
    //                              STORAGE
    // =========================================================================

    struct Bounty {
        address seller;
        uint256 amount;            // expected bounty amount (set by seller, paid by Seaport)
        address agent;
        uint256 agentRegisteredAt;
        bool sellerAssigned;       // true = seller assigned (no expiry), false = self-registered (24h)
        address lastExpiredAgent;  // prevent consecutive re-registration
        bool active;
    }

    IERC721 public registry;

    mapping(uint256 => Bounty) public bounties;
    mapping(address => uint256) public pendingWithdrawals;

    uint256 public constant AGENT_EXPIRY = 24 hours;

    /// @notice Seaport contract address — only Seaport can send ETH to this contract
    address public seaport;

    // =========================================================================
    //                              EVENTS
    // =========================================================================

    event BountyCreated(uint256 indexed tokenId, address indexed seller, uint256 amount, address agent);
    event BountyCancelled(uint256 indexed tokenId, address indexed seller);
    event AgentAssigned(uint256 indexed tokenId, address indexed agent, address indexed assignedBy);
    event AgentRemoved(uint256 indexed tokenId, address indexed agent, address indexed removedBy);
    event AgentRegistered(uint256 indexed tokenId, address indexed agent);
    event BountyClaimed(uint256 indexed tokenId, address indexed agent, uint256 amount);
    event BountyWithdrawn(uint256 indexed tokenId, address indexed seller, uint256 amount);
    event PayoutWithdrawn(address indexed payee, uint256 amount);
    event RegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event SeaportUpdated(address indexed oldSeaport, address indexed newSeaport);

    // =========================================================================
    //                              ERRORS
    // =========================================================================

    error NotSeller();
    error NotAgent();
    error NotActive();
    error NFTNotTransferred();
    error TransferFailed();
    error BountyAlreadyExists();
    error ZeroAmount();
    error AgentExpired();
    error AgentSlotTaken();
    error AgentStillActive();
    error CannotReregisterConsecutively();
    error SellerCannotBeAgent();
    error NothingToWithdraw();
    error ZeroAddress();
    error NotSeaport();

    // =========================================================================
    //                           INITIALIZER
    // =========================================================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice V5 re-initializer — sets seaport address. Called once after upgrade.
    /// @dev reinitializer(2) because V4 used initializer (version 1).
    function initializeV5(address _seaport) external reinitializer(2) {
        if (_seaport == address(0)) revert ZeroAddress();
        seaport = _seaport;
    }

    function initialize(address _registry, address _owner) external initializer {
        if (_registry == address(0) || _owner == address(0)) revert ZeroAddress();
        __Ownable_init(_owner);
        __Pausable_init();
        registry = IERC721(_registry);
    }

    // =========================================================================
    //                         SELLER FUNCTIONS
    // =========================================================================

    /// @notice Register a bounty for a listed name. Records metadata only — no ETH required.
    /// @dev The bounty ETH arrives from Seaport when the sale completes (via consideration split).
    /// @param tokenId The hazza name tokenId
    /// @param bountyAmount The expected bounty amount in wei (must match Seaport consideration)
    /// @param agent Optional agent address. Zero address = open to public.
    function registerBounty(uint256 tokenId, uint256 bountyAmount, address agent) external whenNotPaused nonReentrant {
        if (bountyAmount == 0) revert ZeroAmount();
        if (registry.ownerOf(tokenId) != msg.sender) revert NotSeller();

        Bounty storage existing = bounties[tokenId];
        if (existing.active) revert BountyAlreadyExists();

        bool assigned = agent != address(0);
        if (assigned && agent == msg.sender) revert SellerCannotBeAgent();

        bounties[tokenId] = Bounty({
            seller: msg.sender,
            amount: bountyAmount,
            agent: agent,
            agentRegisteredAt: assigned ? block.timestamp : 0,
            sellerAssigned: assigned,
            lastExpiredAgent: address(0),
            active: true
        });

        emit BountyCreated(tokenId, msg.sender, bountyAmount, agent);
        if (assigned) emit AgentAssigned(tokenId, agent, msg.sender);
    }

    /// @notice Register a bounty with no agent (open to public). Records metadata only.
    function registerBounty(uint256 tokenId, uint256 bountyAmount) external whenNotPaused nonReentrant {
        if (bountyAmount == 0) revert ZeroAmount();
        if (registry.ownerOf(tokenId) != msg.sender) revert NotSeller();

        Bounty storage existing = bounties[tokenId];
        if (existing.active) revert BountyAlreadyExists();

        bounties[tokenId] = Bounty({
            seller: msg.sender,
            amount: bountyAmount,
            agent: address(0),
            agentRegisteredAt: 0,
            sellerAssigned: false,
            lastExpiredAgent: address(0),
            active: true
        });

        emit BountyCreated(tokenId, msg.sender, bountyAmount, address(0));
    }

    /// @notice Seller assigns or switches agent at any time
    function assignAgent(uint256 tokenId, address agent) external whenNotPaused nonReentrant {
        Bounty storage b = bounties[tokenId];
        if (!b.active) revert NotActive();
        if (b.seller != msg.sender) revert NotSeller();
        if (agent == address(0)) revert ZeroAddress();
        if (agent == msg.sender) revert SellerCannotBeAgent();

        address oldAgent = b.agent;
        b.agent = agent;
        b.agentRegisteredAt = block.timestamp;
        b.sellerAssigned = true;
        b.lastExpiredAgent = address(0);

        if (oldAgent != address(0)) emit AgentRemoved(tokenId, oldAgent, msg.sender);
        emit AgentAssigned(tokenId, agent, msg.sender);
    }

    /// @notice Seller removes current agent and opens bounty to public
    function removeAgent(uint256 tokenId) external whenNotPaused nonReentrant {
        Bounty storage b = bounties[tokenId];
        if (!b.active) revert NotActive();
        if (b.seller != msg.sender) revert NotSeller();

        address oldAgent = b.agent;
        b.agent = address(0);
        b.agentRegisteredAt = 0;
        b.sellerAssigned = false;
        b.lastExpiredAgent = address(0);

        if (oldAgent != address(0)) emit AgentRemoved(tokenId, oldAgent, msg.sender);
    }

    /// @notice Seller cancels a bounty entirely (before sale). Only works if no ETH received yet.
    /// @dev If the Seaport sale already sent ETH, use withdrawBounty instead.
    function cancelBounty(uint256 tokenId) external whenNotPaused nonReentrant {
        Bounty storage b = bounties[tokenId];
        if (b.seller != msg.sender) revert NotSeller();
        if (!b.active) revert NotActive();

        b.active = false;

        emit BountyCancelled(tokenId, msg.sender);
    }

    /// @notice Seller reclaims bounty ETH after a sale where no active agent facilitated
    /// @dev Only callable when there is no active agent (no agent, or agent expired)
    function withdrawBounty(uint256 tokenId) external whenNotPaused nonReentrant {
        Bounty storage b = bounties[tokenId];
        if (!b.active) revert NotActive();
        if (b.seller != msg.sender) revert NotSeller();

        // Verify no active agent
        if (b.agent != address(0)) {
            if (b.sellerAssigned || block.timestamp < b.agentRegisteredAt + AGENT_EXPIRY) {
                revert AgentStillActive();
            }
        }

        // Verify the NFT actually transferred (sale happened)
        if (registry.ownerOf(tokenId) == b.seller) revert NFTNotTransferred();

        uint256 amount = b.amount;
        b.active = false;

        pendingWithdrawals[msg.sender] += amount;

        emit BountyWithdrawn(tokenId, msg.sender, amount);
    }

    // =========================================================================
    //                          AGENT FUNCTIONS
    // =========================================================================

    /// @notice Agent self-registers on an open bounty. 24h expiry. No consecutive re-registration.
    function registerAgent(uint256 tokenId) external whenNotPaused nonReentrant {
        Bounty storage b = bounties[tokenId];
        if (!b.active) revert NotActive();
        if (msg.sender == b.seller) revert SellerCannotBeAgent();

        if (b.sellerAssigned) revert AgentSlotTaken();

        if (b.agent != address(0)) {
            if (block.timestamp < b.agentRegisteredAt + AGENT_EXPIRY) {
                revert AgentSlotTaken();
            }
            b.lastExpiredAgent = b.agent;
        }

        if (msg.sender == b.lastExpiredAgent) revert CannotReregisterConsecutively();

        b.agent = msg.sender;
        b.agentRegisteredAt = block.timestamp;

        emit AgentRegistered(tokenId, msg.sender);
    }

    /// @notice Agent claims bounty after a sale happened (any marketplace)
    /// @dev Verifies NFT ownership changed and agent is active. Pays from Seaport-received ETH.
    function claimBounty(uint256 tokenId) external whenNotPaused nonReentrant {
        Bounty storage b = bounties[tokenId];
        if (!b.active) revert NotActive();
        if (b.agent != msg.sender) revert NotAgent();

        if (!b.sellerAssigned && block.timestamp >= b.agentRegisteredAt + AGENT_EXPIRY) {
            revert AgentExpired();
        }

        if (registry.ownerOf(tokenId) == b.seller) revert NFTNotTransferred();

        uint256 amount = b.amount;
        b.active = false;

        pendingWithdrawals[msg.sender] += amount;

        emit BountyClaimed(tokenId, msg.sender, amount);
    }

    // =========================================================================
    //                         WITHDRAWAL (PULL PATTERN)
    // =========================================================================

    /// @notice Withdraw earned payouts. Agents and sellers call this to collect.
    function withdrawPayout() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pendingWithdrawals[msg.sender] = 0;

        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit PayoutWithdrawn(msg.sender, amount);
    }

    // =========================================================================
    //                         RECEIVE ETH (FROM SEAPORT)
    // =========================================================================

    /// @notice Accept ETH from Seaport when a sale completes (consideration split)
    /// @dev Only Seaport can send ETH to this contract. The ETH is tracked per-bounty
    ///      via the registered bounty amounts — no separate accounting needed for incoming
    ///      ETH because each bounty's amount was set when registered.
    receive() external payable {
        if (msg.sender != seaport) revert NotSeaport();
    }

    // =========================================================================
    //                            VIEW FUNCTIONS
    // =========================================================================

    /// @notice Get bounty details for a token
    function getBounty(uint256 tokenId) external view returns (
        address seller,
        uint256 amount,
        address agent,
        bool agentActive,
        bool sellerAssigned,
        bool active
    ) {
        Bounty storage b = bounties[tokenId];
        bool _isAgentActive = b.agent != address(0) && (
            b.sellerAssigned || block.timestamp < b.agentRegisteredAt + AGENT_EXPIRY
        );
        return (b.seller, b.amount, b.agent, _isAgentActive, b.sellerAssigned, b.active);
    }

    /// @notice Check if an agent's registration is still active on a bounty
    function isAgentActive(uint256 tokenId) external view returns (bool) {
        Bounty storage b = bounties[tokenId];
        if (b.agent == address(0)) return false;
        if (b.sellerAssigned) return true;
        return block.timestamp < b.agentRegisteredAt + AGENT_EXPIRY;
    }

    // =========================================================================
    //                           OWNER FUNCTIONS
    // =========================================================================

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        address old = address(registry);
        registry = IERC721(_registry);
        emit RegistryUpdated(old, _registry);
    }

    function setSeaport(address _seaport) external onlyOwner {
        if (_seaport == address(0)) revert ZeroAddress();
        address old = seaport;
        seaport = _seaport;
        emit SeaportUpdated(old, _seaport);
    }

    // =========================================================================
    //                          INTERNAL HELPERS
    // =========================================================================

    /// @dev Only owner can authorize upgrades
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
