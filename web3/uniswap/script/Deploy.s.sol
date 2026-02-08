// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {UniswapV4PoolCreator} from "../contracts/UniswapV4PoolCreator.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {CurrencyLibrary} from "v4-core/src/types/Currency.sol";

/**
 * @title Deploy and create pools on Uniswap v4
 * @notice Deployment script for UniswapV4PoolCreator
 */
contract DeployPoolCreator is Script {
    using CurrencyLibrary for Currency;

    // Replace these with actual addresses for your network
    address constant POOL_MANAGER = address(0); // TODO: Add PoolManager address
    address constant POSITION_MANAGER = address(0); // TODO: Add PositionManager address
    address constant PERMIT2 = address(0); // TODO: Add Permit2 address

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy the pool creator contract
        UniswapV4PoolCreator poolCreator = new UniswapV4PoolCreator(
            POOL_MANAGER,
            POSITION_MANAGER,
            PERMIT2
        );

        console.log("UniswapV4PoolCreator deployed at:", address(poolCreator));

        vm.stopBroadcast();
    }
}

/**
 * @title Example script to create a pool without liquidity
 */
contract CreatePoolOnly is Script {
    using CurrencyLibrary for Currency;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address poolCreatorAddress = vm.envAddress("POOL_CREATOR_ADDRESS");

        UniswapV4PoolCreator poolCreator = UniswapV4PoolCreator(payable(poolCreatorAddress));

        // Example: Create ETH/USDC pool
        Currency currency0 = CurrencyLibrary.ADDRESS_ZERO; // ETH
        Currency currency1 = Currency.wrap(vm.envAddress("USDC_ADDRESS"));
        uint24 fee = 3000; // 0.30%
        int24 tickSpacing = 60;
        address hooks = address(0); // No hooks
        uint160 sqrtPriceX96 = poolCreator.getSqrtPriceX96For1to1();

        vm.startBroadcast(deployerPrivateKey);

        poolCreator.createPool(
            currency0,
            currency1,
            fee,
            tickSpacing,
            hooks,
            sqrtPriceX96
        );

        console.log("Pool created successfully!");

        vm.stopBroadcast();
    }
}

/**
 * @title Example script to create a pool with initial liquidity
 */
contract CreatePoolWithLiquidity is Script {
    using CurrencyLibrary for Currency;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address poolCreatorAddress = vm.envAddress("POOL_CREATOR_ADDRESS");

        UniswapV4PoolCreator poolCreator = UniswapV4PoolCreator(payable(poolCreatorAddress));

        // Example: Create USDC/USDT pool with liquidity
        Currency currency0 = Currency.wrap(vm.envAddress("USDC_ADDRESS"));
        Currency currency1 = Currency.wrap(vm.envAddress("USDT_ADDRESS"));
        uint24 fee = 500; // 0.05%
        int24 tickSpacing = 10;
        address hooks = address(0);
        uint160 sqrtPriceX96 = poolCreator.getSqrtPriceX96For1to1();

        // Position parameters
        int24 tickLower = -600; // Must be multiple of tickSpacing
        int24 tickUpper = 600;
        uint256 liquidity = 1000000e18; // Adjust based on your needs
        uint256 amount0Max = 1000e6; // 1000 USDC
        uint256 amount1Max = 1000e6; // 1000 USDT
        address recipient = vm.addr(deployerPrivateKey);
        bytes memory hookData = "";

        vm.startBroadcast(deployerPrivateKey);

        poolCreator.createPoolWithLiquidity(
            currency0,
            currency1,
            fee,
            tickSpacing,
            hooks,
            sqrtPriceX96,
            tickLower,
            tickUpper,
            liquidity,
            amount0Max,
            amount1Max,
            recipient,
            hookData
        );

        console.log("Pool with liquidity created successfully!");

        vm.stopBroadcast();
    }
}
