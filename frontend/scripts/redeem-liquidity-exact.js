const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("❌ MAIN_WALLET_PRIVATE_KEY not found in .env.local");
    process.exit(1);
}

// Your custom PoolManagers from the dashboard
const CONFIG = {
    base: {
        rpc: 'https://sepolia.base.org',
        poolManager: '0x1b832D5395A41446b508632466cf32c6C07D63c7',
        router: '0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006',
        name: 'Base Sepolia',
        locked: { usdc: 22.36, weth: 0.124 }
    },
    arbitrum: {
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        poolManager: '0x4e650C85801e9dC44313669b491d20DB864a5451',
        router: '0x87bD55Ea0505005799a28D34B5Ca17f4c8d24301',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed',
        name: 'Arbitrum Sepolia',
        locked: { usdc: 11.76, weth: 0.081 }
    },
    ethereum: {
        rpc: 'https://1rpc.io/sepolia',
        poolManager: '0xf448192241A9BBECd36371CD1f446de81A5399d2',
        router: '0x6127b25A12AB31dF2B58Fe9DfFCba595AB927eA3',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
        name: 'Ethereum Sepolia',
        locked: { usdc: 8.43, weth: 0.019 }
    }
};

const ROUTER_ABI = [
    "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable"
];

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)"
];

async function removeLiquidityFromChain(chainKey) {
    const chain = CONFIG[chainKey];
    console.log(`\n🔓 Removing Liquidity from ${chain.name}`);
    console.log(`   Locked: ${chain.locked.usdc} USDC + ${chain.locked.weth} WETH\n`);

    const provider = new ethers.JsonRpcProvider(chain.rpc);
    const pk = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
    const wallet = new ethers.Wallet(pk, provider);

    console.log("Wallet:", wallet.address);

    const usdc = new ethers.Contract(chain.usdc, ERC20_ABI, provider);
    const weth = new ethers.Contract(chain.weth, ERC20_ABI, provider);
    const router = new ethers.Contract(chain.router, ROUTER_ABI, wallet);

    // Check balances before
    const usdcBefore = await usdc.balanceOf(wallet.address);
    const wethBefore = await weth.balanceOf(wallet.address);

    console.log("\nBalances Before:");
    console.log(`  USDC: ${ethers.formatUnits(usdcBefore, 6)} USDC`);
    console.log(`  WETH: ${ethers.formatEther(wethBefore)} WETH`);

    // Pool key - EXACT parameters from add-liquidity scripts
    const isUSDC0 = chain.usdc.toLowerCase() < chain.weth.toLowerCase();
    const poolKey = {
        currency0: isUSDC0 ? chain.usdc : chain.weth,
        currency1: isUSDC0 ? chain.weth : chain.usdc,
        fee: 200, // From the scripts
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    // EXACT parameters from add-liquidity scripts
    const params = {
        tickLower: -887220,  // From scripts
        tickUpper: 887220,   // From scripts
        liquidityDelta: -100000000000n, // Negative to remove (from dashboard)
        salt: ethers.ZeroHash // From scripts
    };

    console.log("\nRemoving liquidity using 'addLiquidity' with negative delta:");
    console.log(`  Fee: 200 (0.02%)`);
    console.log(`  Tick Range: -887220 to 887220 (full range)`);
    console.log(`  Salt: 0x0000...`);
    console.log(`  Liquidity Delta: ${params.liquidityDelta}`);

    try {
        // Use addLiquidity but with negative delta
        // The router likely wraps modifyLiquidity
        const tx = await router.addLiquidity(poolKey, params, "0x", {
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

            console.log("\n💰 Redeemed:");
            console.log(`  USDC: +${ethers.formatUnits(usdcAfter - usdcBefore, 6)} USDC`);
            console.log(`  WETH: +${ethers.formatEther(wethAfter - wethBefore)} WETH`);
        }
    } catch (e) {
        console.error(`\n❌ Failed:`, e.message);

        if (e.data) {
            console.log("\nError data:", e.data);
        }

        console.log("\n⚠️  Possible reasons:");
        console.log("  1. Router contract might use 'addLiquidity' for both add AND remove");
        console.log("  2. Liquidity amount might be different");
        console.log("  3. Need to use modifyLiquidity instead of removeLiquidity");
    }
}

async function main() {
    console.log("🌊 UNIFLOW - Remove Liquidity (Using Exact Script Parameters) 🌊\n");

    for (const chain of ['base', 'arbitrum', 'ethereum']) {
        await removeLiquidityFromChain(chain);
        console.log("\n" + "=".repeat(70));
    }

    console.log("\n✅ Done!");
}

main().catch(console.error);
