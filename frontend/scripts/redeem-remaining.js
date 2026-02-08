const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("❌ MAIN_WALLET_PRIVATE_KEY not found in .env.local");
    process.exit(1);
}

// Your custom PoolManagers from the dashboard
const CONFIG = {
    base: {
        rpc: 'https://sepolia.base.org',
        router: '0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006',
        name: 'Base Sepolia'
    },
    arbitrum: {
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        router: '0x87bD55Ea0505005799a28D34B5Ca17f4c8d24301',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed',
        name: 'Arbitrum Sepolia'
    },
    ethereum: {
        rpc: 'https://1rpc.io/sepolia',
        router: '0x6127b25A12AB31dF2B58Fe9DfFCba595AB927eA3',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
        name: 'Ethereum Sepolia'
    }
};

const ROUTER_ABI = [
    "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable"
];

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)"
];

async function removeLiquidityFromChain(chainKey) {
    const chain = CONFIG[chainKey];
    console.log(`\n🔓 Checking ${chain.name}...`);

    const provider = new ethers.JsonRpcProvider(chain.rpc);
    const pk = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
    const wallet = new ethers.Wallet(pk, provider);
    const router = new ethers.Contract(chain.router, ROUTER_ABI, wallet);

    // Common parameters
    const isUSDC0 = chain.usdc.toLowerCase() < chain.weth.toLowerCase();
    const currency0 = isUSDC0 ? chain.usdc : chain.weth;
    const currency1 = isUSDC0 ? chain.weth : chain.usdc;

    const fees = [200, 500, 3000, 5000, 10000];
    // Try a wide range of amounts because fixed scripts used 1e6 (1 USDC) while others used 1e11
    const amounts = [
        100000000000n, 80000000000n, 50000000000n, 20000000000n,
        10000000000n, 5000000000n, 1000000000n,
        500000000n, 100000000n, 50000000n, 10000000n,
        5000000n, 1000000n, 500000n, 100000n, 1000n
    ];

    for (const fee of fees) {
        process.stdout.write(`  Fee Tier ${fee}: `);

        const poolKey = {
            currency0,
            currency1,
            fee: fee,
            tickSpacing: 60,
            hooks: ethers.ZeroAddress
        };

        for (const amount of amounts) {
            const params = {
                tickLower: -887220,
                tickUpper: 887220,
                liquidityDelta: -amount, // Negative to remove
                salt: ethers.ZeroHash
            };

            try {
                // Try to estimate gas - if this fails, we likely don't have enough liquidity
                await router.addLiquidity.estimateGas(poolKey, params, "0x");

                // If estimate succeeds, send it
                const tx = await router.addLiquidity(poolKey, params, "0x", {
                    gasLimit: 500000
                });

                process.stdout.write(`Found ${amount}! Removing... `);
                await tx.wait();
                process.stdout.write(`✅ Success\n`);

                // If we found a position, we might have MORE in it (e.g. if we had 1.5e11 and removed 1e11).
                // But simplified logic: break amount loop and move to next fee.
                // Or better: continue with same amount to drain it?
                // Let's just move on to next fee for now.
                break;
            } catch (e) {
                // Ignore error, try next amount
            }
        }
        process.stdout.write(`Done checking.\n`);
    }
}

async function main() {
    console.log("🌊 UNIFLOW - Sweep Remaining Liquidity (Brute Force) 🌊\n");

    for (const chain of ['base', 'arbitrum', 'ethereum']) {
        await removeLiquidityFromChain(chain);
        console.log("\n" + "=".repeat(60));
    }

    console.log("\n✅ Done!");
}

main().catch(console.error);
