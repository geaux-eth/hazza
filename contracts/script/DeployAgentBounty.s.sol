// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/HazzaAgentBounty.sol";

contract DeployAgentBounty is Script {
    function run() external {
        // Registry address on Base mainnet
        address registry = 0xdf92cA2fc1e588F7A2ebAEA039CF3860826f4746;

        vm.startBroadcast();
        HazzaAgentBounty bounty = new HazzaAgentBounty(registry);
        vm.stopBroadcast();

        console.log("HazzaAgentBounty deployed at:", address(bounty));
    }
}
