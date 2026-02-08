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

contract AddWethLiquidity is Script {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    // --- Configurations ---
    address constant POOL_MANAGER_BASE = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant ROUTER_BASE = 0xA87c3B41A24Ea5DeD1D625e9AF5AE771E91AEdF6; 

    address constant POOL_MANAGER_ARB = 0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317;
    address constant ROUTER_ARB = 0xD41512F9e58656134d9700871bc735952d9A6962;

    address constant POOL_MANAGER_ETH = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant ROUTER_ETH = 0x83E24F3C644400762e44a4B9f74a6a80F57C1524;

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("MAIN_WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Adding WETH Liquidity with account:", deployer);

        uint256 chainId = block.chainid;
        address pmAddr;
        address routerAddr;
        address token0; 
        address token1; 

        if (chainId == 84532) { // Base Sepolia
            pmAddr = POOL_MANAGER_BASE;
            routerAddr = ROUTER_BASE;
            token0 = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
            token1 = 0x4200000000000000000000000000000000000006;
        } else if (chainId == 421614) { // Arb Sepolia
            pmAddr = POOL_MANAGER_ARB;
            routerAddr = ROUTER_ARB;
            token0 = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
            token1 = 0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed;
        } else if (chainId == 11155111) { // Eth Sepolia
            pmAddr = POOL_MANAGER_ETH;
            routerAddr = ROUTER_ETH;
            token0 = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
            token1 = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
        } else {
            console.log("Unsupported Chain");
            return;
        }

        vm.startBroadcast(deployerPrivateKey);

        IPoolManager manager = IPoolManager(pmAddr);
        // Deploy a fresh PoolModifyLiquidityTest to ensure we have the right contract
        PoolModifyLiquidityTest router = new PoolModifyLiquidityTest(manager);
        console.log("Deployed new Router at:");
        console.log(address(router));

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
        console.log("Current SqrtPrice:");
        console.logUint(sqrtPriceX96);

        if (sqrtPriceX96 == 0) {
            console.log("Pool not initialized");
            return;
        }

        // Calculate Range strictly BELOW current tick to provide Pure WETH (Token1)
        // With Token0=USDC, Token1=WETH. Price P=y/x (Price of USDC in WETH).
        // High Tick = High Price of USDC = Requires USDC.
        // Low Tick = Low Price of USDC (High WETH) = Requires WETH.
        
        // We want tickUpper <= tick.
        
        int24 tickSpacing = 200;
        // Floor to specific spacing
        int24 tickUpper = (tick / tickSpacing) * tickSpacing;
        
        // If tickUpper > tick (can happen with negative numbers logic?), fix it.
        // But for positive numbers (Base), truncation rounds down. 
        // 202513 -> 202400. 202400 <= 202513. Correct.
        
        // Ensure strictly < tick?
        // Actually if Range is [A, B]. If B <= CurrentTick. 
        // Then Range is "Below".
        
        int24 tickLower = tickUpper - tickSpacing;
        
        if (tickUpper > tick) {
             // Should not happen for positive ticks, but strictly enforcing logic:
             tickUpper -= tickSpacing;
             tickLower -= tickSpacing;
        } 

        console.log("Target Range (Pure WETH):");
        console.logInt(tickLower);
        console.logInt(tickUpper);

        IERC20(token0).approve(address(router), type(uint256).max);
        IERC20(token1).approve(address(router), type(uint256).max);
        
        console.log("Allowance Token0:", IERC20(token0).allowance(deployer, address(router)));
        console.log("Allowance Token1:", IERC20(token1).allowance(deployer, address(router)));
        
        uint256 wethBal = IERC20(token1).balanceOf(deployer);
        console.log("WETH Balance:");
        console.logUint(wethBal);
        
        if (wethBal == 0) {
            console.log("No WETH balance");
            return;
        }
        
        // Use 50% of WETH to be super safe
        uint256 wethAmount = wethBal * 50 / 100;
        
        uint160 sqrtRatioLower = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtRatioUpper = TickMath.getSqrtPriceAtTick(tickUpper);
        
        uint256 diff = uint256(sqrtRatioUpper) - uint256(sqrtRatioLower);
        // L = (amount * 2^96) / diff
        uint256 liquidity = (wethAmount << 96) / diff;
        
        int256 liqInt = int256(liquidity);
        
        console.log("Adding Liquidity:");
        console.logUint(uint256(liqInt));

        router.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: liqInt,
                salt: bytes32(0) 
            }),
            hex"" 
        );

        console.log("Liquidity Added!");
        vm.stopBroadcast();
    }
}
