const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

// Base Sepolia - Custom PoolManager
const NETWORK = {
    name: 'Base Sepolia',
    rpc: 'https://sepolia.base.org',
    poolManager: '0x1b832D5395A41446b508632466cf32c6C07D63c7',
    router: '0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    weth: '0x4200000000000000000000000000000000000006'
};

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
];

const ROUTER_ABI = [
    "function addLiquidity(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable"
];

async function main() {
    console.log(`\n🌊 Adding Liquidity to ${NETWORK.name}\n`);

    const provider = new ethers.JsonRpcProvider(NETWORK.rpc);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Wallet: ${wallet.address}`);
    console.log(`Balance: ${ethers.formatEther(await provider.getBalance(wallet.address))} ETH\n`);

    const usdc = new ethers.Contract(NETWORK.usdc, ERC20_ABI, wallet);
    const weth = new ethers.Contract(NETWORK.weth, ERC20_ABI, wallet);
    const router = new ethers.Contract(NETWORK.router, ROUTER_ABI, wallet);

    // Check balances
    const [usdcBal, wethBal] = await Promise.all([
        usdc.balanceOf(wallet.address),
        weth.balanceOf(wallet.address)
    ]);

    console.log(`Token Balances:`);
    console.log(`  USDC: ${ethers.formatUnits(usdcBal, 6)}`);
    console.log(`  WETH: ${ethers.formatEther(wethBal)}\n`);

    // Pool key with fee 200
    const [currency0, currency1] = NETWORK.usdc.toLowerCase() < NETWORK.weth.toLowerCase()
        ? [NETWORK.usdc, NETWORK.weth]
        : [NETWORK.weth, NETWORK.usdc];

    const key = {
        currency0,
        currency1,
        fee: 200,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    console.log("Pool Key:");
    console.log(`  Currency0: ${key.currency0}`);
    console.log(`  Currency1: ${key.currency1}`);
    console.log(`  Fee: 200\n`);

    // Approve router
    console.log("1️⃣ Approving tokens...");

    const approveIfNeeded = async (token, tokenContract, name) => {
        const allowance = await tokenContract.allowance(wallet.address, NETWORK.router);
        if (allowance < ethers.parseUnits("1000", 18)) {
            console.log(`   Approving ${name}...`);
            await (await tokenContract.approve(NETWORK.router, ethers.MaxUint256)).wait();
        }
    };

    await approveIfNeeded(NETWORK.usdc, usdc, "USDC");
    await approveIfNeeded(NETWORK.weth, weth, "WETH");

    // Add liquidity
    console.log("\n2️⃣ Adding liquidity...");

    const params = {
        tickLower: -887220,
        tickUpper: 887220,
        liquidityDelta: ethers.parseUnits("1000", 18),
        salt: ethers.ZeroHash
    };

    try {
        const tx = await router.addLiquidity(key, params, "0x", { gasLimit: 2000000, value: 0 });
        console.log(`   Tx: ${tx.hash}`);
        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log(`   ✅ Liquidity added! Block: ${receipt.blockNumber}\n`);
            console.log(`🎉 Pool is ready!`);
            console.log(`   View: https://sepolia.basescan.org/tx/${tx.hash}\n`);
        }
    } catch (e) {
        console.error(`   ❌ Failed:`, e.message);
    }
}

main().catch(e => {
    console.error("\n❌ Error:", e.message);
    process.exit(1);
});
