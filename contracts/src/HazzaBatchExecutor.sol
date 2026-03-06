// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title HazzaBatchExecutor
/// @notice Executes multiple calls in a single transaction, continuing on failure.
///         Supports mixed ETH + ERC20 operations. User approves this contract once per token,
///         then the executor pulls tokens, approves downstream protocols, and executes.
///         Designed for hazza.name cart checkout: buy listings, register names, renew — all at once.
contract HazzaBatchExecutor {
    struct TokenPull {
        address token;    // ERC20 token address
        uint256 amount;   // Amount to pull from msg.sender
        address spender;  // Protocol to approve (e.g. Seaport)
    }

    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    /// @notice Execute a batch with ERC20 token handling.
    ///         User approves this contract for each token. Executor pulls tokens,
    ///         approves downstream protocols, then executes all calls.
    ///         Failures don't revert the batch. Leftover tokens + ETH are refunded.
    /// @param tokens Tokens to pull from user and approve to downstream protocols
    /// @param calls Array of {target, value, data} to execute
    /// @return results Array of {success, returnData} for each call
    function executeBatch(
        TokenPull[] calldata tokens,
        Call[] calldata calls
    ) external payable returns (Result[] memory results) {
        // 1. Pull tokens from user and approve downstream protocols
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20Minimal token = IERC20Minimal(tokens[i].token);
            token.transferFrom(msg.sender, address(this), tokens[i].amount);
            token.approve(tokens[i].spender, tokens[i].amount);
        }

        // 2. Execute all calls (continue on failure)
        results = new Result[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory ret) = calls[i].target.call{value: calls[i].value}(calls[i].data);
            results[i] = Result({success: success, returnData: ret});
        }

        // 3. Refund leftover tokens
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20Minimal token = IERC20Minimal(tokens[i].token);
            uint256 remaining = token.balanceOf(address(this));
            if (remaining > 0) {
                token.transfer(msg.sender, remaining);
            }
            // Clear approvals
            token.approve(tokens[i].spender, 0);
        }

        // 4. Refund leftover ETH
        uint256 ethRemaining = address(this).balance;
        if (ethRemaining > 0) {
            (bool sent,) = msg.sender.call{value: ethRemaining}("");
            require(sent, "ETH refund failed");
        }
    }

    /// @notice Atomic version — reverts everything if ANY call fails.
    ///         Same token handling but no partial success.
    function executeBatchAtomic(
        TokenPull[] calldata tokens,
        Call[] calldata calls
    ) external payable {
        // Pull tokens and approve
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20Minimal token = IERC20Minimal(tokens[i].token);
            token.transferFrom(msg.sender, address(this), tokens[i].amount);
            token.approve(tokens[i].spender, tokens[i].amount);
        }

        // Execute all calls — revert on any failure
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory ret) = calls[i].target.call{value: calls[i].value}(calls[i].data);
            if (!success) {
                if (ret.length > 0) {
                    assembly { revert(add(ret, 32), mload(ret)) }
                }
                revert("Call failed");
            }
        }

        // Refund leftover tokens
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20Minimal token = IERC20Minimal(tokens[i].token);
            uint256 remaining = token.balanceOf(address(this));
            if (remaining > 0) {
                token.transfer(msg.sender, remaining);
            }
            token.approve(tokens[i].spender, 0);
        }

        // Refund leftover ETH
        uint256 ethRemaining = address(this).balance;
        if (ethRemaining > 0) {
            (bool sent,) = msg.sender.call{value: ethRemaining}("");
            require(sent, "ETH refund failed");
        }
    }

    /// @notice Simple batch without token handling (ETH-only calls)
    function executeBatchSimple(Call[] calldata calls) external payable returns (Result[] memory results) {
        results = new Result[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory ret) = calls[i].target.call{value: calls[i].value}(calls[i].data);
            results[i] = Result({success: success, returnData: ret});
        }
        uint256 ethRemaining = address(this).balance;
        if (ethRemaining > 0) {
            (bool sent,) = msg.sender.call{value: ethRemaining}("");
            require(sent, "ETH refund failed");
        }
    }

    receive() external payable {}
}
