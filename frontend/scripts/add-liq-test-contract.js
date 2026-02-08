const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

// Base Sepolia - Using Official Uniswap Test Contracts
const NETWORK = {
    name: 'Base Sepolia',
    rpc: 'https://sepolia.base.org',
    poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408',
    poolModifyLiquidityTest: '0x37429cd17cb1454c34e7f50b09725202fd533039',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    weth: '0x4200000000000000000000000000000000000006'
};

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

// PoolModifyLiquidityTest ABI
const POOL_MODIFY_ABI = [
    "function modifyLiquidity(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable"
];

async function main() {
    console.log(`\n🌊 Initializing & Adding Liquidity on ${NETWORK.name}\n`);

    const provider = new ethers.JsonRpcProvider(NETWORK.rpc);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Wallet: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`ETH Balance: ${ethers.formatEther(balance)}\n`);

    const usdc = new ethers.Contract(NETWORK.usdc, ERC20_ABI, wallet);
    const weth = new ethers.Contract(NETWORK.weth, ERC20_ABI, wallet);
    const liquidityTest = new ethers.Contract(NETWORK.poolModifyLiquidityTest, POOL_MODIFY_ABI, wallet);

    // Check balances
    const [usdcBal, wethBal] = await Promise.all([
        usdc.balanceOf(wallet.address),
        weth.balanceOf(wallet.address)
    ]);

    console.log(`Token Balances:`);
    console.log(`  USDC: ${ethers.formatUnits(usdcBal, 6)}`);
    console.log(`  WETH: ${ethers.formatEther(wethBal)}\n`);

    // Pool key
    const [currency0, currency1] = NETWORK.usdc.toLowerCase() < NETWORK.weth.toLowerCase()
        ? [NETWORK.usdc, NETWORK.weth]
        : [NETWORK.weth, NETWORK.usdc];

    const key = {
        currency0,
        currency1,
        fee: 3000,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    console.log(`Pool Configuration:`);
    console.log(`  Currency0: ${key.currency0}`);
    console.log(`  Currency1: ${key.currency1}`);
    console.log(`  Fee: 3000 (0.3%)\n`);

    // Approve PoolManager (not the test contract!)
    console.log(`1️⃣ Approving tokens for PoolManager...`);

    const approveIfNeeded = async (token, name) => {
        const allowance = await token.allowance(wallet.address, NETWORK.poolManager);
        if (allowance < ethers.parseUnits("1000", 18)) {
            console.log(`   Approving ${name}...`);
            const tx = await token.approve(NETWORK.poolManager, ethers.MaxUint256);
            await tx.wait();
            console.log(`   ✅ ${name} approved`);
        } else {
            console.log(`   ✅ ${name} already approved`);
        }
    };

    await approveIfNeeded(usdc, "USDC");
    await approveIfNeeded(weth, "WETH");

    // Add liquidity (this will initialize the pool if it doesn't exist)
    console.log(`\n2️⃣ Adding liquidity (will initialize pool if needed)...`);

    const params = {
        tickLower: -600,
        tickUpper: 600,
        liquidityDelta: ethers.parseUnits("10", 18), // 10 units
        salt: ethers.ZeroHash
    };

    console.log(`   Liquidity Delta: ${ethers.formatUnits(params.liquidityDelta, 18)}`);
    console.log(`   Tick Range: ${params.tickLower} to ${params.tickUpper}\n`);

    try {
        // The test contract should handle initialization automatically
        const tx = await liquidityTest.modifyLiquidity(key, params, "0x", {
            gasLimit: 1000000,
            value: 0
        });

        console.log(`   Tx: ${tx.hash}`);
        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log(`   ✅ Success! Block: ${receipt.blockNumber}`);
            console.log(`   Gas Used: ${receipt.gasUsed.toString()}\n`);
            console.log(`🎉 Pool is ready for swaps!`);
            console.log(`   View: https://sepolia.basescan.org/tx/${tx.hash}\n`);
        } else {
            console.log(`   ❌ Transaction failed\n`);
        }
    } catch (e) {
        console.error(`   ❌ Failed:`, e.message);

        // Try to get revert reason
        if (e.receipt) {
            console.log(`   Receipt status: ${e.receipt.status}`);
            console.log(`   Gas used: ${e.receipt.gasUsed.toString()}`);
        }
    }
}

main().catch(e => {
    console.error("\n❌ Error:", e.message);
    process.exit(1);
});
