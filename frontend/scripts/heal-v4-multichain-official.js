const { ethers } = require("ethers");
require("dotenv").config({ path: "../.env" });

const PRIVATE_KEY = process.env.PRIVATE_KEY || 'e844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';

const CHAINS = {
    arbitrum: {
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        router: '0x87bD55Ea0505005799a28D34B5Ca17f4c8d24301',
        poolManager: '0x4e650C85801e9dC44313669b491d20DB864a5451',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed'
    },
    ethereum: {
        rpc: 'https://1rpc.io/sepolia',
        router: '0x6127b25A12AB31dF2B58Fe9DfFCba595AB927eA3',
        poolManager: '0xf448192241A9BBECd36371CD1f446de81A5399d2',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
    },
    base: {
        rpc: 'https://sepolia.base.org',
        router: '0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0',
        poolManager: '0x1b832D5395A41446b508632466cf32c6C07D63c7',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006'
    }
};

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

const ROUTER_ABI = [
    "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable",
    "function getPoolStatus((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key) view returns (uint160 sqrtPriceX96, uint128 liquidity)"
];

async function heal(chainName) {
    console.log(`\n🏥 Healing ${chainName.toUpperCase()}...`);
    const config = CHAINS[chainName];
    const provider = new ethers.JsonRpcProvider(config.rpc);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const uAddr = ethers.getAddress(config.usdc.toLowerCase());
    const wAddr = ethers.getAddress(config.weth.toLowerCase());
    const rAddr = ethers.getAddress(config.router.toLowerCase());
    const pAddr = ethers.getAddress(config.poolManager.toLowerCase());

    const usdc = new ethers.Contract(uAddr, ERC20_ABI, wallet);
    const weth = new ethers.Contract(wAddr, ERC20_ABI, wallet);
    const router = new ethers.Contract(rAddr, ROUTER_ABI, wallet);

    const isWeth0 = wAddr.toLowerCase() < uAddr.toLowerCase();
    const key = {
        currency0: isWeth0 ? wAddr : uAddr,
        currency1: isWeth0 ? uAddr : wAddr,
        fee: 3000,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    console.log("   Checking balances...");
    const [uBal, wBal] = await Promise.all([
        usdc.balanceOf(wallet.address).catch(() => 0n),
        weth.balanceOf(wallet.address).catch(() => 0n)
    ]);
    console.log(`   USDC: ${ethers.formatUnits(uBal, 6)} | WETH: ${ethers.formatUnits(wBal, 18)}`);

    if (uBal === 0n || wBal === 0n) {
        console.log("   ⚠️  Insufficient balances to add liquidity. (Must have both USDC and WETH)");
        return;
    }

    console.log("   Checking pool status...");
    let sqrtPriceX96;
    try {
        const status = await router.getPoolStatus(key);
        sqrtPriceX96 = status.sqrtPriceX96;
    } catch (e) {
        console.log("   ❌ Pool status check failed:", e.message);
        return;
    }

    if (sqrtPriceX96 === 0n) {
        console.log("   ❌ Pool not initialized.");
        return;
    }

    console.log("   Approving Router and PoolManager...");
    await (await usdc.approve(rAddr, ethers.MaxUint256)).wait();
    await (await weth.approve(rAddr, ethers.MaxUint256)).wait();
    await (await usdc.approve(pAddr, ethers.MaxUint256)).wait();
    await (await weth.approve(pAddr, ethers.MaxUint256)).wait();

    // Calculate L correctly based on MIN of available balances
    // L = delta_x * sqrtPrice (approx for full range)
    // L = delta_y / sqrtPrice (approx for full range)
    const Q96 = 2n ** 96n;
    const sqrtP = sqrtPriceX96 / Q96;

    // Max L from USDC: L_x = uBal * sqrtP
    const Lx = uBal * sqrtP;
    // Max L from WETH: L_y = wBal / sqrtP
    const Ly = wBal / sqrtP;

    // Use 80% of the limiting asset to avoid rounding reverts
    const L = (Lx < Ly ? Lx : Ly) * 8n / 10n;

    if (L === 0n) {
        console.log("   ⚠️  Calculated L is 0. Check price vs balances.");
        return;
    }

    console.log(`   Adding liquidity (Delta L: ${L.toString()})...`);
    const liqParams = {
        tickLower: -887220,
        tickUpper: 887220,
        liquidityDelta: L,
        salt: ethers.encodeBytes32String("heal-" + Date.now())
    };

    try {
        const tx = await router.addLiquidity(key, liqParams, "0x", { gasLimit: 3000000 });
        console.log(`   Tx: ${tx.hash}`);
        await tx.wait();
        console.log("   ✅ Success!");
    } catch (e) {
        console.log("   ❌ Failed:", e.message);
    }
}

async function run() {
    // await heal('base');
    await heal('arbitrum');
    await heal('ethereum');
}

run();
