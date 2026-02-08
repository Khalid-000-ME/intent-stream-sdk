const hre = require("hardhat");
require("dotenv").config();

// Deployed PoolInitializer on Base Sepolia
const POOL_INITIALIZER = "0xeE8074dd34c9bfc85Ad49C5aBDccAF49cbb59510";
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const WETH = "0x4200000000000000000000000000000000000006";

const POOL_INITIALIZER_ABI = [
    "function initializeStandardPool(address currency0, address currency1, uint160 sqrtPriceX96) external returns (int24)",
    "function getSqrtPrice1to1() external pure returns (uint160)"
];

async function main() {
    console.log("\n🚀 Initializing USDC/WETH Pool on Base Sepolia\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

    const poolInitializer = new hre.ethers.Contract(
        POOL_INITIALIZER,
        POOL_INITIALIZER_ABI,
        deployer
    );

    // Get 1:1 price
    const sqrtPrice = await poolInitializer.getSqrtPrice1to1();
    console.log(`Using 1:1 starting price: ${sqrtPrice}\n`);

    // Sort currencies (USDC < WETH on Base)
    const [currency0, currency1] = USDC.toLowerCase() < WETH.toLowerCase()
        ? [USDC, WETH]
        : [WETH, USDC];

    console.log("Pool Configuration:");
    console.log(`  Currency0: ${currency0}`);
    console.log(`  Currency1: ${currency1}`);
    console.log(`  Fee: 3000 (0.3%)`);
    console.log(`  TickSpacing: 60\n`);

    console.log("Initializing pool...");

    try {
        const tx = await poolInitializer.initializeStandardPool(
            currency0,
            currency1,
            sqrtPrice,
            { gasLimit: 500000 }
        );

        console.log(`✅ Transaction sent: ${tx.hash}`);
        console.log(`   Waiting for confirmation...`);

        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log(`\n🎉 Pool initialized successfully!`);
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
            console.log(`\n   View on BaseScan: https://sepolia.basescan.org/tx/${tx.hash}\n`);
            console.log(`✅ Pool is ready for liquidity!\n`);
        }
    } catch (e) {
        if (e.message.includes("PoolAlreadyInitialized") || e.message.includes("already initialized")) {
            console.log(`\n✅ Pool already initialized!`);
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
