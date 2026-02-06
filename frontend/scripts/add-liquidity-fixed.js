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

// Latest Deployed Addresses on Base Sepolia
const LIQUIDITY_MANAGER = "0xd02Fef2B4557c5b6E93bE8Ea829f31DfAC1f0276";
const POOL_MANAGER = "0x9f2C9336e3879991aB49748a6C8A4965eE7F90dB";
const USDC_ADDR = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const WETH_ADDR = "0x4200000000000000000000000000000000000006";

const ERC20_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

const LIQUIDITY_MANAGER_ABI = [
    "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable"
];

async function main() {
    if (!PRIVATE_KEY) {
        console.error("❌ Error: PRIVATE_KEY or MAIN_WALLET_PRIVATE_KEY is missing in env.");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`\n🦄 Uniswap V4 Liquidity Manager (Fixed Ratio)`);
    console.log(`🦊 Wallet: ${wallet.address}\n`);

    const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, wallet);
    const weth = new ethers.Contract(WETH_ADDR, ERC20_ABI, wallet);
    const liquidityManager = new ethers.Contract(LIQUIDITY_MANAGER, LIQUIDITY_MANAGER_ABI, wallet);

    // Current Pool Price is ~1:1 in base units (wei-to-wei)
    // This means 10^-6 USDC (1 base unit) matches 10^-18 WETH (1 base unit)
    // To add 1 USDC (1,000,000 base units), we MUST add exactly 1,000,000 units of WETH.
    // 1,000,000 / 10^18 = 0.000000000001 WETH.

    const usdcToAdd = "1.0"; // 1 USDC
    const wethToAdd = "0.000000000001"; // Matching 1:1 base units

    console.log(`📊 Hard-coded Amounts (Current Price Compatible):`);
    console.log(`   USDC: ${usdcToAdd}`);
    console.log(`   WETH: ${wethToAdd}`);

    const usdcParsed = ethers.parseUnits(usdcToAdd, 6);
    const wethParsed = ethers.parseUnits(wethToAdd, 18);

    // Both should be 1,000,000 base units
    console.log(`   USDC Base Units: ${usdcParsed.toString()}`);
    console.log(`   WETH Base Units: ${wethParsed.toString()}`);

    // Approve both for both contracts
    console.log("\n🔓 Checking Approvals...");

    async function ensureApproval(token, spender, amount) {
        const allowance = await token.allowance(wallet.address, spender);
        if (allowance < amount) {
            const symbol = await token.symbol().catch(() => "tokens");
            console.log(`   Approving ${symbol} for ${spender}...`);
            await (await token.approve(spender, ethers.MaxUint256)).wait();
        }
    }

    await ensureApproval(usdc, LIQUIDITY_MANAGER, usdcParsed);
    await ensureApproval(usdc, POOL_MANAGER, usdcParsed);
    await ensureApproval(weth, LIQUIDITY_MANAGER, wethParsed);
    await ensureApproval(weth, POOL_MANAGER, wethParsed);

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

    // For a 1:1 base unit ratio at full range, liquidityDelta is exactly the number of units.
    const liquidityDelta = usdcParsed;

    const params = {
        tickLower: -887220,
        tickUpper: 887220,
        liquidityDelta: liquidityDelta,
        salt: ethers.ZeroHash
    };

    try {
        console.log(`\n💧 Sending ModifyLiquidity (addLiquidity)...`);
        const tx = await liquidityManager.addLiquidity(key, params, "0x", { gasLimit: 2000000 });
        console.log(`⏳ Pending: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Success! Liquidity added to the 1:1 pool.`);
    } catch (e) {
        console.error(`❌ Failed: ${e.message}`);
    }
}

main().catch(console.error);
