// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";

contract DeploySwapRouter is Script {
    // Official Managers from previous steps
    address constant BASE_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant ARB_MANAGER = 0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317;
    address constant ETH_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("MAIN_WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        uint256 chainId = block.chainid;
        address pmAddr;

        if (chainId == 84532) pmAddr = BASE_MANAGER;
        else if (chainId == 421614) pmAddr = ARB_MANAGER;
        else if (chainId == 11155111) pmAddr = ETH_MANAGER;
        else {
            console.log("Unsupported Chain");
            return;
        }

        vm.startBroadcast(deployerPrivateKey);
        PoolSwapTest router = new PoolSwapTest(IPoolManager(pmAddr));
        console.log("Deployed SwapRouter at:", address(router));
        vm.stopBroadcast();
    }
}
