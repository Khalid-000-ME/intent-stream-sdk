const hre = require("hardhat");

async function main() {
    console.log("🚀 Starting Fresh V4 Deployment on Sepolia...");
    const [deployer] = await hre.ethers.getSigners();
    console.log("   Deployer:", deployer.address);

    // 1. Deploy PoolManager
    console.log("   Deploying PoolManager...");
    const PoolManager = await hre.ethers.getContractFactory("PoolManager");
    const manager = await PoolManager.deploy(deployer.address);
    await manager.waitForDeployment();
    const MANAGER_ADDR = await manager.getAddress();
    console.log("   ✅ PoolManager:", MANAGER_ADDR);

    // 2. Deploy Router
    console.log("   Deploying V4TestRouter...");
    const Router = await hre.ethers.getContractFactory("V4TestRouter");
    const router = await Router.deploy(MANAGER_ADDR);
    await router.waitForDeployment();
    const ROUTER_ADDR = await router.getAddress();
    console.log("   ✅ Router:", ROUTER_ADDR);

    // 3. Tokens
    const WETH_ADDR = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // Real Sepolia WETH

    console.log("   Deploying Fresh Mock USDC...");
    const MockToken = await hre.ethers.getContractFactory("MockToken");
    // Suffix with timestamp to ensure uniqueness just in case
    const usdc = await MockToken.deploy("USD Coin", "USDC", hre.ethers.parseUnits("1000000", 6));
    await usdc.waitForDeployment();
    const USDC_ADDR = await usdc.getAddress();
    console.log("   ✅ USDC:", USDC_ADDR);

    // 4. Wrap ETH
    console.log("   Wrapping ETH...");
    try {
        await deployer.sendTransaction({ to: WETH_ADDR, value: hre.ethers.parseEther("0.05") }).then(tx => tx.wait());
        console.log("   ✅ Wrapped 0.05 ETH");
    } catch (e) { console.log("   ⚠️ Wrap error (ignored):", e.message); }

    // 5. Init Pool
    // Determine Token0/Token1
    const [t0, t1] = WETH_ADDR.toLowerCase() < USDC_ADDR.toLowerCase() ? [WETH_ADDR, USDC_ADDR] : [USDC_ADDR, WETH_ADDR];
    const isWethToken0 = t0.toLowerCase() === WETH_ADDR.toLowerCase();

    console.log("   Token0:", t0);
    console.log("   Token1:", t1);
    console.log("   WETH is Token0?", isWethToken0);

    const key = {
        currency0: t0,
        currency1: t1,
        fee: 3000,
        tickSpacing: 60,
        hooks: hre.ethers.ZeroAddress
    };

    // Price 1 WETH = 3000 USDC
    // If WETH is Token0: Price = USDC/WETH = 3000 e6 / 1 e18 = 3e-9.
    // If WETH is Token1: Price = WETH/USDC = 1 e18 / 3000 e6 = 3.33e8.

    let sqrtPriceX96;
    if (isWethToken0) {
        // T0=WETH. Sqrt(3e-9) * 2^96 ~ 4339587376662444655
        sqrtPriceX96 = "4339587376662444655";
    } else {
        // T1=WETH. Sqrt(3.33e8) * 2^96 ~ 1446700000000000000000000000000
        sqrtPriceX96 = "1446700000000000000000000000000";
    }

    console.log("   Initializing Pool...");
    await manager.initialize(key, sqrtPriceX96).then(tx => tx.wait());
    console.log("   ✅ Pool Initialized");

    // 6. Add Liquidity
    console.log("   Adding Liquidity...");
    const token0 = await hre.ethers.getContractAt("IERC20", t0);
    const token1 = await hre.ethers.getContractAt("IERC20", t1);

    await token0.approve(ROUTER_ADDR, hre.ethers.MaxUint256).then(tx => tx.wait());
    await token1.approve(ROUTER_ADDR, hre.ethers.MaxUint256).then(tx => tx.wait());

    const liqParams = {
        tickLower: -887220,
        tickUpper: 887220,
        liquidityDelta: 10000000000000000n, // 0.01 
        salt: hre.ethers.ZeroHash
    };

    await router.addLiquidity(key, liqParams, "0x").then(tx => tx.wait());
    console.log("   ✅ Liquidity Added");

    console.log("\nDATA FOR ROUTE.TS:");
    console.log(`POOL_MANAGER_ADDR="${MANAGER_ADDR}"`);
    console.log(`ROUTER_ADDR="${ROUTER_ADDR}"`);
    console.log(`TOKEN0_ADDR="${t0}"`);
    console.log(`TOKEN1_ADDR="${t1}"`);
}

main().catch(console.error);
