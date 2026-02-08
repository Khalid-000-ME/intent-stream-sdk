const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

// Base Sepolia
const POOL_INITIALIZER = "0x70d8Db9cAb4cD4B2e7494b0488d93ED6018394EF";
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const WETH = "0x4200000000000000000000000000000000000006";
const RPC = "https://sepolia.base.org";

const POOL_INITIALIZER_ABI = [
    "function initializePool(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) external returns (int24)"
];

async function main() {
    console.log("\n🚀 Initializing Pool via Contract on Base Sepolia\n");

    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Wallet: ${wallet.address}`);
    console.log(`Balance: ${ethers.formatEther(await provider.getBalance(wallet.address))} ETH\n`);

    const initializer = new ethers.Contract(POOL_INITIALIZER, POOL_INITIALIZER_ABI, wallet);

    // Pool key with fee 200
    const [currency0, currency1] = USDC.toLowerCase() < WETH.toLowerCase()
        ? [USDC, WETH]
        : [WETH, USDC];

    const poolKey = {
        currency0,
        currency1,
        fee: 200,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    console.log("Pool Key:");
    console.log(`  Currency0: ${poolKey.currency0}`);
    console.log(`  Currency1: ${poolKey.currency1}`);
    console.log(`  Fee: 200`);
    console.log(`  TickSpacing: 60\n`);

    // Initialize at 1:1 price
    const SQRT_PRICE_1_1 = "79228162514264337593543950336";

    console.log("Initializing pool at 1:1 price...\n");

    try {
        const tx = await initializer.initializePool(poolKey, SQRT_PRICE_1_1, {
            gasLimit: 500000
        });

        console.log(`✅ Transaction sent: ${tx.hash}`);
        console.log(`   Waiting for confirmation...`);

        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log(`\n🎉 Pool initialized successfully!`);
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
            console.log(`\n   View on BaseScan: https://sepolia.basescan.org/tx/${tx.hash}\n`);
            console.log(`✅ Pool is ready! You can now add liquidity and make swaps.\n`);
        } else {
            console.log(`\n❌ Transaction failed\n`);
        }
    } catch (e) {
        console.error(`\n❌ Failed:`, e.message);

        if (e.message.includes("PoolAlreadyInitialized") || e.message.includes("already initialized")) {
            console.log(`\n✅ Pool already initialized - this is OK!`);
            console.log(`   You can now add liquidity or make swaps.\n`);
        }
    }
}

main().catch(e => {
    console.error("\n❌ Error:", e.message);
    process.exit(1);
});
