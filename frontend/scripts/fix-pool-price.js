const { ethers } = require("ethers");
const readline = require("readline");
const path = require("path");
const fs = require("fs");

// Load .env.local
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
} else {
    require("dotenv").config();
}

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;

const CONFIG = {
    'arbitrum': {
        name: 'Arbitrum Sepolia',
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        router: '0x87bD55Ea0505005799a28D34B5Ca17f4c8d24301',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed'
    },
    'ethereum': {
        name: 'Ethereum Sepolia',
        rpc: 'https://1rpc.io/sepolia',
        router: '0x6127b25A12AB31dF2B58Fe9DfFCba595AB927eA3',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
    }
};

const ROUTER_ABI = [
    "function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, bytes hookData) external payable",
    "function getPoolStatus((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key) view returns (uint160 sqrtPriceX96, uint128 liquidity)"
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

async function main() {
    console.log("\n🧪 \x1b[36mPOOL PRICE NORMALIZER\x1b[0m 🧪");
    console.log("This script pushes the pool price from 1:1 units to 1 ETH ≈ 2500 USDC.\n");

    const choice = await ask("Select Chain ([1] Arbitrum, [2] Ethereum): ");
    const key = choice === '1' ? 'arbitrum' : 'ethereum';
    const chain = CONFIG[key];

    const provider = new ethers.JsonRpcProvider(chain.rpc);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const router = new ethers.Contract(chain.router, ROUTER_ABI, wallet);

    const isUSDC0 = chain.usdc.toLowerCase() < chain.weth.toLowerCase();
    const poolKey = {
        currency0: isUSDC0 ? chain.usdc : chain.weth,
        currency1: isUSDC0 ? chain.weth : chain.usdc,
        fee: 3000,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    console.log(`\n🔍 Checking status on ${chain.name}...`);
    const status = await router.getPoolStatus(poolKey);
    const Q96 = 2n ** 96n;

    // Check if price is unphysically low (1:1 units or close to it)
    // At 1 ETH = 2500 USDC, sqrtPriceX96 should be ~20,000 * Q96
    const ratio = Number(status.sqrtPriceX96) / Number(Q96);
    console.log(`   Current Price Ratio: ${ratio.toFixed(4)} (Ideal is ~20000)`);

    // 1:1 unit pricing results in a ratio of exactly 1,000,000
    // We want it to be around 20,000.
    if (ratio < 30000 && ratio > 10000) {
        console.log("\x1b[32m✅ Price already looks reasonable on this chain.\x1b[0m");
        process.exit(0);
    }

    console.log("\x1b[33m⚠️ Pool price is unphysical (1:1 units). Swapping ETH for USDC to normalize...\x1b[0m");

    const swapParams = {
        zeroForOne: !isUSDC0, // If USDC is token0, we swap token1 (ETH) for token0
        amountSpecified: -ethers.parseEther("0.002"), // Negative means exact input
        sqrtPriceLimitX96: !isUSDC0 ? (2n ** 160n - 1n) : (4295128739n + 1n)
    };

    try {
        const tx = await router.swap(poolKey, swapParams, "0x", { value: ethers.parseEther("0.002"), gasLimit: 1000000 });
        console.log(`⏳ Swapping: ${tx.hash}`);
        await tx.wait();
        console.log("\x1b[32m✅ SUCCESS! Pool price has been normalized.\x1b[0m");
        console.log("You can now run the add-liquidity script for this chain.");
    } catch (e) {
        console.log("\x1b[31m❌ Swap Failed:\x1b[0m", e.message);
    }
    rl.close();
}

main().catch(console.error);
