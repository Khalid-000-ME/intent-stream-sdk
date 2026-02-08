
const hre = require("hardhat"); // Using hre for ethers access

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`🚀 Deploying & Testing with account: ${deployer.address}`);

    // 1. Deploy PoolManager
    console.log("📦 Deploying PoolManager...");
    const PoolManager = await hre.ethers.getContractFactory("PoolManager");
    // v4-core 1.0.2 constructor(address initialOwner)
    const manager = await PoolManager.deploy(deployer.address);
    await manager.waitForDeployment();
    const managerAddress = await manager.getAddress();
    console.log(`✅ PoolManager deployed to: ${managerAddress}`);

    // 2. Deploy LiquidityManager
    console.log("📦 Deploying LiquidityManager...");
    const LiquidityManager = await hre.ethers.getContractFactory("LiquidityManager");
    const liquidityManager = await LiquidityManager.deploy(managerAddress);
    await liquidityManager.waitForDeployment();
    const liquidityManagerAddress = await liquidityManager.getAddress();
    console.log(`✅ LiquidityManager deployed to: ${liquidityManagerAddress}`);

    // 3. Initialize Pools
    const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

    console.log("💧 Initializing Pools (3000/60)...");
    const txInit = await liquidityManager.initializePools(USDC_ADDRESS, WETH_ADDRESS);
    console.log(`   Tx Sent: ${txInit.hash}`);
    await txInit.wait();
    console.log("✅ Pools Initialized!");

    // 4. Test Swap
    console.log("🔄 Testing Swap...");

    // Approvals (Must use contractAt)
    // Note: We need IERC20 artifact.
    const usdc = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDC_ADDRESS);
    const weth = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", WETH_ADDRESS);

    console.log("📝 Approving tokens...");
    try {
        await (await usdc.approve(liquidityManagerAddress, hre.ethers.MaxUint256)).wait();
        console.log("   USDC Approved");
    } catch (e) { console.log("   USDC Approve failed or already approved"); }

    try {
        await (await weth.approve(liquidityManagerAddress, hre.ethers.MaxUint256)).wait();
        console.log("   WETH Approved");
    } catch (e) { console.log("   WETH Approve failed or already approved"); }

    // Swap Params
    const isWethToken0 = WETH_ADDRESS.toLowerCase() < USDC_ADDRESS.toLowerCase();
    const token0 = isWethToken0 ? WETH_ADDRESS : USDC_ADDRESS;
    const token1 = isWethToken0 ? USDC_ADDRESS : WETH_ADDRESS;
    const zeroForOne = isWethToken0; // WETH -> USDC

    const key = {
        currency0: token0,
        currency1: token1,
        fee: 3000,
        tickSpacing: 60,
        hooks: hre.ethers.ZeroAddress
    };

    const MIN_SQRT_RATIO = BigInt("4295128739") + BigInt(1);
    const MAX_SQRT_RATIO = BigInt("1461446703485210103287273052203988822378723970342") - BigInt(1);
    const sqrtPriceLimitX96 = zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO;

    const params = {
        zeroForOne,
        amountSpecified: -BigInt(100), // Tiny amount
        sqrtPriceLimitX96
    };

    console.log("🚀 Executing Swap (WETH -> USDC)...");
    const txSwap = await liquidityManager.swap(key, params, "0x");
    console.log(`   Tx Sent: ${txSwap.hash}`);
    await txSwap.wait();
    console.log("✅ Swap Successful!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
