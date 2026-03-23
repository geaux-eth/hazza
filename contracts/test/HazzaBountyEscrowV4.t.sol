// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {HazzaBountyEscrowV4} from "../src/HazzaBountyEscrowV4.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Minimal mock ERC721 for testing
contract MockRegistry {
    mapping(uint256 => address) public owners;

    function ownerOf(uint256 tokenId) external view returns (address) {
        return owners[tokenId];
    }

    function setOwner(uint256 tokenId, address owner) external {
        owners[tokenId] = owner;
    }
}

// Malicious agent that tries reentrancy on withdrawPayout
contract ReentrantAgent {
    HazzaBountyEscrowV4 public escrow;
    bool public attacked;

    constructor(address _escrow) {
        escrow = HazzaBountyEscrowV4(payable(_escrow));
    }

    function withdraw() external {
        escrow.withdrawPayout();
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            try escrow.withdrawPayout() {} catch {}
        }
    }
}

contract HazzaBountyEscrowV4Test is Test {
    HazzaBountyEscrowV4 public escrow;
    MockRegistry public registry;

    address owner = address(0x1);
    address seller = address(0x2);
    address buyer = address(0x3);
    address agent1 = address(0x4);
    address agent2 = address(0x5);
    address agent3 = address(0x6);

    uint256 constant TOKEN_ID = 1;
    uint256 constant TOKEN_ID_2 = 2;
    uint256 constant BOUNTY = 0.01 ether;

    function setUp() public {
        registry = new MockRegistry();

        // Deploy implementation
        HazzaBountyEscrowV4 impl = new HazzaBountyEscrowV4();

        // Deploy proxy
        bytes memory initData = abi.encodeWithSelector(
            HazzaBountyEscrowV4.initialize.selector,
            address(registry),
            owner
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        escrow = HazzaBountyEscrowV4(payable(address(proxy)));

        // Setup: seller owns tokens
        registry.setOwner(TOKEN_ID, seller);
        registry.setOwner(TOKEN_ID_2, seller);

        // Fund accounts
        vm.deal(buyer, 10 ether);
        vm.deal(seller, 10 ether);
        vm.deal(agent1, 1 ether);
        vm.deal(agent2, 1 ether);
    }

    // =========================================================================
    //                         BOUNTY REGISTRATION (DEPOSIT MODEL)
    // =========================================================================

    function test_registerBounty_open() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        (address s, uint256 amt,, bool agentActive, bool assigned, bool active) = escrow.getBounty(TOKEN_ID);
        assertEq(s, seller);
        assertEq(amt, BOUNTY);
        assertFalse(agentActive);
        assertFalse(assigned);
        assertTrue(active);

        // Contract holds the deposited ETH
        assertEq(address(escrow).balance, BOUNTY);
    }

    function test_registerBounty_withAgent() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        (,, address agent, bool agentActive, bool assigned,) = escrow.getBounty(TOKEN_ID);
        assertEq(agent, agent1);
        assertTrue(agentActive);
        assertTrue(assigned);
        assertEq(address(escrow).balance, BOUNTY);
    }

    function test_registerBounty_revert_notSeller() public {
        vm.prank(buyer);
        vm.expectRevert(HazzaBountyEscrowV4.NotSeller.selector);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);
    }

    function test_registerBounty_revert_zeroValue() public {
        vm.prank(seller);
        vm.expectRevert(HazzaBountyEscrowV4.ZeroAmount.selector);
        escrow.registerBounty(TOKEN_ID);
    }

    function test_registerBounty_revert_duplicate() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        vm.prank(seller);
        vm.expectRevert(HazzaBountyEscrowV4.BountyAlreadyExists.selector);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);
    }

    function test_registerBounty_revert_sellerAsAgent() public {
        vm.prank(seller);
        vm.expectRevert(HazzaBountyEscrowV4.SellerCannotBeAgent.selector);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, seller);
    }

    // =========================================================================
    //                         AGENT MANAGEMENT
    // =========================================================================

    function test_assignAgent() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        vm.prank(seller);
        escrow.assignAgent(TOKEN_ID, agent1);

        (,, address agent,, bool assigned,) = escrow.getBounty(TOKEN_ID);
        assertEq(agent, agent1);
        assertTrue(assigned);
    }

    function test_assignAgent_switch() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        vm.prank(seller);
        escrow.assignAgent(TOKEN_ID, agent2);

        (,, address agent,,, ) = escrow.getBounty(TOKEN_ID);
        assertEq(agent, agent2);
    }

    function test_assignAgent_revert_notSeller() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        vm.prank(agent1);
        vm.expectRevert(HazzaBountyEscrowV4.NotSeller.selector);
        escrow.assignAgent(TOKEN_ID, agent2);
    }

    function test_assignAgent_revert_zeroAddress() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        vm.prank(seller);
        vm.expectRevert(HazzaBountyEscrowV4.ZeroAddress.selector);
        escrow.assignAgent(TOKEN_ID, address(0));
    }

    function test_removeAgent() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        vm.prank(seller);
        escrow.removeAgent(TOKEN_ID);

        (,, address agent, bool agentActive, bool assigned,) = escrow.getBounty(TOKEN_ID);
        assertEq(agent, address(0));
        assertFalse(agentActive);
        assertFalse(assigned);
    }

    function test_registerAgent_open() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        vm.prank(agent1);
        escrow.registerAgent(TOKEN_ID);

        (,, address agent, bool agentActive,,) = escrow.getBounty(TOKEN_ID);
        assertEq(agent, agent1);
        assertTrue(agentActive);
    }

    function test_registerAgent_revert_slotTaken() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        vm.prank(agent1);
        escrow.registerAgent(TOKEN_ID);

        vm.prank(agent2);
        vm.expectRevert(HazzaBountyEscrowV4.AgentSlotTaken.selector);
        escrow.registerAgent(TOKEN_ID);
    }

    function test_registerAgent_revert_sellerAssigned() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        vm.prank(agent2);
        vm.expectRevert(HazzaBountyEscrowV4.AgentSlotTaken.selector);
        escrow.registerAgent(TOKEN_ID);
    }

    function test_registerAgent_revert_sellerCannotBeAgent() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        vm.prank(seller);
        vm.expectRevert(HazzaBountyEscrowV4.SellerCannotBeAgent.selector);
        escrow.registerAgent(TOKEN_ID);
    }

    // =========================================================================
    //                         24-HOUR EXPIRY
    // =========================================================================

    function test_agentExpiry_after24h() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        vm.prank(agent1);
        escrow.registerAgent(TOKEN_ID);

        skip(24 hours + 1);

        assertFalse(escrow.isAgentActive(TOKEN_ID));

        // Another agent can now register
        vm.prank(agent2);
        escrow.registerAgent(TOKEN_ID);

        (,, address agent,,, ) = escrow.getBounty(TOKEN_ID);
        assertEq(agent, agent2);
    }

    function test_agentExpiry_noConsecutiveReregister() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        vm.prank(agent1);
        escrow.registerAgent(TOKEN_ID);

        skip(24 hours + 1);

        vm.prank(agent1);
        vm.expectRevert(HazzaBountyEscrowV4.CannotReregisterConsecutively.selector);
        escrow.registerAgent(TOKEN_ID);
    }

    function test_agentExpiry_canReregisterAfterOtherAgent() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        // agent1 registers, expires
        vm.prank(agent1);
        escrow.registerAgent(TOKEN_ID);
        skip(24 hours + 1);

        // agent2 registers, expires
        vm.prank(agent2);
        escrow.registerAgent(TOKEN_ID);
        skip(24 hours + 1);

        // agent1 can register again (not consecutive)
        vm.prank(agent1);
        escrow.registerAgent(TOKEN_ID);

        (,, address agent,,, ) = escrow.getBounty(TOKEN_ID);
        assertEq(agent, agent1);
    }

    function test_sellerAssigned_noExpiry() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        vm.warp(block.timestamp + 30 days);

        assertTrue(escrow.isAgentActive(TOKEN_ID));
    }

    // =========================================================================
    //                    CLAIM BOUNTY (AGENT CLAIMS AFTER SALE)
    // =========================================================================

    function test_claimBounty_afterSale() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        // Sale happens (any marketplace) — NFT transfers
        registry.setOwner(TOKEN_ID, buyer);

        vm.prank(agent1);
        escrow.claimBounty(TOKEN_ID);

        assertEq(escrow.pendingWithdrawals(agent1), BOUNTY);

        // Bounty deactivated
        (,,,,, bool active) = escrow.getBounty(TOKEN_ID);
        assertFalse(active);
    }

    function test_claimBounty_revert_notAgent() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        registry.setOwner(TOKEN_ID, buyer);

        vm.prank(agent2);
        vm.expectRevert(HazzaBountyEscrowV4.NotAgent.selector);
        escrow.claimBounty(TOKEN_ID);
    }

    function test_claimBounty_revert_nftNotTransferred() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        vm.prank(agent1);
        vm.expectRevert(HazzaBountyEscrowV4.NFTNotTransferred.selector);
        escrow.claimBounty(TOKEN_ID);
    }

    function test_claimBounty_revert_expiredAgent() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        vm.prank(agent1);
        escrow.registerAgent(TOKEN_ID);

        skip(24 hours + 1);

        registry.setOwner(TOKEN_ID, buyer);

        vm.prank(agent1);
        vm.expectRevert(HazzaBountyEscrowV4.AgentExpired.selector);
        escrow.claimBounty(TOKEN_ID);
    }

    function test_claimBounty_revert_doubleClaim() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        registry.setOwner(TOKEN_ID, buyer);

        vm.prank(agent1);
        escrow.claimBounty(TOKEN_ID);

        vm.prank(agent1);
        vm.expectRevert(HazzaBountyEscrowV4.NotActive.selector);
        escrow.claimBounty(TOKEN_ID);
    }

    // =========================================================================
    //                    WITHDRAW BOUNTY (SELLER RECLAIM)
    // =========================================================================

    function test_withdrawBounty_noAgent() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        // Direct sale (no agent registered)
        registry.setOwner(TOKEN_ID, buyer);

        vm.prank(seller);
        escrow.withdrawBounty(TOKEN_ID);

        assertEq(escrow.pendingWithdrawals(seller), BOUNTY);
    }

    function test_withdrawBounty_afterAgentExpires() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        vm.prank(agent1);
        escrow.registerAgent(TOKEN_ID);

        skip(24 hours + 1);

        // Sale happened, agent expired
        registry.setOwner(TOKEN_ID, buyer);

        vm.prank(seller);
        escrow.withdrawBounty(TOKEN_ID);

        assertEq(escrow.pendingWithdrawals(seller), BOUNTY);
    }

    function test_withdrawBounty_revert_agentStillActive() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        registry.setOwner(TOKEN_ID, buyer);

        // Seller can't withdraw when agent is active
        vm.prank(seller);
        vm.expectRevert(HazzaBountyEscrowV4.AgentStillActive.selector);
        escrow.withdrawBounty(TOKEN_ID);
    }

    function test_withdrawBounty_revert_sellerAssignedAgentStillActive() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        registry.setOwner(TOKEN_ID, buyer);

        // Seller-assigned agent never expires — seller must removeAgent first
        skip(30 days);

        vm.prank(seller);
        vm.expectRevert(HazzaBountyEscrowV4.AgentStillActive.selector);
        escrow.withdrawBounty(TOKEN_ID);

        // Fix: remove agent, then withdraw
        vm.prank(seller);
        escrow.removeAgent(TOKEN_ID);

        vm.prank(seller);
        escrow.withdrawBounty(TOKEN_ID);

        assertEq(escrow.pendingWithdrawals(seller), BOUNTY);
    }

    function test_withdrawBounty_revert_nftNotTransferred() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        // NFT hasn't been sold
        vm.prank(seller);
        vm.expectRevert(HazzaBountyEscrowV4.NFTNotTransferred.selector);
        escrow.withdrawBounty(TOKEN_ID);
    }

    // =========================================================================
    //                    CANCEL BOUNTY (REFUND DEPOSIT)
    // =========================================================================

    function test_cancelBounty_refunds() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        vm.prank(seller);
        escrow.cancelBounty(TOKEN_ID);

        (,,,,, bool active) = escrow.getBounty(TOKEN_ID);
        assertFalse(active);

        // Seller has pending refund
        assertEq(escrow.pendingWithdrawals(seller), BOUNTY);

        // Withdraw the refund
        uint256 sellerBalBefore = seller.balance;
        vm.prank(seller);
        escrow.withdrawPayout();
        assertEq(seller.balance, sellerBalBefore + BOUNTY);
    }

    function test_cancelBounty_revert_notSeller() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        vm.prank(agent1);
        vm.expectRevert(HazzaBountyEscrowV4.NotSeller.selector);
        escrow.cancelBounty(TOKEN_ID);
    }

    // =========================================================================
    //                         WITHDRAWALS (PULL PATTERN)
    // =========================================================================

    function test_withdrawPayout() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        registry.setOwner(TOKEN_ID, buyer);

        vm.prank(agent1);
        escrow.claimBounty(TOKEN_ID);

        uint256 balBefore = agent1.balance;

        vm.prank(agent1);
        escrow.withdrawPayout();

        assertEq(agent1.balance, balBefore + BOUNTY);
        assertEq(escrow.pendingWithdrawals(agent1), 0);
    }

    function test_withdrawPayout_revert_nothing() public {
        vm.prank(agent1);
        vm.expectRevert(HazzaBountyEscrowV4.NothingToWithdraw.selector);
        escrow.withdrawPayout();
    }

    // =========================================================================
    //                    PER-BOUNTY ACCOUNTING (CRITICAL AUDIT FIX)
    // =========================================================================

    function test_crossBounty_isolation() public {
        // Bounty 1: seller deposits 0.01 ETH
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        // Bounty 2: seller deposits 0.01 ETH
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID_2, agent2);

        // Contract holds both deposits
        assertEq(address(escrow).balance, BOUNTY * 2);

        // Sale of token 1 — agent1 claims
        registry.setOwner(TOKEN_ID, buyer);
        vm.prank(agent1);
        escrow.claimBounty(TOKEN_ID);

        // Sale of token 2 — agent2 claims
        registry.setOwner(TOKEN_ID_2, buyer);
        vm.prank(agent2);
        escrow.claimBounty(TOKEN_ID_2);

        // Both agents have pending withdrawals
        assertEq(escrow.pendingWithdrawals(agent1), BOUNTY);
        assertEq(escrow.pendingWithdrawals(agent2), BOUNTY);

        // Both can withdraw
        vm.prank(agent1);
        escrow.withdrawPayout();
        vm.prank(agent2);
        escrow.withdrawPayout();

        assertEq(address(escrow).balance, 0);
    }

    function test_noCrossBountyTheft() public {
        // Only one bounty deposited
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        // Agent claims
        registry.setOwner(TOKEN_ID, buyer);
        vm.prank(agent1);
        escrow.claimBounty(TOKEN_ID);

        // Agent withdraws — contract has exactly BOUNTY deposited
        vm.prank(agent1);
        escrow.withdrawPayout();

        // Contract is empty — no extra ETH
        assertEq(address(escrow).balance, 0);
    }

    // =========================================================================
    //                    SELLER vs AGENT RACE CONDITION (AUDIT FIX)
    // =========================================================================

    function test_sellerCannotWithdrawWhileAgentActive() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        registry.setOwner(TOKEN_ID, buyer);

        // Seller tries to front-run agent
        vm.prank(seller);
        vm.expectRevert(HazzaBountyEscrowV4.AgentStillActive.selector);
        escrow.withdrawBounty(TOKEN_ID);

        // Agent can still claim
        vm.prank(agent1);
        escrow.claimBounty(TOKEN_ID);
        assertEq(escrow.pendingWithdrawals(agent1), BOUNTY);
    }

    // =========================================================================
    //                         SELLER CONTROLS
    // =========================================================================

    function test_sellerKickAndReassign() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        vm.prank(seller);
        escrow.removeAgent(TOKEN_ID);

        vm.prank(seller);
        escrow.assignAgent(TOKEN_ID, agent2);

        (,, address agent,,, ) = escrow.getBounty(TOKEN_ID);
        assertEq(agent, agent2);
    }

    function test_sellerKickOpensToPublic() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        vm.prank(seller);
        escrow.removeAgent(TOKEN_ID);

        vm.prank(agent2);
        escrow.registerAgent(TOKEN_ID);

        (,, address agent,,, ) = escrow.getBounty(TOKEN_ID);
        assertEq(agent, agent2);
    }

    // =========================================================================
    //                         PAUSABILITY
    // =========================================================================

    function test_pause_blocksOperations() public {
        vm.prank(owner);
        escrow.pause();

        vm.prank(seller);
        vm.expectRevert();
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);
    }

    function test_unpause_restoresOperations() public {
        vm.prank(owner);
        escrow.pause();

        vm.prank(owner);
        escrow.unpause();

        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);
    }

    // =========================================================================
    //                       REENTRANCY PROTECTION
    // =========================================================================

    function test_reentrancy_withdrawPayout() public {
        // Deploy reentrant agent and register bounty with it
        ReentrantAgent malicious = new ReentrantAgent(address(escrow));

        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, address(malicious));

        registry.setOwner(TOKEN_ID, buyer);

        vm.prank(address(malicious));
        escrow.claimBounty(TOKEN_ID);

        // The reentrancy attack should fail — second call reverts
        malicious.withdraw();

        // Should only get BOUNTY once, not twice
        assertEq(address(malicious).balance, BOUNTY);
        assertEq(escrow.pendingWithdrawals(address(malicious)), 0);
    }

    // =========================================================================
    //                         UPGRADE PROTECTION
    // =========================================================================

    function test_upgrade_onlyOwner() public {
        HazzaBountyEscrowV4 newImpl = new HazzaBountyEscrowV4();

        vm.prank(seller);
        vm.expectRevert();
        escrow.upgradeToAndCall(address(newImpl), "");

        // Owner can upgrade
        vm.prank(owner);
        escrow.upgradeToAndCall(address(newImpl), "");
    }

    function test_upgrade_preservesState() public {
        // Register bounty with deposit
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID, agent1);

        // Upgrade
        HazzaBountyEscrowV4 newImpl = new HazzaBountyEscrowV4();
        vm.prank(owner);
        escrow.upgradeToAndCall(address(newImpl), "");

        // State should be preserved
        (address s, uint256 amt, address agent,, bool assigned, bool active) = escrow.getBounty(TOKEN_ID);
        assertEq(s, seller);
        assertEq(amt, BOUNTY);
        assertEq(agent, agent1);
        assertTrue(assigned);
        assertTrue(active);

        // Balance preserved
        assertEq(address(escrow).balance, BOUNTY);
    }

    // =========================================================================
    //                         OWNER FUNCTIONS
    // =========================================================================

    function test_setRegistry_emitsEvent() public {
        address newRegistry = address(0x99);

        vm.prank(owner);
        escrow.setRegistry(newRegistry);

        assertEq(address(escrow.registry()), newRegistry);
    }

    function test_setRegistry_revert_zeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(HazzaBountyEscrowV4.ZeroAddress.selector);
        escrow.setRegistry(address(0));
    }

    function test_initialize_revert_zeroAddress() public {
        HazzaBountyEscrowV4 impl = new HazzaBountyEscrowV4();

        // Zero registry
        vm.expectRevert(HazzaBountyEscrowV4.ZeroAddress.selector);
        new ERC1967Proxy(address(impl), abi.encodeWithSelector(
            HazzaBountyEscrowV4.initialize.selector, address(0), owner
        ));

        // Zero owner
        vm.expectRevert(HazzaBountyEscrowV4.ZeroAddress.selector);
        new ERC1967Proxy(address(impl), abi.encodeWithSelector(
            HazzaBountyEscrowV4.initialize.selector, address(registry), address(0)
        ));
    }

    // =========================================================================
    //                         EDGE CASES
    // =========================================================================

    function test_registerBounty_afterCancellation() public {
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        vm.prank(seller);
        escrow.cancelBounty(TOKEN_ID);

        // Can register new bounty after cancellation
        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY * 2}(TOKEN_ID);

        (, uint256 amt,,,, bool active) = escrow.getBounty(TOKEN_ID);
        assertEq(amt, BOUNTY * 2);
        assertTrue(active);
    }

    function test_claimBounty_thenWithdrawPayout_fullCycle() public {
        // Full happy path: deposit → sale → claim → withdraw
        vm.prank(seller);
        escrow.registerBounty{value: 0.05 ether}(TOKEN_ID, agent1);

        assertEq(address(escrow).balance, 0.05 ether);

        registry.setOwner(TOKEN_ID, buyer);

        vm.prank(agent1);
        escrow.claimBounty(TOKEN_ID);

        uint256 agentBalBefore = agent1.balance;
        vm.prank(agent1);
        escrow.withdrawPayout();

        assertEq(agent1.balance, agentBalBefore + 0.05 ether);
        assertEq(address(escrow).balance, 0);
    }

    function test_cancelBounty_thenReregister_differentAmount() public {
        vm.prank(seller);
        escrow.registerBounty{value: 0.01 ether}(TOKEN_ID);

        vm.prank(seller);
        escrow.cancelBounty(TOKEN_ID);

        // Re-register with higher amount
        vm.prank(seller);
        escrow.registerBounty{value: 0.05 ether}(TOKEN_ID, agent1);

        (, uint256 amt,,,, ) = escrow.getBounty(TOKEN_ID);
        assertEq(amt, 0.05 ether);

        // Contract holds both: cancelled pending + new deposit
        assertEq(address(escrow).balance, 0.01 ether + 0.05 ether);
    }

    // =========================================================================
    //                         FUZZ TESTS
    // =========================================================================

    function testFuzz_registerBounty_anyAmount(uint256 amount) public {
        vm.assume(amount > 0 && amount < 1000 ether);
        vm.deal(seller, amount);
        vm.prank(seller);
        escrow.registerBounty{value: amount}(TOKEN_ID);

        (, uint256 stored,,,,) = escrow.getBounty(TOKEN_ID);
        assertEq(stored, amount);
        assertEq(address(escrow).balance, amount);
    }

    function testFuzz_agentExpiry_timing(uint256 elapsed) public {
        vm.assume(elapsed < 365 days);

        vm.prank(seller);
        escrow.registerBounty{value: BOUNTY}(TOKEN_ID);

        vm.prank(agent1);
        escrow.registerAgent(TOKEN_ID);

        vm.warp(block.timestamp + elapsed);

        bool active = escrow.isAgentActive(TOKEN_ID);
        if (elapsed < 24 hours) {
            assertTrue(active);
        } else {
            assertFalse(active);
        }
    }

    function testFuzz_depositAndClaim(uint256 amount) public {
        vm.assume(amount > 0 && amount < 100 ether);
        vm.deal(seller, amount);

        vm.prank(seller);
        escrow.registerBounty{value: amount}(TOKEN_ID, agent1);

        registry.setOwner(TOKEN_ID, buyer);

        vm.prank(agent1);
        escrow.claimBounty(TOKEN_ID);

        assertEq(escrow.pendingWithdrawals(agent1), amount);

        vm.prank(agent1);
        escrow.withdrawPayout();

        assertEq(address(escrow).balance, 0);
    }
}
