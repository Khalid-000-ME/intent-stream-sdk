const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying Uniswap V4 System to Sepolia...");
    const [deployer] = await hre.ethers.getSigners();
    console.log("   Deployer:", deployer.address);

    // 1. Deploy PoolManager
    console.log("1️⃣  Deploying PoolManager...");
    const PoolManager = await hre.ethers.getContractFactory("PoolManager");
    const manager = await PoolManager.deploy(deployer.address);
    await manager.waitForDeployment();
    const managerAddr = await manager.getAddress();
    console.log("   ✅ PoolManager:", managerAddr);

    // 2. Deploy Router
    console.log("2️⃣  Deploying V4TestRouter...");
    const Router = await hre.ethers.getContractFactory("V4TestRouter");
    const router = await Router.deploy(managerAddr);
    await router.waitForDeployment();
    const routerAddr = await router.getAddress();
    console.log("   ✅ V4TestRouter:", routerAddr);

    // 3. Deploy Tokens (Mock USDC/WETH)
    console.log("3️⃣  Deploying Mock Tokens...");
    const MockToken = await hre.ethers.getContractFactory("MockToken");

    const tokenA = await MockToken.deploy("Mock Token A", "MKA", hre.ethers.parseEther("1000000"));
    await tokenA.waitForDeployment();

    const tokenB = await MockToken.deploy("Mock Token B", "MKB", hre.ethers.parseEther("1000000"));
    await tokenB.waitForDeployment();

    const addrA = await tokenA.getAddress();
    const addrB = await tokenB.getAddress();
    console.log(`   ✅ Tokens: ${addrA} | ${addrB}`);

    // Sort Addresses for Pool Key
    const [t0, t1] = addrA.toLowerCase() < addrB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
    const [a0, a1] = addrA.toLowerCase() < addrB.toLowerCase() ? [addrA, addrB] : [addrB, addrA];

    console.log("4️⃣  Initializing Pool...");
    const key = {
        currency0: a0,
        currency1: a1,
        fee: 3000,
        tickSpacing: 60,
        hooks: hre.ethers.ZeroAddress
    };

    // 1:1 Price
    const sqrtPriceX96 = "79228162514264337593543950336";

    // Check if pool already initialized (optional, but for clean deploy we assume fresh)
    await manager.initialize(key, sqrtPriceX96).then(tx => tx.wait());
    console.log("   ✅ Pool Initialized.");

    // 5. Add Initial Liquidity so swaps work
    console.log("5️⃣  Adding Initial Liquidity...");
    await t0.approve(routerAddr, hre.ethers.MaxUint256).then(tx => tx.wait());
    await t1.approve(routerAddr, hre.ethers.MaxUint256).then(tx => tx.wait());

    const liqParams = {
        tickLower: -120,
        tickUpper: 120,
        liquidityDelta: 10000n * 10n ** 18n,
        salt: hre.ethers.ZeroHash
    };

    await router.addLiquidity(key, liqParams, "0x").then(tx => tx.wait());
    console.log("   ✅ Liquidity Added.");

    console.log("\n🎉 Deployment Complete!");
    console.log("----------------------------------------");
    console.log(`POOL_MANAGER_ADDRESS="${managerAddr}"`);
    console.log(`ROUTER_ADDRESS="${routerAddr}"`);
    console.log(`TOKEN0_ADDRESS="${a0}"`);
    console.log(`TOKEN1_ADDRESS="${a1}"`);
    console.log("----------------------------------------");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
