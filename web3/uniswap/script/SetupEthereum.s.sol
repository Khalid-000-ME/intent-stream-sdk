// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol"; // Implementation.
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";

contract SetupEthereum is Script {
    using CurrencyLibrary for Currency;

    // Official Addresses (Ethereum Sepolia)
    IPoolManager constant manager = IPoolManager(0xE03A1074c86CFeDd5C142C4F04F1a1536e203543);
    PoolModifyLiquidityTest constant liquidityRouter = PoolModifyLiquidityTest(0x0C478023803a644c94c4CE1C1e7b9A087e411B0A);
    PoolSwapTest constant swapRouter = PoolSwapTest(0x9B6b46e2c869aa39918Db7f52f5557FE577B6eEe);

    // Token Addresses (Ethereum Sepolia)
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
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
