const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");

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
        router: '0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0',
        pm: '0x1b832D5395A41446b508632466cf32c6C07D63c7',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006'
    },
    arbitrum: {
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        router: '0x87bD55Ea0505005799a28D34B5Ca17f4c8d24301',
        pm: '0x4e650C85801e9dC44313669b491d20DB864a5451',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed'
    },
    ethereum: {
        rpc: 'https://1rpc.io/sepolia',
        router: '0x6127b25A12AB31dF2B58Fe9DfFCba595AB927eA3',
        pm: '0xf448192241A9BBECd36371CD1f446de81A5399d2',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
    }
};

const ROUTER_ABI = [
    "function getPoolStatus((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key) view returns (uint160 sqrtPriceX96, uint128 liquidity)",
    "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable"
];

async function main() {
    console.log("🆘 \x1b[31mEMERGENCY LIQUIDITY RECOVERY\x1b[0m 🆘");

    for (const [net, chain] of Object.entries(CONFIG)) {
        console.log(`\n🔍 Checking ${net.toUpperCase()}...`);
        const provider = new ethers.JsonRpcProvider(chain.rpc);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const router = new ethers.Contract(chain.router, ROUTER_ABI, wallet);

        const isUSDC0 = chain.usdc.toLowerCase() < chain.weth.toLowerCase();
        const fees = [3000, 5000];

        for (const fee of fees) {
            const key = {
                currency0: isUSDC0 ? chain.usdc : chain.weth,
                currency1: isUSDC0 ? chain.weth : chain.usdc,
                fee,
                tickSpacing: 60,
                hooks: ethers.ZeroAddress
            };

            try {
                const [price, liq] = await router.getPoolStatus(key);
                if (liq > 0n) {
                    console.log(`   💰 Found ${liq.toString()} liquidity in Fee ${fee} pool. Recovering...`);
                    // To remove liquidity in V4TestRouter, we call addLiquidity with negative delta
                    const tx = await router.addLiquidity(key, {
                        tickLower: -887220,
                        tickUpper: 887220,
                        liquidityDelta: -liq,
                        salt: ethers.ZeroHash
                    }, "0x", { gasLimit: 1000000 });

                    console.log(`   ⏳ Sent: ${tx.hash}`);
                    await tx.wait();
                    console.log(`   ✅ Successfully recovered funds from Fee ${fee} pool!`);
                } else {
                    console.log(`   ℹ️  Fee ${fee} pool has no liquidity.`);
                }
            } catch (e) {
                // Not initialized or other error
            }
        }
    }
    console.log("\n✨ Recovery complete. Check your balances.");
}

main().catch(console.error);
