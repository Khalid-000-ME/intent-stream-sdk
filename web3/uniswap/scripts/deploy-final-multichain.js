const hre = require("hardhat");

async function main() {
    const network = hre.network.name;
    console.log(`🚀 Starting Multi-Chain Deployment on ${network}...`);
    const [deployer] = await hre.ethers.getSigners();
    console.log("   Deployer:", deployer.address);

    const bal = await deployer.provider.getBalance(deployer.address);
    console.log("   Balance:", hre.ethers.formatEther(bal));

    if (bal === 0n) throw new Error("❌ Zero Balance.");

    // 1. Deploy PoolManager
    console.log("1️⃣  Deploying PoolManager...");
    const PoolManager = await hre.ethers.getContractFactory("PoolManager");
    const manager = await PoolManager.deploy(deployer.address);
    await manager.waitForDeployment();
    const managerAddr = await manager.getAddress();
    console.log("   ✅ PoolManager:", managerAddr);

    // 2. Deploy LiquidityManager (Our Router)
    console.log("2️⃣  Deploying LiquidityManager...");
    const LiquidityManager = await hre.ethers.getContractFactory("LiquidityManager");
    const router = await LiquidityManager.deploy(managerAddr);
    await router.waitForDeployment();
    const routerAddr = await router.getAddress();
    console.log("   ✅ LiquidityManager:", routerAddr);

    // 3. Official Tokens
    let usdcAddr, wethAddr;
    if (network === "arbitrumSepolia") {
        usdcAddr = hre.ethers.getAddress("0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d".toLowerCase());
        wethAddr = hre.ethers.getAddress("0x802cc0f559ebc79da798bf3f3bab44141a1a06ed".toLowerCase());
    } else if (network === "sepolia") {
        usdcAddr = hre.ethers.getAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238".toLowerCase());
        wethAddr = hre.ethers.getAddress("0xfff9976782d46cc05630d1f6ebab18b2324d6b14".toLowerCase());
    } else {
        // Base Sepolia (Reference)
        usdcAddr = hre.ethers.getAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e".toLowerCase());
        wethAddr = hre.ethers.getAddress("0x4200000000000000000000000000000000000006".toLowerCase());
    }

    console.log(`   Official USDC: ${usdcAddr}`);
    console.log(`   Official WETH: ${wethAddr}`);

    // 4. Initialize Pool (Decimal Balanced Price)
    // For USDC (6 dec) and WETH (18 dec), 1:1 value means 10^6 units : 10^18 units
    // Price = 10^12, SqrtPrice = 10^6
    const Q96 = 2n ** 96n;
    const balancedSqrtPriceX96 = 1000000n * Q96;

    console.log("4️⃣  Initializing Marketplace...");
    try {
        const tx = await router.initializePools(usdcAddr, wethAddr, balancedSqrtPriceX96);
        await tx.wait();
        console.log("   ✅ Pool Initialized!");
    } catch (e) {
        console.log("   ⚠️  Initialization failed (Might already exist?):", e.message);
    }

    // Output for Config
    console.log("\n----------------------------------------");
    console.log(`${network.toUpperCase()} UPDATED CONFIG:`);
    console.log(`router: '${routerAddr}',`);
    console.log(`poolManager: '${managerAddr}',`);
    console.log(`usdc: '${usdcAddr}',`);
    console.log(`weth: '${wethAddr}'`);
    console.log("----------------------------------------");
}

main().catch(console.error);
