// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "forge-std/interfaces/IERC721.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title HazzaBountyEscrowV4
/// @notice Upgradeable escrow for agent bounties on hazza name marketplace sales.
/// @dev UUPS upgradeable. Sellers deposit bounty ETH upfront. Agents earn by facilitating sales.
///
///      Flow:
///      1. Seller lists name on Seaport (any marketplace)
///      2. Seller calls registerBounty{value: bountyETH}() — deposits bounty into escrow
///      3. Agent registers on the bounty (or seller assigns one)
///      4. Sale happens on any Seaport-compatible marketplace
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
///      - Seller deposits bounty upfront (true escrow)
contract HazzaBountyEscrowV4 is UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuard {

    // =========================================================================
    //                              STORAGE
    // =========================================================================

    struct Bounty {
        address seller;
        uint256 amount;            // deposited ETH (set from msg.value)
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

    // =========================================================================
    //                              EVENTS
    // =========================================================================

    event BountyCreated(uint256 indexed tokenId, address indexed seller, uint256 amount, address agent);
    event BountyCancelled(uint256 indexed tokenId, address indexed seller, uint256 refund);
    event AgentAssigned(uint256 indexed tokenId, address indexed agent, address indexed assignedBy);
    event AgentRemoved(uint256 indexed tokenId, address indexed agent, address indexed removedBy);
    event AgentRegistered(uint256 indexed tokenId, address indexed agent);
    event BountyClaimed(uint256 indexed tokenId, address indexed agent, uint256 amount);
    event BountyWithdrawn(uint256 indexed tokenId, address indexed seller, uint256 amount);
    event PayoutWithdrawn(address indexed payee, uint256 amount);
    event RegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

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

    // =========================================================================
    //                           INITIALIZER
    // =========================================================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
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

    /// @notice Register a bounty for a listed name. Deposit ETH as the bounty amount.
    /// @dev Seller sends msg.value as the bounty deposit. Optional: assign an agent from the start.
    /// @param tokenId The hazza name tokenId
    /// @param agent Optional agent address. Zero address = open to public.
    function registerBounty(uint256 tokenId, address agent) external payable whenNotPaused nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        if (registry.ownerOf(tokenId) != msg.sender) revert NotSeller();

        Bounty storage existing = bounties[tokenId];
        if (existing.active) revert BountyAlreadyExists();

        bool assigned = agent != address(0);
        if (assigned && agent == msg.sender) revert SellerCannotBeAgent();

        bounties[tokenId] = Bounty({
            seller: msg.sender,
            amount: msg.value,
            agent: agent,
            agentRegisteredAt: assigned ? block.timestamp : 0,
            sellerAssigned: assigned,
            lastExpiredAgent: address(0),
            active: true
        });

        emit BountyCreated(tokenId, msg.sender, msg.value, agent);
        if (assigned) emit AgentAssigned(tokenId, agent, msg.sender);
    }

    /// @notice Register a bounty with no agent (open to public). Deposit ETH as the bounty.
    function registerBounty(uint256 tokenId) external payable whenNotPaused nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        if (registry.ownerOf(tokenId) != msg.sender) revert NotSeller();

        Bounty storage existing = bounties[tokenId];
        if (existing.active) revert BountyAlreadyExists();

        bounties[tokenId] = Bounty({
            seller: msg.sender,
            amount: msg.value,
            agent: address(0),
            agentRegisteredAt: 0,
            sellerAssigned: false,
            lastExpiredAgent: address(0),
            active: true
        });

        emit BountyCreated(tokenId, msg.sender, msg.value, address(0));
    }

    /// @notice Seller assigns or switches agent at any time
    /// @param tokenId The token with an active bounty
    /// @param agent The agent to assign (cannot be zero — use removeAgent for that)
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
        b.lastExpiredAgent = address(0); // reset since seller is taking control

        if (oldAgent != address(0)) emit AgentRemoved(tokenId, oldAgent, msg.sender);
        emit AgentAssigned(tokenId, agent, msg.sender);
    }

    /// @notice Seller removes current agent and opens bounty to public
    /// @param tokenId The token with an active bounty
    function removeAgent(uint256 tokenId) external whenNotPaused nonReentrant {
        Bounty storage b = bounties[tokenId];
        if (!b.active) revert NotActive();
        if (b.seller != msg.sender) revert NotSeller();

        address oldAgent = b.agent;
        b.agent = address(0);
        b.agentRegisteredAt = 0;
        b.sellerAssigned = false;
        b.lastExpiredAgent = address(0); // seller kicked — anyone can register fresh

        if (oldAgent != address(0)) emit AgentRemoved(tokenId, oldAgent, msg.sender);
    }

    /// @notice Seller cancels a bounty entirely (before sale). Deposited ETH is refunded.
    /// @param tokenId The token whose bounty to cancel
    function cancelBounty(uint256 tokenId) external whenNotPaused nonReentrant {
        Bounty storage b = bounties[tokenId];
        if (b.seller != msg.sender) revert NotSeller();
        if (!b.active) revert NotActive();

        uint256 refund = b.amount;
        b.active = false;

        // Refund deposited bounty ETH to seller via pull pattern
        pendingWithdrawals[msg.sender] += refund;

        emit BountyCancelled(tokenId, msg.sender, refund);
    }

    /// @notice Seller reclaims bounty ETH after a direct sale (no active agent facilitated)
    /// @dev Only callable when there is no active agent (no agent, or agent expired)
    /// @param tokenId The token whose bounty ETH to withdraw
    function withdrawBounty(uint256 tokenId) external whenNotPaused nonReentrant {
        Bounty storage b = bounties[tokenId];
        if (!b.active) revert NotActive();
        if (b.seller != msg.sender) revert NotSeller();

        // Verify no active agent — agent gets priority if active
        if (b.agent != address(0)) {
            if (b.sellerAssigned || block.timestamp < b.agentRegisteredAt + AGENT_EXPIRY) {
                revert AgentStillActive();
            }
        }

        // Verify the NFT actually transferred (sale happened)
        if (registry.ownerOf(tokenId) == b.seller) revert NFTNotTransferred();

        uint256 amount = b.amount;
        b.active = false;

        // Pull pattern: credit seller
        pendingWithdrawals[msg.sender] += amount;

        emit BountyWithdrawn(tokenId, msg.sender, amount);
    }

    // =========================================================================
    //                          AGENT FUNCTIONS
    // =========================================================================

    /// @notice Agent self-registers on an open bounty. 24h expiry. No consecutive re-registration.
    /// @param tokenId The token to work on selling
    function registerAgent(uint256 tokenId) external whenNotPaused nonReentrant {
        Bounty storage b = bounties[tokenId];
        if (!b.active) revert NotActive();
        if (msg.sender == b.seller) revert SellerCannotBeAgent();

        // If seller assigned an agent, public can't register
        if (b.sellerAssigned) revert AgentSlotTaken();

        // If there's a current agent, check if expired
        if (b.agent != address(0)) {
            if (block.timestamp < b.agentRegisteredAt + AGENT_EXPIRY) {
                revert AgentSlotTaken(); // current agent still active
            }
            // Current agent expired — record them so they can't re-register immediately
            b.lastExpiredAgent = b.agent;
        }

        // Prevent consecutive re-registration
        if (msg.sender == b.lastExpiredAgent) revert CannotReregisterConsecutively();

        b.agent = msg.sender;
        b.agentRegisteredAt = block.timestamp;

        emit AgentRegistered(tokenId, msg.sender);
    }

    /// @notice Agent claims bounty after a sale happened (any marketplace)
    /// @dev Verifies NFT ownership changed and agent is active. Pays from deposited ETH.
    /// @param tokenId The token whose bounty to claim
    function claimBounty(uint256 tokenId) external whenNotPaused nonReentrant {
        Bounty storage b = bounties[tokenId];
        if (!b.active) revert NotActive();
        if (b.agent != msg.sender) revert NotAgent();

        // Verify agent is still active (not expired)
        if (!b.sellerAssigned && block.timestamp >= b.agentRegisteredAt + AGENT_EXPIRY) {
            revert AgentExpired();
        }

        // Verify the NFT actually transferred
        if (registry.ownerOf(tokenId) == b.seller) revert NFTNotTransferred();

        uint256 amount = b.amount;
        b.active = false;

        // Pull pattern: credit agent from deposited ETH
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

    /// @notice Update the registry address
    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        address old = address(registry);
        registry = IERC721(_registry);
        emit RegistryUpdated(old, _registry);
    }

    // =========================================================================
    //                          INTERNAL HELPERS
    // =========================================================================

    /// @dev Only owner can authorize upgrades
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
