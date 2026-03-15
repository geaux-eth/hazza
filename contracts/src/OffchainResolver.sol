// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title OffchainResolver
 * @notice CCIP-Read (ERC-3668) resolver for hazza names on ENS.
 *         Deployed on Ethereum. All resolve() calls revert with OffchainLookup,
 *         directing ENS clients to hazza gateway(s) which read from the
 *         registry on Base and return signed responses.
 *
 *         Supports multiple gateway URLs and multiple signers for
 *         decentralized operation. Any approved signer's response is accepted.
 *         ENS clients try URLs in order until one succeeds (ERC-3668 spec).
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
    bytes4 private constant EXTENDED_RESOLVER_IFACE = 0x9061b923;
    bytes4 private constant EIP165_IFACE = 0x01ffc9a7;

    // ── State ───────────────────────────────────────────────────────────
    string[] private _urls;
    mapping(address => bool) public signers;

    // ── Events ──────────────────────────────────────────────────────────
    event SignerUpdated(address indexed signer, bool authorized);
    event UrlAdded(string url);
    event UrlRemoved(string url);

    constructor(string memory _url, address _signer) Ownable(msg.sender) {
        _urls.push(_url);
        signers[_signer] = true;
        emit UrlAdded(_url);
        emit SignerUpdated(_signer, true);
    }

    // ── ENSIP-10: resolve ───────────────────────────────────────────────

    /**
     * @notice Called by ENS universal resolver. Always reverts with
     *         OffchainLookup to redirect the client to the CCIP gateway(s).
     *         ENS clients try each URL in order until one returns a valid response.
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

        revert OffchainLookup(
            address(this),
            _urls,
            callData,
            this.resolveWithProof.selector,
            callData
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

    // ── Admin: Signers ──────────────────────────────────────────────────

    function setSigner(address signer, bool authorized) external onlyOwner {
        signers[signer] = authorized;
        emit SignerUpdated(signer, authorized);
    }

    // ── Admin: Gateway URLs ─────────────────────────────────────────────

    /// @notice Add a gateway URL. ENS clients try URLs in order.
    function addUrl(string calldata _url) external onlyOwner {
        _urls.push(_url);
        emit UrlAdded(_url);
    }

    /// @notice Remove a gateway URL by index.
    function removeUrl(uint256 index) external onlyOwner {
        require(index < _urls.length, "Index out of bounds");
        require(_urls.length > 1, "Must keep at least one URL");
        string memory removed = _urls[index];
        _urls[index] = _urls[_urls.length - 1];
        _urls.pop();
        emit UrlRemoved(removed);
    }

    /// @notice Replace all URLs at once (for bulk updates).
    function setUrls(string[] calldata urls_) external onlyOwner {
        require(urls_.length > 0, "Must provide at least one URL");
        delete _urls;
        for (uint256 i = 0; i < urls_.length; i++) {
            _urls.push(urls_[i]);
        }
    }

    /// @notice Get all gateway URLs.
    function urls() external view returns (string[] memory) {
        return _urls;
    }

    /// @notice Get the number of gateway URLs.
    function urlCount() external view returns (uint256) {
        return _urls.length;
    }

    // ── EIP-165 ─────────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == EXTENDED_RESOLVER_IFACE || interfaceId == EIP165_IFACE;
    }
}
