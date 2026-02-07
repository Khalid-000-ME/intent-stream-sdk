const { ethers } = require("ethers");
const readline = require("readline");
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
const RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc";

// Latest Deployed Addresses on Arbitrum Sepolia
const LIQUIDITY_MANAGER = "0x87bD55Ea0505005799a28D34B5Ca17f4c8d24301";
const POOL_MANAGER = "0x4e650C85801e9dC44313669b491d20DB864a5451";
const USDC_ADDR = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
const WETH_ADDR = "0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed";

const ERC20_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function symbol() view returns (string)"
];

const POOL_MANAGER_ABI = [
    "function balanceOf(address owner, uint256 id) view returns (uint256)"
];

const ROUTER_ABI = [
    "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable",
    "function getPoolStatus((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key) view returns (uint160 sqrtPriceX96, uint128 liquidity)"
];

const q = (query) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
};

async function main() {
    console.log("\n🌊 \x1b[36mARBITRUM SEPOLIA V4 LIQUIDITY PROVIDER\x1b[0m 🌊");

    if (!PRIVATE_KEY) {
        console.error("❌ Error: PRIVATE_KEY or MAIN_WALLET_PRIVATE_KEY is missing.");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`🦊 Wallet: ${wallet.address}`);

    const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, wallet);
    const weth = new ethers.Contract(WETH_ADDR, ERC20_ABI, wallet);
    const pm = new ethers.Contract(POOL_MANAGER, POOL_MANAGER_ABI, wallet);
    const router = new ethers.Contract(LIQUIDITY_MANAGER, ROUTER_ABI, wallet);

    // Initial check
    const [uBal, wBal] = await Promise.all([usdc.balanceOf(wallet.address), weth.balanceOf(wallet.address)]);
    console.log(`💰 Balances:\n   USDC: ${ethers.formatUnits(uBal, 6)}\n   WETH: ${ethers.formatEther(wBal)}`);

    const uAmtInput = await q("\nEnter USDC amount to provide (default 1.0): ");
    const uAmt = uAmtInput.trim() === "" ? "1.0" : uAmtInput;

    const wAmtInput = await q("Enter WETH amount to provide (e.g. 0.005): ");
    const wAmt = wAmtInput.trim() === "" ? "0.01" : wAmtInput;

    const uIn = ethers.parseUnits(uAmt, 6);
    const wIn = ethers.parseUnits(wAmt, 18);

    if (uIn > uBal || wIn > wBal) {
        console.log("❌ Insufficient balance!");
        process.exit(1);
    }

    const isUSDC0 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase();
    const key = {
        currency0: isUSDC0 ? USDC_ADDR : WETH_ADDR,
        currency1: isUSDC0 ? WETH_ADDR : USDC_ADDR,
        fee: 200,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    console.log("\n🔓 Checking Approvals...");
    const checkApprove = async (contract, spender) => {
        const allowance = await contract.allowance(wallet.address, spender);
        if (allowance < ethers.parseUnits("1000000", 18)) {
            console.log(`   Approving ${await contract.symbol()} for ${spender}...`);
            await (await contract.approve(spender, ethers.MaxUint256)).wait();
        }
    };

    await checkApprove(usdc, LIQUIDITY_MANAGER);
    await checkApprove(weth, LIQUIDITY_MANAGER);
    await checkApprove(usdc, POOL_MANAGER);
    await checkApprove(weth, POOL_MANAGER);

    const status = await router.getPoolStatus(key);
    const sqrtPriceX96 = status.sqrtPriceX96;

    if (sqrtPriceX96 === 0n) {
        console.log("❌ Pool not initialized!");
        process.exit(1);
    }

    // Full Range L calculation: L = amount0 * (sqrtP * sqrtUpper) / (sqrtUpper - sqrtP)
    // For full range (inf), L = amount0 * sqrtPrice_actual
    const Q96 = 2n ** 96n;
    const sqrtP = Number(sqrtPriceX96) / Number(Q96);

    // Calculate required WETH for the given USDC
    const requiredWethUnits = BigInt(Math.floor(Number(uIn) * (sqrtP ** 2)));
    const requiredWeth = ethers.formatEther(requiredWethUnits);

    console.log(`\n📊 \x1b[33mLiquidity Requirement Analysis:\x1b[0m`);
    console.log(`   To provide ${uAmt} USDC at current price, you need:`);
    console.log(`   Required: ${requiredWeth} WETH`);
    console.log(`   Your Bal: ${ethers.formatEther(wBal)} WETH`);

    if (requiredWethUnits > wBal) {
        console.log(`\n\x1b[31m❌ Insufficient WETH! You need ${requiredWeth} but only have ${ethers.formatEther(wBal)}.\x1b[0m`);
        const maxUsdc = Number(ethers.formatEther(wBal)) / (sqrtP ** 2);
        console.log(`\x1b[36m💡 Suggestion: Try providing a maximum of ${maxUsdc.toFixed(4)} USDC instead.\x1b[0m`);
        process.exit(1);
    }

    const L = (uIn * sqrtPriceX96) / Q96;
    console.log(`\n🌊 Adding Liquidity (L: ${L.toString()})...`);
    try {
        const tx = await router.addLiquidity(key, {
            tickLower: -887220,
            tickUpper: 887220,
            liquidityDelta: L,
            salt: ethers.ZeroHash
        }, "0x", { gasLimit: 2000000 });

        console.log(`⏳ Pending: ${tx.hash}`);
        await tx.wait();
        console.log("✅ SUCCESS! Liquidity provisioned on Arbitrum Sepolia.");
    } catch (e) {
        console.log("❌ FAILED:", e.message);
    }
}

main().catch(console.error);
