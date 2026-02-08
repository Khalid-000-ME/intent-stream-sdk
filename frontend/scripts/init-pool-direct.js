const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

const NETWORK = {
    rpc: 'https://eth-sepolia.g.alchemy.com/v2/demo',
    poolManager: '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543',
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
};

const PM_ABI = [
    "function initialize(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) external returns (int24)",
    "function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
    "function modifyLiquidity(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external returns (int256, int256)"
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
];

async function main() {
    console.log("\n🚀 Direct PoolManager Initialization (Ethereum Sepolia)\n");

    const provider = new ethers.JsonRpcProvider(NETWORK.rpc);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Wallet: ${wallet.address}`);

    const pm = new ethers.Contract(NETWORK.poolManager, PM_ABI, wallet);
    const usdc = new ethers.Contract(NETWORK.usdc, ERC20_ABI, wallet);
    const weth = new ethers.Contract(NETWORK.weth, ERC20_ABI, wallet);

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

    console.log(`\nPool Key:`);
    console.log(`  Token0: ${token0}`);
    console.log(`  Token1: ${token1}`);
    console.log(`  Fee: 3000 (0.3%)`);

    // 1. Initialize Pool
    const SQRT_PRICE_1_1 = "79228162514264337593543950336"; // 1:1 price

    console.log(`\n1️⃣ Initializing pool...`);
    try {
        const tx = await pm.initialize(key, SQRT_PRICE_1_1, { gasLimit: 500000 });
        console.log(`   Tx: ${tx.hash}`);
        await tx.wait();
        console.log(`   ✅ Pool initialized!`);
    } catch (e) {
        if (e.message.includes("PoolAlreadyInitialized") || e.message.includes("already initialized")) {
            console.log(`   ℹ️  Pool already initialized`);
        } else {
            console.error(`   ❌ Init failed:`, e.message);
            return;
        }
    }

    // 2. Approve tokens
    console.log(`\n2️⃣ Approving tokens...`);
    const approveIfNeeded = async (token, name) => {
        const allowance = await token.allowance(wallet.address, NETWORK.poolManager);
        if (allowance < ethers.parseUnits("1000", 18)) {
            console.log(`   Approving ${name}...`);
            const tx = await token.approve(NETWORK.poolManager, ethers.MaxUint256);
            await tx.wait();
        }
    };

    await approveIfNeeded(usdc, "USDC");
    await approveIfNeeded(weth, "WETH");

    // 3. Add Liquidity
    console.log(`\n3️⃣ Adding liquidity...`);

    const liquidityDelta = ethers.parseUnits("10", 18); // 10 units of liquidity

    const params = {
        tickLower: -600,
        tickUpper: 600,
        liquidityDelta: liquidityDelta,
        salt: ethers.ZeroHash
    };

    try {
        const tx = await pm.modifyLiquidity(key, params, "0x", { gasLimit: 1000000 });
        console.log(`   Tx: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`   ✅ Liquidity added! Block: ${receipt.blockNumber}`);
    } catch (e) {
        console.error(`   ❌ Failed:`, e.message);
    }

    console.log("\n✅ Setup complete!\n");
}

main().catch(console.error);
