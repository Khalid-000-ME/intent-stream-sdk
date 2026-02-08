// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol"; // Implementation
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";

contract SetupArbitrum is Script {
    using CurrencyLibrary for Currency;

    // Official Addresses (Arbitrum Sepolia)
    IPoolManager constant manager = IPoolManager(0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317);
    PoolModifyLiquidityTest constant liquidityRouter = PoolModifyLiquidityTest(0x9A8ca723F5dcCb7926D00B71deC55c2fEa1F50f7);
    PoolSwapTest constant swapRouter = PoolSwapTest(0xf3A39C86dbd13C45365E57FB90fe413371F65AF8);

    // Token Addresses
    address constant USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    address constant WETH = 0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed;
    
    function run() external {
        vm.startBroadcast();
        address deployer = msg.sender;
        console.log("Using Official Manager:", address(manager));
        console.log("Using Official Liquidity Router:", address(liquidityRouter));
        console.log("Using Official Swap Router:", address(swapRouter));

        // ---------------------------------------------------------
        // Initialize Pool (Fee 10000)
        // ---------------------------------------------------------
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 10000, 
            tickSpacing: 200,
            hooks: IHooks(address(0))
        });
        
        uint160 sqrtPriceX96 = 18257 * 79228162514264337593543950336;
        
        /*
        try manager.initialize(key, sqrtPriceX96) {
            console.log("Pool Initialized!");
        } catch {
            console.log("Pool already exists.");
        }
        */

        // 4. Add Liquidity (10 USDC approx)
        int256 liquidityDelta = 10_000_000; 
        // Note: Exact amount depends on price, but 10e6 L is roughly order of magnitude of 10e6 tokens if P=1. 
        // If P=3000, might be different, but safe to try. 

        IERC20(USDC).approve(address(liquidityRouter), type(uint256).max);
        IERC20(WETH).approve(address(liquidityRouter), type(uint256).max);

        liquidityRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: -887200, 
                tickUpper: 887200,
                liquidityDelta: liquidityDelta,
                salt: bytes32(0)
            }),
            bytes("")
        );
        console.log("Liquidity Added:", uint256(liquidityDelta));

        // Approve Swap Router too
        IERC20(USDC).approve(address(swapRouter), type(uint256).max);
        IERC20(WETH).approve(address(swapRouter), type(uint256).max);

        vm.stopBroadcast();
    }
}
