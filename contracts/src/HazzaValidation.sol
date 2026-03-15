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
    error LeadingHyphen();
    error TrailingHyphen();
    error ConsecutiveHyphens();

    /// @dev Strict ASCII validation for public commit-reveal path
    function validateNameStrict(string calldata name) external pure {
        bytes memory b = bytes(name);
        uint256 len = b.length;

        if (len < MIN_NAME_LENGTH) revert NameTooShort();
        if (len > MAX_NAME_LENGTH) revert NameTooLong();
        if (b[0] == 0x2D) revert LeadingHyphen();
        if (b[len - 1] == 0x2D) revert TrailingHyphen();

        bool prevHyphen = false;
        for (uint256 i = 0; i < len; i++) {
            bytes1 c = b[i];
            if (c == 0x2D) {
                if (prevHyphen) revert ConsecutiveHyphens();
                prevHyphen = true;
            } else if ((c >= 0x30 && c <= 0x39) || (c >= 0x61 && c <= 0x7A)) {
                prevHyphen = false;
            } else {
                revert InvalidCharacter();
            }
        }
    }

    /// @dev Permissive UTF-8 validation for relayer path (ENSIP-15 normalized offchain)
    function validateNamePermissive(string calldata name, uint8 charCount) external pure {
        uint256 len = bytes(name).length;
        if (len == 0) revert NameTooShort();
        if (len > 255) revert NameTooLong();
        uint256 effectiveLen = charCount > 0 ? uint256(charCount) : len;
        if (effectiveLen < MIN_NAME_LENGTH) revert NameTooShort();
    }
}
