// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/HazzaBountyEscrow.sol";

contract DeployBountyEscrow is Script {
    function run() external {
        address registry = 0xD4E420201fE02F44AaF6d28D4c8d3A56fEaE0D3E;

        vm.startBroadcast();
        HazzaBountyEscrow escrow = new HazzaBountyEscrow(registry);
        vm.stopBroadcast();

        console.log("HazzaBountyEscrow deployed at:", address(escrow));
    }
}
