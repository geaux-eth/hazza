// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/HazzaBatchExecutor.sol";

contract DeployBatchExecutor is Script {
    function run() external {
        vm.startBroadcast();
        HazzaBatchExecutor executor = new HazzaBatchExecutor();
        vm.stopBroadcast();
        console.log("BatchExecutor:", address(executor));
    }
}
