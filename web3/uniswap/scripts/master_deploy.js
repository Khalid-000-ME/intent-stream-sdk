const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    let nonce = await deployer.getNonce();
    console.log(`🚀 Deployment with: ${deployer.address}, nonce: ${nonce}`);

    // 1. Deploy PoolManager
    const manager = await (await hre.ethers.getContractFactory("PoolManager")).deploy(
        deployer.address,
        { nonce: nonce++ }
    );
    await manager.waitForDeployment();
    const managerAddr = await manager.getAddress();
    console.log(`✅ PoolManager: ${managerAddr}`);

    // 2. Deploy LiquidityManager
    const liqMan = await (await hre.ethers.getContractFactory("LiquidityManager")).deploy(
        managerAddr,
        { nonce: nonce++ }
    );
    await liqMan.waitForDeployment();
    const liqManAddr = await liqMan.getAddress();
    console.log(`✅ LiquidityManager: ${liqManAddr}`);

    // Token addresses on Base Sepolia
    const USDC_ADDR = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const WETH_ADDR = "0x4200000000000000000000000000000000000006";

    const usdc = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDC_ADDR);
    const weth = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", WETH_ADDR);

    const token0 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase() ? USDC_ADDR : WETH_ADDR;
    const token1 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase() ? WETH_ADDR : USDC_ADDR;

    const key = {
        currency0: token0,
        currency1: token1,
        fee: 3000,
        tickSpacing: 60,
        hooks: hre.ethers.ZeroAddress
    };

    // 3. Initialize pool
    console.log(`\n💧 Initializing pool...`);
    try {
        const txInit = await liqMan.initializePools(USDC_ADDR, WETH_ADDR, { nonce: nonce++ });
        await txInit.wait();
        console.log(`✅ Pool initialized!`);
    } catch (e) {
        console.log(`⚠️ Pool might already be initialized: ${e.message}`);
    }

    // 4. Approve tokens
    console.log(`\n📝 Approving tokens to LiquidityManager...`);
    // IMPORTANT: Wallet must approve the LiquidityManager (the router)
    await (await usdc.approve(liqManAddr, hre.ethers.MaxUint256, { nonce: nonce++ })).wait();
    await (await weth.approve(liqManAddr, hre.ethers.MaxUint256, { nonce: nonce++ })).wait();
    console.log(`✅ Tokens approved`);

    // 5. Add liquidity
    console.log(`\n💧 Adding liquidity...`);
    const liqParams = {
        tickLower: -120,
        tickUpper: 120,
        liquidityDelta: 1000000n,
        salt: hre.ethers.ZeroHash
    };

    try {
        const txLiq = await liqMan.addLiquidity(
            key,
            liqParams,
            "0x",
            {
                nonce: nonce++,
                gasLimit: 3000000
            }
        );
        console.log(`   Tx hash: ${txLiq.hash}`);
        const receipt = await txLiq.wait();
        console.log(`✅ Liquidity added! Block: ${receipt.blockNumber}`);

        // 6. Verification Swap
        console.log("\n🔄 Running Verification Swap...");
        const swapParams = {
            zeroForOne: true,
            amountSpecified: -100n, // Swap 100 units
            sqrtPriceLimitX96: 4295128740n // Safe limit for zeroForOne
        };

        const txSwap = await liqMan.swap(key, swapParams, "0x", { gasLimit: 1000000, nonce: nonce++ });
        await txSwap.wait();
        console.log("✅ Verification Swap Success!");

        // 8. Check Claim Balances (ERC-6909)
        const pm = await hre.ethers.getContractAt("IPoolManager", managerAddr);

        const claimBal0 = await pm.balanceOf(deployer.address, key.currency0);
        const claimBal1 = await pm.balanceOf(deployer.address, key.currency1);
        console.log(`\n💎 Your Claim Balances (ERC-6909):`);
        console.log(`   Currency 0: ${claimBal0.toString()}`);
        console.log(`   Currency 1: ${claimBal1.toString()}`);

        // Check final status
        const status = await liqMan.getPoolStatus(key);

        console.log(`\n📊 Final Pool Status:`);
        console.log(`   Price: ${status[0].toString()}`);
        console.log(`   Liquidity: ${status[1].toString()}`);

    } catch (e) {
        console.error(`\n❌ Operation failed:`, e.message);
        if (e.data) console.log("Error Data:", e.data);
    }

    console.log(`\n✅ DEPLOYMENT COMPLETE`);
    console.log(`   LiquidityManager: ${liqManAddr}`);
}

main().catch(console.error);
