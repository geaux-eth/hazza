// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {HazzaBountyEscrowV5} from "../src/HazzaBountyEscrowV5.sol";

/// @title Upgrade Bounty Escrow to V5
/// @notice Deploy new V5 implementation, then upgrade the proxy via Safe multisig.
/// @dev Steps:
///   1. Run this script to deploy the new implementation contract
///   2. In Safe UI, propose upgradeToAndCall(v5Impl, initializeV5(seaport)) on the proxy
///
///   Proxy: 0x95a29AD7f23c1039A03de365c23D275Fc5386f90
///   Safe:  0x87D69A843973663eAb9D5B8ef31F773131fC9737
contract UpgradeBountyEscrowV5 is Script {
    function run() external {
        // Base mainnet Seaport 1.6
        address seaport = 0x0000000000000068F116a894984e2DB1123eB395;

        vm.startBroadcast();

        // Deploy new V5 implementation
        HazzaBountyEscrowV5 v5Impl = new HazzaBountyEscrowV5();
        console.log("V5 Implementation:", address(v5Impl));

        // Encode the initializeV5 call for upgradeToAndCall
        bytes memory initV5Data = abi.encodeWithSelector(
            HazzaBountyEscrowV5.initializeV5.selector,
            seaport
        );
        console.log("initializeV5 calldata (for Safe UI upgradeToAndCall):");
        console.logBytes(initV5Data);

        // Encode the full upgradeToAndCall for convenience (paste into Safe tx builder)
        bytes memory upgradeCall = abi.encodeWithSignature(
            "upgradeToAndCall(address,bytes)",
            address(v5Impl),
            initV5Data
        );
        console.log("\nFull upgradeToAndCall calldata (paste into Safe tx builder):");
        console.logBytes(upgradeCall);
        console.log("\nTarget (proxy): 0x95a29AD7f23c1039A03de365c23D275Fc5386f90");

        vm.stopBroadcast();
    }
}
