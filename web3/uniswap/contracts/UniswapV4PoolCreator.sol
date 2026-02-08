// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {IPoolInitializer_v4} from "v4-periphery/src/interfaces/IPoolInitializer_v4.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";

/**
 * @title UniswapV4PoolCreator
 * @notice Comprehensive contract for creating Uniswap v4 pools with or without initial liquidity
 * @dev Supports both standalone pool creation and atomic pool creation with liquidity
 */
contract UniswapV4PoolCreator {
    using CurrencyLibrary for Currency;

    IPoolManager public immutable poolManager;
    IPositionManager public immutable positionManager;
    address public immutable permit2;

    event PoolCreated(
        Currency indexed currency0,
        Currency indexed currency1,
        uint24 fee,
        int24 tickSpacing,
        address hooks,
        uint160 sqrtPriceX96
    );

    event PoolCreatedWithLiquidity(
        Currency indexed currency0,
        Currency indexed currency1,
        uint24 fee,
        int24 tickSpacing,
        address hooks,
        uint160 sqrtPriceX96,
        uint256 liquidity,
        address recipient
    );

    constructor(address _poolManager, address _positionManager, address _permit2) {
        poolManager = IPoolManager(_poolManager);
        positionManager = IPositionManager(_positionManager);
        permit2 = _permit2;
    }

    /**
     * @notice Creates a pool without initial liquidity
     * @param currency0 The first currency (must be < currency1)
     * @param currency1 The second currency
     * @param fee The LP fee in pips (e.g., 3000 = 0.30%)
     * @param tickSpacing The tick spacing for the pool
     * @param hooks The hook contract address (use address(0) for no hooks)
     * @param sqrtPriceX96 The starting price as sqrt(token1/token0) * 2^96
     * @return poolKey The PoolKey struct that uniquely identifies the pool
     */
    function createPool(
        Currency currency0,
        Currency currency1,
        uint24 fee,
        int24 tickSpacing,
        address hooks,
        uint160 sqrtPriceX96
    ) external returns (PoolKey memory poolKey) {
        // Validate currencies are sorted
        require(Currency.unwrap(currency0) < Currency.unwrap(currency1), "Currencies not sorted");

        // Configure the pool
        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(hooks)
        });

        // Initialize the pool
        poolManager.initialize(poolKey, sqrtPriceX96);

        emit PoolCreated(currency0, currency1, fee, tickSpacing, hooks, sqrtPriceX96);
    }

    /**
     * @notice Creates a pool with initial liquidity in a single transaction
     * @param currency0 The first currency (must be < currency1)
     * @param currency1 The second currency
     * @param fee The LP fee in pips (e.g., 3000 = 0.30%)
     * @param tickSpacing The tick spacing for the pool
     * @param hooks The hook contract address (use address(0) for no hooks)
     * @param sqrtPriceX96 The starting price as sqrt(token1/token0) * 2^96
     * @param tickLower The lower tick of the position (must be multiple of tickSpacing)
     * @param tickUpper The upper tick of the position (must be multiple of tickSpacing)
     * @param liquidity The amount of liquidity units to add
     * @param amount0Max Maximum amount of token0 willing to transfer
     * @param amount1Max Maximum amount of token1 willing to transfer
     * @param recipient Address to receive the liquidity position NFT
     * @param hookData Optional hook data
     * @return poolKey The PoolKey struct that uniquely identifies the pool
     */
    function createPoolWithLiquidity(
        Currency currency0,
        Currency currency1,
        uint24 fee,
        int24 tickSpacing,
        address hooks,
        uint160 sqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        uint256 liquidity,
        uint256 amount0Max,
        uint256 amount1Max,
        address recipient,
        bytes calldata hookData
    ) external payable returns (PoolKey memory poolKey) {
        // Validate currencies are sorted
        require(Currency.unwrap(currency0) < Currency.unwrap(currency1), "Currencies not sorted");

        // Validate tick ranges
        require(tickLower % tickSpacing == 0, "tickLower not multiple of tickSpacing");
        require(tickUpper % tickSpacing == 0, "tickUpper not multiple of tickSpacing");
        require(tickLower < tickUpper, "Invalid tick range");

        // Configure the pool
        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(hooks)
        });

        // Approve tokens if not native ETH
        if (!currency0.isAddressZero()) {
            _approveTokens(Currency.unwrap(currency0));
        }
        if (!currency1.isAddressZero()) {
            _approveTokens(Currency.unwrap(currency1));
        }

        // 1. Initialize multicall parameters
        bytes[] memory params = new bytes[](2);

        // 2. Encode initializePool parameters
        params[0] = abi.encodeWithSelector(
            IPoolInitializer_v4.initializePool.selector,
            poolKey,
            sqrtPriceX96
        );

        // 3. Initialize mint-liquidity parameters
        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION),
            uint8(Actions.SETTLE_PAIR)
        );

        // 4. Encode MINT_POSITION parameters
        bytes[] memory mintParams = new bytes[](2);
        mintParams[0] = abi.encode(
            poolKey,
            tickLower,
            tickUpper,
            liquidity,
            amount0Max,
            amount1Max,
            recipient,
            hookData
        );

        // 5. Encode SETTLE_PAIR parameters
        mintParams[1] = abi.encode(currency0, currency1);

        // 6. Encode modifyLiquidities call
        uint256 deadline = block.timestamp + 3600; // 1 hour deadline
        params[1] = abi.encodeWithSelector(
            positionManager.modifyLiquidities.selector,
            abi.encode(actions, mintParams),
            deadline
        );

        // 7. Execute multicall
        if (currency0.isAddressZero() || currency1.isAddressZero()) {
            // Handle native ETH
            positionManager.multicall{value: msg.value}(params);
        } else {
            positionManager.multicall(params);
        }

        emit PoolCreatedWithLiquidity(
            currency0,
            currency1,
            fee,
            tickSpacing,
            hooks,
            sqrtPriceX96,
            liquidity,
            recipient
        );
    }

    /**
     * @notice Helper function to approve tokens for Permit2 and PositionManager
     * @param token The token address to approve
     */
    function _approveTokens(address token) internal {
        // Approve Permit2 as spender
        IERC20(token).approve(permit2, type(uint256).max);

        // Approve PositionManager through Permit2
        IAllowanceTransfer(permit2).approve(
            token,
            address(positionManager),
            type(uint160).max,
            type(uint48).max
        );
    }

    /**
     * @notice Helper to calculate sqrtPriceX96 for a 1:1 pool
     * @return sqrtPriceX96 The sqrt price for a 1:1 ratio
     */
    function getSqrtPriceX96For1to1() external pure returns (uint160) {
        return 79228162514264337593543950336;
    }

    /**
     * @notice Allows contract to receive ETH
     */
    receive() external payable {}
}
