// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract SwapScript is Script {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    // SwapRouter Addresses (Passed via ENV SWAP_ROUTER)
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("MAIN_WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        address tokenIn = vm.envAddress("SWAP_TOKEN_IN");
        address tokenOut = vm.envAddress("SWAP_TOKEN_OUT");
        uint256 amountIn = vm.envUint("SWAP_AMOUNT");
        address routerAddr = vm.envAddress("SWAP_ROUTER");
        address recipient = vm.envAddress("SWAP_RECIPIENT"); // Optional recipient logic

        require(routerAddr != address(0), "Router not defined");

        console.log("Using Router:", routerAddr);

        vm.startBroadcast(deployerPrivateKey);

        // Approve Router
        IERC20(tokenIn).approve(routerAddr, amountIn);

        // Sort Tokens for PoolKey
        address currency0 = tokenIn < tokenOut ? tokenIn : tokenOut;
        address currency1 = tokenIn < tokenOut ? tokenOut : tokenIn;
        bool zeroForOne = tokenIn < tokenOut; 

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(currency0),
            currency1: Currency.wrap(currency1),
            fee: 10000,
            tickSpacing: 200,
            hooks: IHooks(address(0))
        });

        PoolSwapTest.TestSettings memory testSettings = PoolSwapTest.TestSettings({
            takeClaims: false, 
            settleUsingBurn: false
        });

        // V4 Exact Input: amountSpecified < 0
        int256 amountSpecified = -int256(amountIn);

        SwapParams memory params = SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: amountSpecified, 
            sqrtPriceLimitX96: zeroForOne ? uint160(4295128740) : uint160(1461446703485210103287273052203988822378723970341) 
        });

        BalanceDelta delta = PoolSwapTest(routerAddr).swap(key, params, testSettings, hex"");
        
        // Log Raw Delta for debugging
        console.logInt(BalanceDelta.unwrap(delta));
        
        // Handle Output Transfer
        int128 amount0 = delta.amount0();
        int128 amount1 = delta.amount1();
        
        int256 outputAmount;
        if (zeroForOne) {
            outputAmount = int256(amount1); // Input 0, Output 1
        } else {
            outputAmount = int256(amount0); // Input 1, Output 0
        }
        
        // Output should be negative (user receives)
        if (outputAmount < 0) {
            uint256 absOut = uint256(-outputAmount);
            if (recipient != address(0) && recipient != deployer) {
                IERC20(tokenOut).transfer(recipient, absOut);
                console.log("Transferred Output:", absOut);
            } else {
                console.log("Output kept in deployer wallet:", absOut);
                // Also log "Transferred Output" so API can parse it? 
                // Using "Transferred Output" as generic "Output Received" signal.
                console.log("Transferred Output:", absOut);
            }
        } else {
            console.log("Swap resulted in positive/zero output balance change? (Unexpected for Exact Input)");
        }
        
        vm.stopBroadcast();
    }
}
