// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/HazzaAgentBounty.sol";

contract DeployAgentBounty is Script {
    function run() external {
        // Registry address on Base mainnet
        address registry = 0xaA27d926F057B72D006883785FC03DB1d9d6E3AC;

        vm.startBroadcast();
        HazzaAgentBounty bounty = new HazzaAgentBounty(registry);
        vm.stopBroadcast();

        console.log("HazzaAgentBounty deployed at:", address(bounty));
    }
}
