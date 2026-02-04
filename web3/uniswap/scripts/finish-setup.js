const hre = require("hardhat");

async function main() {
    console.log("🚀 Finishing Liquidity Setup...");
    const [deployer] = await hre.ethers.getSigners();

    const MANAGER_ADDR = "0x1b173aA3F4e8B32bf2efA8Cf840B8432FA132042";
    const ROUTER_ADDR = "0x33702CB2232aF0284D67FF4cF01eC39B2a1d7031";
    const USDC_ADDR = "0x888303972e735256422d35Cc599B2144DA833762";
    const WETH_ADDR = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";

    const router = await hre.ethers.getContractAt("V4TestRouter", ROUTER_ADDR);

    // Sort logic
    const [t0, t1] = WETH_ADDR.toLowerCase() < USDC_ADDR.toLowerCase() ? [WETH_ADDR, USDC_ADDR] : [USDC_ADDR, WETH_ADDR];

    console.log("   Token0:", t0);
    console.log("   Token1:", t1);

    const token0 = await hre.ethers.getContractAt("IERC20", t0);
    const token1 = await hre.ethers.getContractAt("IERC20", t1);

    console.log("   Approving...");
    await token0.approve(ROUTER_ADDR, hre.ethers.MaxUint256).then(tx => tx.wait());
    await token1.approve(ROUTER_ADDR, hre.ethers.MaxUint256).then(tx => tx.wait());

    const key = {
        currency0: t0,
        currency1: t1,
        fee: 3000,
        tickSpacing: 60,
        hooks: hre.ethers.ZeroAddress
    };

    const liqParams = {
        tickLower: -887220,
        tickUpper: 887220,
        liquidityDelta: 10000000000000000n, // 0.01 
        salt: hre.ethers.ZeroHash
    };

    console.log("   Adding Liquidity (High Gas)...");
    await router.addLiquidity(key, liqParams, "0x", { gasLimit: 5000000 }).then(tx => tx.wait());
    console.log("   ✅ Liquidity Added.");
}

main().catch(console.error);
