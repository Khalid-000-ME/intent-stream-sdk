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
        poolManager: '0x1b832D5395A41446b508632466cf32c6C07D63c7',
        router: '0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006',
        name: 'Base Sepolia'
    },
    arbitrum: {
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        poolManager: '0x4e650C85801e9dC44313669b491d20DB864a5451',
        router: '0x87bD55Ea0505005799a28D34B5Ca17f4c8d24301',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed',
        name: 'Arbitrum Sepolia'
    },
    ethereum: {
        rpc: 'https://1rpc.io/sepolia',
        poolManager: '0xf448192241A9BBECd36371CD1f446de81A5399d2',
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

    const params = {
        tickLower: -887220,
        tickUpper: 887220,
        liquidityDelta: -100000000000n, // Negative to remove
        salt: ethers.ZeroHash
    };

    // Try multiple fee tiers
    const fees = [200, 500, 3000, 5000, 10000];

    for (const fee of fees) {
        console.log(`\n  Trying to remove from Fee Tier: ${fee} (0.${fee / 100}%)`);

        const poolKey = {
            currency0,
            currency1,
            fee: fee,
            tickSpacing: 60,
            hooks: ethers.ZeroAddress
        };

        try {
            // Estimate gas first to see if transaction would succeed
            // If we have no liquidity in this pool, it might revert or consume minimal gas

            // We'll just try to send it. If it reverts, we catch it.
            const tx = await router.addLiquidity(poolKey, params, "0x", {
                gasLimit: 500000
            });

            console.log(`  ✅ Transaction sent: ${tx.hash}`);
            const receipt = await tx.wait();

            if (receipt.status === 1) {
                console.log(`  🎉 SUCCESS! Liquidity removed from fee tier ${fee}!`);
            }
        } catch (e) {
            // Expected if no liquidity in this tier
            process.stdout.write(`  ❌ No liquidity in fee tier ${fee} (or tx reverted)\n`);
        }
    }
}

async function main() {
    console.log("🌊 UNIFLOW - Sweep All Liquidity 🌊\n");

    for (const chain of ['base', 'arbitrum', 'ethereum']) {
        await removeLiquidityFromChain(chain);
        console.log("\n" + "=".repeat(60));
    }

    console.log("\n✅ Done!");
}

main().catch(console.error);
