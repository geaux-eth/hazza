// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/OffchainResolver.sol";

contract DeployOffchainResolver is Script {
    function run() external {
        string memory gatewayUrl = vm.envString("CCIP_GATEWAY_URL");
        address signer = vm.envAddress("CCIP_SIGNER_ADDRESS");

        vm.startBroadcast();

        OffchainResolver resolver = new OffchainResolver(gatewayUrl, signer);

        vm.stopBroadcast();

        console.log("=== OffchainResolver Deployed ===");
        console.log("Resolver:", address(resolver));
        console.log("Gateway URL:", gatewayUrl);
        console.log("Signer:", signer);
        console.log("Owner:", msg.sender);
    }
}
