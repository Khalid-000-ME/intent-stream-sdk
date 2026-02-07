
const { ethers } = require('ethers');
require('dotenv').config({ path: '../.env' });

async function healPool() {
    const rawKey = process.env.MAIN_WALLET_PRIVATE_KEY || '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';
    const PRIVATE_KEY = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
    const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const LIQUIDITY_MANAGER = '0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0';
    const USDC_ADDR = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
    const WETH_ADDR = '0x4200000000000000000000000000000000000006';

    const router = new ethers.Contract(LIQUIDITY_MANAGER, [
        "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable"
    ], wallet);

    const usdc = new ethers.Contract(USDC_ADDR, [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)"
    ], wallet);
    const weth = new ethers.Contract(WETH_ADDR, [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)"
    ], wallet);

    console.log(`Healing Pool from wallet: ${wallet.address}`);

    const isUSDC0 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase();
    const token0 = isUSDC0 ? USDC_ADDR : WETH_ADDR;
    const token1 = isUSDC0 ? WETH_ADDR : USDC_ADDR;

    const key = {
        currency0: token0,
        currency1: token1,
        fee: 3000,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    // Full range tick boundaries
    const tickLower = -887220 + (60 - (-887220 % 60));
    const tickUpper = 887220 - (887220 % 60);

    // Skip approvals if already high
    const uAll = await usdc.allowance(wallet.address, LIQUIDITY_MANAGER);
    if (uAll < BigInt("10000000")) {
        console.log("Approving USDC...");
        await (await usdc.approve(LIQUIDITY_MANAGER, ethers.MaxUint256)).wait();
    }
    const wAll = await weth.allowance(wallet.address, LIQUIDITY_MANAGER);
    if (wAll < BigInt("1000000000000000000")) {
        console.log("Approving WETH...");
        await (await weth.approve(LIQUIDITY_MANAGER, ethers.MaxUint256)).wait();
    }

    // L = 5 * 10^8 units of liquidity.
    // This requires ~7 USDC and ~0.0003 WETH at current pool price.
    // This provides enough depth for small user swaps (~$1).
    const liquidityDelta = BigInt("500000000");

    console.log("Adding liquidity depth...");
    const tx = await router.addLiquidity(key, {
        tickLower,
        tickUpper,
        liquidityDelta,
        salt: ethers.encodeBytes32String("heal-" + Date.now())
    }, "0x", { gasLimit: 2000000 });

    console.log(`Tx Submitted: ${tx.hash}`);
    const receipt = await tx.wait();

    if (receipt.status === 1) {
        console.log("✅ Pool Healed! Math should now be correct for small swaps.");
    } else {
        console.error("❌ Add Liquidity Reverted!");
    }
}

healPool();
