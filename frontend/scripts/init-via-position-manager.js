const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

// Base Sepolia Configuration
const NETWORK = {
    name: 'Base Sepolia',
    rpc: 'https://sepolia.base.org',
    poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408',
    positionManager: '0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    weth: '0x4200000000000000000000000000000000000006'
};

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

// Simplified PositionManager ABI (based on Uniswap v4-periphery)
const POSITION_MANAGER_ABI = [
    "function initialize(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, uint160 sqrtPriceX96) external payable returns (int24)"
];

async function main() {
    console.log(`\n🚀 Initializing Pool via PositionManager on ${NETWORK.name}\n`);

    const provider = new ethers.JsonRpcProvider(NETWORK.rpc);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Wallet: ${wallet.address}`);

    const balance = await provider.getBalance(wallet.address);
    console.log(`ETH Balance: ${ethers.formatEther(balance)}\n`);

    const positionManager = new ethers.Contract(NETWORK.positionManager, POSITION_MANAGER_ABI, wallet);

    // Define pool key
    const [currency0, currency1] = NETWORK.usdc.toLowerCase() < NETWORK.weth.toLowerCase()
        ? [NETWORK.usdc, NETWORK.weth]
        : [NETWORK.weth, NETWORK.usdc];

    const poolKey = {
        currency0,
        currency1,
        fee: 3000, // 0.3%
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    console.log(`Pool Key:`);
    console.log(`  Currency0: ${poolKey.currency0}`);
    console.log(`  Currency1: ${poolKey.currency1}`);
    console.log(`  Fee: 3000 (0.3%)\n`);

    // Initialize at 1:1 price
    const SQRT_PRICE_1_1 = "79228162514264337593543950336";

    console.log(`📝 Initializing pool at 1:1 price...`);
    try {
        const tx = await positionManager.initialize(poolKey, SQRT_PRICE_1_1, {
            gasLimit: 500000,
            value: 0
        });

        console.log(`   Tx: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`   ✅ Pool initialized! Block: ${receipt.blockNumber}\n`);
        console.log(`   View on BaseScan: https://sepolia.basescan.org/tx/${tx.hash}\n`);
    } catch (e) {
        console.error(`   ❌ Failed:`, e.message);
        if (e.message.includes("PoolAlreadyInitialized") || e.message.includes("already initialized")) {
            console.log(`   ℹ️  Pool already initialized - this is OK!\n`);
        }
    }
}

main().catch(e => {
    console.error("\n❌ Error:", e.message);
    process.exit(1);
});
