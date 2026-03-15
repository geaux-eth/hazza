// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "forge-std/interfaces/IERC721.sol";

/// @title HazzaAgentBounty
/// @notice ERC-8183 compatible agent bounty system for hazza marketplace
/// @dev Sellers attach ETH bounties to listings. Agents who facilitate the sale claim the bounty
///      after the NFT transfers to the buyer. The evaluator (this contract) verifies the transfer.
///
/// ERC-8183 Roles:
///   Client  = Seller (creates bounty)
///   Provider = Agent (claims bounty after facilitating sale)
///   Evaluator = This contract (verifies NFT ownership changed)
contract HazzaAgentBounty {

    struct Bounty {
        address seller;          // Client — who posted the bounty
        uint256 tokenId;         // Which hazza name (NFT)
        uint256 amount;          // ETH bounty amount
        address agent;           // Provider — agent who claims (0x0 = open to any)
        uint64 expiresAt;        // Expiration timestamp (0 = no expiry)
        bool claimed;            // Whether the bounty has been claimed
        bool cancelled;          // Whether the seller cancelled
    }

    IERC721 public immutable registry;
    address public owner;

    uint256 public nextBountyId;
    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => uint256) public tokenBounty; // tokenId => active bountyId (0 = none)

    event BountyCreated(uint256 indexed bountyId, address indexed seller, uint256 indexed tokenId, uint256 amount, address agent, uint64 expiresAt);
    event BountyClaimed(uint256 indexed bountyId, address indexed agent, uint256 indexed tokenId, address newOwner);
    event BountyCancelled(uint256 indexed bountyId, address indexed seller);
    event BountyExpired(uint256 indexed bountyId);

    error NotSeller();
    error BountyNotActive();
    error NotAuthorizedAgent();
    error NFTNotTransferred();
    error BountyExpiredError();
    error TokenAlreadyHasBounty();
    error InsufficientAmount();

    constructor(address _registry) {
        registry = IERC721(_registry);
        owner = msg.sender;
        nextBountyId = 1; // 0 means "no bounty"
    }

    /// @notice Create a bounty for a hazza name sale
    /// @param tokenId The hazza name tokenId
    /// @param agent Restrict to specific agent address (0x0 = open bounty)
    /// @param expiresAt Expiration timestamp (0 = no expiry)
    function createBounty(uint256 tokenId, address agent, uint64 expiresAt) external payable {
        if (msg.value == 0) revert InsufficientAmount();
        if (registry.ownerOf(tokenId) != msg.sender) revert NotSeller();
        if (tokenBounty[tokenId] != 0) {
            // Check if existing bounty is still active
            Bounty storage existing = bounties[tokenBounty[tokenId]];
            if (!existing.claimed && !existing.cancelled && (existing.expiresAt == 0 || existing.expiresAt > block.timestamp)) {
                revert TokenAlreadyHasBounty();
            }
        }

        uint256 bountyId = nextBountyId++;
        bounties[bountyId] = Bounty({
            seller: msg.sender,
            tokenId: tokenId,
            amount: msg.value,
            agent: agent,
            expiresAt: expiresAt,
            claimed: false,
            cancelled: false
        });
        tokenBounty[tokenId] = bountyId;

        emit BountyCreated(bountyId, msg.sender, tokenId, msg.value, agent, expiresAt);
    }

    /// @notice Claim a bounty after facilitating a sale
    /// @dev The evaluator logic: checks that the NFT is no longer owned by the seller
    /// @param bountyId The bounty to claim
    function claimBounty(uint256 bountyId) external {
        Bounty storage b = bounties[bountyId];
        if (b.claimed || b.cancelled) revert BountyNotActive();
        if (b.expiresAt != 0 && b.expiresAt < block.timestamp) revert BountyExpiredError();
        if (b.agent != address(0) && b.agent != msg.sender) revert NotAuthorizedAgent();

        // ERC-8183 Evaluator: verify the NFT has been transferred away from the seller
        address currentOwner = registry.ownerOf(b.tokenId);
        if (currentOwner == b.seller) revert NFTNotTransferred();

        b.claimed = true;
        tokenBounty[b.tokenId] = 0;

        // Pay the agent
        (bool success,) = payable(msg.sender).call{value: b.amount}("");
        require(success, "ETH transfer failed");

        emit BountyClaimed(bountyId, msg.sender, b.tokenId, currentOwner);
    }

    /// @notice Cancel a bounty and reclaim ETH
    /// @param bountyId The bounty to cancel
    function cancelBounty(uint256 bountyId) external {
        Bounty storage b = bounties[bountyId];
        if (b.seller != msg.sender) revert NotSeller();
        if (b.claimed || b.cancelled) revert BountyNotActive();

        b.cancelled = true;
        tokenBounty[b.tokenId] = 0;

        (bool success,) = payable(msg.sender).call{value: b.amount}("");
        require(success, "ETH transfer failed");

        emit BountyCancelled(bountyId, msg.sender);
    }

    /// @notice Reclaim ETH from an expired bounty
    /// @param bountyId The expired bounty
    function reclaimExpired(uint256 bountyId) external {
        Bounty storage b = bounties[bountyId];
        if (b.seller != msg.sender) revert NotSeller();
        if (b.claimed || b.cancelled) revert BountyNotActive();
        if (b.expiresAt == 0 || b.expiresAt >= block.timestamp) revert BountyNotActive();

        b.cancelled = true;
        tokenBounty[b.tokenId] = 0;

        (bool success,) = payable(msg.sender).call{value: b.amount}("");
        require(success, "ETH transfer failed");

        emit BountyExpired(bountyId);
    }

    /// @notice Get active bounty for a token
    function getActiveBounty(uint256 tokenId) external view returns (
        uint256 bountyId, uint256 amount, address agent, uint64 expiresAt, address seller
    ) {
        bountyId = tokenBounty[tokenId];
        if (bountyId == 0) return (0, 0, address(0), 0, address(0));
        Bounty storage b = bounties[bountyId];
        if (b.claimed || b.cancelled) return (0, 0, address(0), 0, address(0));
        if (b.expiresAt != 0 && b.expiresAt < block.timestamp) return (0, 0, address(0), 0, address(0));
        return (bountyId, b.amount, b.agent, b.expiresAt, b.seller);
    }
}
