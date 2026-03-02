// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/HazzaRegistry.sol";

contract DeployHazza is Script {
    // Base mainnet
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant ERC8004_REGISTRY = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;

    // Base Sepolia
    address constant USDC_BASE_SEPOLIA = 0x06A096A051906dEDd05Ef22dCF61ca1199bb038c;

    function run() external {
        address treasury = vm.envAddress("HAZZA_TREASURY");
        bool isTestnet = vm.envOr("TESTNET", false);

        // Optional — set to zero address if not deployed yet
        address netLibMembership = vm.envOr("NET_LIB_MEMBERSHIP", address(0));
        address unlimitedPass = vm.envOr("UNLIMITED_PASS", address(0));

        // Cheryl's Bankr wallet (relayer)
        address cherylWallet = vm.envOr("CHERYL_WALLET", address(0));

        // Website relayer (0% commission)
        address websiteRelayer = vm.envOr("WEBSITE_RELAYER", address(0));

        address usdc = isTestnet ? USDC_BASE_SEPOLIA : USDC_BASE;

        vm.startBroadcast();

        HazzaRegistry registry = new HazzaRegistry(
            usdc,
            ERC8004_REGISTRY,
            treasury,
            netLibMembership,
            unlimitedPass
        );

        // Set Cheryl as relayer with 25% commission
        if (cherylWallet != address(0)) {
            registry.setRelayer(cherylWallet, true, 2500);
        }

        // Set website relayer with 0% commission
        if (websiteRelayer != address(0)) {
            registry.setRelayer(websiteRelayer, true, 0);
        }

        vm.stopBroadcast();

        console.log("=== HAZZA Deployed ===");
        console.log("Registry:", address(registry));
        console.log("USDC:", usdc);
        console.log("ERC-8004:", ERC8004_REGISTRY);
        console.log("Treasury:", treasury);
        console.log("Net Library Membership:", netLibMembership);
        console.log("Unlimited Pass:", unlimitedPass);
        console.log("Cheryl (relayer):", cherylWallet);
        console.log("Network:", isTestnet ? "Base Sepolia" : "Base Mainnet");
    }
}
