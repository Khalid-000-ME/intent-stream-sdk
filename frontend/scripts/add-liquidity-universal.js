const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");

const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) require("dotenv").config({ path: envPath });
else require("dotenv").config();

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;

// Updated Configuration with Official PoolManagers and New Routers
const CONTRACTS = {
    ethereum: {
        rpc: 'https://1rpc.io/sepolia',
        router: '0x72166B1ec9Da1233CEc8D742Abc9890608BA4097',
        poolManager: '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
    },
    arbitrum: {
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        router: '0x0C3B163c971e11e2308Fc3e1020787f2E21b280C',
        poolManager: '0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed'
    },
    base: {
        rpc: 'https://sepolia.base.org',
        router: '0xB079cab802838d5aB97f12dC1B8D369f439719B3',
        poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006'
    }
};

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)",
    "function allowance(address, address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

const ROUTER_ABI = [
    "function initializePools(address _usdc, address _weth, uint160 _sqrtPriceX96) external",
    "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable",
    "function getPoolStatus((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key) view returns (uint160 sqrtPriceX96, uint128 liquidity)"
];

async function main() {
    const args = process.argv.slice(2);
    const networkArg = args.find(a => a.startsWith('--network='));
    const network = networkArg ? networkArg.split('=')[1] : null;

    if (!network || !CONTRACTS[network]) {
        console.error("❌ Usage: node scripts/add-liquidity-universal.js --network=<ethereum|arbitrum|base>");
        process.exit(1);
    }

    const config = CONTRACTS[network];
    console.log(`\n🌊 Liquidity Manager: \x1b[36m${network.toUpperCase()}\x1b[0m`);
    console.log(`   Router: ${config.router}`);
    console.log(`   PoolManager: ${config.poolManager}`);

    const provider = new ethers.JsonRpcProvider(config.rpc);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const usdc = new ethers.Contract(config.usdc, ERC20_ABI, wallet);
    const weth = new ethers.Contract(config.weth, ERC20_ABI, wallet);
    const router = new ethers.Contract(config.router, ROUTER_ABI, wallet);

    // 1. Initial State Check
    const isUSDC0 = config.usdc.toLowerCase() < config.weth.toLowerCase();
    const token0 = isUSDC0 ? config.usdc : config.weth;
    const token1 = isUSDC0 ? config.weth : config.usdc;

    const key = {
        currency0: token0,
        currency1: token1,
        fee: 3000,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    let status;
    try {
        status = await router.getPoolStatus(key);
    } catch (e) {
        console.log("⚠️  Could not fetch status, pool might strictly not exist.");
        status = { sqrtPriceX96: 0n };
    }

    if (status.sqrtPriceX96 === 0n) {
        console.log("⚙️  Initializing Pool (1:1 Price)...");
        try {
            const SQRT_PRICE_1_1 = BigInt("79228162514264337593543950336");
            const tx = await router.initializePools(config.usdc, config.weth, SQRT_PRICE_1_1);
            console.log(`   Tx: ${tx.hash}`);
            await tx.wait();
            console.log("   ✅ Pool Initialized.");
        } catch (e) {
            console.error("   ❌ Init Failed:", e.message);
            // It might be initialized via another router?
            // If the pool exists in PM but not initialized by US, getPoolStatus might fail?
            // V4 pools are uniquely identified by key. If PM has it, it has it.
            // If initialize fails, maybe it already exists.
        }
    } else {
        console.log("   ✅ Pool already initialized.");
    }

    // 2. Add Liquidity
    // We'll add modest liquidity: 10 USDC and equivalent WETH
    const uDecimals = await usdc.decimals();
    const wDecimals = await weth.decimals();

    const uAmount = ethers.parseUnits("10.0", uDecimals);
    const wAmount = ethers.parseUnits("0.01", wDecimals); // 0.01 ETH ~ 20-30 USD

    // Approve
    const approveIfNeeded = async (token, spender, amount) => {
        const allow = await token.allowance(wallet.address, spender);
        if (allow < amount) {
            console.log(`   Approving ${await token.symbol()}...`);
            await (await token.approve(spender, ethers.MaxUint256)).wait();
        }
    };

    await approveIfNeeded(usdc, config.router, uAmount);
    await approveIfNeeded(weth, config.router, wAmount);

    // Grant Router allowance to PoolManager? No, Router pulls from User. User approves Router.
    // Router approves PoolManager? Yes. Router code should handle that (if standard implementation).
    // V4TestRouter usually approves PM in constructor or on the fly.
    // Checking V4TestRouter code:
    // It calls `manager.modifyLiquidity`.
    // The `unlockCallback` handles transfers.
    // `currency0.take(manager, cbData.sender, ...)` -> PM sends to user.
    // `currency0.settle(manager, cbData.sender, ...)` -> PM asks for tokens.
    // `settle` implementation: `IERC20(currency).transferFrom(sender, manager, amount)`.
    // So USER must approve POOL_MANAGER.
    // Wait, let's verify `V4TestRouter.sol`.
    // Line 16: `using CurrencySettler for Currency;`
    // Line 58: `cbData.key.currency0.settle(manager, cbData.sender, ...)`
    // `CurrencySettler.settle`:
    // If native, msg.value.
    // If ERC20, `IERC20.transferFrom(payer, manager, amount)`.
    // HERE `payer` is `cbData.sender` (User). `"manager"` is passed as first arg, but `transferFrom` target is `startvm`? No, `manager` address is the recipient.
    // So **USER MUST APPROVE POOL_MANAGER**, NOT ROUTER (for paying/settling).
    // Wait, who calls `poolManager.modifyLiquidity`? The Router.
    // The Router is `msg.sender` to the PoolManager.
    // The PoolManager calls `unlockCallback` on Router.
    // Router calls `settle` using `CurrencySettler`.
    // `CurrencySettler` (library) does `transferFrom(payer, address(manager), amount)`.
    // So YES, User must approve the PoolManager address to spend tokens.

    console.log(`   Checking approvals for PoolManager (${config.poolManager})...`);
    await approveIfNeeded(usdc, config.poolManager, uAmount);
    await approveIfNeeded(weth, config.poolManager, wAmount);

    console.log("💧 Adding Liquidity...");

    // Add liquidity parameters
    // Full Range approx -60000 to +60000? 
    // Arbitrum script used -887220 to 887220.
    const liquidityDelta = ethers.parseUnits("1.0", 18); // Arbitrary L unit, simpler than precise math for now. 
    // Wait, L should be calculated if I want specifically 10 USDC used.
    // For 1:1 price, L = amount.
    // If I just provide L=1e18, validation might fail if I don't have enough.
    // Let's use specific L.

    try {
        const tx = await router.addLiquidity(key, {
            tickLower: -600, // Concentrated range for efficiency in test
            tickUpper: 600,
            liquidityDelta: liquidityDelta,
            salt: ethers.ZeroHash
        }, "0x", { gasLimit: 2000000 });

        console.log(`   Tx: ${tx.hash}`);
        await tx.wait();
        console.log("   ✅ Liquidity Added!");
    } catch (e) {
        console.error("   ❌ Liquidity Add Failed:", e.message);
        // Maybe pool not initialized or balance issue.
    }
}

main().catch(console.error);
