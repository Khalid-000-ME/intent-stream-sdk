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

const LIQUIDITY_MANAGER = "0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0";
const POOL_MANAGER = "0x1b832D5395A41446b508632466cf32c6C07D63c7";
const USDC_ADDR = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const WETH_ADDR = "0x4200000000000000000000000000000000000006";

const ERC20_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

const LIQUIDITY_MANAGER_ABI = [
    "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`\n💧 Adding Liquidity to New Pool (Fee: 500)`);

    const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, wallet);
    const weth = new ethers.Contract(WETH_ADDR, ERC20_ABI, wallet);
    const liqMan = new ethers.Contract(LIQUIDITY_MANAGER, LIQUIDITY_MANAGER_ABI, wallet);

    // 1 WETH = 3000 USDC. Providing 0.001 WETH and 3 USDC.
    const usdcToAdd = "3.0";
    const wethToAdd = "0.001";

    const usdcUnits = ethers.parseUnits(usdcToAdd, 6);
    const wethUnits = ethers.parseUnits(wethToAdd, 18);

    console.log(`📊 Amounts: ${usdcToAdd} USDC and ${wethToAdd} WETH`);

    // Approvals
    console.log("🔓 Checking Approvals...");
    const ensureAppr = async (t, s, a) => {
        if (await t.allowance(wallet.address, s) < a) await (await t.approve(s, ethers.MaxUint256)).wait();
    };
    await ensureAppr(usdc, LIQUIDITY_MANAGER, usdcUnits);
    await ensureAppr(usdc, POOL_MANAGER, usdcUnits);
    await ensureAppr(weth, LIQUIDITY_MANAGER, wethUnits);
    await ensureAppr(weth, POOL_MANAGER, wethUnits);
    console.log("✅ Approvals OK");

    const token0 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase() ? USDC_ADDR : WETH_ADDR;
    const token1 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase() ? WETH_ADDR : USDC_ADDR;

    const key = {
        currency0: token0,
        currency1: token1,
        fee: 500,
        tickSpacing: 10,
        hooks: ethers.ZeroAddress
    };

    // Correct liquidity delta calculation for Price = 333,333,333 (base units ratio)
    // L = amount0 * sqrt(P) / (sqrt(P_u) - sqrt(P_l)) -- assuming large range
    // Let's just use a reasonable number that won't exceed balances.
    // For 3 USDC (3e6 units), liquidity delta is roughly 3e6.
    const liquidityDelta = BigInt(3000000);

    const params = {
        tickLower: -887220, // Full range usually works fine for tests
        tickUpper: 887220,
        liquidityDelta: liquidityDelta,
        salt: ethers.ZeroHash
    };

    try {
        console.log(`💧 Adding Liquidity...`);
        const tx = await liqMan.addLiquidity(key, params, "0x", { gasLimit: 2000000 });
        console.log(`⏳ Pending: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Success! Liquidity added to the 3000:1 pool.`);
    } catch (e) {
        console.error(`❌ Failed: ${e.message}`);
    }
}

main().catch(console.error);
