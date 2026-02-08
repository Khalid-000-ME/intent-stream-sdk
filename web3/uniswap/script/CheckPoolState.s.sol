// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";

contract CheckPoolState is Script {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    IPoolManager constant manager = IPoolManager(0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408);
    
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WETH = 0x4200000000000000000000000000000000000006;

    function run() external view {
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 10000,
            tickSpacing: 200,
            hooks: IHooks(address(0))
        });

        PoolId id = key.toId();
        
        (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee) = manager.getSlot0(id);
        uint128 liquidity = manager.getLiquidity(id);

        console.log("Pool State on Official Manager (0x05E7...):");
        console.log("PoolId:");
        console.logBytes32(PoolId.unwrap(id));
        console.log("SqrtPriceX96:", sqrtPriceX96);
        console.log("Tick:", tick);
        console.log("Liquidity:", liquidity);
        
        uint256 Q96 = 2**96;
        console.log("Q96:", Q96);
    }
}
