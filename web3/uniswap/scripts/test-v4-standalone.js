const hre = require("hardhat");

async function main() {
    const [owner] = await hre.ethers.getSigners();
    console.log("🚀 Testing Uniswap V4 Standalone...");
    console.log("   Owner:", owner.address);

    // 1. Deploy PoolManager
    const PoolManager = await hre.ethers.getContractFactory("PoolManager");
    // PoolManager(initialOwner)
    const manager = await PoolManager.deploy(owner.address);
    await manager.waitForDeployment();
    console.log("✅ PoolManager:", await manager.getAddress());

    // 2. Deploy Router
    const Router = await hre.ethers.getContractFactory("V4TestRouter");
    const router = await Router.deploy(await manager.getAddress());
    await router.waitForDeployment();
    console.log("✅ V4TestRouter:", await router.getAddress());

    // 3. Deploy Tokens
    const MockToken = await hre.ethers.getContractFactory("MockToken");
    const tokenA = await MockToken.deploy("Token A", "TKNA", hre.ethers.parseEther("1000000"));
    const tokenB = await MockToken.deploy("Token B", "TKNB", hre.ethers.parseEther("1000000"));
    await tokenA.waitForDeployment();
    await tokenB.waitForDeployment();
    const addrA = await tokenA.getAddress();
    const addrB = await tokenB.getAddress();
    console.log(`✅ Tokens: ${addrA} / ${addrB}`);

    // Sort Addresses (V4 requires sorting)
    const [t0, t1] = addrA.toLowerCase() < addrB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
    const [a0, a1] = addrA.toLowerCase() < addrB.toLowerCase() ? [addrA, addrB] : [addrB, addrA];

    console.log(`   Currency0: ${a0}`);
    console.log(`   Currency1: ${a1}`);

    // Approve Router to spend tokens
    await t0.approve(await router.getAddress(), hre.ethers.MaxUint256);
    await t1.approve(await router.getAddress(), hre.ethers.MaxUint256);

    // 4. Initialize Pool
    const key = {
        currency0: a0,
        currency1: a1,
        fee: 3000,
        tickSpacing: 60,
        hooks: hre.ethers.ZeroAddress
    };

    // SqrtPrice 1:1 = 2^96
    const sqrtPriceX96 = "79228162514264337593543950336";

    console.log("Initializing Pool...");
    await manager.initialize(key, sqrtPriceX96).then(tx => tx.wait());
    console.log("   Pool Initialized.");

    // 5. Add Liquidity
    console.log("Adding Liquidity...");
    const liqParams = {
        tickLower: -120,
        tickUpper: 120,
        liquidityDelta: 100000n * 10n ** 18n, // BigInt
        salt: hre.ethers.ZeroHash
    };

    await router.addLiquidity(key, liqParams, "0x");
    console.log("   Liquidity Added.");

    // 6. Swap
    console.log("Swapping A -> B...");
    // Swap 1.0 TokenA (Exact Input)
    const swapParams = {
        zeroForOne: true,
        amountSpecified: -(1000000000000000000n), // -1.0 ETH (Negative = Exact Input)
        sqrtPriceLimitX96: 4295128740n // MIN_SQRT_RATIO + 1
    };

    const balB_before = await t1.balanceOf(owner.address);
    await router.swap(key, swapParams, "0x");
    const balB_after = await t1.balanceOf(owner.address);

    const received = hre.ethers.formatEther(balB_after - balB_before);
    console.log(`   Received B: ${received}`);

    if (parseFloat(received) > 0) {
        console.log("✅ Swap Complete! V4 Logic Verified.");
    } else {
        console.error("❌ Swap Failed or Returned 0.");
        process.exit(1);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
