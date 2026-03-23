// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {HazzaBountyEscrowV4} from "../src/HazzaBountyEscrowV4.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployBountyEscrow is Script {
    function run() external {
        address registry = 0xD4E420201fE02F44AaF6d28D4c8d3A56fEaE0D3E;
        address owner = msg.sender; // deployer = owner (transfer to multisig later)

        vm.startBroadcast();

        // 1. Deploy implementation
        HazzaBountyEscrowV4 impl = new HazzaBountyEscrowV4();
        console.log("Implementation:", address(impl));

        // 2. Deploy proxy with initialize call
        bytes memory initData = abi.encodeWithSelector(
            HazzaBountyEscrowV4.initialize.selector,
            registry,
            owner
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        console.log("Proxy (use this address):", address(proxy));

        vm.stopBroadcast();
    }
}
