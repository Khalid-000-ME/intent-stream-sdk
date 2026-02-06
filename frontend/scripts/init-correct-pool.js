const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");

// Load environment variables
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
} else {
    require("dotenv").config();
}

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

const LIQUIDITY_MANAGER = "0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0";
const POOL_MANAGER_ADDR = "0x1b832D5395A41446b508632466cf32c6C07D63c7";
const USDC_ADDR = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const WETH_ADDR = "0x4200000000000000000000000000000000000006";

const POOL_MANAGER_ABI = [
    "function initialize((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) external returns (int24 tick)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`\n🌊 Initializing New V4 Pool (Fee: 500) with CORRECT Price`);

    const poolManager = new ethers.Contract(POOL_MANAGER_ADDR, POOL_MANAGER_ABI, wallet);

    // Sort tokens
    const token0 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase() ? USDC_ADDR : WETH_ADDR;
    const token1 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase() ? WETH_ADDR : USDC_ADDR;

    const key = {
        currency0: token0,
        currency1: token1,
        fee: 500, // New fee tier (0.05%)
        tickSpacing: 10,
        hooks: ethers.ZeroAddress
    };

    // Correct Price: 1 WETH = 3000 USDC
    // Token0 (USDC, 6), Token1 (WETH, 18)
    // SqrtPriceX96 for 3000 USDC/WETH ≈ 1446700000000000000000000000000
    const sqrtPriceX96 = "1446700000000000000000000000000";

    try {
        console.log(`🚀 Initializing Pool...`);
        const tx = await poolManager.initialize(key, sqrtPriceX96, { gasLimit: 1000000 });
        console.log(`⏳ Pending: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Success! Pool initialized with correct price.`);
        console.log(`   Fee: 500, Tick Spacing: 10`);
    } catch (e) {
        if (e.message.includes("PoolAlreadyInitialized")) {
            console.log("ℹ️ Pool already initialized at this fee tier.");
        } else {
            console.error(`❌ Failed: ${e.message}`);
        }
    }
}

main().catch(console.error);
