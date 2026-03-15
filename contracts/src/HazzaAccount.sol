// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @dev ERC-6551 Account Interface
interface IERC6551Account {
    receive() external payable;

    function token()
        external
        view
        returns (uint256 chainId, address tokenContract, uint256 tokenId);

    function state() external view returns (uint256);

    function isValidSigner(address signer, bytes calldata context)
        external
        view
        returns (bytes4 magicValue);
}

/// @dev ERC-6551 Executable Interface
interface IERC6551Executable {
    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external
        payable
        returns (bytes memory);
}

/// @dev Minimal ERC-4337 UserOperation for validateUserOp
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

/// @dev ERC-4337 IAccount interface
interface IAccount {
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}

/// @title HazzaAccount — Token-Bound Account for hazza names
/// @notice Each hazza name NFT can have a smart wallet that follows ownership.
///         Supports ERC-6551 (TBA), ERC-4337 (account abstraction), ERC-1271 (signature validation).
///         The account is controlled by whoever owns the hazza name NFT.
///
/// @dev SECURITY NOTES:
///   - DELEGATECALL is blocked (operation must be 0). A malicious delegatecall could
///     overwrite storage or destroy the contract.
///   - Reentrancy is guarded: _executing flag prevents re-entering execute().
///   - Self-transfer protection: onERC721Received rejects the bound NFT being sent
///     to this account, preventing circular ownership (permanently bricked account).
///   - Revert reasons are forwarded from target calls for debuggability.
contract HazzaAccount is
    IERC6551Account,
    IERC6551Executable,
    IAccount,
    IERC1271,
    IERC165,
    IERC721Receiver,
    IERC1155Receiver
{
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // =========================================================================
    //                              STATE
    // =========================================================================

    uint256 private _state;

    // Reentrancy guard for execute()
    bool private _executing;

    // ERC-4337 EntryPoint (v0.7 on Base: 0x0000000071727De22E5E9d8BAf0edAc6f37da032)
    address public immutable entryPoint;

    // =========================================================================
    //                              ERRORS
    // =========================================================================

    error InvalidSigner();
    error OnlyCallOperations();
    error ExecutionFailed(bytes reason);
    error OnlyEntryPoint();
    error InsufficientBalance();
    error Reentrancy();
    error CircularOwnership();

    // =========================================================================
    //                           CONSTRUCTOR
    // =========================================================================

    /// @param _entryPoint The ERC-4337 EntryPoint address (use address(0) to disable 4337)
    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
    }

    // =========================================================================
    //                       ERC-6551: CORE
    // =========================================================================

    /// @notice Receive ETH
    receive() external payable override {}

    /// @notice Get the token this account is bound to
    /// @dev Token info is appended to bytecode by the 6551 registry during CREATE2
    function token()
        public
        view
        override
        returns (uint256 chainId, address tokenContract, uint256 tokenId)
    {
        bytes memory footer = new bytes(0x60);
        assembly {
            extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
        }
        return abi.decode(footer, (uint256, address, uint256));
    }

    /// @notice Monotonically increasing state counter (incremented on each execute)
    function state() external view override returns (uint256) {
        return _state;
    }

    /// @notice Check if an address is a valid signer for this account
    function isValidSigner(address signer, bytes calldata)
        external
        view
        override
        returns (bytes4)
    {
        if (_isValidSigner(signer)) {
            return IERC6551Account.isValidSigner.selector;
        }
        return bytes4(0);
    }

    // =========================================================================
    //                    ERC-6551: EXECUTE
    // =========================================================================

    /// @notice Execute a call from this account
    /// @param to Target address
    /// @param value ETH value to send
    /// @param data Calldata
    /// @param operation Must be 0 (CALL). DELEGATECALL (1) not supported for safety.
    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external
        payable
        override
        returns (bytes memory)
    {
        // Reentrancy guard — prevents a called contract from re-entering execute()
        if (_executing) revert Reentrancy();
        _executing = true;

        if (!_isValidSigner(msg.sender)) revert InvalidSigner();
        if (operation != 0) revert OnlyCallOperations();

        _state++;

        (bool success, bytes memory result) = to.call{value: value}(data);
        if (!success) {
            // Forward the revert reason for debuggability
            revert ExecutionFailed(result);
        }

        _executing = false;
        return result;
    }

    // =========================================================================
    //                    ERC-4337: ACCOUNT ABSTRACTION
    // =========================================================================

    /// @notice Validate a UserOperation (ERC-4337)
    /// @dev Called by the EntryPoint to verify the account owner signed the op
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override returns (uint256 validationData) {
        if (msg.sender != entryPoint) revert OnlyEntryPoint();

        // Verify signature is from the NFT owner
        address signer = userOpHash.toEthSignedMessageHash().recover(userOp.signature);

        if (!_isValidSigner(signer)) {
            return 1; // SIG_VALIDATION_FAILED
        }

        // Pay prefund if needed
        if (missingAccountFunds > 0) {
            (bool success,) = payable(msg.sender).call{value: missingAccountFunds}("");
            if (!success) revert InsufficientBalance();
        }

        return 0; // SIG_VALIDATION_SUCCESS
    }

    // =========================================================================
    //                    ERC-1271: SIGNATURE VALIDATION
    // =========================================================================

    /// @notice Validate a signature (ERC-1271) — used by protocols to verify this account signed something
    function isValidSignature(bytes32 hash, bytes memory signature)
        external
        view
        override
        returns (bytes4)
    {
        address signer = hash.toEthSignedMessageHash().recover(signature);
        if (_isValidSigner(signer)) {
            return IERC1271.isValidSignature.selector; // 0x1626ba7e
        }
        return bytes4(0xffffffff);
    }

    // =========================================================================
    //                       TOKEN RECEIVERS
    // =========================================================================

    /// @notice Accept ERC-721 tokens — but REJECT the bound NFT to prevent circular ownership
    /// @dev If someone sends this account's own hazza NFT to this account, both the
    ///      account and the NFT become permanently bricked (no valid signer can ever exist).
    function onERC721Received(address, address, uint256 receivedTokenId, bytes calldata)
        external
        view
        override
        returns (bytes4)
    {
        // Prevent circular ownership: reject our own bound NFT
        (, address tokenContract, uint256 boundTokenId) = token();
        if (msg.sender == tokenContract && receivedTokenId == boundTokenId) {
            revert CircularOwnership();
        }
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Accept ERC-1155 single transfers
    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    /// @notice Accept ERC-1155 batch transfers
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    // =========================================================================
    //                         ERC-165
    // =========================================================================

    function supportsInterface(bytes4 interfaceId) external pure override(IERC165) returns (bool) {
        return
            interfaceId == type(IERC6551Account).interfaceId ||
            interfaceId == type(IERC6551Executable).interfaceId ||
            interfaceId == type(IERC1271).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    // =========================================================================
    //                          INTERNAL
    // =========================================================================

    /// @dev Check if signer is the current owner of the bound NFT
    function _isValidSigner(address signer) internal view returns (bool) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = token();
        if (chainId != block.chainid) return false;

        try IERC721(tokenContract).ownerOf(tokenId) returns (address tokenOwner) {
            return signer == tokenOwner;
        } catch {
            return false;
        }
    }

    /// @notice Get the current owner of this account (whoever owns the NFT)
    function owner() external view returns (address) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = token();
        if (chainId != block.chainid) return address(0);
        try IERC721(tokenContract).ownerOf(tokenId) returns (address tokenOwner) {
            return tokenOwner;
        } catch {
            return address(0);
        }
    }
}
