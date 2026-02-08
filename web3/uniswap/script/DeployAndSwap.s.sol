// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";

contract DeployAndSwap is Script {
    using CurrencyLibrary for Currency;

    // The Manager where we added liquidity (0x05E7...)
    IPoolManager constant manager = IPoolManager(0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408);
    
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WETH = 0x4200000000000000000000000000000000000006;

    function run() external {
        address deployer = msg.sender;
        console.log("Deployer:", deployer);
        
        vm.startBroadcast();

        // 1. Deploy Swap Router linked to correct manager
        PoolSwapTest swapRouter = new PoolSwapTest(manager);
        console.log("Deployed New Swap Router:", address(swapRouter));

        // 2. Approve Tokens
        IERC20(USDC).approve(address(swapRouter), type(uint256).max);
        IERC20(WETH).approve(address(swapRouter), type(uint256).max);

        // 3. Swap on Fee 10000 Pool (1% Fee, Correct Price)
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 10000,
            tickSpacing: 200,
            hooks: IHooks(address(0))
        });

        // Swap 0.01 USDC -> WETH
        // zeroForOne = true
        // Limit: MIN + 1
        uint160 sqrtPriceLimit = 4295128740; 
        
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -10000, // 0.01 USDC
            sqrtPriceLimitX96: sqrtPriceLimit
        });
        
        PoolSwapTest.TestSettings memory settings = PoolSwapTest.TestSettings({
            takeClaims: false,
            settleUsingBurn: false
        });

        console.log("Swapping 0.01 USDC for WETH on correct pool...");
        swapRouter.swap(key, params, settings, "");
        console.log("Swap Successful on CORRECT POOL (Fee 10000)!");

        vm.stopBroadcast();
    }
}
