// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";

contract AddLiquidityBaseSepolia is Script {
    using CurrencyLibrary for Currency;
    
    PoolModifyLiquidityTest constant router = 
        PoolModifyLiquidityTest(0x37429cD17Cb1454C34E7F50b09725202Fd533039);
    
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    
    function run() external {
        address deployer = msg.sender;
        
        console.log("=== Add Liquidity to Base Sepolia ===");
        console.log("Deployer:", deployer);
        
        // Check balances
        uint256 usdcBalance = IERC20(USDC).balanceOf(deployer);
        uint256 wethBalance = IERC20(WETH).balanceOf(deployer);
        
        console.log("\nCurrent Balances:");
        console.log("  USDC:", usdcBalance / 1e6, "USDC");
        console.log("  WETH:", wethBalance / 1e18, "WETH");
        
        vm.startBroadcast();
        
        PoolKey memory pool = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        
        // Approve tokens for router
        IERC20(USDC).approve(address(router), type(uint256).max);
        IERC20(WETH).approve(address(router), type(uint256).max);
        
        // Add liquidity with 1 USDC worth
        // At 1:1 price, we need ~1 USDC and ~0.001 WETH
        // Using a narrow tick range around current price to minimize capital
        
        // Tick range: -600 to 600 (very narrow, ~10% price range)
        int24 tickLower = -600;
        int24 tickUpper = 600;
        
        // Small liquidity amount that requires ~1 USDC
        int256 liquidityDelta = 1e15; // Much smaller amount
        
        console.log("\nAdding liquidity:");
        console.log("  Narrow tick range for minimal capital");
        console.log("  Liquidity Delta:", uint256(liquidityDelta));
        
        router.modifyLiquidity(
            pool,
            ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: liquidityDelta,
                salt: bytes32(0)
            }),
            bytes("")
        );
        
        vm.stopBroadcast();
        
        // Check new balances
        uint256 newUsdcBalance = IERC20(USDC).balanceOf(deployer);
        uint256 newWethBalance = IERC20(WETH).balanceOf(deployer);
        
        console.log("\nNew Balances:");
        console.log("  USDC:", newUsdcBalance / 1e6, "USDC");
        console.log("  WETH:", newWethBalance / 1e18, "WETH");
        
        console.log("\nUsed:");
        console.log("  USDC:", (usdcBalance - newUsdcBalance) / 1e6, "USDC");
        console.log("  WETH:", (wethBalance - newWethBalance) / 1e18, "WETH");
        
        console.log("\n[SUCCESS] Liquidity added!");
    }
}
