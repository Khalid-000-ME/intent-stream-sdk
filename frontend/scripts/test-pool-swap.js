const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const POOL_MANAGER = "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408";
const POOL_SWAP_TEST = "0xa87c3b41a24ea5ded1d625e9af5ae771e91aedf6"; // NEW Correct Router
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const WETH = "0x4200000000000000000000000000000000000006";
const RPC = "https://sepolia.base.org";

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"];

const POOL_SWAP_TEST_ABI = [
    "function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, (bool takeClaims, bool settleUsingBurn) testSettings, bytes hookData) external payable returns (int256)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(process.env.MAIN_WALLET_PRIVATE_KEY, provider);

    console.log("🧪 Testing USDC/WETH Pool on Base Sepolia (Official Manager)\n");
    console.log("Wallet:", wallet.address);

    const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);
    const weth = new ethers.Contract(WETH, ERC20_ABI, wallet);
    const swapTest = new ethers.Contract(POOL_SWAP_TEST, POOL_SWAP_TEST_ABI, wallet);

    // Check balances
    const usdcBalance = await usdc.balanceOf(wallet.address);
    const wethBalance = await weth.balanceOf(wallet.address);

    console.log("Balances:");
    console.log(`  USDC: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
    console.log(`  WETH: ${ethers.formatEther(wethBalance)} WETH\n`);

    // Pool key
    const token0 = USDC;
    const token1 = WETH;
    const poolKey = {
        currency0: token0,
        currency1: token1,
        fee: 10000, // 1%
        tickSpacing: 200,
        hooks: ethers.ZeroAddress
    };

    console.log("Pool Configuration:");
    console.log(`  Currency0: ${token0}`);
    console.log(`  Currency1: ${token1}`);
    console.log(`  Fee: 10000 (1%)\n`);

    // Try a tiny swap: 0.01 USDC for WETH
    const swapAmount = ethers.parseUnits("0.01", 6); // 0.01 USDC

    // Proper Price Limits
    const MIN_SQRT_PRICE = 4295128739n;

    const swapParams = {
        zeroForOne: true, // USDC -> WETH
        amountSpecified: -swapAmount, // Negative = exact input
        sqrtPriceLimitX96: MIN_SQRT_PRICE + 1n // Must be slightly above min
    };

    const testSettings = {
        takeClaims: false,
        settleUsingBurn: false
    };

    console.log("Attempting swap:");
    console.log(`  Swapping 0.01 USDC for WETH...\n`);

    try {
        const tx = await swapTest.swap(poolKey, swapParams, testSettings, "0x", {
            gasLimit: 500000
        });

        console.log(`✅ Swap transaction sent: ${tx.hash}`);
        console.log(`   Waiting for confirmation...`);

        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log(`\n🎉 SWAP SUCCESSFUL!`);
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
            console.log(`\n   View on BaseScan: https://sepolia.basescan.org/tx/${tx.hash}\n`);

            // Check new balances
            const newUsdcBalance = await usdc.balanceOf(wallet.address);
            const newWethBalance = await weth.balanceOf(wallet.address);

            console.log("New Balances:");
            console.log(`  USDC: ${ethers.formatUnits(newUsdcBalance, 6)} USDC`);
            console.log(`  WETH: ${ethers.formatEther(newWethBalance)} WETH\n`);

            console.log("✅ Pool is working! TINT system is ready!");
        }
    } catch (e) {
        console.error(`\n❌ Swap failed:`, e.message);
    }
}

main().catch(console.error);
