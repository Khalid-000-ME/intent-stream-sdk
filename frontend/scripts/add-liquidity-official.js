const { ethers } = require("ethers");
require("dotenv").config({ path: "../.env" });

const PRIVATE_KEY = process.env.PRIVATE_KEY || 'e844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';

const CHAINS = {
    arbitrum: {
        rpc: 'https://arbitrum-sepolia.gateway.tenderly.co',
        // These will be updated after deployment
        router: '',
        poolManager: '',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x980B62a498b36E08b31B5e9E3060E53d865c7705'
    },
    ethereum: {
        rpc: 'https://1rpc.io/sepolia',
        // These will be updated after deployment
        router: '',
        poolManager: '',
        usdc: '0x1c7D4B62650b4f6259c5d7967396657c9C7238b6',
        weth: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14'
    }
};

const ROUTER_ABI = [
    "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable",
    "function getPoolStatus((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key) view returns (uint160 sqrtPriceX96, uint128 liquidity)"
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

async function addLiquidity(chainName, routerAddr, pmAddr) {
    console.log(`\n🌊 Adding Liquidity to ${chainName}...`);
    const config = CHAINS[chainName];
    const provider = new ethers.JsonRpcProvider(config.rpc);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const uAddr = ethers.getAddress(config.usdc.toLowerCase());
    const wAddr = ethers.getAddress(config.weth.toLowerCase());
    const rAddr = ethers.getAddress(routerAddr.toLowerCase());
    const pAddr = ethers.getAddress(pmAddr.toLowerCase());

    const usdc = new ethers.Contract(uAddr, ERC20_ABI, wallet);
    const weth = new ethers.Contract(wAddr, ERC20_ABI, wallet);
    const router = new ethers.Contract(rAddr, ROUTER_ABI, wallet);

    const uBal = await usdc.balanceOf(wallet.address);
    const wBal = await weth.balanceOf(wallet.address);

    console.log(`   Wallet: ${wallet.address}`);
    console.log(`   USDC Bal: ${ethers.formatUnits(uBal, 6)}`);
    console.log(`   WETH Bal: ${ethers.formatUnits(wBal, 18)}`);

    if (uBal === 0n || wBal === 0n) {
        console.log(`   ⚠️  Zero balance for tokens. Please fund the wallet with testnet USDC/WETH.`);
        return;
    }

    const isWeth0 = wAddr.toLowerCase() < uAddr.toLowerCase();
    const key = {
        currency0: isWeth0 ? wAddr : uAddr,
        currency1: isWeth0 ? uAddr : wAddr,
        fee: 3000,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    console.log("   Fetching Pool State...");
    let sqrtPriceX96;
    try {
        const status = await router.getPoolStatus(key);
        sqrtPriceX96 = status.sqrtPriceX96;
    } catch (e) {
        console.log("   ❌ Error fetching pool status:", e.message);
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

    // Amount to add (use min of available or a safe small amount)
    const uAmount = (uBal > ethers.parseUnits("1", 6)) ? ethers.parseUnits("1", 6) : uBal;

    const Q96 = 2n ** 96n;
    // Calculate L based on amountSpecified (amountIn)
    // For T0: L = amount0 * sqrtPrice / (sqrtPriceUpper - sqrtPriceLower) 
    // Simplified for full range: L = amount0 * sqrtPrice / 2^96
    const L = (uAmount * sqrtPriceX96) / Q96;

    console.log(`   Adding L: ${L.toString()} delta...`);

    const liqParams = {
        tickLower: -887220,
        tickUpper: 887220,
        liquidityDelta: L,
        salt: ethers.ZeroHash
    };

    try {
        const tx = await router.addLiquidity(key, liqParams, "0x", { gasLimit: 3000000 });
        console.log(`   ⏳ Pending: ${tx.hash}`);
        await tx.wait();
        console.log(`   ✅ Liquidity Added!`);
    } catch (e) {
        console.log(`   ❌ Liquidity Add Failed: ${e.message}`);
    }
}

// Map command line args or manually run
async function run() {
    // These will be passed after deployment
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.log("Usage: node add-liquidity-official.js [chain] [router] [pm]");
        return;
    }
    await addLiquidity(args[0], args[1], args[2]);
}

run();
