const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    // Replace with the latest deployed addresses from your output
    const LIQUIDITY_MANAGER = "0xc02a4209a171b203d93da0b95aF5E42c00948468";
    const POOL_MANAGER = "0xEcD23770bB81FB62Daa42dfaF31009aBE10bf3F7";







    const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const WETH = "0x4200000000000000000000000000000000000006";

    const token0 = USDC.toLowerCase() < WETH.toLowerCase() ? USDC : WETH;
    const token1 = USDC.toLowerCase() < WETH.toLowerCase() ? WETH : USDC;

    const key = {
        currency0: token0,
        currency1: token1,
        fee: 3000,
        tickSpacing: 60,
        hooks: hre.ethers.ZeroAddress
    };

    const liqMan = await hre.ethers.getContractAt("LiquidityManager", LIQUIDITY_MANAGER);

    const liqParams = {
        tickLower: -120,
        tickUpper: 120,
        liquidityDelta: 1000n,
        salt: hre.ethers.ZeroHash
    };

    console.log(`🔍 Debugging addLiquidity...`);

    try {
        // Try to static call to get the revert reason
        await liqMan.addLiquidity.staticCall(key, liqParams, "0x");
        console.log("✅ Static call succeeded (this is strange if the tx failed)");
    } catch (e) {
        console.log("❌ Static call failed!");
        if (e.data) {
            console.log("Error Data:", e.data);
            // Try to decode the error data if possible
            try {
                const decoded = liqMan.interface.parseError(e.data);
                console.log("Decoded Error:", decoded);
            } catch (decodeErr) {
                console.log("Could not decode error with LiquidityManager ABI");
                // Try PoolManager ABI
                try {
                    const pm = await hre.ethers.getContractAt("IPoolManager", POOL_MANAGER);
                    const decodedPM = pm.interface.parseError(e.data);
                    console.log("Decoded Error (PoolManager):", decodedPM);
                } catch (pmErr) {
                    console.log("Could not decode error with PoolManager ABI either");
                }
            }
        } else {
            console.log("Error Message:", e.message);
        }
    }
}

main().catch(console.error);
