// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {TINTNettingVerifier} from "../contracts/TINTNettingVerifier.sol";

contract DeployTINTVerifier is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        uint256 chainId = block.chainid;
        string memory network;
        
        if (chainId == 11155111) {
            network = "Ethereum Sepolia";
        } else if (chainId == 84532) {
            network = "Base Sepolia";
        } else if (chainId == 421614) {
            network = "Arbitrum Sepolia";
        } else {
            network = "Unknown";
        }

        console.log("Deploying TINTNettingVerifier to:", network);

        vm.startBroadcast(deployerPrivateKey);

        TINTNettingVerifier verifier = new TINTNettingVerifier();

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log("TINTNettingVerifier deployed at:", address(verifier));
        console.log("\nAdd to .env:");
        console.log("TINT_VERIFIER_ADDRESS=\"%s\"", address(verifier));
    }
}
