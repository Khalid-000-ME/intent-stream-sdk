const hre = require("hardhat");

async function main() {
    console.log("🚀 Finishing Liquidity Setup (Low Liq)...");
    const [deployer] = await hre.ethers.getSigners();

    const MANAGER_ADDR = "0x1b173aA3F4e8B32bf2efA8Cf840B8432FA132042";
    const ROUTER_ADDR = "0x33702CB2232aF0284D67FF4cF01eC39B2a1d7031";
    const USDC_ADDR = "0x888303972e735256422d35Cc599B2144DA833762";
    const WETH_ADDR = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";

    const router = await hre.ethers.getContractAt("V4TestRouter", ROUTER_ADDR);

    // Sort logic
    const [t0, t1] = WETH_ADDR.toLowerCase() < USDC_ADDR.toLowerCase() ? [WETH_ADDR, USDC_ADDR] : [USDC_ADDR, WETH_ADDR];

    // Validate balance
    const token1 = await hre.ethers.getContractAt("IERC20", t1);
    const bal = await token1.balanceOf(deployer.address);
    console.log("   WETH Balance:", hre.ethers.formatEther(bal));

    const key = {
        currency0: t0,
        currency1: t1,
        fee: 3000,
        tickSpacing: 60,
        hooks: hre.ethers.ZeroAddress
    };

    // Reduce Liquidity to fit 0.05 ETH
    // Prev Calc: L=10^16 needs 180 ETH.
    // Need 0.05 ETH. Ratio ~ 3600.
    // L = 10^16 / 4000 = 2.5e12.
    // Let's use 1e12 (1000 Gwei).
    const liqParams = {
        tickLower: -887220,
        tickUpper: 887220,
        liquidityDelta: 1000000000000n, // 1e12
        salt: hre.ethers.ZeroHash
    };

    console.log("   Adding Liquidity (1e12)...");
    await router.addLiquidity(key, liqParams, "0x", { gasLimit: 5000000 }).then(tx => tx.wait());
    console.log("   ✅ Liquidity Added.");
}

main().catch(console.error);
