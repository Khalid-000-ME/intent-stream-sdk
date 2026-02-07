const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");

// Load .env.local
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
} else {
    require("dotenv").config();
}

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;

// New RPC we want to test
const ARB_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';

const CONTRACTS = {
    router: '0x87bD55Ea0505005799a28D34B5Ca17f4c8d24301',
    usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed'
};

const ERC20_ABI = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

async function main() {
    console.log("🧪 Testing Arbitrum TINT Swap (Direct Execution)...");

    const provider = new ethers.JsonRpcProvider(ARB_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`   RPC: ${ARB_RPC}`);
    console.log(`   Wallet: ${wallet.address}`);

    const usdc = new ethers.Contract(CONTRACTS.usdc, ERC20_ABI, wallet);
    const routerAddress = CONTRACTS.router;

    // Simulate 0.15 USDC swap (the residual from the failed intent)
    const amount = "0.15";
    const amountInt = ethers.parseUnits(amount, 6); // USDC has 6 decimals

    console.log(`   Checking Allowance...`);
    const allowance = await usdc.allowance(wallet.address, routerAddress);
    if (allowance < amountInt) {
        console.log(`   Approving Router...`);
        const tx = await usdc.approve(routerAddress, ethers.MaxUint256);
        console.log(`   Tx Sent: ${tx.hash}`);
        await tx.wait();
        console.log(`   Approved.`);
    } else {
        console.log(`   Allowance OK.`);
    }

    const router = new ethers.Contract(routerAddress, [
        "function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, bytes hookData) external payable"
    ], wallet);

    // Setup Pool Key (Fee 200)
    const token0 = CONTRACTS.usdc.toLowerCase() < CONTRACTS.weth.toLowerCase() ? CONTRACTS.usdc : CONTRACTS.weth;
    const token1 = CONTRACTS.usdc.toLowerCase() < CONTRACTS.weth.toLowerCase() ? CONTRACTS.weth : CONTRACTS.usdc;

    const key = {
        currency0: token0,
        currency1: token1,
        fee: 200,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    const isFromToken0 = CONTRACTS.usdc.toLowerCase() === token0.toLowerCase();

    const MIN_SQRT_RATIO = 4295128739n + 1n;
    const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n - 1n;

    const params = {
        zeroForOne: isFromToken0,
        amountSpecified: -amountInt, // Exact input
        sqrtPriceLimitX96: isFromToken0 ? (MIN_SQRT_RATIO + 100n) : (MAX_SQRT_RATIO - 100n)
    };

    console.log(`   Executing Swap (0.15 USDC -> WETH)...`);
    try {
        const tx = await router.swap(key, params, "0x", { gasLimit: 2000000 });
        console.log(`   📝 Tx Sent: ${tx.hash}`);
        console.log(`   ⏳ Waiting for confirmation...`);
        const receipt = await tx.wait();
        console.log(`   ✅ Confirmed in Block ${receipt.blockNumber}`);
    } catch (error) {
        console.error(`   ❌ Failed:`, error);
    }
}

main().catch(console.error);
