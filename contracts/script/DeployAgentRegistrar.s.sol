// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgentRegistrar.sol";

contract DeployAgentRegistrar is Script {
    // Base mainnet addresses
    address constant HAZZA_REGISTRY = 0xdf92cA2fc1e588F7A2ebAEA039CF3860826f4746;
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant ERC8004_REGISTRY = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;

    function run() external {
        vm.startBroadcast();

        AgentRegistrar registrar = new AgentRegistrar(
            HAZZA_REGISTRY,
            USDC_BASE,
            ERC8004_REGISTRY
        );

        vm.stopBroadcast();

        console.log("=== AgentRegistrar Deployed ===");
        console.log("AgentRegistrar:", address(registrar));
        console.log("HazzaRegistry:", HAZZA_REGISTRY);
        console.log("USDC:", USDC_BASE);
        console.log("ERC-8004:", ERC8004_REGISTRY);
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. Owner calls registry.setRelayer(AgentRegistrar, true, 0)");
        console.log("2. Nomi approves AgentRegistrar to spend USDC");
        console.log("3. Nomi calls registrar.registerFor(name, userAddress, charCount)");
    }
}
