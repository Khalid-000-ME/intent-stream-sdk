const hre = require("hardhat");
const { ethers } = require("ethers");
require("dotenv").config();

// Network configurations
const NETWORKS = {
    sepolia: {
        poolManager: '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
    },
    arbitrumSepolia: {
        poolManager: '0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed'
    },
    baseSepolia: {
        poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006'
    }
};

const POOL_MANAGER_ABI = [
    "function initialize(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) external returns (int24)"
];

async function main() {
    const networkName = hre.network.name;
    const config = NETWORKS[networkName];

    if (!config) {
        console.error(`❌ Network ${networkName} not configured`);
        process.exit(1);
    }

    console.log(`\n🚀 Creating USDC/WETH Pool on ${networkName}`);
    console.log(`   PoolManager: ${config.poolManager}\n`);

    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

    const poolManager = new hre.ethers.Contract(
        config.poolManager,
        POOL_MANAGER_ABI,
        deployer
    );

    // Sort currencies (currency0 < currency1)
    const [currency0, currency1] = config.usdc.toLowerCase() < config.weth.toLowerCase()
        ? [config.usdc, config.weth]
        : [config.weth, config.usdc];

    const poolKey = {
        currency0,
        currency1,
        fee: 3000,      // 0.3% fee - standard tier
        tickSpacing: 60,
        hooks: hre.ethers.ZeroAddress
    };

    console.log("Pool Configuration:");
    console.log(`  Currency0: ${poolKey.currency0}`);
    console.log(`  Currency1: ${poolKey.currency1}`);
    console.log(`  Fee: 3000 (0.3%)`);
    console.log(`  TickSpacing: 60\n`);

    // 1:1 starting price
    const SQRT_PRICE_1_1 = "79228162514264337593543950336";

    console.log("Initializing pool...");

    try {
        const tx = await poolManager.initialize(poolKey, SQRT_PRICE_1_1, {
            gasLimit: 500000
        });

        console.log(`✅ Transaction sent: ${tx.hash}`);
        console.log(`   Waiting for confirmation...`);

        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log(`\n🎉 Pool created successfully!`);
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas Used: ${receipt.gasUsed.toString()}\n`);
            console.log(`✅ Pool is ready for liquidity!\n`);
        }
    } catch (e) {
        if (e.message.includes("PoolAlreadyInitialized") || e.message.includes("already initialized")) {
            console.log(`\n✅ Pool already exists - this is OK!`);
            console.log(`   You can now add liquidity.\n`);
        } else {
            console.error(`\n❌ Failed:`, e.message);
            throw e;
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
