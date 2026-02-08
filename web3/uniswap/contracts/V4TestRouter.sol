// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {CurrencySettler} from "@openzeppelin/uniswap-hooks/src/utils/CurrencySettler.sol";

contract V4TestRouter is IUnlockCallback {
    using CurrencyLibrary for Currency;
    using BalanceDeltaLibrary for BalanceDelta;
    using CurrencySettler for Currency;

    IPoolManager public immutable manager;

    constructor(IPoolManager _manager) {
        manager = _manager;
    }

    struct CallbackData {
        address sender;
        PoolKey key;
        SwapParams swapParams;
        ModifyLiquidityParams liqParams;
        bytes hookData;
        bool isSwap;
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(manager), "Only manager");
        
        // Handle simple redemption (address sender, address currency, uint256 amount)
        if (data.length == 96) {
            (address sender, Currency currency, uint256 amount) = abi.decode(data, (address, Currency, uint256));
            // Burn the user's 6909 claims
            currency.settle(manager, sender, amount, true); // true = burn claims
            // Deliver ERC-20 tokens to the user
            currency.take(manager, sender, amount, false);  // false = ERC-20
            return "";
        }

        CallbackData memory cbData = abi.decode(data, (CallbackData));
        
        BalanceDelta delta;
        if (cbData.isSwap) {
            delta = manager.swap(cbData.key, cbData.swapParams, cbData.hookData);
        } else {
            (delta, ) = manager.modifyLiquidity(cbData.key, cbData.liqParams, cbData.hookData);
        }

        // Handle Currency 0
        int128 delta0 = delta.amount0();
        if (delta0 < 0) {
            cbData.key.currency0.settle(manager, cbData.sender, uint256(uint128(-delta0)), false);
        } else if (delta0 > 0) {
            // Keep as claims (true) or take as ERC-20 (false)?
            // Default to ERC-20 for better user experience unless they specify
            cbData.key.currency0.take(manager, cbData.sender, uint256(uint128(delta0)), false);
        }

        // Handle Currency 1
        int128 delta1 = delta.amount1();
        if (delta1 < 0) {
            cbData.key.currency1.settle(manager, cbData.sender, uint256(uint128(-delta1)), false);
        } else if (delta1 > 0) {
            cbData.key.currency1.take(manager, cbData.sender, uint256(uint128(delta1)), false);
        }

        return abi.encode(delta);
    }

    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData) external payable {
        manager.unlock(abi.encode(CallbackData(msg.sender, key, params, ModifyLiquidityParams(0, 0, 0, bytes32(0)), hookData, true)));
    }

    function addLiquidity(PoolKey memory key, ModifyLiquidityParams memory params, bytes calldata hookData) external payable {
        manager.unlock(abi.encode(CallbackData(msg.sender, key, SwapParams(false, 0, 0), params, hookData, false)));
    }

    function redeem(Currency currency, uint256 amount) external {
        manager.unlock(abi.encode(msg.sender, currency, amount));
    }

    receive() external payable {}
}
