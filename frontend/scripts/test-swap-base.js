const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

// Base Sepolia - Simplified approach using PoolSwapTest
const POOL_SWAP_TEST = "0x8b5bcc363dde2614281ad875bad385e0a785d3b9";
const POOL_MANAGER = "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408";
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const WETH = "0x4200000000000000000000000000000000000006";
const RPC = "https://sepolia.base.org";

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
];

const POOL_SWAP_TEST_ABI = [
    "function swap(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, bytes hookData) external payable returns (int256)"
];

async function main() {
    console.log("\n🧪 Testing Swap on Base Sepolia (will initialize pool if needed)\n");

    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Wallet: ${wallet.address}\n`);

    const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);
    const swapTest = new ethers.Contract(POOL_SWAP_TEST, POOL_SWAP_TEST_ABI, wallet);

    // Pool key
    const [currency0, currency1] = USDC.toLowerCase() < WETH.toLowerCase()
        ? [USDC, WETH]
        : [WETH, USDC];

    const key = {
        currency0,
        currency1,
        fee: 3000,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    console.log("Pool Configuration:");
    console.log(`  Currency0: ${key.currency0}`);
    console.log(`  Currency1: ${key.currency1}`);
    console.log(`  Fee: 3000 (0.3%)\n`);

    // Approve PoolManager
    console.log("1️⃣ Approving tokens for PoolManager...");
    const allowance = await usdc.allowance(wallet.address, POOL_MANAGER);
    if (allowance < ethers.parseUnits("1000", 6)) {
        const tx = await usdc.approve(POOL_MANAGER, ethers.MaxUint256);
        await tx.wait();
        console.log("   ✅ USDC approved\n");
    } else {
        console.log("   ✅ USDC already approved\n");
    }

    // Try a small swap (this will fail if pool doesn't exist, but shows us the error)
    console.log("2️⃣ Attempting swap (2 USDC -> WETH)...");

    const amountIn = ethers.parseUnits("2", 6); // 2 USDC
    const MIN_SQRT_RATIO = BigInt("4295128740");

    const params = {
        zeroForOne: true, // USDC -> WETH
        amountSpecified: -amountIn, // Negative for exact input
        sqrtPriceLimitX96: MIN_SQRT_RATIO
    };

    try {
        const tx = await swapTest.swap(key, params, "0x", { gasLimit: 1000000, value: 0 });
        console.log(`   Tx: ${tx.hash}`);
        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log(`   ✅ Swap successful!`);
            console.log(`   View: https://sepolia.basescan.org/tx/${tx.hash}\n`);
        }
    } catch (e) {
        console.error(`   ❌ Swap failed:`, e.message);

        if (e.message.includes("PoolNotInitialized") || e.message.includes("not initialized")) {
            console.log(`\n   ℹ️  Pool needs to be initialized first.`);
            console.log(`   The official Uniswap PoolManagers require using the PositionManager`);
            console.log(`   to create pools, which is complex. Recommendation:`);
            console.log(`   - Use Uniswap's frontend to create a position`);
            console.log(`   - Or wait for other users to create pools`);
            console.log(`   - Or revert to custom PoolManagers where you have control\n`);
        }
    }
}

main().catch(e => {
    console.error("\n❌ Error:", e.message);
    process.exit(1);
});
