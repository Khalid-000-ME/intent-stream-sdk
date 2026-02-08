// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {UniswapV4PoolCreator} from "../contracts/UniswapV4PoolCreator.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";

/**
 * @title Deploy PoolCreator and Create Pool on Base Sepolia
 */
contract DeployAndCreatePool is Script {
    using CurrencyLibrary for Currency;

    // Base Sepolia addresses
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant POSITION_MANAGER = 0x37429cD17Cb1454C34E7F50b09725202Fd533039;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WETH = 0x4200000000000000000000000000000000000006;

    function run() external {
        address deployer = msg.sender;

        console.log("=== Deploying on Base Sepolia ===");
        console.log("Deployer:", deployer);

        vm.startBroadcast();

        // 1. Deploy the pool creator contract
        UniswapV4PoolCreator poolCreator = new UniswapV4PoolCreator(
            POOL_MANAGER,
            POSITION_MANAGER,
            PERMIT2
        );

        console.log("\nUniswapV4PoolCreator deployed at:", address(poolCreator));

        // 2. Create USDC/WETH pool
        Currency currency0 = Currency.wrap(USDC);
        Currency currency1 = Currency.wrap(WETH);
        uint24 fee = 3000; // 0.30%
        int24 tickSpacing = 60;
        address hooks = address(0); // No hooks
        uint160 sqrtPriceX96 = poolCreator.getSqrtPriceX96For1to1();

        console.log("\n=== Creating USDC/WETH Pool ===");
        console.log("Currency0 (USDC):", Currency.unwrap(currency0));
        console.log("Currency1 (WETH):", Currency.unwrap(currency1));
        console.log("Fee: 3000 (0.3%)");

        PoolKey memory poolKey = poolCreator.createPool(
            currency0,
            currency1,
            fee,
            tickSpacing,
            hooks,
            sqrtPriceX96
        );

        vm.stopBroadcast();

        console.log("\n=== SUCCESS! ===");
        console.log("Pool created successfully!");
        console.log("PoolCreator:", address(poolCreator));
    }
}
