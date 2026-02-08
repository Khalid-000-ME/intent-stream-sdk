// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";

contract CreateCorrectPool is Script {
    using CurrencyLibrary for Currency;

    IPoolManager constant manager = IPoolManager(0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408);
    PoolModifyLiquidityTest constant router = PoolModifyLiquidityTest(0x37429cD17Cb1454C34E7F50b09725202Fd533039);
    
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    
    function run() external {
        vm.startBroadcast();
        
        // 1. Initialize Pool with Correct Market Price
        // Current Market: 1 WETH ~ 3000 USDC
        // Decimals: USDC (6), WETH (18)
        // 1 wei USDC = 1e-6 USDC value -> 3.33e-10 WETH value -> 3.33e8 wei WETH
        // Price P (T1/T0) = 333,333,333
        // SqrtPrice = sqrt(333333333) = 18257
        
        uint160 sqrtPriceX96 = 18257 * 79228162514264337593543950336;
        
        // Use Fee 10000 (1%) to get a fresh pool
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 10000, 
            tickSpacing: 200,
            hooks: IHooks(address(0))
        });
        
        // Pool already initialized (verified via check script)
        // Check/Init block commented out to avoid revert halting execution
        /*
        try manager.initialize(key, sqrtPriceX96) {
            console.log("Pool Initialized with Correct Price (1 USDC = 3.3e8 wei WETH)!");
        } catch {
            console.log("Pool already exists.");
        }
        */
        
        // 2. Add Liquidity (12 USDC)
        // L = (12/29) * 9.12e11 ~= 3.8e11
        int256 liquidityDelta = 380_000_000_000; 

        // Approve tokens
        IERC20(USDC).approve(address(router), type(uint256).max);
        IERC20(WETH).approve(address(router), type(uint256).max);

        router.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: -887200, // Align with 200 spacing
                tickUpper: 887200,
                liquidityDelta: liquidityDelta,
                salt: bytes32(0)
            }),
            bytes("")
        );
        console.log("Liquidity Added:", uint256(liquidityDelta));

        vm.stopBroadcast();
    }
}
