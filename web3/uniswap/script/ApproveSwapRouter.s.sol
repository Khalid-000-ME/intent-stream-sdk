// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

contract ApproveSwapRouter is Script {
    // Official PoolSwapTest on Base Sepolia
    address constant SWAP_ROUTER = 0x96E3495b712c6589f1D2c50635FDE68CF17AC83c;
    
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    
    function run() external {
        vm.startBroadcast();
        
        console.log("Approving Swap Router (PoolSwapTest):", SWAP_ROUTER);
        
        IERC20(USDC).approve(SWAP_ROUTER, type(uint256).max);
        console.log("Approved USDC");
        
        IERC20(WETH).approve(SWAP_ROUTER, type(uint256).max);
        console.log("Approved WETH");
        
        vm.stopBroadcast();
    }
}
