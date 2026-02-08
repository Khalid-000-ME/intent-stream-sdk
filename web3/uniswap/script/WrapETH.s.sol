// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

interface IWETH {
    function deposit() external payable;
    function balanceOf(address) external view returns (uint256);
}

contract WrapETH is Script {
    address constant WETH = 0x4200000000000000000000000000000000000006;
    
    function run() external {
        address deployer = msg.sender;
        
        console.log("=== Wrapping ETH to WETH on Base Sepolia ===");
        console.log("Deployer:", deployer);
        
        uint256 ethBalance = deployer.balance;
        uint256 wethBalanceBefore = IWETH(WETH).balanceOf(deployer);
        
        console.log("\nBalances Before:");
        console.log("  ETH:", ethBalance / 1e18, "ETH");
        console.log("  WETH:", wethBalanceBefore / 1e18, "WETH");
        
        vm.startBroadcast();
        
        // Wrap 0.1 ETH
        uint256 amountToWrap = 0.1 ether;
        
        console.log("\nWrapping 0.1 ETH to WETH...");
        IWETH(WETH).deposit{value: amountToWrap}();
        
        vm.stopBroadcast();
        
        uint256 wethBalanceAfter = IWETH(WETH).balanceOf(deployer);
        
        console.log("\nBalances After:");
        console.log("  WETH:", wethBalanceAfter / 1e18, "WETH");
        console.log("  Wrapped:", (wethBalanceAfter - wethBalanceBefore) / 1e18, "WETH");
        
        console.log("\n[SUCCESS] ETH wrapped to WETH!");
    }
}
