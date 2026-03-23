// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "forge-std/interfaces/IERC721.sol";

/// @title HazzaBountyEscrow
/// @notice Receives agent bounties from Seaport sale proceeds and releases them to registered agents.
/// @dev This contract is listed as a Seaport consideration recipient. When a name sells,
///      Seaport sends the bounty ETH here automatically. The agent who facilitated the sale
///      then claims the bounty by proving the NFT changed hands.
///
///      Flow:
///      1. Seller lists on Seaport/Bazaar with consideration: (price-bounty) → seller, bounty → this contract
///      2. Seller calls registerBounty(tokenId, bountyAmount) to record the intent
///      3. Any agent can register on open bounties. If approvedAgent is set, only that agent can.
///      4. Buyer purchases via Seaport — NFT transfers, ETH splits automatically
///      5. Agent calls claimBounty(tokenId) — contract verifies ownership changed, pays agent
///      6. If no agent facilitated, seller can withdrawBounty(tokenId) after sale to reclaim
contract HazzaBountyEscrow {

    struct Bounty {
        address seller;         // Original NFT owner who listed
        uint256 bountyAmount;   // Expected bounty amount from Seaport consideration
        address approvedAgent;  // Seller-approved agent (0x0 = open to ANY agent)
        address agent;          // Agent who registered to facilitate (0x0 = none)
        bool claimed;           // Whether bounty has been claimed/withdrawn
        bool active;            // Whether this bounty registration is active
    }

    IERC721 public immutable registry;
    address public owner;

    /// @dev tokenId => Bounty
    mapping(uint256 => Bounty) public bounties;

    event BountyRegistered(uint256 indexed tokenId, address indexed seller, uint256 bountyAmount, address approvedAgent);
    event AgentRegistered(uint256 indexed tokenId, address indexed agent);
    event BountyClaimed(uint256 indexed tokenId, address indexed agent, uint256 amount);
    event BountyWithdrawn(uint256 indexed tokenId, address indexed seller, uint256 amount);
    event BountyCancelled(uint256 indexed tokenId, address indexed seller);

    error NotSeller();
    error NotAgent();
    error NotActive();
    error AlreadyClaimed();
    error NFTNotTransferred();
    error NoBountyBalance();
    error TransferFailed();
    error BountyAlreadyExists();
    error ZeroAmount();
    error NotOwner();
    error NotApprovedAgent();
    error AgentAlreadyRegistered();

    constructor(address _registry) {
        registry = IERC721(_registry);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Seller registers a bounty for a token they're listing on Seaport
    /// @param tokenId The hazza name tokenId being listed
    /// @param bountyAmount The ETH amount that Seaport will send to this contract on sale
    /// @param approvedAgent If non-zero, only this agent can register. If zero, any agent can.
    function registerBounty(uint256 tokenId, uint256 bountyAmount, address approvedAgent) external {
        if (bountyAmount == 0) revert ZeroAmount();
        if (registry.ownerOf(tokenId) != msg.sender) revert NotSeller();

        // If there's an existing active bounty, seller must cancel it first
        Bounty storage existing = bounties[tokenId];
        if (existing.active && !existing.claimed) revert BountyAlreadyExists();

        bounties[tokenId] = Bounty({
            seller: msg.sender,
            bountyAmount: bountyAmount,
            approvedAgent: approvedAgent,
            agent: address(0),
            claimed: false,
            active: true
        });

        emit BountyRegistered(tokenId, msg.sender, bountyAmount, approvedAgent);
    }

    /// @notice Backwards-compatible overload — open bounty (any agent can register)
    function registerBounty(uint256 tokenId, uint256 bountyAmount) external {
        if (bountyAmount == 0) revert ZeroAmount();
        if (registry.ownerOf(tokenId) != msg.sender) revert NotSeller();

        Bounty storage existing = bounties[tokenId];
        if (existing.active && !existing.claimed) revert BountyAlreadyExists();

        bounties[tokenId] = Bounty({
            seller: msg.sender,
            bountyAmount: bountyAmount,
            approvedAgent: address(0),
            agent: address(0),
            claimed: false,
            active: true
        });

        emit BountyRegistered(tokenId, msg.sender, bountyAmount, address(0));
    }

    /// @notice Any agent registers to facilitate the sale of a listed name
    /// @dev Open bounties: any address can register (first-come, first-served).
    ///      Approved bounties: only the approved agent can register.
    ///      Once an agent is registered, no one else can take the slot.
    ///      Seller can cancel and re-register if they want a different agent.
    /// @param tokenId The token to facilitate sale for
    function registerAgent(uint256 tokenId) external {
        Bounty storage b = bounties[tokenId];
        if (!b.active) revert NotActive();
        if (b.claimed) revert AlreadyClaimed();
        if (b.seller == msg.sender) revert NotSeller(); // seller can't be their own agent
        if (b.agent != address(0)) revert AgentAlreadyRegistered(); // first-come, no replacement

        // If seller specified an approved agent, only that agent can register
        if (b.approvedAgent != address(0)) {
            if (msg.sender != b.approvedAgent) revert NotApprovedAgent();
        }
        // Otherwise: open bounty — any address can register

        b.agent = msg.sender;
        emit AgentRegistered(tokenId, msg.sender);
    }

    /// @notice Agent claims the bounty after the name has sold via Seaport
    /// @dev Verifies the NFT is no longer owned by the original seller
    /// @param tokenId The token whose bounty to claim
    function claimBounty(uint256 tokenId) external {
        Bounty storage b = bounties[tokenId];
        if (!b.active) revert NotActive();
        if (b.claimed) revert AlreadyClaimed();
        if (b.agent != msg.sender) revert NotAgent();

        // Verify the NFT actually transferred (sale happened via Seaport)
        address currentOwner = registry.ownerOf(tokenId);
        if (currentOwner == b.seller) revert NFTNotTransferred();

        // Check contract has the bounty ETH (sent by Seaport as consideration)
        if (address(this).balance < b.bountyAmount) revert NoBountyBalance();

        b.claimed = true;
        b.active = false;

        (bool ok,) = payable(msg.sender).call{value: b.bountyAmount}("");
        if (!ok) revert TransferFailed();

        emit BountyClaimed(tokenId, msg.sender, b.bountyAmount);
    }

    /// @notice Seller withdraws unclaimed bounty ETH after a direct sale (no agent)
    /// @dev Only callable if the NFT transferred but no agent claimed
    /// @param tokenId The token whose bounty to withdraw
    function withdrawBounty(uint256 tokenId) external {
        Bounty storage b = bounties[tokenId];
        if (!b.active) revert NotActive();
        if (b.claimed) revert AlreadyClaimed();
        if (b.seller != msg.sender) revert NotSeller();

        // Verify the NFT actually transferred (sale happened)
        address currentOwner = registry.ownerOf(tokenId);
        if (currentOwner == b.seller) revert NFTNotTransferred();

        // No agent registered, or agent didn't claim — seller gets it back
        if (address(this).balance < b.bountyAmount) revert NoBountyBalance();

        b.claimed = true;
        b.active = false;

        (bool ok,) = payable(msg.sender).call{value: b.bountyAmount}("");
        if (!ok) revert TransferFailed();

        emit BountyWithdrawn(tokenId, msg.sender, b.bountyAmount);
    }

    /// @notice Seller cancels a bounty registration (before sale happens)
    /// @param tokenId The token whose bounty to cancel
    function cancelBounty(uint256 tokenId) external {
        Bounty storage b = bounties[tokenId];
        if (b.seller != msg.sender) revert NotSeller();
        if (!b.active) revert NotActive();
        if (b.claimed) revert AlreadyClaimed();

        b.active = false;
        emit BountyCancelled(tokenId, msg.sender);

        // If any ETH arrived, return it
        if (address(this).balance >= b.bountyAmount) {
            (bool ok,) = payable(msg.sender).call{value: b.bountyAmount}("");
            if (!ok) revert TransferFailed();
        }
    }

    /// @notice Check active bounty for a token
    function getBounty(uint256 tokenId) external view returns (
        address seller, uint256 bountyAmount, address agent, bool claimed, bool active
    ) {
        Bounty storage b = bounties[tokenId];
        return (b.seller, b.bountyAmount, b.agent, b.claimed, b.active);
    }

    /// @notice Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    /// @notice Accept ETH from Seaport consideration payments
    receive() external payable {}
}
