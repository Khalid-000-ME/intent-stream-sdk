// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {TINTHook} from "../contracts/TINTHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";

contract DeployTINTHook is Script {
    // Uniswap V4 PoolManager addresses
    address constant POOL_MANAGER_ETH = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543; // Sepolia
    address constant POOL_MANAGER_BASE = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408; // Base Sepolia
    address constant POOL_MANAGER_ARB = 0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317; // Arbitrum Sepolia

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Determine network
        uint256 chainId = block.chainid;
        address poolManager;
        string memory network;
        
        if (chainId == 11155111) {
            poolManager = POOL_MANAGER_ETH;
            network = "Ethereum Sepolia";
        } else if (chainId == 84532) {
            poolManager = POOL_MANAGER_BASE;
            network = "Base Sepolia";
        } else if (chainId == 421614) {
            poolManager = POOL_MANAGER_ARB;
            network = "Arbitrum Sepolia";
        } else {
            revert("Unsupported network");
        }

        console.log("Deploying TINTHook to:", network);
        console.log("PoolManager:", poolManager);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy TINTHook
        TINTHook hook = new TINTHook(IPoolManager(poolManager));

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log("TINTHook deployed at:", address(hook));
        console.log("\nAdd to .env:");
        console.log("TINT_HOOK_ADDRESS=\"%s\"", address(hook));
        
        // Verify hook permissions
        Hooks.Permissions memory permissions = hook.getHookPermissions();
        console.log("\nHook Permissions:");
        console.log("  beforeSwap:", permissions.beforeSwap);
        console.log("  afterSwap:", permissions.afterSwap);
    }
}
