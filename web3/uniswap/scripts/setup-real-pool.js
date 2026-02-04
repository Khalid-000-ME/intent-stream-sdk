const hre = require("hardhat");

async function main() {
    console.log("🚀 Setting up Real WETH / USDC Pool on Sepolia V4...");
    const [deployer] = await hre.ethers.getSigners();
    console.log("   User:", deployer.address);

    // 1. Existing Deployments
    const MANAGER_ADDR = "0x11708d76f0B3779F1bE3264b64F3892e6d5d977d";
    const ROUTER_ADDR = "0x9e2dFa913eC368569faaD7D5f7c90EC6a137ccF6";

    const manager = await hre.ethers.getContractAt("PoolManager", MANAGER_ADDR);
    const router = await hre.ethers.getContractAt("V4TestRouter", ROUTER_ADDR);

    // 2. Token Setup
    // Real Sepolia WETH
    const WETH_ADDR = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
    // We assume WETH artifact exists via IERC20

    // Deploy Mock USDC (since official USDC faucet is restricted)
    console.log("   Deploying Mock USDC...");
    const MockToken = await hre.ethers.getContractFactory("MockToken");
    const usdc = await MockToken.deploy("USD Coin", "USDC", hre.ethers.parseUnits("1000000", 6)); // 1M USDC, 6 decimals
    await usdc.waitForDeployment();
    const USDC_ADDR = await usdc.getAddress();
    console.log("   ✅ Mock USDC Deployed:", USDC_ADDR);

    // 3. Wrap ETH to WETH
    console.log("   Wrapping ETH to WETH...");
    try {
        const tx = await deployer.sendTransaction({
            to: WETH_ADDR,
            value: hre.ethers.parseEther("0.1")
        });
        await tx.wait();
        console.log("   ✅ Wrapped 0.1 ETH");
    } catch (e) {
        console.log("   ⚠️ Wrap failed:", e.message);
    }

    // 4. Initialize Pool (WETH / USDC)
    const [t0, t1] = WETH_ADDR.toLowerCase() < USDC_ADDR.toLowerCase() ? [WETH_ADDR, USDC_ADDR] : [USDC_ADDR, WETH_ADDR];
    const isWethToken0 = t0.toLowerCase() === WETH_ADDR.toLowerCase();

    console.log(`   Token0: ${t0}`);
    console.log(`   Token1: ${t1}`);

    const key = {
        currency0: t0,
        currency1: t1,
        fee: 3000,
        tickSpacing: 60,
        hooks: hre.ethers.ZeroAddress
    };

    // PRICE: 1 WETH = 3000 USDC
    let sqrtPriceX96;
    if (isWethToken0) {
        // Token0 = WETH (18), Token1 = USDC (6)
        // Ratio = 3000 * 1e6 / 1e18 = 3e-9
        // Sqrt(3e-9) * 2^96 ~ 4339587376662444655
        sqrtPriceX96 = "4339587376662444655";
    } else {
        // Token0 = USDC (6), Token1 = WETH (18)
        // Ratio = 1e18 / 3000 * 1e6 = 3.33e8
        // Sqrt(3.33e8) * 2^96 ~ 1446700000000000000000000000000
        sqrtPriceX96 = "1446700000000000000000000000000";
    }

    console.log("   Initializing Pool...");
    try {
        await manager.initialize(key, sqrtPriceX96).then(tx => tx.wait());
    } catch (e) {
        console.log("   ⚠️ Pool might be already initialized. Continuing...");
    }

    // 5. Add Liquidity
    console.log("   Adding Liquidity...");
    const token0 = await hre.ethers.getContractAt("IERC20", t0);
    const token1 = await hre.ethers.getContractAt("IERC20", t1);

    await token0.approve(ROUTER_ADDR, hre.ethers.MaxUint256).then(tx => tx.wait());
    await token1.approve(ROUTER_ADDR, hre.ethers.MaxUint256).then(tx => tx.wait());

    const liqParams = {
        tickLower: -887220,
        tickUpper: 887220,
        liquidityDelta: 10n ** 16n, // Small liquidity
        salt: hre.ethers.ZeroHash
    };

    await router.addLiquidity(key, liqParams, "0x").then(tx => tx.wait());
    console.log("   ✅ Liquidity Added.");

    console.log("----------------------------------------");
    console.log(`REAL_WETH="${WETH_ADDR}"`);
    console.log(`NEW_USDC="${USDC_ADDR}"`);
    console.log("----------------------------------------");
}

main().catch(console.error);
