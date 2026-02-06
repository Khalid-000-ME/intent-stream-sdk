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

const POOL_MANAGER_ABI = [
    "function balanceOf(address owner, uint256 id) view returns (uint256)"
];

async function ask(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => rl.question(question, answer => {
        rl.close();
        resolve(answer);
    }));
}

async function checkBalances(wallet, usdc, weth, pm) {
    const [uBal, wBal, uClaim, wClaim] = await Promise.all([
        usdc.balanceOf(wallet.address),
        weth.balanceOf(wallet.address),
        pm.balanceOf(wallet.address, USDC_ADDR),
        pm.balanceOf(wallet.address, WETH_ADDR)
    ]);

    console.log(`\n💰 Current Balances:`);
    console.log(`   ERC-20 USDC:   ${ethers.formatUnits(uBal, 6)}`);
    console.log(`   ERC-20 WETH:   ${ethers.formatUnits(wBal, 18)}`);
    console.log(`   Claim USDC:    ${ethers.formatUnits(uClaim, 6)} (ERC-6909)`);
    console.log(`   Claim WETH:    ${ethers.formatUnits(wClaim, 18)} (ERC-6909)`);

    return { uBal, wBal, uClaim, wClaim };
}

async function checkPoolLiquidity(pm) {
    const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, pm.runner);
    const weth = new ethers.Contract(WETH_ADDR, ERC20_ABI, pm.runner);

    const [pmUSDC, pmWETH] = await Promise.all([
        usdc.balanceOf(POOL_MANAGER),
        weth.balanceOf(POOL_MANAGER)
    ]);

    console.log(`\n📊 Pool Manager Total Liquidity:`);
    console.log(`   USDC: ${ethers.formatUnits(pmUSDC, 6)}`);
    console.log(`   WETH: ${ethers.formatUnits(pmWETH, 18)}`);
}

async function main() {
    if (!PRIVATE_KEY) {
        console.error("❌ Error: PRIVATE_KEY or MAIN_WALLET_PRIVATE_KEY is missing in env.");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`\n🦄 Uniswap V4 Liquidity Manager (Base Sepolia)`);
    console.log(`🦊 Wallet: ${wallet.address}\n`);

    const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, wallet);
    const weth = new ethers.Contract(WETH_ADDR, ERC20_ABI, wallet);
    const pm = new ethers.Contract(POOL_MANAGER, POOL_MANAGER_ABI, wallet);
    const liquidityManager = new ethers.Contract(LIQUIDITY_MANAGER, LIQUIDITY_MANAGER_ABI, wallet);

    // Check current balances
    await checkBalances(wallet, usdc, weth, pm);
    await checkPoolLiquidity(pm);

    // Sort tokens for PoolKey
    const token0 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase() ? USDC_ADDR : WETH_ADDR;
    const token1 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase() ? WETH_ADDR : USDC_ADDR;

    const key = {
        currency0: token0,
        currency1: token1,
        fee: 3000,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    console.log(`\n📝 Pool Configuration:`);
    console.log(`   Token0: ${token0 === USDC_ADDR ? 'USDC' : 'WETH'} (${token0})`);
    console.log(`   Token1: ${token1 === WETH_ADDR ? 'WETH' : 'USDC'} (${token1})`);
    console.log(`   Fee: 0.3%`);
    console.log(`   Tick Spacing: 60`);

    // Get user input for liquidity amounts
    console.log(`\n💧 Add Liquidity`);
    const usdcAmount = await ask("Enter USDC amount to add: ");
    const wethAmount = await ask("Enter WETH amount to add: ");

    if (!usdcAmount || !wethAmount || parseFloat(usdcAmount) <= 0 || parseFloat(wethAmount) <= 0) {
        console.log("❌ Invalid amounts. Exiting.");
        process.exit(0);
    }

    const usdcParsed = ethers.parseUnits(usdcAmount, 6);
    const wethParsed = ethers.parseUnits(wethAmount, 18);

    // Check and approve USDC
    const usdcAllowance = await usdc.allowance(wallet.address, LIQUIDITY_MANAGER);
    if (usdcAllowance < usdcParsed) {
        console.log("\n🔓 Approving USDC...");
        const approveTx = await usdc.approve(LIQUIDITY_MANAGER, ethers.MaxUint256);
        await approveTx.wait();
        console.log("✅ USDC Approved");
    }

    // Check and approve WETH
    const wethAllowance = await weth.allowance(wallet.address, LIQUIDITY_MANAGER);
    if (wethAllowance < wethParsed) {
        console.log("🔓 Approving WETH...");
        const approveTx = await weth.approve(LIQUIDITY_MANAGER, ethers.MaxUint256);
        await approveTx.wait();
        console.log("✅ WETH Approved");
    }

    // Calculate liquidity delta (simplified - using geometric mean)
    // For a more accurate calculation, you'd need the current pool price
    const liquidityDelta = BigInt(Math.floor(Math.sqrt(Number(usdcParsed) * Number(wethParsed))));

    console.log(`\n💧 Adding Liquidity...`);
    console.log(`   USDC: ${usdcAmount}`);
    console.log(`   WETH: ${wethAmount}`);
    console.log(`   Liquidity Delta: ${liquidityDelta.toString()}`);

    // Full range liquidity: tick range from min to max
    const params = {
        tickLower: -887220, // Min tick for 0.3% fee tier
        tickUpper: 887220,  // Max tick for 0.3% fee tier
        liquidityDelta: liquidityDelta,
        salt: ethers.ZeroHash
    };

    try {
        const tx = await liquidityManager.addLiquidity(key, params, "0x", { gasLimit: 3000000 });
        console.log(`\n⏳ Transaction Pending: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ Liquidity Added Successfully!`);
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
    } catch (error) {
        console.error("\n❌ Error adding liquidity:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
        process.exit(1);
    }

    // Check updated balances
    console.log(`\n📊 Updated Balances:`);
    await checkBalances(wallet, usdc, weth, pm);
    await checkPoolLiquidity(pm);

    console.log(`\n🎉 Done! You can now swap larger amounts.`);
}

main().catch(console.error);
