const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying V4 on Arbitrum Sepolia...");
    const [deployer] = await hre.ethers.getSigners();
    console.log("   Deployer:", deployer.address);
    // Check balance
    const bal = await deployer.provider.getBalance(deployer.address);
    console.log("   Balance:", hre.ethers.formatEther(bal));

    if (bal === 0n) {
        throw new Error("❌ Zero Balance on Arbitrum Sepolia. Please bridge ETH.");
    }

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

    // 3. Tokens (Mocks for High Liquidity)
    console.log("   Deploying Mock Tokens...");
    const MockToken = await hre.ethers.getContractFactory("MockToken");

    const usdc = await MockToken.deploy("Mock USDC", "USDC", hre.ethers.parseUnits("1000000000", 6)); // 1B
    await usdc.waitForDeployment();
    const USDC_ADDR = await usdc.getAddress();

    const weth = await MockToken.deploy("Mock WETH", "WETH", hre.ethers.parseUnits("1000000", 18)); // 1M
    await weth.waitForDeployment();
    const WETH_ADDR = await weth.getAddress();

    console.log("   ✅ Mock USDC:", USDC_ADDR);
    console.log("   ✅ Mock WETH:", WETH_ADDR);

    // 4. Init Pool
    // Sort
    const [t0, t1] = WETH_ADDR.toLowerCase() < USDC_ADDR.toLowerCase() ? [WETH_ADDR, USDC_ADDR] : [USDC_ADDR, WETH_ADDR];
    const isWethToken0 = t0.toLowerCase() === WETH_ADDR.toLowerCase();

    const key = {
        currency0: t0,
        currency1: t1,
        fee: 3000,
        tickSpacing: 60,
        hooks: hre.ethers.ZeroAddress
    };

    // Price 3000 USDC/WETH
    // WETH (18 dec), USDC (6 dec).
    // Price = 3000.
    // If WETH=T0: Price(raw) = T1(USDC)/T0(WETH) = 3000e6 / 1e18 = 3e-9.
    // Sqrt(3e-9) * 2^96 = ~4.34e24.
    // If WETH=T1: Price(raw) = T1(WETH)/T0(USDC) = 1e18 / 3000e6 = ~3.33e8.
    // Sqrt(3.33e8) * 2^96 = ~1.44e33.

    let sqrtPriceX96;
    if (isWethToken0) {
        sqrtPriceX96 = "4339587376662444655385600"; // 4.33e24
    } else {
        sqrtPriceX96 = "1446505293695286595609378122396490"; // 1.44e33
    }

    console.log("   Initializing Pool...");
    await manager.initialize(key, sqrtPriceX96).then(tx => tx.wait());
    console.log("   ✅ Pool Initialized");

    // 5. Add Liquidity (Large)
    console.log("   Approving and Adding Liquidity...");
    const token0 = await hre.ethers.getContractAt("MockToken", t0);
    const token1 = await hre.ethers.getContractAt("MockToken", t1);

    await token0.approve(ROUTER_ADDR, hre.ethers.MaxUint256).then(tx => tx.wait());
    await token1.approve(ROUTER_ADDR, hre.ethers.MaxUint256).then(tx => tx.wait());

    // 100 ETH Liquidity equivalent
    // Previous: L=1e9 works for 0.003 ETH.
    // Scale up 100,000x.
    // L = 1e14 roughly.
    // Let's use 1e16 (Should be fine with 1M tokens minted).

    const liqParams = {
        tickLower: -887220,
        tickUpper: 887220,
        liquidityDelta: 10000000000000000n, // 0.01 WETH-ish scale? No wait.
        // Previous script comment: "L=10^16 needs 180 ETH".
        // I have 1,000,000 ETH (Mock).
        // So 10^16 is fine.
        salt: hre.ethers.ZeroHash
    };

    await router.addLiquidity(key, liqParams, "0x").then(tx => tx.wait());
    console.log("   ✅ Liquidity Added (High Capacity)");

    console.log("\nDATA FOR ROUTE.TS (ARBITRUM):");
    console.log(`ARBITRUM_ROUTER="${ROUTER_ADDR}"`);
    console.log(`ARBITRUM_USDC="${USDC_ADDR}"`);
    console.log(`ARBITRUM_WETH="${WETH_ADDR}"`);
}

main().catch(console.error);
