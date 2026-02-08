const { ethers } = require("ethers");

const NETWORKS = {
    base: {
        rpc: 'https://sepolia.base.org',
        poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408', // Official
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006'
    },
    arbitrum: {
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        poolManager: '0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317', // Official
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed'
    }
};

const PM_ABI = [
    "function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
    "function getLiquidity(bytes32 poolId) external view returns (uint128)"
];

const FEE_TIERS = [
    { fee: 200, tickSpacing: 60 },   // Custom pools use this
    { fee: 100, tickSpacing: 1 },
    { fee: 500, tickSpacing: 10 },
    { fee: 3000, tickSpacing: 60 },
    { fee: 10000, tickSpacing: 200 }
];

async function scanPools(network) {
    const config = NETWORKS[network];
    console.log(`\n🔍 Scanning ${network.toUpperCase()} for USDC/WETH pools...`);
    console.log(`   PoolManager: ${config.poolManager}\n`);

    const provider = new ethers.JsonRpcProvider(config.rpc);
    const pm = new ethers.Contract(config.poolManager, PM_ABI, provider);

    const [currency0, currency1] = config.usdc.toLowerCase() < config.weth.toLowerCase()
        ? [config.usdc, config.weth]
        : [config.weth, config.usdc];

    let foundPools = 0;

    for (const { fee, tickSpacing } of FEE_TIERS) {
        const key = {
            currency0,
            currency1,
            fee,
            tickSpacing,
            hooks: ethers.ZeroAddress
        };

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
                foundPools++;
                console.log(`✅ Pool Found:`);
                console.log(`   Fee: ${fee / 100}% (${fee})`);
                console.log(`   TickSpacing: ${tickSpacing}`);
                console.log(`   SqrtPriceX96: ${sqrtPriceX96}`);
                console.log(`   Tick: ${tick}`);
                console.log(`   Liquidity: ${ethers.formatUnits(liquidity, 18)}`);
                console.log(`   Pool ID: ${poolId}\n`);
            }
        } catch (e) {
            // Pool doesn't exist
        }
    }

    if (foundPools === 0) {
        console.log(`⚠️  No pools found on ${network}\n`);
    } else {
        console.log(`📊 Total pools found: ${foundPools}\n`);
    }
}

async function main() {
    await scanPools('base');
    await scanPools('arbitrum');
}

main().catch(console.error);
