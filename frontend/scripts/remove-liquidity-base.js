const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("❌ MAIN_WALLET_PRIVATE_KEY not found in .env.local");
    process.exit(1);
}

const CONFIG = {
    base: {
        rpc: 'https://sepolia.base.org',
        poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408',
        poolModifyTest: '0x37429cD17Cb1454C34E7F50b09725202Fd533039',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006',
        name: 'Base Sepolia'
    }
};

const POOL_MODIFY_ABI = [
    "function modifyLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable returns (int256, int256)"
];

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)"
];

async function removeLiquidity() {
    console.log("🔓 Removing Liquidity from Base Sepolia\n");

    const provider = new ethers.JsonRpcProvider(CONFIG.base.rpc);
    const pk = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
    const wallet = new ethers.Wallet(pk, provider);

    console.log("Wallet:", wallet.address);

    const usdc = new ethers.Contract(CONFIG.base.usdc, ERC20_ABI, provider);
    const weth = new ethers.Contract(CONFIG.base.weth, ERC20_ABI, provider);
    const modifyTest = new ethers.Contract(CONFIG.base.poolModifyTest, POOL_MODIFY_ABI, wallet);

    // Check balances before
    const usdcBefore = await usdc.balanceOf(wallet.address);
    const wethBefore = await weth.balanceOf(wallet.address);

    console.log("\nBalances Before:");
    console.log(`  USDC: ${ethers.formatUnits(usdcBefore, 6)} USDC`);
    console.log(`  WETH: ${ethers.formatEther(wethBefore)} WETH`);

    // Pool key
    const poolKey = {
        currency0: CONFIG.base.usdc,
        currency1: CONFIG.base.weth,
        fee: 3000,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    // Remove liquidity - use NEGATIVE liquidityDelta to remove
    // We added: 1e15 + 1.5e6 + 1.2e6 = ~1e15 + 2.7e6
    // Let's remove all of it
    const liquidityToRemove = -(1e15 + 27e5); // Negative to remove

    const params = {
        tickLower: -887220,
        tickUpper: 887220,
        liquidityDelta: liquidityToRemove,
        salt: ethers.ZeroHash
    };

    console.log("\nRemoving liquidity...");
    console.log(`  Liquidity Delta: ${liquidityToRemove} (negative = remove)`);

    try {
        const tx = await modifyTest.modifyLiquidity(poolKey, params, "0x", {
            gasLimit: 500000
        });

        console.log(`\n✅ Transaction sent: ${tx.hash}`);
        console.log("   Waiting for confirmation...");

        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log(`\n🎉 SUCCESS! Liquidity removed!`);
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);

            // Check balances after
            const usdcAfter = await usdc.balanceOf(wallet.address);
            const wethAfter = await weth.balanceOf(wallet.address);

            console.log("\nBalances After:");
            console.log(`  USDC: ${ethers.formatUnits(usdcAfter, 6)} USDC`);
            console.log(`  WETH: ${ethers.formatEther(wethAfter)} WETH`);

            console.log("\nRedeemed:");
            console.log(`  USDC: +${ethers.formatUnits(usdcAfter - usdcBefore, 6)} USDC`);
            console.log(`  WETH: +${ethers.formatEther(wethAfter - wethBefore)} WETH`);

            console.log(`\n   View on BaseScan: https://sepolia.basescan.org/tx/${tx.hash}`);
        }
    } catch (e) {
        console.error(`\n❌ Failed:`, e.message);

        if (e.message.includes("insufficient")) {
            console.log("\n⚠️  You might not have that much liquidity in the pool");
            console.log("Try removing a smaller amount");
        }
    }
}

removeLiquidity().catch(console.error);
