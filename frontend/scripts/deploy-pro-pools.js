const { ethers } = require("ethers");
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
    base: {
        rpc: 'https://sepolia.base.org',
        manager: '0x1b832D5395A41446b508632466cf32c6C07D63c7',
        router: '0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006'
    },
    arbitrum: {
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        manager: '0x4e650C85801e9dC44313669b491d20DB864a5451',
        router: '0x87bD55Ea0505005799a28D34B5Ca17f4c8d24301',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed'
    },
    ethereum: {
        rpc: 'https://1rpc.io/sepolia',
        manager: '0xf448192241A9BBECd36371CD1f446de81A5399d2',
        router: '0x6127b25A12AB31dF2B58Fe9DfFCba595AB927eA3',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
    }
};

const FEE = 100; // 0.01% - Fresh and Clean
const TICK_SPACING = 60;

// sqrtPrice for 1 ETH = 2500 USDC
// sqrt(2500 * 10^6 / 10^18) * 2^96 = 0.00005 * 2^96
const SQRT_PRICE_X96 = "3961408125713216879677200";

async function main() {
    console.log("\n💎 \x1b[36mUNIFLOW PROFESSIONAL POOL DEPLOYMENT\x1b[0m 💎");
    console.log(`Target: 1 ETH = 2500 USDC | Fee: ${FEE} | TS: ${TICK_SPACING}\n`);

    for (const [net, chain] of Object.entries(CONFIG)) {
        console.log(`\n🚀 Processing ${net.toUpperCase()}...`);
        const provider = new ethers.JsonRpcProvider(chain.rpc);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

        const manager = new ethers.Contract(chain.manager, [
            "function initialize((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks), uint160 sqrtPriceX96) external returns (int24)",
        ], wallet);

        const router = new ethers.Contract(chain.router, [
            "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable"
        ], wallet);

        const isUSDC0 = chain.usdc.toLowerCase() < chain.weth.toLowerCase();
        const poolKey = {
            currency0: isUSDC0 ? chain.usdc : chain.weth,
            currency1: isUSDC0 ? chain.weth : chain.usdc,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: ethers.ZeroAddress
        };

        // 1. Initialize
        try {
            const tx = await manager.initialize(poolKey, SQRT_PRICE_X96, { gasLimit: 1000000 });
            console.log(`   ✅ Pool Initialized: ${tx.hash}`);
            await tx.wait();
        } catch (e) {
            console.log(`   ℹ️  Initialization Skipped (Already exists or error)`);
        }

        // 2. Add Tiny Seed Liquidity (0.25 USDC / 0.0001 ETH)
        console.log(`   🌊 Providing Seed Liquidity...`);
        try {
            const tx = await router.addLiquidity(poolKey, {
                tickLower: -887220,
                tickUpper: 887220,
                liquidityDelta: 100000000n, // Tiny amount
                salt: ethers.ZeroHash
            }, "0x", { gasLimit: 1000000 });
            await tx.wait();
            console.log(`   ✅ Seed Liquidity Added!`);
        } catch (e) {
            console.log(`   ❌ Seed Failed: ${e.message.split('(')[0]}`);
        }
    }
    console.log("\n✨ System is now ready on Fee 100.");
}

main().catch(console.error);
