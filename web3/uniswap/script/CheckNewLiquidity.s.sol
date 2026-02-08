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
import {FullMath} from "v4-core/src/libraries/FullMath.sol";
import {FixedPoint96} from "v4-core/src/libraries/FixedPoint96.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";

contract CheckNewLiquidity is Script {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    // Chain IDs
    uint256 constant BASE_SEPOLIA_ID = 84532;
    uint256 constant ARB_SEPOLIA_ID = 421614;
    uint256 constant ETH_SEPOLIA_ID = 11155111;

    // Managers
    address constant BASE_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant ARB_MANAGER = 0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317;
    address constant ETH_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;

    // Tokens (Base)
    address constant BASE_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant BASE_WETH = 0x4200000000000000000000000000000000000006;
    
    // Tokens (Arbitrum)
    address constant ARB_USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    address constant ARB_WETH = 0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed;

    // Tokens (Ethereum)
    address constant ETH_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant ETH_WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;

    function run() external view {
        uint256 id = block.chainid;
        
        if (id == BASE_SEPOLIA_ID) {
            checkChain("Base Sepolia", BASE_MANAGER, BASE_USDC, BASE_WETH);
        } else if (id == ARB_SEPOLIA_ID) {
            checkChain("Arbitrum Sepolia", ARB_MANAGER, ARB_USDC, ARB_WETH);
        } else if (id == ETH_SEPOLIA_ID) {
            if (ETH_MANAGER == address(0)) {
                console.log("Ethereum Manager pending deployment.");
            } else {
                checkChain("Ethereum Sepolia", ETH_MANAGER, ETH_USDC, ETH_WETH);
            }
        } else {
            console.log("Unsupported Chain ID:", id);
        }
    }

    function checkChain(string memory name, address managerAddr, address usdc, address weth) internal view {
        console.log("----------------------------------------");
        console.log(string.concat("Checking ", name, "..."));
        console.log("Manager:", managerAddr);

        IPoolManager manager = IPoolManager(managerAddr);
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(usdc),
            currency1: Currency.wrap(weth),
            fee: 10000,
            tickSpacing: 200,
            hooks: IHooks(address(0))
        });

        PoolId poolId = key.toId();
        
        uint128 liquidity = manager.getLiquidity(poolId);
        console.log("Liquidity:", liquidity);
        
        (uint160 sqrtPriceX96, , , ) = manager.getSlot0(poolId);
        console.log("SqrtPrice:", sqrtPriceX96);
        
        if (liquidity > 0) {
            console.log("Active Liquidity Found!");
            
            // Calculate Ranges for "Full Range" estimation (-887200 to 887200)
            uint160 sqrtRatioAX96 = TickMath.getSqrtPriceAtTick(int24(-887200));
            uint160 sqrtRatioBX96 = TickMath.getSqrtPriceAtTick(int24(887200));
            
            (uint256 amount0, uint256 amount1) = getAmountsForLiquidity(
                sqrtPriceX96,
                sqrtRatioAX96,
                sqrtRatioBX96,
                liquidity
            );
            
            // Print estimated locked amounts (Raw Units)
            console.log("Est. USDC Locked (Raw):", amount0);
            console.log("Est. WETH Locked (Wei):", amount1);
        } else {
            console.log("No Liquidity.");
        }
        console.log("----------------------------------------");
    }

    // --- Helper Math Functions ---

    function getAmountsForLiquidity(
        uint160 sqrtPriceX96,
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint128 liquidity
    ) internal pure returns (uint256 amount0, uint256 amount1) {
        if (sqrtRatioAX96 > sqrtRatioBX96) (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);

        if (sqrtPriceX96 <= sqrtRatioAX96) {
            amount0 = getAmount0ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
        } else if (sqrtPriceX96 < sqrtRatioBX96) {
            amount0 = getAmount0ForLiquidity(sqrtPriceX96, sqrtRatioBX96, liquidity);
            amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtPriceX96, liquidity);
        } else {
            amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
        }
    }

    function getAmount0ForLiquidity(uint160 sqrtRatioAX96, uint160 sqrtRatioBX96, uint128 liquidity) internal pure returns (uint256 amount0) {
        if (sqrtRatioAX96 > sqrtRatioBX96) (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);
        
        uint256 numerator1 = uint256(liquidity) << 96;
        uint256 numerator2 = sqrtRatioBX96 - sqrtRatioAX96;
        
        return FullMath.mulDiv(FullMath.mulDiv(numerator1, numerator2, sqrtRatioBX96), 1, sqrtRatioAX96);
    }

    function getAmount1ForLiquidity(uint160 sqrtRatioAX96, uint160 sqrtRatioBX96, uint128 liquidity) internal pure returns (uint256 amount1) {
        if (sqrtRatioAX96 > sqrtRatioBX96) (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);
        
        return FullMath.mulDiv(liquidity, sqrtRatioBX96 - sqrtRatioAX96, FixedPoint96.Q96);
    }
}
