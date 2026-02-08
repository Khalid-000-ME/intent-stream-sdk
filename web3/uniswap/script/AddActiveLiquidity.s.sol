// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";


interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract AddActiveLiquidity is Script {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    address constant POOL_MANAGER_BASE = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant POOL_MANAGER_ETH = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("MAIN_WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Adding ACTIVE Liquidity (Both Sides) with account:", deployer);

        uint256 chainId = block.chainid;
        address pmAddr;
        address token0; 
        address token1; 

        if (chainId == 84532) { // Base Sepolia
            pmAddr = POOL_MANAGER_BASE;
            token0 = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
            token1 = 0x4200000000000000000000000000000000000006;
        } else if (chainId == 11155111) { // Eth Sepolia
            pmAddr = POOL_MANAGER_ETH;
            token0 = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
            token1 = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
        } else {
            console.log("Unsupported Chain");
            return;
        }

        vm.startBroadcast(deployerPrivateKey);

        IPoolManager manager = IPoolManager(pmAddr);
        PoolModifyLiquidityTest router = new PoolModifyLiquidityTest(manager);
        console.log("Deployed Router:", address(router));

        if (token0 > token1) (token0, token1) = (token1, token0);
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: 10000, 
            tickSpacing: 200,
            hooks: IHooks(address(0))
        });

        PoolId id = key.toId();
        (uint160 sqrtPriceX96, int24 tick, , ) = manager.getSlot0(id);

        console.log("Current Tick:");
        console.logInt(tick);
        
        if (sqrtPriceX96 == 0) {
            console.log("Pool not initialized");
            return;
        }

        // Target Active Range (Includes Current Tick)
        int24 tickSpacing = 200;
        int24 tickLower = (tick / tickSpacing) * tickSpacing;
        
        // Ensure tickLower <= tick < tickUpper
        // If tick is negative, division rounds towards zero.
        // -210 / 200 = -1. -200. -200 > -210.
        // So for negative numbers we might need adjustments to ensure wrapping.
        // TickMath doesn't provide floor, we do it manually.
        if (tick < 0 && tick % tickSpacing != 0) {
             tickLower -= tickSpacing;
        }
        // Base Sepolia tick ~ 202513 (Positive). So logic holds.
        // 202400 <= 202513. Correct.
        
        int24 tickUpper = tickLower + tickSpacing; 

        console.log("Target Active Range:");
        console.logInt(tickLower);
        console.logInt(tickUpper);

        // Approve
        IERC20(token0).approve(address(router), type(uint256).max);
        IERC20(token1).approve(address(router), type(uint256).max);
        
        uint256 bal0 = IERC20(token0).balanceOf(deployer);
        uint256 bal1 = IERC20(token1).balanceOf(deployer);
        
        console.log("Bal0 (USDC?):");
        console.logUint(bal0);
        console.log("Bal1 (WETH?):");
        console.logUint(bal1);

        // Calculate Liquidity based on Token0 constraints (since we have little USDC)
        // Use 50% of Token0
        uint256 amount0Desired = bal0 * 50 / 100;
        
        uint160 sqrtRatioAX96 = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtPriceAtTick(tickUpper);
        
        // L0 calculation based on amount0 (USDC)
        // L = amount0 * sqrtP * sqrtB / (sqrtB - sqrtP)
        
        // Correct Formula: L = amount0 * (sqrtP * sqrtB) / (sqrtB - sqrtP)
        // sqrtP * sqrtB is Q192.
        // We want L (raw).
        // amount0 * Q192 / Q96 = amount0 * Q96.
        // Then >> 96 at end?
        
        // Let's approximate since exact precision isn't critical for "Adding some liquidity".
        // We just need meaningful amount that fits balance.
        
        uint256 diff0 = uint256(sqrtRatioBX96) - uint256(sqrtPriceX96);
        // Avoid division by zero
        if (diff0 == 0) diff0 = 1;
        
        uint256 L0 = (amount0Desired * uint256(sqrtPriceX96));
        // Check overflow for intermediate
        // amount0 (~1e6) * sqrtP (~1e33) = ~1e39. Safe.
        L0 = L0 / diff0;
        L0 = (L0 * uint256(sqrtRatioBX96)) >> 96;
        
        console.log("L0 (USDC constrained):");
        console.logUint(L0);

        // L1 calculation based on amount1 (WETH)
        // L = amount1 / (sqrtP - sqrtA)
        // Term is (sqrtP - sqrtA) [Q96]
        // L = amount1 * 2^96 / term.
        
        uint256 diff1 = uint256(sqrtPriceX96) - uint256(sqrtRatioAX96);
        uint256 L1 = (bal1 * 50 / 100) << 96;
        L1 = L1 / diff1;
        
        console.log("L1 (WETH constrained):");
        console.logUint(L1);
        
        // Take MIN
        uint256 L = L0 < L1 ? L0 : L1;
        
        // If L is too small?
        if (L == 0) {
            console.log("Liquidity calculation resulted in 0. Check balances/ticks.");
            return;
        }
        
        console.log("Final Liquidity L:");
        console.logUint(L);
        
        router.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: int256(L),
                salt: bytes32(0) 
            }),
            hex"" 
        );

        console.log("Active Liquidity Added!");
        vm.stopBroadcast();
    }
}
