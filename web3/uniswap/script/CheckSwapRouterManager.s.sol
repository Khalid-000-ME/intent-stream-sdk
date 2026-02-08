// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";

contract CheckSwapRouterManager is Script {
    PoolSwapTest constant router = PoolSwapTest(0x96E3495b712c6589f1D2c50635FDE68CF17AC83c);
    function run() external view {
        console.log("SwapRouter Address:", address(router));
        console.log("Manager Address:", address(router.manager()));
    }
}
