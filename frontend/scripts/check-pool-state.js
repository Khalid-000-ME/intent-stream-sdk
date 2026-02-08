const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const NETWORKS = {
    ethereum: {
        rpc: 'https://1rpc.io/sepolia',
        router: '0x72166B1ec9Da1233CEc8D742Abc9890608BA4097',
        poolManager: '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
    },
    arbitrum: {
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        router: '0x0C3B163c971e11e2308Fc3e1020787f2E21b280C',
        poolManager: '0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed'
    },
    base: {
        rpc: 'https://sepolia.base.org',
        router: '0xB079cab802838d5aB97f12dC1B8D369f439719B3',
        poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006'
    }
};

const PM_ABI = [
    "function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
    "function getLiquidity(bytes32 poolId) external view returns (uint128)"
];

async function main() {
    const network = process.argv[2] || 'ethereum';
    const config = NETWORKS[network];

    if (!config) {
        console.error("Usage: node check-pool-state.js <ethereum|arbitrum|base>");
        process.exit(1);
    }

    console.log(`\n🔍 Checking Pool State on ${network.toUpperCase()}`);
    console.log(`   PoolManager: ${config.poolManager}`);

    const provider = new ethers.JsonRpcProvider(config.rpc);
    const pm = new ethers.Contract(config.poolManager, PM_ABI, provider);

    const isUSDC0 = config.usdc.toLowerCase() < config.weth.toLowerCase();
    const token0 = isUSDC0 ? config.usdc : config.weth;
    const token1 = isUSDC0 ? config.weth : config.usdc;

    // Check multiple fee tiers
    const feeTiers = [200, 500, 3000, 10000];

    for (const fee of feeTiers) {
        const key = {
            currency0: token0,
            currency1: token1,
            fee: fee,
            tickSpacing: fee === 200 ? 60 : fee === 500 ? 10 : fee === 3000 ? 60 : 200,
            hooks: ethers.ZeroAddress
        };

        // Compute pool ID
        const poolId = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "uint24", "int24", "address"],
                [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
            )
        );

        try {
            const [sqrtPriceX96, tick] = await pm.getSlot0(poolId);
            const liquidity = await pm.getLiquidity(poolId);

            if (sqrtPriceX96 > 0n) {
                console.log(`\n✅ Pool Found (Fee: ${fee})`);
                console.log(`   Pool ID: ${poolId}`);
                console.log(`   SqrtPriceX96: ${sqrtPriceX96}`);
                console.log(`   Tick: ${tick}`);
                console.log(`   Liquidity: ${liquidity}`);

                if (liquidity === 0n) {
                    console.log(`   ⚠️  WARNING: Pool initialized but has ZERO liquidity!`);
                }
            }
        } catch (e) {
            // Pool doesn't exist for this fee tier
        }
    }

    console.log("\n");
}

main().catch(console.error);
