const { ethers } = require('ethers');
require('dotenv').config({ path: '../.env' });

const PRIVATE_KEY = process.env.PRIVATE_KEY || 'e844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';

const CHAINS = {
    arbitrumSepolia: {
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        router: '0xe094c00E6d49E6106CFB3F36cc8818088Cb6ba2c'.toLowerCase(),
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'.toLowerCase(),
        weth: '0x980B62a498b36E08b31B5e9E3060E53d865c7705'.toLowerCase()
    },
    sepolia: {
        rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
        router: '0x940FE85c68e4F3EE863c356aEc6B72FE0D0aA40c'.toLowerCase(),
        usdc: '0x1c7D4B62650b4f6259c5d7967396657c9C7238b6'.toLowerCase(),
        weth: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14'.toLowerCase()
    }
};

async function heal(chainName) {
    console.log(`\n🏥 Healing ${chainName}...`);
    const config = CHAINS[chainName];
    const provider = new ethers.JsonRpcProvider(config.rpc);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const router = new ethers.Contract(config.router, [
        "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable"
    ], wallet);

    const usdc = new ethers.Contract(config.usdc, [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)"
    ], wallet);
    const weth = new ethers.Contract(config.weth, [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)"
    ], wallet);

    // Sort tokens
    const isWeth0 = config.weth.toLowerCase() < config.usdc.toLowerCase();
    const t0 = isWeth0 ? config.weth : config.usdc;
    const t1 = isWeth0 ? config.usdc : config.weth;

    const key = {
        currency0: t0,
        currency1: t1,
        fee: 3000,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    const tickLower = -887220 + (60 - (-887220 % 60));
    const tickUpper = 887220 - (887220 % 60);

    // Approvals
    console.log("   Approving tokens...");
    await (await usdc.approve(config.router, ethers.MaxUint256)).wait();
    await (await weth.approve(config.router, ethers.MaxUint256)).wait();

    // Small safe delta
    const liquidityDelta = BigInt("100000000000");

    console.log("   Adding liquidity...");
    try {
        const tx = await router.addLiquidity(key, {
            tickLower,
            tickUpper,
            liquidityDelta,
            salt: ethers.encodeBytes32String("heal-" + Date.now())
        }, "0x", { gasLimit: 2000000 });
        console.log(`   Tx: ${tx.hash}`);
        await tx.wait();
        console.log("   ✅ Pool Healed!");
    } catch (e) {
        console.error(`   ❌ Failed: ${e.message}`);
    }
}

async function run() {
    await heal('arbitrumSepolia');
    await heal('sepolia');
}

run();
