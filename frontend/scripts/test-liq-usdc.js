const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");

// Load environment variables
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
} else {
    require("dotenv").config();
}

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

const LIQUIDITY_MANAGER = "0xd02Fef2B4557c5b6E93bE8Ea829f31DfAC1f0276";
const POOL_MANAGER = "0x9f2C9336e3879991aB49748a6C8A4965eE7F90dB";
const USDC_ADDR = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const WETH_ADDR = "0x4200000000000000000000000000000000000006";

const ERC20_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function symbol() view returns (string)"
];

const LIQUIDITY_MANAGER_ABI = [
    "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`\n🧪 Testing USDC-only Liquidity (Range Above Current Price)`);

    const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, wallet);
    const liquidityManager = new ethers.Contract(LIQUIDITY_MANAGER, LIQUIDITY_MANAGER_ABI, wallet);

    // Current Pool Price is ~1.0 in base units. 
    // We'll add liquidity in a range strictly ABOVE the current price (e.g., tick 60000 to 120000).
    // This will only require USDC (Token0).

    const usdcToProvide = "0.1"; // 0.1 USDC = 100,000 units
    const usdcUnits = ethers.parseUnits(usdcToProvide, 6);

    // Approvals
    console.log("🔓 Checking Approvals...");

    async function ensureApproval(token, spender) {
        const allowance = await token.allowance(wallet.address, spender);
        if (allowance < ethers.MaxUint256 / 2n) {
            console.log(`   Approving for ${spender}...`);
            await (await token.approve(spender, ethers.MaxUint256)).wait();
        }
    }

    await ensureApproval(usdc, LIQUIDITY_MANAGER);
    await ensureApproval(usdc, POOL_MANAGER);
    console.log("✅ Approvals OK");

    const token0 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase() ? USDC_ADDR : WETH_ADDR;
    const token1 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase() ? WETH_ADDR : USDC_ADDR;

    const key = {
        currency0: token0,
        currency1: token1,
        fee: 3000,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    // Calculate liquidityDelta for a range where only Token0 is provided.
    // L = amount0 * (sqrt(P_u) * sqrt(P_l)) / (sqrt(P_u) - sqrt(P_l))
    // Let's just use a fixed small delta to see if it works.
    const liquidityDelta = BigInt(1000000);

    const params = {
        tickLower: 60000, // Strictly above current tick 0
        tickUpper: 120000,
        liquidityDelta: liquidityDelta,
        salt: ethers.ZeroHash
    };

    try {
        console.log(`💧 Adding USDC-only Liquidity...`);
        const tx = await liquidityManager.addLiquidity(key, params, "0x", { gasLimit: 2000000 });
        console.log(`⏳ Pending: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Success! USDC-only liquidity added.`);
    } catch (e) {
        console.error(`❌ Failed: ${e.message}`);
    }
}

main().catch(console.error);
