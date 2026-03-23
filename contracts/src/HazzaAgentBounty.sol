// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "forge-std/interfaces/IERC721.sol";

/// @title HazzaAgentBounty
/// @notice ERC-8183 compatible marketplace with automatic agent bounty payment
/// @dev Sellers list names with a price and optional agent bounty. When a buyer purchases,
///      the contract splits payment atomically: seller gets (price - bounty), agent gets bounty.
///      No escrow required — bounty comes from sale proceeds.
///
/// ERC-8183 Roles:
///   Client   = Seller (lists name with bounty)
///   Provider = Agent (registers to facilitate sale, earns bounty)
///   Evaluator = This contract (handles sale, verifies transfer, splits payment)
contract HazzaAgentBounty {

    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 price;           // Total price buyer pays (in ETH)
        uint256 bountyAmount;    // Portion of price that goes to agent
        address agent;           // Agent who registered (0x0 = no agent yet)
        uint64 expiresAt;        // Listing expiration (0 = no expiry)
        bool active;
    }

    IERC721 public immutable registry;
    address public owner;

    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => uint256) public tokenListing; // tokenId => active listingId (0 = none)

    event Listed(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId, uint256 price, uint256 bountyAmount, uint64 expiresAt);
    event AgentRegistered(uint256 indexed listingId, address indexed agent, uint256 indexed tokenId);
    event Sale(uint256 indexed listingId, address indexed buyer, uint256 indexed tokenId, address seller, address agent, uint256 sellerProceeds, uint256 agentBounty);
    event Cancelled(uint256 indexed listingId, address indexed seller);

    error NotSeller();
    error NotActive();
    error ListingExpired();
    error AlreadyListed();
    error BountyExceedsPrice();
    error WrongPrice();
    error NFTNotApproved();
    error TransferFailed();

    constructor(address _registry) {
        registry = IERC721(_registry);
        owner = msg.sender;
        nextListingId = 1;
    }

    /// @notice List a name for sale with optional agent bounty
    /// @param tokenId The hazza name tokenId
    /// @param price Total price in ETH the buyer pays
    /// @param bountyAmount Portion of price allocated to agent (0 = no bounty)
    /// @param expiresAt Listing expiration timestamp (0 = no expiry)
    function list(uint256 tokenId, uint256 price, uint256 bountyAmount, uint64 expiresAt) external {
        if (registry.ownerOf(tokenId) != msg.sender) revert NotSeller();
        if (bountyAmount >= price) revert BountyExceedsPrice();
        if (!registry.isApprovedForAll(msg.sender, address(this)) &&
            registry.getApproved(tokenId) != address(this)) revert NFTNotApproved();

        // Cancel any existing active listing for this token
        uint256 existingId = tokenListing[tokenId];
        if (existingId != 0 && listings[existingId].active) {
            listings[existingId].active = false;
        }

        uint256 listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            tokenId: tokenId,
            price: price,
            bountyAmount: bountyAmount,
            agent: address(0),
            expiresAt: expiresAt,
            active: true
        });
        tokenListing[tokenId] = listingId;

        emit Listed(listingId, msg.sender, tokenId, price, bountyAmount, expiresAt);
    }

    /// @notice Agent registers to facilitate a sale (earn the bounty)
    /// @param listingId The listing to register for
    function registerAgent(uint256 listingId) external {
        Listing storage l = listings[listingId];
        if (!l.active) revert NotActive();
        if (l.expiresAt != 0 && l.expiresAt < block.timestamp) revert ListingExpired();
        if (l.bountyAmount == 0) revert BountyExceedsPrice(); // no bounty to earn
        if (l.seller == msg.sender) revert NotSeller(); // seller can't be their own agent

        l.agent = msg.sender;
        emit AgentRegistered(listingId, msg.sender, l.tokenId);
    }

    /// @notice Purchase a listed name — payment splits automatically
    /// @param listingId The listing to purchase
    function buy(uint256 listingId) external payable {
        Listing storage l = listings[listingId];
        if (!l.active) revert NotActive();
        if (l.expiresAt != 0 && l.expiresAt < block.timestamp) revert ListingExpired();
        if (msg.value != l.price) revert WrongPrice();

        l.active = false;
        tokenListing[l.tokenId] = 0;

        // Transfer NFT to buyer
        registry.transferFrom(l.seller, msg.sender, l.tokenId);

        // Split payment
        uint256 agentPayout = 0;
        if (l.agent != address(0) && l.bountyAmount > 0) {
            agentPayout = l.bountyAmount;
            (bool agentOk,) = payable(l.agent).call{value: agentPayout}("");
            if (!agentOk) revert TransferFailed();
        }

        uint256 sellerPayout = msg.value - agentPayout;
        (bool sellerOk,) = payable(l.seller).call{value: sellerPayout}("");
        if (!sellerOk) revert TransferFailed();

        emit Sale(listingId, msg.sender, l.tokenId, l.seller, l.agent, sellerPayout, agentPayout);
    }

    /// @notice Cancel a listing
    /// @param listingId The listing to cancel
    function cancel(uint256 listingId) external {
        Listing storage l = listings[listingId];
        if (l.seller != msg.sender) revert NotSeller();
        if (!l.active) revert NotActive();

        l.active = false;
        tokenListing[l.tokenId] = 0;

        emit Cancelled(listingId, msg.sender);
    }

    /// @notice Update price and/or bounty on an active listing
    /// @param listingId The listing to update
    /// @param newPrice New total price
    /// @param newBountyAmount New bounty amount
    function updateListing(uint256 listingId, uint256 newPrice, uint256 newBountyAmount) external {
        Listing storage l = listings[listingId];
        if (l.seller != msg.sender) revert NotSeller();
        if (!l.active) revert NotActive();
        if (newBountyAmount >= newPrice) revert BountyExceedsPrice();

        l.price = newPrice;
        l.bountyAmount = newBountyAmount;
    }

    /// @notice Get active listing for a token
    function getActiveListing(uint256 tokenId) external view returns (
        uint256 listingId, address seller, uint256 price, uint256 bountyAmount,
        address agent, uint64 expiresAt
    ) {
        listingId = tokenListing[tokenId];
        if (listingId == 0) return (0, address(0), 0, 0, address(0), 0);
        Listing storage l = listings[listingId];
        if (!l.active) return (0, address(0), 0, 0, address(0), 0);
        if (l.expiresAt != 0 && l.expiresAt < block.timestamp) return (0, address(0), 0, 0, address(0), 0);
        return (listingId, l.seller, l.price, l.bountyAmount, l.agent, l.expiresAt);
    }

    /// @notice Get listing details by ID
    function getListing(uint256 listingId) external view returns (
        address seller, uint256 tokenId, uint256 price, uint256 bountyAmount,
        address agent, uint64 expiresAt, bool active
    ) {
        Listing storage l = listings[listingId];
        return (l.seller, l.tokenId, l.price, l.bountyAmount, l.agent, l.expiresAt, l.active);
    }
}
