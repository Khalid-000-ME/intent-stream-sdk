// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";

contract TestSwap is Script {
    using CurrencyLibrary for Currency;
    
    PoolSwapTest constant swapRouter = 
        PoolSwapTest(0x96E3495b712c6589f1D2c50635FDE68CF17AC83c);
    
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    
    function run() external {
        address deployer = msg.sender;
        
        console.log("=== Testing Swap on Base Sepolia ===");
        console.log("Deployer:", deployer);
        
        uint256 usdcBefore = IERC20(USDC).balanceOf(deployer);
        uint256 wethBefore = IERC20(WETH).balanceOf(deployer);
        
        console.log("\nBalances Before:");
        console.log("  USDC:", usdcBefore / 1e6, "USDC");
        console.log("  WETH:", wethBefore / 1e18, "WETH");
        
        vm.startBroadcast();
        // Pool Key for Fee 10000
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 10000,
            tickSpacing: 200,
            hooks: IHooks(address(0))
        });
        
        // Approve tokens
        IERC20(USDC).approve(address(swapRouter), type(uint256).max);
        IERC20(WETH).approve(address(swapRouter), type(uint256).max);
        
        // Swap 0.01 USDC for WETH
        // For zeroForOne=true, price decreases, so use a very low limit
        // TickMath.MIN_SQRT_PRICE = 4295128739
        // But we need MIN_SQRT_PRICE + 1 to avoid the boundary
        uint160 sqrtPriceLimit = 4295128740; // MIN_SQRT_PRICE + 1
        
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -10000, // 0.01 USDC (negative = exact input)
            sqrtPriceLimitX96: sqrtPriceLimit
        });
        
        console.log("\nSwapping 0.01 USDC for WETH...");
        
        PoolSwapTest.TestSettings memory settings = PoolSwapTest.TestSettings({
            takeClaims: false,
            settleUsingBurn: false
        });
        
        swapRouter.swap(key, params, settings, "");
        
        vm.stopBroadcast();
        
        uint256 usdcAfter = IERC20(USDC).balanceOf(deployer);
        uint256 wethAfter = IERC20(WETH).balanceOf(deployer);
        
        console.log("\nBalances After:");
        console.log("  USDC:", usdcAfter / 1e6, "USDC");
        console.log("  WETH:", wethAfter / 1e18, "WETH");
        
        console.log("\nSwap Result:");
        console.log("  USDC spent:", (usdcBefore - usdcAfter) / 1e6, "USDC");
        console.log("  WETH received:", (wethAfter - wethBefore) / 1e18, "WETH");
        
        console.log("\n[SUCCESS] Swap completed!");
    }
}
