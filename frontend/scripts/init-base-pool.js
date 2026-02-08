const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

const NETWORK = {
    name: 'Base Sepolia',
    rpc: 'https://sepolia.base.org',
    poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    weth: '0x4200000000000000000000000000000000000006'
};

const PM_ABI = [
    "function initialize(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) external returns (int24)",
    "function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)"
];

async function main() {
    console.log(`\n🚀 Initializing Pool on ${NETWORK.name}\n`);

    if (!PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEY not found");
        return;
    }

    const provider = new ethers.JsonRpcProvider(NETWORK.rpc);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Wallet: ${wallet.address}`);

    const balance = await provider.getBalance(wallet.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

    const pm = new ethers.Contract(NETWORK.poolManager, PM_ABI, wallet);
    const usdc = new ethers.Contract(NETWORK.usdc, ERC20_ABI, wallet);
    const weth = new ethers.Contract(NETWORK.weth, ERC20_ABI, wallet);

    const [usdcBal, wethBal, usdcSym, wethSym] = await Promise.all([
        usdc.balanceOf(wallet.address),
        weth.balanceOf(wallet.address),
        usdc.symbol(),
        weth.symbol()
    ]);

    console.log(`Token Balances:`);
    console.log(`  ${usdcSym}: ${ethers.formatUnits(usdcBal, 6)}`);
    console.log(`  ${wethSym}: ${ethers.formatEther(wethBal)}\n`);

    const isUSDC0 = NETWORK.usdc.toLowerCase() < NETWORK.weth.toLowerCase();
    const token0 = isUSDC0 ? NETWORK.usdc : NETWORK.weth;
    const token1 = isUSDC0 ? NETWORK.weth : NETWORK.usdc;

    const key = {
        currency0: token0,
        currency1: token1,
        fee: 3000,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    console.log(`Pool Configuration:`);
    console.log(`  Currency0: ${token0}`);
    console.log(`  Currency1: ${token1}`);
    console.log(`  Fee: 3000 (0.3%)`);
    console.log(`  TickSpacing: 60\n`);

    // Check if pool exists
    const poolId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "uint24", "int24", "address"],
            [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
        )
    );

    try {
        const [sqrtPrice] = await pm.getSlot0(poolId);
        if (sqrtPrice > 0n) {
            console.log(`✅ Pool already initialized!`);
            console.log(`   SqrtPriceX96: ${sqrtPrice}\n`);
            return;
        }
    } catch (e) {
        // Pool doesn't exist, continue to initialize
    }

    // Initialize Pool at 1:1 price
    const SQRT_PRICE_1_1 = "79228162514264337593543950336";

    console.log(`📝 Initializing pool at 1:1 price...`);
    try {
        const tx = await pm.initialize(key, SQRT_PRICE_1_1, { gasLimit: 500000 });
        console.log(`   Tx: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`   ✅ Pool initialized! Block: ${receipt.blockNumber}\n`);
    } catch (e) {
        console.error(`   ❌ Failed:`, e.message);
        if (e.data) console.error(`   Data:`, e.data);
    }
}

main().catch(e => {
    console.error("\n❌ Error:", e.message);
    process.exit(1);
});
