// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract TestSwapSol is Script {
    using PoolIdLibrary for PoolKey;

    // Chain IDs
    uint256 constant BASE_SEPOLIA_ID = 84532;
    uint256 constant ARB_SEPOLIA_ID = 421614;
    uint256 constant ETH_SEPOLIA_ID = 11155111;

    // Swap Routers (PoolSwapTest)
    address constant BASE_ROUTER = 0xA87c3B41A24Ea5DeD1D625e9AF5AE771E91AEdF6; 
    address constant ARB_ROUTER = 0xf3A39C86dbd13C45365E57FB90fe413371F65AF8;
    address constant ETH_ROUTER = 0x9B6b46e2c869aa39918Db7f52f5557FE577B6eEe;

    // Tokens (Base)
    address constant BASE_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant BASE_WETH = 0x4200000000000000000000000000000000000006;
    
    // Tokens (Arbitrum)
    address constant ARB_USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    address constant ARB_WETH = 0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed;

    // Tokens (Ethereum)
    address constant ETH_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant ETH_WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;

    function run() external {
        uint256 id = block.chainid;
        uint256 deployerPrivateKey = vm.envUint("MAIN_WALLET_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        if (id == BASE_SEPOLIA_ID) {
            testSwap("Base Sepolia", BASE_ROUTER, BASE_USDC, BASE_WETH);
        } else if (id == ARB_SEPOLIA_ID) {
            testSwap("Arbitrum Sepolia", ARB_ROUTER, ARB_USDC, ARB_WETH);
        } else if (id == ETH_SEPOLIA_ID) {
            testSwap("Ethereum Sepolia", ETH_ROUTER, ETH_USDC, ETH_WETH);
        } else {
            console.log("Unsupported Chain ID:", id);
        }

        vm.stopBroadcast();
    }

    function testSwap(string memory name, address routerAddr, address usdc, address weth) internal {
        console.log("----------------------------------------");
        console.log(string.concat("Testing Swap on ", name, "..."));
        console.log("Router:", routerAddr);

        PoolSwapTest router = PoolSwapTest(routerAddr);
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(usdc),
            currency1: Currency.wrap(weth),
            fee: 10000,
            tickSpacing: 200,
            hooks: IHooks(address(0))
        });

        // Swap Amount: 1000 wei USDC (0.001 USDC)
        // Small amount to ensure we don't hit slippage limits on low-liquidity pools
        int256 amountSpecified = -1000; 

        // Check Balances Before
        uint256 balUSDCBefore = IERC20(usdc).balanceOf(msg.sender);
        uint256 balWETHBefore = IERC20(weth).balanceOf(msg.sender);
        
        console.log("USDC Before:", balUSDCBefore);
        console.log("WETH Before:", balWETHBefore);

        if (balUSDCBefore < 1000) {
            console.log("Error: Insufficient USDC balance to swap.");
            return;
        }

        // Approve
        IERC20(usdc).approve(routerAddr, type(uint256).max);
        
        // Swap Params
        SwapParams memory params = SwapParams({
            zeroForOne: true, // USDC -> WETH
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1 // No limit (min price)
        });

        PoolSwapTest.TestSettings memory settings = PoolSwapTest.TestSettings({
            takeClaims: false,
            settleUsingBurn: false
        });

        try router.swap(key, params, settings, "") returns (BalanceDelta delta) {
            console.log("Swap Executed!");
        } catch Error(string memory reason) {
            console.log("Swap Failed:", reason);
        } catch {
            console.log("Swap Failed (Unknown Revert)");
        }

        // Check Balances After
        uint256 balUSDCAfter = IERC20(usdc).balanceOf(msg.sender);
        uint256 balWETHAfter = IERC20(weth).balanceOf(msg.sender);
        
        console.log("USDC After: ", balUSDCAfter);
        console.log("WETH After: ", balWETHAfter);
        
        if (balUSDCAfter < balUSDCBefore) {
            console.log("SUCCESS: USDC decreased (Swapped out)");
        }
        if (balWETHAfter > balWETHBefore) {
            console.log("SUCCESS: WETH increased (Swapped in)");
        }
        
        console.log("----------------------------------------");
    }
}
