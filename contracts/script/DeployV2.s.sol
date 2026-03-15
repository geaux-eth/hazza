// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/HazzaConfig.sol";
import "../src/HazzaRegistryV2.sol";

contract DeployV2 is Script {
    // Base mainnet
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant ERC8004_REGISTRY = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;

    // Base Sepolia
    address constant USDC_BASE_SEPOLIA = 0x06A096A051906dEDd05Ef22dCF61ca1199bb038c;

    function run() external {
        address treasury = vm.envAddress("HAZZA_TREASURY");
        bool isTestnet = vm.envOr("TESTNET", false);

        address netLibMembership = vm.envOr("NET_LIB_MEMBERSHIP", address(0));
        address unlimitedPassAddr = vm.envOr("UNLIMITED_PASS", address(0));
        address relayerWallet = vm.envOr("RELAYER_WALLET", address(0));

        address usdc = isTestnet ? USDC_BASE_SEPOLIA : USDC_BASE;

        vm.startBroadcast();

        // Deploy config first
        HazzaConfig cfg = new HazzaConfig();

        // Deploy registry with config
        HazzaRegistryV2 registry = new HazzaRegistryV2(
            usdc,
            ERC8004_REGISTRY,
            treasury,
            address(cfg),
            netLibMembership,
            unlimitedPassAddr
        );

        // Set relayer with 0% commission
        if (relayerWallet != address(0)) {
            registry.setRelayer(relayerWallet, true, 0);
        }

        vm.stopBroadcast();

        console.log("=== HAZZA V2 Deployed ===");
        console.log("Config:", address(cfg));
        console.log("Registry:", address(registry));
        console.log("USDC:", usdc);
        console.log("ERC-8004:", ERC8004_REGISTRY);
        console.log("Treasury:", treasury);
        console.log("Net Library Membership:", netLibMembership);
        console.log("Unlimited Pass:", unlimitedPassAddr);
        console.log("Relayer:", relayerWallet);
        console.log("Network:", isTestnet ? "Base Sepolia" : "Base Mainnet");
    }
}
