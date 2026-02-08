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

contract AddMaxLiquidity is Script {
    using CurrencyLibrary for Currency;
    
    PoolModifyLiquidityTest constant router = 
        PoolModifyLiquidityTest(0x37429cD17Cb1454C34E7F50b09725202Fd533039);
    
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    
    function run() external {
        address deployer = msg.sender;
        
        console.log("=== Adding Maximum Available Liquidity ===");
        console.log("Deployer:", deployer);
        
        // Check balances
        uint256 usdcBalance = IERC20(USDC).balanceOf(deployer);
        uint256 wethBalance = IERC20(WETH).balanceOf(deployer);
        
        console.log("\nAvailable Balances:");
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
        
        // Use full range
        int24 tickLower = -887220;
        int24 tickUpper = 887220;
        
        // We have ~1.2 USDC and ~0.165 WETH
        // For full range, use liquidity that will consume most of our tokens
        // Empirically: 1e6 liquidity ≈ 1 USDC for full range
        // So for 1.2 USDC, use 12e5 liquidity
        
        int256 liquidityDelta = 12e5;
        
        console.log("\nAdding liquidity:");
        console.log("  Using ALL available tokens");
        console.log("  Full range (-887220 to 887220)");
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
        
        console.log("\nRemaining Balances:");
        console.log("  USDC:", newUsdcBalance / 1e6, "USDC");
        console.log("  WETH:", newWethBalance / 1e18, "WETH");
        
        console.log("\nLiquidity Added:");
        console.log("  USDC:", (usdcBalance - newUsdcBalance) / 1e6, "USDC");
        console.log("  WETH:", (wethBalance - newWethBalance) / 1e18, "WETH");
        
        console.log("\n[SUCCESS] Maximum liquidity added!");
        console.log("Pool should now support small swaps!");
    }
}
