// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/HazzaRegistry.sol";

contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockAgentRegistry {
    uint256 private _nextId = 1;
    mapping(uint256 => address) public ownerOf;

    function register(string calldata) external returns (uint256) {
        uint256 id = _nextId++;
        ownerOf[id] = msg.sender;
        return id;
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        require(ownerOf[tokenId] == from, "not owner");
        ownerOf[tokenId] = to;
    }
}

contract MockMembership {
    mapping(address => uint256) private _balances;

    function setMember(address who, bool isMember) external {
        _balances[who] = isMember ? 1 : 0;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }
}

contract HazzaRegistryTest is Test {
    HazzaRegistry public registry;
    MockUSDC public usdc;
    MockAgentRegistry public agentReg;
    MockMembership public membership;
    MockMembership public unlimitedPass;

    address public deployer = address(this);
    address public treasury = address(0xBEEF);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public cheryl = address(0xC4E1);

    function setUp() public {
        usdc = new MockUSDC();
        agentReg = new MockAgentRegistry();
        membership = new MockMembership();
        unlimitedPass = new MockMembership();

        registry = new HazzaRegistry(
            address(usdc),
            address(agentReg),
            treasury,
            address(membership),
            address(unlimitedPass)
        );

        // Fund everyone
        usdc.mint(deployer, 100000e6);
        usdc.mint(alice, 100000e6);
        usdc.mint(bob, 100000e6);
        usdc.mint(cheryl, 100000e6);

        // Approve
        usdc.approve(address(registry), type(uint256).max);
        vm.prank(alice); usdc.approve(address(registry), type(uint256).max);
        vm.prank(bob); usdc.approve(address(registry), type(uint256).max);
        vm.prank(cheryl); usdc.approve(address(registry), type(uint256).max);

        // Set Cheryl as relayer with 25% commission
        registry.setRelayer(cheryl, true, 2500);
    }

    // =========================================================================
    //  Helper: register a name via owner (skips commit-reveal)
    // =========================================================================

    function _register(string memory name, address to) internal {
        registry.registerDirect(name, to, 1, 0, false, address(0), "", false, false);
    }

    function _registerWithAgent(string memory name, address to) internal {
        registry.registerDirect(name, to, 1, 0, true, to, "https://example.com/agent.json", false, false);
    }

    /// @dev Commit and warp past MIN_COMMIT_AGE, returns salt for register() call
    function _commitAndWarp(string memory name, address to) internal returns (bytes32 salt) {
        salt = bytes32(uint256(uint160(to)));
        bytes32 commitHash = keccak256(abi.encodePacked(name, to, salt));
        vm.prank(to);
        registry.commit(commitHash);
        vm.warp(block.timestamp + 61);
    }

    // =========================================================================
    //                       BASIC REGISTRATION
    // =========================================================================

    function test_registerDirect() public {
        _register("hello", alice);
        assertFalse(registry.available("hello"));
        (address resolvedOwner, uint256 tokenId,,,,,) = registry.resolve("hello");
        assertEq(resolvedOwner, alice);
        assertEq(tokenId, 1);
    }

    function test_commitReveal() public {
        string memory name = "alice";
        bytes32 salt = bytes32(uint256(123));
        bytes32 commitHash = keccak256(abi.encodePacked(name, alice, salt));

        vm.prank(alice);
        registry.commit(commitHash);
        vm.warp(block.timestamp + 61);

        vm.prank(alice);
        registry.register(name, alice, salt, 1, false, address(0), "");

        assertFalse(registry.available(name));
    }

    function test_commitTooNew() public {
        bytes32 commitHash = keccak256(abi.encodePacked("alice", alice, bytes32(uint256(1))));
        vm.prank(alice);
        registry.commit(commitHash);

        vm.prank(alice);
        vm.expectRevert(HazzaRegistry.CommitmentTooNew.selector);
        registry.register("alice", alice, bytes32(uint256(1)), 1, false, address(0), "");
    }

    function test_commitTooOld() public {
        bytes32 commitHash = keccak256(abi.encodePacked("alice", alice, bytes32(uint256(1))));
        vm.prank(alice);
        registry.commit(commitHash);
        vm.warp(block.timestamp + 86401);

        vm.prank(alice);
        vm.expectRevert(HazzaRegistry.CommitmentTooOld.selector);
        registry.register("alice", alice, bytes32(uint256(1)), 1, false, address(0), "");
    }

    function test_cannotRegisterTaken() public {
        _register("taken", alice);
        vm.expectRevert(HazzaRegistry.NameNotAvailable.selector);
        _register("taken", bob);
    }

    function test_multiYearRegistration() public {
        registry.registerDirect("multiyear", alice, 5, 0, false, address(0), "", false, false);
        (,,, uint64 expiresAt,,,) = registry.resolve("multiyear");
        assertEq(expiresAt, uint64(block.timestamp + 5 * 365 days));
    }

    // =========================================================================
    //                            PRICING
    // =========================================================================

    function test_price3Char() public view {
        assertEq(registry.price("abc", 0), 100e6);
    }

    function test_price4Char() public view {
        assertEq(registry.price("abcd", 0), 25e6);
    }

    function test_price5Plus() public view {
        assertEq(registry.price("abcde", 0), 5e6);
    }

    function test_paymentIncludesRenewal() public {
        uint256 before = usdc.balanceOf(treasury);
        _register("hello", alice); // 5 chars = $5 + $2 renewal = $7
        assertEq(usdc.balanceOf(treasury) - before, 7e6);
    }

    function test_multiYearPayment() public {
        uint256 before = usdc.balanceOf(treasury);
        registry.registerDirect("hello", alice, 3, 0, false, address(0), "", false, false); // $5 + $6 renewal
        assertEq(usdc.balanceOf(treasury) - before, 11e6);
    }

    function test_quoteName() public view {
        (uint256 total, uint256 regFee, uint256 renewFee) = registry.quoteName("hello", alice, 1, 0, false, false);
        assertEq(regFee, 5e6);
        assertEq(renewFee, 2e6);
        assertEq(total, 7e6);
    }

    // =========================================================================
    //                      PROGRESSIVE PRICING
    // =========================================================================

    function test_progressivePricing() public {
        // Make alice a member so she can register 3/day (no pricing effect for tier 1)
        membership.setMember(alice, true);

        // Names 1-3: base price (same day OK — member early limit is 3)
        _register("name1", alice);
        _register("name2", alice);
        _register("name3", alice);

        // Name 4: 2.5x
        (uint256 total4,,) = registry.quoteName("name4", alice, 1, 0, false, false);
        assertEq(total4, (5e6 * 25 / 10) + 2e6); // 12.5 + 2 = 14.5

        vm.warp(block.timestamp + 1 days); // new day to stay under daily limit
        _register("name4", alice);

        // Name 6: 5x
        _register("name5", alice);
        (uint256 total6,,) = registry.quoteName("name6", alice, 1, 0, false, false);
        assertEq(total6, (5e6 * 5) + 2e6); // 25 + 2 = 27
    }

    function test_unlimitedPassDiscount() public {
        unlimitedPass.setMember(alice, true);
        (uint256 total,,) = registry.quoteName("hello", alice, 1, 0, false, false);
        // $5 * 80% + $2 = $6
        assertEq(total, 4e6 + 2e6);
    }

    function test_pricingWindowResets() public {
        // Make alice a member so she can register 3/day (no pricing effect for tier 1)
        membership.setMember(alice, true);

        uint256 t0 = 100000;
        vm.warp(t0);
        _register("old1a", alice);
        _register("old2a", alice);
        _register("old3a", alice);

        // Warp past 90-day window
        vm.warp(t0 + 91 days);

        // Should be back to base price — use 5+ char name for $5 base
        (uint256 total,,) = registry.quoteName("newone", alice, 1, 0, false, false);
        assertEq(total, 7e6); // base $5 + $2 renewal
    }

    // =========================================================================
    //                        RATE LIMITING
    // =========================================================================

    function test_nonMemberDailyLimit() public {
        // Non-member, day 1: max 1 per day
        _register("first", alice);

        vm.expectRevert(HazzaRegistry.RateLimitExceeded.selector);
        _register("second", alice);
    }

    function test_nonMemberAfterEarlyPeriod() public {
        _register("first", alice);
        vm.warp(block.timestamp + 8 days);

        // Should allow up to 3 per day after 7 days
        _register("second", alice);
        _register("third", alice);
        _register("fourth", alice);

        vm.expectRevert(HazzaRegistry.RateLimitExceeded.selector);
        _register("fifth", alice);
    }

    function test_nonMemberWalletCap() public {
        // Use absolute timestamps to avoid via_ir caching issues
        uint256 t0 = 100000;

        // Register first name to start early period
        vm.warp(t0);
        _register("cap00", alice);

        // Warp past early period → 3/day limit for non-members
        vm.warp(t0 + 8 days);
        _register("cap01", alice);
        _register("cap02", alice);
        _register("cap03", alice);

        vm.warp(t0 + 9 days);
        _register("cap04", alice);
        _register("cap05", alice);
        _register("cap06", alice);

        vm.warp(t0 + 10 days);
        _register("cap07", alice);
        _register("cap08", alice);
        _register("cap09", alice);

        // Now at 10 total — next should hit wallet cap
        vm.warp(t0 + 11 days);
        vm.expectRevert(HazzaRegistry.WalletLimitExceeded.selector);
        _register("toomany", alice);
    }

    function test_memberHigherLimits() public {
        membership.setMember(alice, true);
        // Member, day 1: max 3 per day
        _register("mem1", alice);
        _register("mem2", alice);
        _register("mem3", alice);

        vm.expectRevert(HazzaRegistry.RateLimitExceeded.selector);
        _register("mem4", alice);
    }

    function test_memberUnlimitedAfterEarlyPeriod() public {
        membership.setMember(alice, true);
        _register("first", alice);
        vm.warp(block.timestamp + 8 days);

        // Unlimited daily after 7 days for members
        for (uint256 i = 0; i < 20; i++) {
            string memory name = string(abi.encodePacked("bulk", vm.toString(i)));
            _register(name, alice);
        }
    }

    function test_unlimitedPassNoLimits() public {
        unlimitedPass.setMember(alice, true);
        // No limits at all
        for (uint256 i = 0; i < 15; i++) {
            string memory name = string(abi.encodePacked("pass", vm.toString(i)));
            _register(name, alice);
        }
    }

    function test_membershipTier() public {
        assertEq(registry.getMembershipTier(alice), 0);
        membership.setMember(alice, true);
        assertEq(registry.getMembershipTier(alice), 1);
        unlimitedPass.setMember(alice, true);
        assertEq(registry.getMembershipTier(alice), 2); // Unlimited > member
    }

    // =========================================================================
    //                     RENEWAL & EXPIRY
    // =========================================================================

    function test_nameExpiresAfterYear() public {
        _register("expiring", alice);
        assertTrue(registry.isActive("expiring"));

        vm.warp(block.timestamp + 366 days);
        assertFalse(registry.isActive("expiring"));
        assertTrue(registry.isInGracePeriod("expiring"));
    }

    function test_renewDuringActive() public {
        _register("renew-me", alice);
        (,,, uint64 expBefore,,,) = registry.resolve("renew-me");

        vm.prank(alice);
        registry.renew("renew-me", 2);

        (,,, uint64 expAfter,,,) = registry.resolve("renew-me");
        assertEq(expAfter, expBefore + uint64(2 * 365 days));
    }

    function test_renewDuringGrace() public {
        _register("grace", alice);
        vm.warp(block.timestamp + 366 days); // in grace

        vm.prank(alice);
        registry.renew("grace", 1);

        assertTrue(registry.isActive("grace"));
    }

    function test_redeemDuringRedemption() public {
        _register("redeem-me", alice);
        vm.warp(block.timestamp + 365 days + 31 days); // past grace, in redemption

        assertTrue(registry.isInRedemptionPeriod("redeem-me"));

        uint256 before = usdc.balanceOf(treasury);
        vm.prank(alice);
        registry.redeem("redeem-me", 1); // $10 penalty + $2 renewal

        assertEq(usdc.balanceOf(treasury) - before, 12e6);
        assertTrue(registry.isActive("redeem-me"));
    }

    function test_nameReleasedAfterFullExpiry() public {
        _register("released", alice);
        // Past expiry + grace + redemption
        vm.warp(block.timestamp + 365 days + 30 days + 30 days + 1);

        assertTrue(registry.available("released"));

        // Someone else can register it
        _register("released", bob);
        (address newOwner,,,,,,) = registry.resolve("released");
        assertEq(newOwner, bob);
    }

    function test_cannotManageExpiredName() public {
        _register("expired", alice);
        vm.warp(block.timestamp + 366 days);

        vm.prank(alice);
        vm.expectRevert(HazzaRegistry.NameExpired.selector);
        registry.setOperator("expired", bob);
    }

    // =========================================================================
    //                      RELAYER & COMMISSION
    // =========================================================================

    function test_relayerCanRegister() public {
        vm.prank(cheryl);
        registry.registerDirect("relayed", alice, 1, 0, false, address(0), "", false, false);

        (address resolvedOwner,,,,,,) = registry.resolve("relayed");
        assertEq(resolvedOwner, alice);
    }

    function test_relayerCommission() public {
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256 cherylBefore = usdc.balanceOf(cheryl);

        vm.prank(cheryl);
        registry.registerDirect("commission", alice, 1, 0, false, address(0), "", false, false);

        uint256 totalPaid = 7e6; // $5 reg + $2 renewal
        uint256 expectedCommission = (totalPaid * 2500) / 10000; // 25%
        uint256 expectedTreasury = totalPaid - expectedCommission;

        assertEq(usdc.balanceOf(treasury) - treasuryBefore, expectedTreasury);
        assertEq(cherylBefore - usdc.balanceOf(cheryl), totalPaid - expectedCommission);
    }

    function test_nonRelayerCannotRegisterDirect() public {
        vm.prank(alice);
        vm.expectRevert(HazzaRegistry.NotRelayer.selector);
        registry.registerDirect("nope", alice, 1, 0, false, address(0), "", false, false);
    }

    // =========================================================================
    //                      NAME CHALLENGE
    // =========================================================================

    function test_challengeFlow() public {
        // Squatter registers "coke"
        _register("coke", alice); // 4 chars = $25

        // Admin approves challenge for bob (Coca-Cola)
        registry.approveChallenge("coke", bob, uint64(block.timestamp + 7 days));

        uint256 aliceBefore = usdc.balanceOf(alice);

        // Bob executes challenge, pays 2x original ($50)
        vm.prank(bob);
        registry.executeChallenge("coke");

        // Bob now owns "coke"
        (address newOwner,,,,,,) = registry.resolve("coke");
        assertEq(newOwner, bob);

        // Alice got compensated: 2x original = $50
        assertEq(usdc.balanceOf(alice) - aliceBefore, 50e6);
    }

    function test_challengeUsesOriginalPrice() public {
        // Register 3-char name for $100
        _register("abc", alice);

        registry.approveChallenge("abc", bob, uint64(block.timestamp + 7 days));

        // Claim price = 2x original = $200 (regardless of secondary market)
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(bob);
        registry.executeChallenge("abc");

        assertEq(usdc.balanceOf(alice) - aliceBefore, 200e6);
    }

    function test_challengeExpired() public {
        _register("late", alice);
        registry.approveChallenge("late", bob, uint64(block.timestamp + 1 days));

        vm.warp(block.timestamp + 2 days);

        vm.prank(bob);
        vm.expectRevert(HazzaRegistry.ChallengeExpired.selector);
        registry.executeChallenge("late");
    }

    function test_challengeWrongClaimant() public {
        _register("wrong", alice);
        registry.approveChallenge("wrong", bob, uint64(block.timestamp + 7 days));

        vm.prank(alice); // not bob
        vm.expectRevert(HazzaRegistry.ChallengeNotApproved.selector);
        registry.executeChallenge("wrong");
    }

    function test_challengeGivesFreshYear() public {
        _register("fresh", alice);
        vm.warp(block.timestamp + 300 days); // almost expired

        registry.approveChallenge("fresh", bob, uint64(block.timestamp + 7 days));
        vm.prank(bob);
        registry.executeChallenge("fresh");

        (,,, uint64 expiresAt,,,) = registry.resolve("fresh");
        assertEq(expiresAt, uint64(block.timestamp + 365 days));
    }

    // =========================================================================
    //                       REVERSE RESOLUTION
    // =========================================================================

    function test_setPrimaryName() public {
        _register("primary", alice);
        vm.prank(alice);
        registry.setPrimaryName("primary");

        string memory resolved = registry.reverseResolve(alice);
        assertEq(resolved, "primary");
    }

    function test_clearPrimaryName() public {
        _register("temp", alice);
        vm.prank(alice);
        registry.setPrimaryName("temp");

        vm.prank(alice);
        registry.clearPrimaryName();

        string memory resolved = registry.reverseResolve(alice);
        assertEq(bytes(resolved).length, 0);
    }

    function test_primaryNameClearedOnTransfer() public {
        _register("moving", alice);
        vm.prank(alice);
        registry.setPrimaryName("moving");

        vm.prank(alice);
        registry.transferFrom(alice, bob, 1);

        // Alice's primary should be cleared
        assertEq(bytes(registry.reverseResolve(alice)).length, 0);
    }

    function test_reverseResolveExpiredName() public {
        _register("expname", alice);
        vm.prank(alice);
        registry.setPrimaryName("expname");

        vm.warp(block.timestamp + 366 days);

        // Expired — should not resolve
        assertEq(bytes(registry.reverseResolve(alice)).length, 0);
    }

    // =========================================================================
    //                         NAMESPACES
    // =========================================================================

    function test_registerNamespace() public {
        _register("netlibrary", alice);

        vm.prank(alice);
        registry.registerNamespace("netlibrary");

        // Verify namespace exists
        (address admin,) = registry.namespaces(keccak256(bytes("netlibrary")));
        assertEq(admin, alice);
    }

    function test_issueSubname() public {
        _register("myorg", alice);
        vm.prank(alice);
        registry.registerNamespace("myorg");

        vm.prank(alice);
        registry.issueSubname("myorg", "worker1", bob);

        (address subOwner,) = registry.resolveSubname("myorg", "worker1");
        assertEq(subOwner, bob);
    }

    function test_revokeSubname() public {
        _register("myorg2", alice);
        vm.prank(alice);
        registry.registerNamespace("myorg2");
        vm.prank(alice);
        registry.issueSubname("myorg2", "temp", bob);

        vm.prank(alice);
        registry.revokeSubname("myorg2", "temp");

        (address subOwner,) = registry.resolveSubname("myorg2", "temp");
        assertEq(subOwner, address(0));
    }

    function test_namespaceNotAdmin() public {
        _register("secured", alice);
        vm.prank(alice);
        registry.registerNamespace("secured");

        vm.prank(bob);
        vm.expectRevert(HazzaRegistry.NotNamespaceAdmin.selector);
        registry.issueSubname("secured", "hack", bob);
    }

    function test_transferNamespace() public {
        _register("transfer-ns", alice);
        vm.prank(alice);
        registry.registerNamespace("transfer-ns");

        vm.prank(alice);
        registry.transferNamespace("transfer-ns", bob);

        (address admin,) = registry.namespaces(keccak256(bytes("transfer-ns")));
        assertEq(admin, bob);
    }

    function test_namespaceCosts50() public {
        _register("pricens", alice);
        uint256 before = usdc.balanceOf(treasury);

        vm.prank(alice);
        registry.registerNamespace("pricens");

        assertEq(usdc.balanceOf(treasury) - before, 50e6);
    }

    function test_subnameCosts1() public {
        _register("cheapns", alice);
        vm.prank(alice);
        registry.registerNamespace("cheapns");

        uint256 before = usdc.balanceOf(treasury);
        vm.prank(alice);
        registry.issueSubname("cheapns", "agent1", bob);

        assertEq(usdc.balanceOf(treasury) - before, 1e6);
    }

    // =========================================================================
    //                        ERC-8004 AGENT
    // =========================================================================

    function test_registerWithAgent() public {
        _registerWithAgent("agentname", alice);
        (,,,,, uint256 agentId, address agentWallet) = registry.resolve("agentname");
        assertTrue(agentId > 0);
        assertEq(agentWallet, alice);
    }

    function test_registerWithoutAgent() public {
        _register("noagent", alice);
        (,,,,, uint256 agentId,) = registry.resolve("noagent");
        assertEq(agentId, 0);
    }

    function test_registerAgentPostPurchase() public {
        _register("later", alice);
        vm.prank(alice);
        registry.registerAgent("later", "https://example.com/agent.json", alice);
        (,,,,, uint256 agentId,) = registry.resolve("later");
        assertTrue(agentId > 0);
    }

    function test_cannotDoubleRegisterAgent() public {
        _registerWithAgent("double", alice);
        vm.prank(alice);
        vm.expectRevert(HazzaRegistry.AgentAlreadyRegistered.selector);
        registry.registerAgent("double", "https://example.com/a.json", alice);
    }

    // =========================================================================
    //                    NAME MANAGEMENT
    // =========================================================================

    function test_setOperator() public {
        _register("managed", alice);
        vm.prank(alice);
        registry.setOperator("managed", bob);
        (,,,, address op,,) = registry.resolve("managed");
        assertEq(op, bob);
    }

    function test_operatorResetsOnTransfer() public {
        _register("xfer", alice);
        vm.prank(alice);
        registry.setOperator("xfer", bob);
        vm.prank(alice);
        registry.transferFrom(alice, bob, 1);
        (,,,, address op,,) = registry.resolve("xfer");
        assertEq(op, bob);
    }

    function test_customDomain() public {
        _register("mysite", alice);
        vm.prank(alice);
        registry.setCustomDomain("mysite", "toolbelts.com");
        assertEq(registry.resolveCustomDomain("toolbelts.com"), "mysite");
    }

    function test_removeCustomDomain() public {
        _register("mysite2", alice);
        vm.prank(alice);
        registry.setCustomDomain("mysite2", "example.com");
        vm.prank(alice);
        registry.removeCustomDomain("mysite2", "example.com");
        assertEq(bytes(registry.resolveCustomDomain("example.com")).length, 0);
    }

    // =========================================================================
    //                        API KEYS
    // =========================================================================

    function test_apiKeyLifecycle() public {
        _register("keytest", alice);

        vm.prank(alice);
        bytes32 rawKey = registry.generateApiKey("keytest", bytes32(uint256(42)));
        assertTrue(rawKey != bytes32(0));

        bytes32 nameHash = registry.verifyApiKey(rawKey);
        assertEq(nameHash, keccak256(bytes("keytest")));

        bytes32 keyHash = keccak256(abi.encodePacked(rawKey));
        vm.prank(alice);
        registry.revokeApiKey(keyHash);

        vm.expectRevert(HazzaRegistry.ApiKeyNotFound.selector);
        registry.verifyApiKey(rawKey);
    }

    // =========================================================================
    //                      NAME VALIDATION
    // =========================================================================

    function test_validNames() public {
        _register("abc", alice);
        _register("hello-world", bob);
        _register("test123", cheryl); // different wallet to avoid alice's daily limit
    }

    function test_tooShort() public {
        vm.expectRevert(HazzaRegistry.NameTooShort.selector);
        _register("ab", alice);
    }

    function test_leadingHyphen() public {
        bytes32 salt = _commitAndWarp("-abc", alice);
        vm.prank(alice);
        vm.expectRevert(HazzaRegistry.LeadingHyphen.selector);
        registry.register("-abc", alice, salt, 1, false, address(0), "");
    }

    function test_trailingHyphen() public {
        bytes32 salt = _commitAndWarp("abc-", alice);
        vm.prank(alice);
        vm.expectRevert(HazzaRegistry.TrailingHyphen.selector);
        registry.register("abc-", alice, salt, 1, false, address(0), "");
    }

    function test_consecutiveHyphens() public {
        bytes32 salt = _commitAndWarp("ab--cd", alice);
        vm.prank(alice);
        vm.expectRevert(HazzaRegistry.ConsecutiveHyphens.selector);
        registry.register("ab--cd", alice, salt, 1, false, address(0), "");
    }

    function test_uppercase() public {
        bytes32 salt = _commitAndWarp("Hello", alice);
        vm.prank(alice);
        vm.expectRevert(HazzaRegistry.InvalidCharacter.selector);
        registry.register("Hello", alice, salt, 1, false, address(0), "");
    }

    function test_specialChars() public {
        bytes32 salt = _commitAndWarp("hello!", alice);
        vm.prank(alice);
        vm.expectRevert(HazzaRegistry.InvalidCharacter.selector);
        registry.register("hello!", alice, salt, 1, false, address(0), "");
    }

    // =========================================================================
    //                         ADMIN
    // =========================================================================

    function test_setTreasury() public {
        registry.setTreasury(address(0xDEAD));
        assertEq(registry.treasury(), address(0xDEAD));
    }

    function test_setRelayer() public {
        registry.setRelayer(address(0x999), true, 1000);
        assertTrue(registry.relayers(address(0x999)));
        assertEq(registry.relayerCommission(address(0x999)), 1000);
    }

    function test_setMembershipContracts() public {
        address newMembership = address(0x111);
        registry.setMembershipContracts(newMembership, address(0));
        // Should not revert
    }

    // =========================================================================
    //                       TOKEN BASICS
    // =========================================================================

    function test_tokenName() public view {
        assertEq(registry.name(), "HAZZA Name");
        assertEq(registry.symbol(), "HAZZA");
    }

    function test_totalRegistered() public {
        assertEq(registry.totalRegistered(), 0);
        _register("one11", alice);
        assertEq(registry.totalRegistered(), 1);
        _register("two22", bob);
        assertEq(registry.totalRegistered(), 2);
    }

    function test_nameOf() public {
        _register("lookup", alice);
        assertEq(registry.nameOf(1), "lookup");
    }

    // =========================================================================
    //                   ENSIP-15 CHARCOUNT PRICING
    // =========================================================================

    function test_charCountOverridesByteLength() public {
        // Register an emoji name (simulated): 12 bytes UTF-8 but 3 grapheme clusters
        // Relayer passes charCount=3 → should price as 3-char ($100)
        uint256 before = usdc.balanceOf(treasury);
        registry.registerDirect("emoji-test1", alice, 1, 3, false, address(0), "", false, false);
        // 3-char price ($100) + $2 renewal = $102
        assertEq(usdc.balanceOf(treasury) - before, 102e6);
    }

    function test_charCountZeroUsesByteLength() public {
        // charCount=0 falls back to byte length
        uint256 before = usdc.balanceOf(treasury);
        registry.registerDirect("fivechars", alice, 1, 0, false, address(0), "", false, false);
        // "fivechars" = 9 bytes → 5+ char price ($5) + $2 = $7
        assertEq(usdc.balanceOf(treasury) - before, 7e6);
    }

    function test_priceWithCharCount() public view {
        // price() with charCount=3 should return 3-char price
        assertEq(registry.price("anything", 3), 100e6);
        assertEq(registry.price("anything", 4), 25e6);
        assertEq(registry.price("anything", 5), 5e6);
    }

    // =========================================================================
    //                       ENS IMPORT DISCOUNT
    // =========================================================================

    function test_ensImport50PercentDiscount() public {
        uint256 before = usdc.balanceOf(treasury);
        // ENS import: 50% off registration + $2 renewal
        registry.registerDirect("ensname", alice, 1, 0, false, address(0), "", true, false);
        // $5 base * 50% = $2.50 + $2 renewal = $4.50 → $4 (integer division: 5e6/2 = 2.5e6)
        assertEq(usdc.balanceOf(treasury) - before, 2500000 + 2e6);
    }

    function test_ensImportChallengeImmunity() public {
        registry.registerDirect("protected", alice, 1, 0, false, address(0), "", true, false);

        // Should NOT be challengeable
        vm.expectRevert(HazzaRegistry.ChallengeBlockedENS.selector);
        registry.approveChallenge("protected", bob, uint64(block.timestamp + 7 days));
    }

    function test_ensImportMarkedVerified() public {
        registry.registerDirect("verified", alice, 1, 0, false, address(0), "", true, false);
        assertTrue(registry.ensVerified(keccak256(bytes("verified"))));
    }

    function test_nonEnsNotMarkedVerified() public {
        _register("regular", alice);
        assertFalse(registry.ensVerified(keccak256(bytes("regular"))));
    }

    function test_ensQuoteShowsDiscount() public view {
        // Quote with ENS import: 50% off $5 + $2 = $4.50
        (uint256 total,,) = registry.quoteName("hello", alice, 1, 0, true, false);
        assertEq(total, 2500000 + 2e6);
    }

    // =========================================================================
    //                  CROSS-WALLET UNLIMITED PASS
    // =========================================================================

    function test_verifiedPassDiscount() public {
        // verifiedPass=true gives 20% discount even without on-chain pass
        uint256 before = usdc.balanceOf(treasury);
        registry.registerDirect("crosswallet", alice, 1, 0, false, address(0), "", false, true);
        // $5 * 80% + $2 = $6
        assertEq(usdc.balanceOf(treasury) - before, 6e6);
    }

    function test_verifiedPassBypassesRateLimit() public {
        // Without pass: alice can only register 1/day in early period
        _register("first1", alice);

        // Second should fail normally
        vm.expectRevert(HazzaRegistry.RateLimitExceeded.selector);
        _register("second1", alice);

        // But with verifiedPass, no rate limit
        registry.registerDirect("second1", alice, 1, 0, false, address(0), "", false, true);
        assertFalse(registry.available("second1"));
    }

    function test_stackedDiscounts() public {
        // ENS import (50%) + Unlimited Pass (20%) = multiplicative: price * 0.8 * 0.5
        uint256 before = usdc.balanceOf(treasury);
        registry.registerDirect("stacked", alice, 1, 0, false, address(0), "", true, true);
        // $5 * 80% = $4 * 50% = $2 + $2 renewal = $4
        assertEq(usdc.balanceOf(treasury) - before, 4e6);
    }

    function test_stackedQuote() public view {
        (uint256 total,,) = registry.quoteName("hello", alice, 1, 0, true, true);
        // $5 * 80% * 50% + $2 = $4
        assertEq(total, 4e6);
    }

    // =========================================================================
    //              PERMISSIVE VALIDATION (RELAYER PATH)
    // =========================================================================

    function test_relayerCanRegisterUTF8() public {
        // Relayer path uses permissive validation — any UTF-8 bytes accepted
        // Simulating an emoji name (actual bytes don't matter, validation is permissive)
        registry.registerDirect("utf8-name", alice, 1, 5, false, address(0), "", false, false);
        assertFalse(registry.available("utf8-name"));
    }

    function test_permissiveRejectsEmpty() public {
        vm.expectRevert(HazzaRegistry.NameTooShort.selector);
        registry.registerDirect("", alice, 1, 0, false, address(0), "", false, false);
    }

    function test_permissiveRejectsShortCharCount() public {
        vm.expectRevert(HazzaRegistry.NameTooShort.selector);
        registry.registerDirect("some-name", alice, 1, 2, false, address(0), "", false, false);
    }

    // =========================================================================
    //                  FREE CLAIM (Unlimited Pass + Net Library)
    // =========================================================================

    function test_freeClaimWithMember() public {
        registry.registerDirectWithMember("freename", alice, 1, 0, false, address(0), "", false, true, 1);
        (address resolvedOwner,,,,,,) = registry.resolve("freename");
        assertEq(resolvedOwner, alice);
    }

    function test_freeClaimNoPayment() public {
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256 deployerBefore = usdc.balanceOf(deployer);

        registry.registerDirectWithMember("freebie", alice, 1, 0, false, address(0), "", false, true, 1);

        assertEq(usdc.balanceOf(treasury), treasuryBefore);
        assertEq(usdc.balanceOf(deployer), deployerBefore);
    }

    function test_freeClaimCannotDoubleUse() public {
        registry.registerDirectWithMember("first-free", alice, 1, 0, false, address(0), "", false, true, 42);

        vm.expectRevert(HazzaRegistry.FreeClaimAlreadyUsed.selector);
        registry.registerDirectWithMember("second-free", bob, 1, 0, false, address(0), "", false, true, 42);
    }

    function test_differentMemberIdCanClaim() public {
        registry.registerDirectWithMember("member-one", alice, 1, 0, false, address(0), "", false, true, 1);
        registry.registerDirectWithMember("member-two", bob, 1, 0, false, address(0), "", false, true, 2);

        (address owner1,,,,,,) = registry.resolve("member-one");
        (address owner2,,,,,,) = registry.resolve("member-two");
        assertEq(owner1, alice);
        assertEq(owner2, bob);
    }

    function test_memberIdZeroNoFreeClaim() public {
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        // memberId=0 should behave like normal registerDirect (paid)
        registry.registerDirectWithMember("paid-name", alice, 1, 0, false, address(0), "", false, false, 0);

        // Treasury should have received payment
        assertGt(usdc.balanceOf(treasury), treasuryBefore);
    }

    function test_afterFreeClaimDiscountStillWorks() public {
        // Free claim first
        registry.registerDirectWithMember("my-free", alice, 1, 0, false, address(0), "", false, true, 10);

        // Then a paid registration with verifiedPass discount
        uint256 balBefore = usdc.balanceOf(deployer);
        registry.registerDirect("paid-after", alice, 1, 0, false, address(0), "", false, true);
        uint256 paid = balBefore - usdc.balanceOf(deployer);

        // 5+ char = $5 base, verifiedPass = 20% off = $4
        assertEq(paid, 4e6);
    }

    function test_hasClaimedFreeName() public {
        assertFalse(registry.hasClaimedFreeName(99));

        registry.registerDirectWithMember("claimed", alice, 1, 0, false, address(0), "", false, true, 99);

        assertTrue(registry.hasClaimedFreeName(99));
    }

    function test_freeClaimEmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit HazzaRegistry.FreeNameClaimed("evented", alice, 100, 1);
        registry.registerDirectWithMember("evented", alice, 1, 0, false, address(0), "", false, true, 100);
    }

    function test_quoteWithMemberFree() public view {
        (uint256 totalCost, uint256 regFee, uint256 renewFee, bool isFreeClaim) =
            registry.quoteNameWithMember("quoted", alice, 1, 0, false, true, 5);

        assertEq(totalCost, 0);
        assertEq(regFee, 0);
        assertEq(renewFee, 2e6); // $2 renewal
        assertTrue(isFreeClaim);
    }

    function test_quoteWithMemberAlreadyClaimed() public {
        // Claim first
        registry.registerDirectWithMember("used-up", alice, 1, 0, false, address(0), "", false, true, 5);

        // Now quote with same memberId — should return normal discounted price
        (uint256 totalCost, uint256 regFee,, bool isFreeClaim) =
            registry.quoteNameWithMember("another", alice, 1, 0, false, true, 5);

        assertEq(regFee, 4e6); // $5 base, 20% verifiedPass = $4
        assertEq(totalCost, 4e6);
        assertFalse(isFreeClaim);
    }

    function test_freeClaimStoresOriginalPrice() public {
        // Free claim a 5+ char name (base = $5)
        registry.registerDirectWithMember("original-price", alice, 1, 0, false, address(0), "", false, true, 7);

        // Verify originalPrice via challenge system: claimPrice = 2x originalPrice = $10
        registry.approveChallenge("original-price", bob, uint64(block.timestamp + 7 days));
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(bob);
        registry.executeChallenge("original-price");
        // Alice gets 2x original base price ($5) = $10 compensation
        assertEq(usdc.balanceOf(alice) - aliceBefore, 10e6);
    }

    function test_freeClaimWithAgent() public {
        registry.registerDirectWithMember(
            "agent-free", alice, 1, 0, true, alice, "https://example.com/agent.json", false, true, 15
        );

        (address resolvedOwner,,,,, uint256 agentId, address agentWallet) = registry.resolve("agent-free");
        assertEq(resolvedOwner, alice);
        assertGt(agentId, 0);
        assertEq(agentWallet, alice);
    }
}
