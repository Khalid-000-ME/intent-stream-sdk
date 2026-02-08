const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // 1. Deploy PoolManager
    // Note: If PoolManager is not in artifacts, this might fail unless compiled from node_modules
    // We assume standard compilation includes it due to imports.
    let managerAddress;
    try {
        const PoolManager = await hre.ethers.getContractFactory("PoolManager");
        const manager = await PoolManager.deploy(deployer.address); // initialOwner
        await manager.waitForDeployment();
        managerAddress = await manager.getAddress();
        console.log(`PoolManager deployed to ${managerAddress}`);
    } catch (error) {
        console.warn("Could not deploy PoolManager (artifact might be missing or complex). Using Mock or skipping...");
        // For this task, if we can't deploy Manager, LiquidityManager won't work.
        // We will try MockPoolManager if exists?
        // Assuming it works.
        throw error;
    }

    // 2. Deploy LiquidityManager
    const LiquidityManager = await hre.ethers.getContractFactory("LiquidityManager");
    const liquidityManager = await LiquidityManager.deploy(managerAddress);
    await liquidityManager.waitForDeployment();
    const lmAddress = await liquidityManager.getAddress();
    console.log(`LiquidityManager deployed to ${lmAddress}`);

    // 3. Initialize Pools
    // Define addresses based on network
    const network = hre.network.name;
    let usdc = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia Default
    let weth = "0x4200000000000000000000000000000000000006"; // Base WETH

    if (network === "arbitrumSepolia") {
        usdc = "0x75faf114eafb1BDbe2F031385358e1850861882D"; // Arb Sepolia USDC
        weth = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73"; // Arb Sepolia WETH (Example)
    }

    console.log(`Initializing pools for USDC: ${usdc} and WETH: ${weth}`);
    const tx = await liquidityManager.initializePools(usdc, weth);
    await tx.wait();
    console.log("Pools initialized!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
