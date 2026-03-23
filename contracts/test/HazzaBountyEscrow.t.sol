// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/HazzaBountyEscrow.sol";

/// @dev Minimal ERC-721 mock for testing
contract MockNFT {
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    function mint(address to, uint256 tokenId) external {
        ownerOf[tokenId] = to;
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        require(ownerOf[tokenId] == from, "not owner");
        ownerOf[tokenId] = to;
    }

    function approve(address to, uint256 tokenId) external {
        getApproved[tokenId] = to;
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
    }
}

contract HazzaBountyEscrowTest is Test {
    HazzaBountyEscrow public escrow;
    MockNFT public nft;

    address seller = address(0x1);
    address buyer = address(0x2);
    address agent = address(0x3);
    address agent2 = address(0x4);
    address randomAgent = address(0x5);

    uint256 tokenId = 42;
    uint256 bountyAmount = 0.01 ether;
    uint256 salePrice = 0.1 ether;

    function setUp() public {
        nft = new MockNFT();
        escrow = new HazzaBountyEscrow(address(nft));

        // Mint NFT to seller
        nft.mint(seller, tokenId);

        // Fund accounts
        vm.deal(seller, 1 ether);
        vm.deal(buyer, 1 ether);
        vm.deal(agent, 1 ether);
        vm.deal(agent2, 1 ether);
        vm.deal(randomAgent, 1 ether);
    }

    // ─── Registration ───

    function test_registerBounty_open() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        (address s, uint256 amt, address a, bool claimed, bool active) = escrow.getBounty(tokenId);
        assertEq(s, seller);
        assertEq(amt, bountyAmount);
        assertEq(a, address(0));
        assertFalse(claimed);
        assertTrue(active);
    }

    function test_registerBounty_withApprovedAgent() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount, agent);

        (address s, uint256 amt, , , bool active) = escrow.getBounty(tokenId);
        assertEq(s, seller);
        assertEq(amt, bountyAmount);
        assertTrue(active);
    }

    function test_registerBounty_revert_notOwner() public {
        vm.prank(buyer);
        vm.expectRevert(HazzaBountyEscrow.NotSeller.selector);
        escrow.registerBounty(tokenId, bountyAmount);
    }

    function test_registerBounty_revert_zeroAmount() public {
        vm.prank(seller);
        vm.expectRevert(HazzaBountyEscrow.ZeroAmount.selector);
        escrow.registerBounty(tokenId, 0);
    }

    function test_registerBounty_revert_alreadyExists() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.prank(seller);
        vm.expectRevert(HazzaBountyEscrow.BountyAlreadyExists.selector);
        escrow.registerBounty(tokenId, bountyAmount);
    }

    function test_registerBounty_canReregisterAfterClaim() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.prank(agent);
        escrow.registerAgent(tokenId);

        vm.deal(address(escrow), bountyAmount);
        vm.prank(seller);
        nft.transferFrom(seller, buyer, tokenId);

        vm.prank(agent);
        escrow.claimBounty(tokenId);

        vm.prank(buyer);
        nft.transferFrom(buyer, seller, tokenId);

        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);
    }

    // ─── Agent Registration — Open Bounties (ANY agent can register) ───

    function test_registerAgent_anyoneCanRegister() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount); // open bounty

        // Random address registers — no whitelist needed
        vm.prank(randomAgent);
        escrow.registerAgent(tokenId);

        (, , address a, , ) = escrow.getBounty(tokenId);
        assertEq(a, randomAgent);
    }

    function test_registerAgent_firstComeFirstServed() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount); // open bounty

        // First agent registers
        vm.prank(agent);
        escrow.registerAgent(tokenId);

        // Second agent tries — blocked
        vm.prank(agent2);
        vm.expectRevert(HazzaBountyEscrow.AgentAlreadyRegistered.selector);
        escrow.registerAgent(tokenId);

        // First agent still holds the slot
        (, , address a, , ) = escrow.getBounty(tokenId);
        assertEq(a, agent);
    }

    function test_registerAgent_approvedAgent() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount, agent);

        vm.prank(agent);
        escrow.registerAgent(tokenId);

        (, , address a, , ) = escrow.getBounty(tokenId);
        assertEq(a, agent);
    }

    function test_registerAgent_revert_wrongApprovedAgent() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount, agent); // agent-specific bounty

        vm.prank(randomAgent);
        vm.expectRevert(HazzaBountyEscrow.NotApprovedAgent.selector);
        escrow.registerAgent(tokenId);
    }

    function test_registerAgent_revert_notActive() public {
        vm.prank(agent);
        vm.expectRevert(HazzaBountyEscrow.NotActive.selector);
        escrow.registerAgent(tokenId);
    }

    function test_registerAgent_revert_sellerCantBeAgent() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.prank(seller);
        vm.expectRevert(HazzaBountyEscrow.NotSeller.selector);
        escrow.registerAgent(tokenId);
    }

    // ─── Claim Bounty ───

    function test_claimBounty() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.prank(agent);
        escrow.registerAgent(tokenId);

        vm.deal(address(escrow), bountyAmount);
        vm.prank(seller);
        nft.transferFrom(seller, buyer, tokenId);

        uint256 agentBalBefore = agent.balance;

        vm.prank(agent);
        escrow.claimBounty(tokenId);

        assertEq(agent.balance, agentBalBefore + bountyAmount);

        (, , , bool claimed, bool active) = escrow.getBounty(tokenId);
        assertTrue(claimed);
        assertFalse(active);
    }

    function test_claimBounty_revert_notAgent() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.prank(agent);
        escrow.registerAgent(tokenId);

        vm.deal(address(escrow), bountyAmount);
        vm.prank(seller);
        nft.transferFrom(seller, buyer, tokenId);

        vm.prank(buyer);
        vm.expectRevert(HazzaBountyEscrow.NotAgent.selector);
        escrow.claimBounty(tokenId);
    }

    function test_claimBounty_revert_nftNotTransferred() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.prank(agent);
        escrow.registerAgent(tokenId);

        vm.deal(address(escrow), bountyAmount);

        vm.prank(agent);
        vm.expectRevert(HazzaBountyEscrow.NFTNotTransferred.selector);
        escrow.claimBounty(tokenId);
    }

    function test_claimBounty_revert_alreadyClaimed() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.prank(agent);
        escrow.registerAgent(tokenId);

        vm.deal(address(escrow), bountyAmount);
        vm.prank(seller);
        nft.transferFrom(seller, buyer, tokenId);

        vm.prank(agent);
        escrow.claimBounty(tokenId);

        vm.prank(agent);
        vm.expectRevert(HazzaBountyEscrow.NotActive.selector);
        escrow.claimBounty(tokenId);
    }

    function test_claimBounty_revert_noBalance() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.prank(agent);
        escrow.registerAgent(tokenId);

        vm.prank(seller);
        nft.transferFrom(seller, buyer, tokenId);

        vm.prank(agent);
        vm.expectRevert(HazzaBountyEscrow.NoBountyBalance.selector);
        escrow.claimBounty(tokenId);
    }

    // ─── Withdraw Bounty ───

    function test_withdrawBounty_noAgent() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.deal(address(escrow), bountyAmount);
        vm.prank(seller);
        nft.transferFrom(seller, buyer, tokenId);

        uint256 sellerBalBefore = seller.balance;

        vm.prank(seller);
        escrow.withdrawBounty(tokenId);

        assertEq(seller.balance, sellerBalBefore + bountyAmount);
    }

    function test_withdrawBounty_agentRegisteredButDidntClaim() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.prank(agent);
        escrow.registerAgent(tokenId);

        vm.deal(address(escrow), bountyAmount);
        vm.prank(seller);
        nft.transferFrom(seller, buyer, tokenId);

        vm.prank(seller);
        escrow.withdrawBounty(tokenId);

        vm.prank(agent);
        vm.expectRevert(HazzaBountyEscrow.NotActive.selector);
        escrow.claimBounty(tokenId);
    }

    function test_withdrawBounty_revert_nftNotTransferred() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.deal(address(escrow), bountyAmount);

        vm.prank(seller);
        vm.expectRevert(HazzaBountyEscrow.NFTNotTransferred.selector);
        escrow.withdrawBounty(tokenId);
    }

    function test_withdrawBounty_revert_notSeller() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.deal(address(escrow), bountyAmount);
        vm.prank(seller);
        nft.transferFrom(seller, buyer, tokenId);

        vm.prank(buyer);
        vm.expectRevert(HazzaBountyEscrow.NotSeller.selector);
        escrow.withdrawBounty(tokenId);
    }

    // ─── Cancel Bounty ───

    function test_cancelBounty() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.prank(seller);
        escrow.cancelBounty(tokenId);

        (, , , , bool active) = escrow.getBounty(tokenId);
        assertFalse(active);
    }

    function test_cancelBounty_returnsEthIfPresent() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.deal(address(escrow), bountyAmount);

        uint256 sellerBalBefore = seller.balance;

        vm.prank(seller);
        escrow.cancelBounty(tokenId);

        assertEq(seller.balance, sellerBalBefore + bountyAmount);
    }

    function test_cancelBounty_revert_notSeller() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.prank(agent);
        vm.expectRevert(HazzaBountyEscrow.NotSeller.selector);
        escrow.cancelBounty(tokenId);
    }

    // ─── Receive ETH ───

    function test_receiveEth() public {
        vm.deal(address(this), 1 ether);
        (bool ok, ) = address(escrow).call{value: 0.5 ether}("");
        assertTrue(ok);
        assertEq(address(escrow).balance, 0.5 ether);
    }

    // ─── Full Flow: Any agent earns bounty ───

    function test_fullFlow_anyAgent() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        // Random agent registers — no whitelist, no approval needed
        vm.prank(randomAgent);
        escrow.registerAgent(tokenId);

        vm.deal(address(escrow), bountyAmount);
        vm.prank(seller);
        nft.transferFrom(seller, buyer, tokenId);

        uint256 agentBalBefore = randomAgent.balance;
        vm.prank(randomAgent);
        escrow.claimBounty(tokenId);

        assertEq(randomAgent.balance, agentBalBefore + bountyAmount);
        assertEq(nft.ownerOf(tokenId), buyer);
    }

    // ─── Full Flow: Approved agent ───

    function test_fullFlow_approvedAgent() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount, agent);

        vm.prank(agent);
        escrow.registerAgent(tokenId);

        vm.deal(address(escrow), bountyAmount);
        vm.prank(seller);
        nft.transferFrom(seller, buyer, tokenId);

        uint256 agentBalBefore = agent.balance;
        vm.prank(agent);
        escrow.claimBounty(tokenId);

        assertEq(agent.balance, agentBalBefore + bountyAmount);
    }

    // ─── Full Flow: Direct sale, seller reclaims ───

    function test_fullFlow_directSale_sellerReclaims() public {
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount);

        vm.deal(address(escrow), bountyAmount);
        vm.prank(seller);
        nft.transferFrom(seller, buyer, tokenId);

        uint256 sellerBalBefore = seller.balance;
        vm.prank(seller);
        escrow.withdrawBounty(tokenId);

        assertEq(seller.balance, sellerBalBefore + bountyAmount);
    }

    // ─── Approved agent blocks others ───

    function test_approvedAgent_blocksOthers() public {
        // Seller specifies exact agent
        vm.prank(seller);
        escrow.registerBounty(tokenId, bountyAmount, agent);

        // Random agent can't register — even though open bounties allow anyone
        vm.prank(randomAgent);
        vm.expectRevert(HazzaBountyEscrow.NotApprovedAgent.selector);
        escrow.registerAgent(tokenId);

        // Only the approved agent can register
        vm.prank(agent);
        escrow.registerAgent(tokenId);
    }

    // ─── Ownership ───

    function test_transferOwnership() public {
        escrow.transferOwnership(seller);
        assertEq(escrow.owner(), seller);
    }

    function test_transferOwnership_revert_notOwner() public {
        vm.prank(randomAgent);
        vm.expectRevert(HazzaBountyEscrow.NotOwner.selector);
        escrow.transferOwnership(randomAgent);
    }
}
