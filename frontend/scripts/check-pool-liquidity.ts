import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const POOL_MANAGER = "0x1b832D5395A41446b508632466cf32c6C07D63c7";
const LIQUIDITY_MANAGER = "0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0";
const USDC_ADDR = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const WETH_ADDR = "0x4200000000000000000000000000000000000006";
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY!;

const ERC20_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
];

const POOL_MANAGER_ABI = [
    "function balanceOf(address owner, uint256 id) view returns (uint256)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`\n🔍 Checking Pool Liquidity on Base Sepolia\n`);
    console.log(`Wallet: ${wallet.address}\n`);

    const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, provider);
    const weth = new ethers.Contract(WETH_ADDR, ERC20_ABI, provider);
    const pm = new ethers.Contract(POOL_MANAGER, POOL_MANAGER_ABI, provider);

    // Check PoolManager's token balances (total liquidity locked)
    const [pmUSDC, pmWETH] = await Promise.all([
        usdc.balanceOf(POOL_MANAGER),
        weth.balanceOf(POOL_MANAGER)
    ]);

    console.log(`📊 PoolManager Total Liquidity:`);
    console.log(`   USDC: ${ethers.formatUnits(pmUSDC, 6)}`);
    console.log(`   WETH: ${ethers.formatUnits(pmWETH, 18)}`);

    // Check your wallet's ERC-20 balances
    const [walletUSDC, walletWETH] = await Promise.all([
        usdc.balanceOf(wallet.address),
        weth.balanceOf(wallet.address)
    ]);

    console.log(`\n💰 Your Wallet Balances (ERC-20):`);
    console.log(`   USDC: ${ethers.formatUnits(walletUSDC, 6)}`);
    console.log(`   WETH: ${ethers.formatUnits(walletWETH, 18)}`);

    // Check your ERC-6909 claims
    const [claimUSDC, claimWETH] = await Promise.all([
        pm.balanceOf(wallet.address, USDC_ADDR),
        pm.balanceOf(wallet.address, WETH_ADDR)
    ]);

    console.log(`\n🎫 Your Claims (ERC-6909):`);
    console.log(`   USDC: ${ethers.formatUnits(claimUSDC, 6)}`);
    console.log(`   WETH: ${ethers.formatUnits(claimWETH, 18)}`);

    // Estimate max swap size
    const maxSwapWETH = Number(ethers.formatUnits(pmUSDC, 6)) / 3000; // Rough estimate assuming 1 WETH = 3000 USDC
    console.log(`\n⚠️  Estimated Max Swap: ~${maxSwapWETH.toFixed(4)} WETH`);
    console.log(`   (Based on available USDC liquidity)\n`);
}

main().catch(console.error);
