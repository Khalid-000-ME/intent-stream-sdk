// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

/// @title PoolInitializer
/// @notice Contract to initialize Uniswap V4 pools
/// @dev Based on official Uniswap V4 documentation
contract PoolInitializer {
    IPoolManager public immutable poolManager;

    event PoolInitialized(
        Currency indexed currency0,
        Currency indexed currency1,
        uint24 fee,
        int24 tickSpacing,
        int24 tick
    );

    constructor(address _poolManager) {
        poolManager = IPoolManager(_poolManager);
    }

    /// @notice Initialize a pool with a starting price
    /// @param key The pool key containing currency pair, fee, tickSpacing, and hooks
    /// @param sqrtPriceX96 The starting price as sqrt(token1/token0) * 2^96
    /// @return tick The initial tick of the pool
    /// @dev For 1:1 price, use sqrtPriceX96 = 79228162514264337593543950336
    function initializePool(
        PoolKey memory key,
        uint160 sqrtPriceX96
    ) external returns (int24 tick) {
        // Validate that currencies are sorted
        require(
            Currency.unwrap(key.currency0) < Currency.unwrap(key.currency1),
            "Currencies must be sorted"
        );

        // Initialize the pool
        tick = poolManager.initialize(key, sqrtPriceX96);

        emit PoolInitialized(
            key.currency0,
            key.currency1,
            key.fee,
            key.tickSpacing,
            tick
        );
    }

    /// @notice Helper function to create a standard pool with 0.3% fee
    /// @param currency0 The first currency (must be < currency1)
    /// @param currency1 The second currency
    /// @param sqrtPriceX96 The starting price
    /// @return tick The initial tick of the pool
    function initializeStandardPool(
        Currency currency0,
        Currency currency1,
        uint160 sqrtPriceX96
    ) external returns (int24 tick) {
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,      // 0.3% fee
            tickSpacing: 60, // Standard tick spacing for 0.3% fee
            hooks: IHooks(address(0))
        });

        return this.initializePool(key, sqrtPriceX96);
    }

    /// @notice Helper to get the 1:1 price constant
    /// @return The sqrtPriceX96 value for 1:1 price
    function getSqrtPrice1to1() external pure returns (uint160) {
        return 79228162514264337593543950336;
    }
}
