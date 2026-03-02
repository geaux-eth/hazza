// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/OffchainResolver.sol";

contract OffchainResolverTest is Test {
    OffchainResolver public resolver;

    // Foundry default test private key
    uint256 constant SIGNER_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address public signer;
    string constant GATEWAY_URL = "https://hazza.name/ccip/{sender}/{data}.json";

    function setUp() public {
        signer = vm.addr(SIGNER_KEY);
        resolver = new OffchainResolver(GATEWAY_URL, signer);
    }

    // ── Initial State ─────────────────────────────────────────────────────

    function test_initial_state() public view {
        assertEq(resolver.url(), GATEWAY_URL);
        assertTrue(resolver.signers(signer));
        assertEq(resolver.owner(), address(this));
    }

    // ── resolve() reverts with OffchainLookup ─────────────────────────────

    function test_resolve_reverts_with_offchain_lookup() public {
        // DNS-encoded "alice.hazza.name"
        bytes memory dnsName = hex"05616c6963650568617a7a61046e616d6500";
        bytes memory data = abi.encodeWithSelector(bytes4(0x3b3b57de), bytes32(0));

        bytes memory callData = abi.encodeWithSelector(
            resolver.resolve.selector, dnsName, data
        );

        string[] memory expectedUrls = new string[](1);
        expectedUrls[0] = GATEWAY_URL;

        vm.expectRevert(abi.encodeWithSelector(
            OffchainResolver.OffchainLookup.selector,
            address(resolver),
            expectedUrls,
            callData,
            resolver.resolveWithProof.selector,
            callData
        ));

        resolver.resolve(dnsName, data);
    }

    // ── resolveWithProof: valid signature ─────────────────────────────────

    function test_resolveWithProof_valid_signature() public view {
        bytes memory result = abi.encode(address(0xA11CE));
        uint64 expires = uint64(block.timestamp + 300);
        bytes memory request = hex"deadbeef";

        bytes32 hash = resolver.makeSignatureHash(
            address(resolver), expires, request, result
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, hash);
        bytes memory signature = abi.encodePacked(r, s, v);

        bytes memory response = abi.encode(result, expires, signature);
        bytes memory returned = resolver.resolveWithProof(response, request);

        assertEq(keccak256(returned), keccak256(result));
    }

    // ── resolveWithProof: decodes address correctly ───────────────────────

    function test_resolveWithProof_returns_correct_address() public view {
        address expected = address(0x96168ACf7f3925e7A9eAA08Ddb21e59643da8097);
        bytes memory result = abi.encode(expected);
        uint64 expires = uint64(block.timestamp + 300);
        bytes memory request = hex"cafebabe";

        bytes32 hash = resolver.makeSignatureHash(
            address(resolver), expires, request, result
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, hash);
        bytes memory signature = abi.encodePacked(r, s, v);

        bytes memory response = abi.encode(result, expires, signature);
        bytes memory returned = resolver.resolveWithProof(response, request);

        address decoded = abi.decode(returned, (address));
        assertEq(decoded, expected);
    }

    // ── resolveWithProof: invalid signer rejected ─────────────────────────

    function test_resolveWithProof_rejects_invalid_signer() public {
        bytes memory result = abi.encode(address(0xA11CE));
        uint64 expires = uint64(block.timestamp + 300);
        bytes memory request = hex"deadbeef";

        // Sign with a key that is NOT authorized
        uint256 wrongKey = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
        bytes32 hash = resolver.makeSignatureHash(
            address(resolver), expires, request, result
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, hash);
        bytes memory signature = abi.encodePacked(r, s, v);

        bytes memory response = abi.encode(result, expires, signature);

        vm.expectRevert("CCIP: invalid signer");
        resolver.resolveWithProof(response, request);
    }

    // ── resolveWithProof: expired response rejected ───────────────────────

    function test_resolveWithProof_rejects_expired() public {
        bytes memory result = abi.encode(address(0xA11CE));
        uint64 expires = uint64(block.timestamp - 1); // already expired
        bytes memory request = hex"deadbeef";

        bytes32 hash = resolver.makeSignatureHash(
            address(resolver), expires, request, result
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, hash);
        bytes memory signature = abi.encodePacked(r, s, v);

        bytes memory response = abi.encode(result, expires, signature);

        vm.expectRevert("CCIP: response expired");
        resolver.resolveWithProof(response, request);
    }

    // ── resolveWithProof: tampered result rejected ────────────────────────

    function test_resolveWithProof_rejects_tampered_result() public {
        bytes memory realResult = abi.encode(address(0xA11CE));
        bytes memory fakeResult = abi.encode(address(0xBAD));
        uint64 expires = uint64(block.timestamp + 300);
        bytes memory request = hex"deadbeef";

        // Sign the real result
        bytes32 hash = resolver.makeSignatureHash(
            address(resolver), expires, request, realResult
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, hash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // But return the fake result — signature won't match
        bytes memory response = abi.encode(fakeResult, expires, signature);

        vm.expectRevert("CCIP: invalid signer");
        resolver.resolveWithProof(response, request);
    }

    // ── setSigner ─────────────────────────────────────────────────────────

    function test_setSigner_add_and_remove() public {
        address newSigner = address(0x1234);
        assertFalse(resolver.signers(newSigner));

        resolver.setSigner(newSigner, true);
        assertTrue(resolver.signers(newSigner));

        resolver.setSigner(newSigner, false);
        assertFalse(resolver.signers(newSigner));
    }

    function test_setSigner_emits_event() public {
        address newSigner = address(0x1234);
        vm.expectEmit(true, false, false, true);
        emit OffchainResolver.SignerUpdated(newSigner, true);
        resolver.setSigner(newSigner, true);
    }

    function test_setSigner_only_owner() public {
        vm.prank(address(0xBAD));
        vm.expectRevert();
        resolver.setSigner(address(0x1234), true);
    }

    // ── setUrl ────────────────────────────────────────────────────────────

    function test_setUrl() public {
        string memory newUrl = "https://new-gateway.example.com/{sender}/{data}.json";
        resolver.setUrl(newUrl);
        assertEq(resolver.url(), newUrl);
    }

    function test_setUrl_emits_event() public {
        string memory newUrl = "https://new.example.com";
        vm.expectEmit(false, false, false, true);
        emit OffchainResolver.UrlUpdated(newUrl);
        resolver.setUrl(newUrl);
    }

    function test_setUrl_only_owner() public {
        vm.prank(address(0xBAD));
        vm.expectRevert();
        resolver.setUrl("https://evil.com");
    }

    // ── supportsInterface ─────────────────────────────────────────────────

    function test_supportsInterface_extended_resolver() public view {
        assertTrue(resolver.supportsInterface(0x9061b923));
    }

    function test_supportsInterface_eip165() public view {
        assertTrue(resolver.supportsInterface(0x01ffc9a7));
    }

    function test_supportsInterface_unknown() public view {
        assertFalse(resolver.supportsInterface(0xdeadbeef));
    }

    // ── makeSignatureHash ─────────────────────────────────────────────────

    function test_makeSignatureHash_deterministic() public view {
        bytes32 h1 = resolver.makeSignatureHash(
            address(resolver), 1000, hex"aa", hex"bb"
        );
        bytes32 h2 = resolver.makeSignatureHash(
            address(resolver), 1000, hex"aa", hex"bb"
        );
        assertEq(h1, h2);
    }

    function test_makeSignatureHash_varies_with_target() public view {
        bytes32 h1 = resolver.makeSignatureHash(
            address(0x1), 1000, hex"aa", hex"bb"
        );
        bytes32 h2 = resolver.makeSignatureHash(
            address(0x2), 1000, hex"aa", hex"bb"
        );
        assertTrue(h1 != h2);
    }

    function test_makeSignatureHash_varies_with_expires() public view {
        bytes32 h1 = resolver.makeSignatureHash(
            address(resolver), 1000, hex"aa", hex"bb"
        );
        bytes32 h2 = resolver.makeSignatureHash(
            address(resolver), 1001, hex"aa", hex"bb"
        );
        assertTrue(h1 != h2);
    }

    function test_makeSignatureHash_varies_with_request() public view {
        bytes32 h1 = resolver.makeSignatureHash(
            address(resolver), 1000, hex"aa", hex"bb"
        );
        bytes32 h2 = resolver.makeSignatureHash(
            address(resolver), 1000, hex"cc", hex"bb"
        );
        assertTrue(h1 != h2);
    }

    function test_makeSignatureHash_varies_with_result() public view {
        bytes32 h1 = resolver.makeSignatureHash(
            address(resolver), 1000, hex"aa", hex"bb"
        );
        bytes32 h2 = resolver.makeSignatureHash(
            address(resolver), 1000, hex"aa", hex"cc"
        );
        assertTrue(h1 != h2);
    }

    // ── Multiple signers ──────────────────────────────────────────────────

    function test_multiple_signers() public {
        uint256 secondKey = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
        address secondSigner = vm.addr(secondKey);

        resolver.setSigner(secondSigner, true);

        // Both signers should be accepted
        bytes memory result = abi.encode(address(0xA11CE));
        uint64 expires = uint64(block.timestamp + 300);
        bytes memory request = hex"deadbeef";

        // Sign with first signer
        bytes32 hash = resolver.makeSignatureHash(
            address(resolver), expires, request, result
        );
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(SIGNER_KEY, hash);
        bytes memory sig1 = abi.encodePacked(r1, s1, v1);
        bytes memory response1 = abi.encode(result, expires, sig1);
        resolver.resolveWithProof(response1, request);

        // Sign with second signer
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(secondKey, hash);
        bytes memory sig2 = abi.encodePacked(r2, s2, v2);
        bytes memory response2 = abi.encode(result, expires, sig2);
        resolver.resolveWithProof(response2, request);
    }

    // ── Revoked signer rejected ───────────────────────────────────────────

    function test_revoked_signer_rejected() public {
        // Revoke the original signer
        resolver.setSigner(signer, false);

        bytes memory result = abi.encode(address(0xA11CE));
        uint64 expires = uint64(block.timestamp + 300);
        bytes memory request = hex"deadbeef";

        bytes32 hash = resolver.makeSignatureHash(
            address(resolver), expires, request, result
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, hash);
        bytes memory signature = abi.encodePacked(r, s, v);

        bytes memory response = abi.encode(result, expires, signature);

        vm.expectRevert("CCIP: invalid signer");
        resolver.resolveWithProof(response, request);
    }
}
