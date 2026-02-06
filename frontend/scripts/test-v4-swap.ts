import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

// Final High Quality Deployment
const LIQUIDITY_MANAGER_ADDRESS = "0xE97fDf8934564EF6fdeA4044FdFE0A6A9fdC5cb4";
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

async function main() {
    if (!PRIVATE_KEY) {
        console.error("❌ MAIN_WALLET_PRIVATE_KEY missing in .env.local");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`🚀 Testing V4 Swap with Wallet: ${wallet.address}`);

    // Check Balances
    const ERC20_ABI_CHECK = ["function balanceOf(address account) view returns (uint256)"];
    const usdcCheck = new ethers.Contract(USDC_ADDRESS, ERC20_ABI_CHECK, wallet);
    const wethCheck = new ethers.Contract(WETH_ADDRESS, ERC20_ABI_CHECK, wallet);
    const usdcBal = await usdcCheck.balanceOf(wallet.address);
    const wethBal = await wethCheck.balanceOf(wallet.address);
    const ethBal = await provider.getBalance(wallet.address);
    console.log(`💰 Balances: USDC=${usdcBal.toString()}, WETH=${wethBal.toString()}, ETH=${ethers.formatEther(ethBal)}`);

    const MANAGER_ABI = [
        "function manager() external view returns (address)",
        "function getPoolStatus((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key) external view returns (uint160 sqrtPriceX96, uint128 liquidity)",
        "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int128 liquidityDelta, bytes32 salt) params, bytes hookData) external",
        "function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, bytes hookData) external"
    ];

    const liquidityManager = new ethers.Contract(LIQUIDITY_MANAGER_ADDRESS, MANAGER_ABI, wallet);
    const poolManagerAddr = await liquidityManager.manager();
    console.log(`🔍 LiquidityManager is using PoolManager: ${poolManagerAddr}`);


    const poolManager = new ethers.Contract(poolManagerAddr, [
        "function initialize((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) external returns (int24)"
    ], wallet);

    const isWethToken0 = WETH_ADDRESS.toLowerCase() < USDC_ADDRESS.toLowerCase();
    const token0 = isWethToken0 ? WETH_ADDRESS : USDC_ADDRESS;
    const token1 = isWethToken0 ? USDC_ADDRESS : WETH_ADDRESS;

    const key = {
        currency0: token0,
        currency1: token1,
        fee: 3000,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    let nonce = await wallet.getNonce();

    try {
        console.log("🔍 Checking pool status...");
        let price, liquidity;
        try {
            const status = await liquidityManager.getPoolStatus(key);
            price = status[0];
            liquidity = status[1];
        } catch (e) {
            console.log("⚠️ Pool likely not initialized.");
            price = BigInt(0);
            liquidity = BigInt(0);
        }

        if (price === BigInt(0)) {
            console.log("🆕 Initializing new pool (1:1)...");
            const txInit = await poolManager.initialize(key, BigInt("79228162514264337593543950336"), { nonce: nonce++ });
            await txInit.wait();
            console.log("✅ Pool Initialized!");
        }

        if (liquidity === BigInt(0)) {
            console.log("💧 Adding liquidity...");
            const liqParams = {
                tickLower: -1200,
                tickUpper: 1200,
                liquidityDelta: BigInt("10000"), // Small amount
                salt: ethers.ZeroHash
            };

            // Approvals (USDC/WETH to LiquidityManager)
            const ERC20_ABI = ["function approve(address spender, uint256 amount) external returns (bool)"];
            const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
            const weth = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, wallet);

            console.log("📝 Approving...");
            await (await usdc.approve(LIQUIDITY_MANAGER_ADDRESS, ethers.MaxUint256, { nonce: nonce++ })).wait();
            await (await weth.approve(LIQUIDITY_MANAGER_ADDRESS, ethers.MaxUint256, { nonce: nonce++ })).wait();

            console.log("💧 Sending addLiquidity...");
            const txLiq = await liquidityManager.addLiquidity(key, liqParams, "0x", { nonce: nonce++, gasLimit: 1000000 });
            await txLiq.wait();
            console.log("✅ Liquidity Added!");
        }
    } catch (e: any) {
        console.error("❌ Setup failed:", e.message);
        if (e.data) console.error("   Data:", e.data);
    }

    // Perform Swap
    const zeroForOne = true;
    const MIN_SQRT_RATIO = BigInt("4295128739") + BigInt(1);
    const MAX_SQRT_RATIO = BigInt("1461446703485210103287273052203988822378723970342") - BigInt(1);

    const params = {
        zeroForOne,
        amountSpecified: -BigInt(100),
        sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO
    };

    console.log(`🔄 Executing Swap...`);
    try {
        const tx = await liquidityManager.swap(key, params, "0x", { nonce: nonce++, gasLimit: 1000000 });
        console.log(`⏳ Tx Sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ Swap Confirmed! Block: ${receipt.blockNumber}`);

        const finalStatus = await liquidityManager.getPoolStatus(key);
        console.log(`📊 Final Pool Price: ${finalStatus[0].toString()}`);
    } catch (e: any) {
        console.error("❌ Swap failed:", e.message);
    }
}

main().catch(console.error);
