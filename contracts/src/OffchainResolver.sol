// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title OffchainResolver
 * @notice CCIP-Read (ERC-3668) resolver for HAZZA names on ENS.
 *         Deployed on Ethereum. All resolve() calls revert with OffchainLookup,
 *         directing ENS clients to the HAZZA gateway which reads from the
 *         registry on Base and returns signed responses.
 */
contract OffchainResolver is Ownable {
    using ECDSA for bytes32;

    // ── ERC-3668 ────────────────────────────────────────────────────────
    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

    // ── EIP-165 / ENSIP-10 ─────────────────────────────────────────────
    // IExtendedResolver interface ID
    bytes4 private constant EXTENDED_RESOLVER_IFACE = 0x9061b923;
    // EIP-165
    bytes4 private constant EIP165_IFACE = 0x01ffc9a7;

    // ── State ───────────────────────────────────────────────────────────
    string public url;
    mapping(address => bool) public signers;

    // ── Events ──────────────────────────────────────────────────────────
    event SignerUpdated(address indexed signer, bool authorized);
    event UrlUpdated(string newUrl);

    constructor(string memory _url, address _signer) Ownable(msg.sender) {
        url = _url;
        signers[_signer] = true;
        emit UrlUpdated(_url);
        emit SignerUpdated(_signer, true);
    }

    // ── ENSIP-10: resolve ───────────────────────────────────────────────

    /**
     * @notice Called by ENS universal resolver. Always reverts with
     *         OffchainLookup to redirect the client to the CCIP gateway.
     * @param name  DNS-encoded name (e.g. \x05alice\x05hazza\x04name\x00)
     * @param data  ABI-encoded resolver call (addr, text, contenthash, etc.)
     */
    function resolve(bytes calldata name, bytes calldata data)
        external
        view
        returns (bytes memory)
    {
        bytes memory callData = abi.encodeWithSelector(
            this.resolve.selector, name, data
        );

        string[] memory urls = new string[](1);
        urls[0] = url;

        revert OffchainLookup(
            address(this),
            urls,
            callData,
            this.resolveWithProof.selector,
            callData // extraData = the original request, used for sig verification
        );
    }

    // ── ERC-3668: callback ──────────────────────────────────────────────

    /**
     * @notice Callback from the CCIP client after fetching gateway response.
     *         Verifies the gateway's signature and returns the result.
     * @param response  ABI-encoded (bytes result, uint64 expires, bytes signature)
     * @param extraData The original callData passed through from resolve()
     * @return The ABI-encoded resolver result
     */
    function resolveWithProof(bytes calldata response, bytes calldata extraData)
        external
        view
        returns (bytes memory)
    {
        (bytes memory result, uint64 expires, bytes memory signature) =
            abi.decode(response, (bytes, uint64, bytes));

        require(expires > block.timestamp, "CCIP: response expired");

        bytes32 hash = makeSignatureHash(address(this), expires, extraData, result);
        address recovered = hash.recover(signature);
        require(signers[recovered], "CCIP: invalid signer");

        return result;
    }

    // ── Signature hash ──────────────────────────────────────────────────

    /**
     * @notice Builds the hash that the gateway must sign.
     *         Uses EIP-191 version 0x00 (intended validator) format:
     *         keccak256(0x1900 || target || expires || keccak256(request) || keccak256(result))
     */
    function makeSignatureHash(
        address target,
        uint64 expires,
        bytes memory request,
        bytes memory result
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                hex"1900",
                target,
                expires,
                keccak256(request),
                keccak256(result)
            )
        );
    }

    // ── Admin ───────────────────────────────────────────────────────────

    function setSigner(address signer, bool authorized) external onlyOwner {
        signers[signer] = authorized;
        emit SignerUpdated(signer, authorized);
    }

    function setUrl(string calldata _url) external onlyOwner {
        url = _url;
        emit UrlUpdated(_url);
    }

    // ── EIP-165 ─────────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == EXTENDED_RESOLVER_IFACE || interfaceId == EIP165_IFACE;
    }
}
