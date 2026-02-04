// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {SafeCast} from "@uniswap/v4-core/src/libraries/SafeCast.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

contract V4TestRouter is IUnlockCallback {
    using CurrencyLibrary for Currency;
    using SafeCast for uint256;

    IPoolManager public manager;

    constructor(IPoolManager _manager) {
        manager = _manager;
    }

    struct CallbackData {
        address sender;
        PoolKey key;
        SwapParams params;
        bool isSwap;
        ModifyLiquidityParams liquidityParams;
        bytes hookData;
    }

    modifier onlyManager() {
        require(msg.sender == address(manager), "Only manager");
        _;
    }

    function unlockCallback(bytes calldata data) external onlyManager returns (bytes memory) {
        CallbackData memory cb = abi.decode(data, (CallbackData));

        if (cb.isSwap) {
             BalanceDelta delta = manager.swap(cb.key, cb.params, cb.hookData);
             _settle(cb.key.currency0, cb.sender, delta.amount0());
             _settle(cb.key.currency1, cb.sender, delta.amount1());
             _take(cb.key.currency0, cb.sender, delta.amount0());
             _take(cb.key.currency1, cb.sender, delta.amount1());
        } else {
             (BalanceDelta delta, ) = manager.modifyLiquidity(cb.key, cb.liquidityParams, cb.hookData);
             _settle(cb.key.currency0, cb.sender, delta.amount0());
             _settle(cb.key.currency1, cb.sender, delta.amount1());
             _take(cb.key.currency0, cb.sender, delta.amount0());
             _take(cb.key.currency1, cb.sender, delta.amount1());
        }
        return "";
    }

    function _settle(Currency currency, address payer, int128 amount) internal {
        if (amount < 0) {
            uint256 payAmount = uint256(int256(-amount));
            manager.sync(currency);
            IERC20(Currency.unwrap(currency)).transferFrom(payer, address(manager), payAmount);
            manager.settle();
        }
    }

    function _take(Currency currency, address recipient, int128 amount) internal {
        if (amount > 0) {
            manager.take(currency, recipient, uint256(int256(amount)));
        }
    }

    function swap(PoolKey memory key, SwapParams memory params, bytes memory hookData) external {
        CallbackData memory data = CallbackData({
            sender: msg.sender,
            key: key,
            params: params,
            isSwap: true,
            liquidityParams: ModifyLiquidityParams(0, 0, 0, bytes32(0)),
            hookData: hookData
        });
        manager.unlock(abi.encode(data));
    }

    function addLiquidity(PoolKey memory key, ModifyLiquidityParams memory params, bytes memory hookData) external {
        CallbackData memory data = CallbackData({
            sender: msg.sender,
            key: key,
            params: SwapParams(false, 0, 0),
            isSwap: false,
            liquidityParams: params,
            hookData: hookData
        });
        manager.unlock(abi.encode(data));
    }
}
