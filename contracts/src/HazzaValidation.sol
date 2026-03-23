// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HazzaValidation
/// @notice External library for name validation — saves bytecode in the main registry
library HazzaValidation {
    uint256 internal constant MIN_NAME_LENGTH = 3;
    uint256 internal constant MAX_NAME_LENGTH = 63;

    error NameTooShort();
    error NameTooLong();
    error InvalidCharacter();
    /// @dev Permissive UTF-8 validation for relayer path (ENSIP-15 normalized offchain)
    function validateNamePermissive(string calldata name, uint8 charCount) external pure {
        uint256 len = bytes(name).length;
        if (len == 0) revert NameTooShort();
        if (len > 255) revert NameTooLong();
        uint256 effectiveLen = charCount > 0 ? uint256(charCount) : len;
        if (effectiveLen < MIN_NAME_LENGTH) revert NameTooShort();
    }
}
