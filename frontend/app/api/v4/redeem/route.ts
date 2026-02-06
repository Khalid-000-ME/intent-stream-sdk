
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { MAIN_WALLET_PRIVATE_KEY, CONTRACTS, CHAINS } from '@/lib/config';

const ERC20_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

const ROUTER_ABI = [
    "function redeem(address currency, uint256 amount) external"
];

const POOL_MANAGER_ABI = [
    "function balanceOf(address owner, uint256 id) view returns (uint256)"
];

export async function POST(req: Request) {
    try {
        const { token, amount, network = 'base' } = await req.json();

        // 1. Setup Provider & Wallet
        const chainConfig = CHAINS[network];
        const contracts = CONTRACTS[network];

        if (!chainConfig || !contracts) {
            return NextResponse.json({ success: false, error: `Config not found for ${network}` });
        }

        const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
        const wallet = new ethers.Wallet(MAIN_WALLET_PRIVATE_KEY, provider);

        const LIQUIDITY_MANAGER = contracts.router;
        const POOL_MANAGER = contracts.poolManager;
        const USDC_ADDR = contracts.usdc;
        const WETH_ADDR = contracts.weth;

        // Determine token address
        const tToken = token.toUpperCase();
        const tokenAddr = (tToken === 'WETH' || tToken === 'ETH') ? WETH_ADDR : USDC_ADDR;
        const decimals = (tToken === 'WETH' || tToken === 'ETH') ? 18 : 6;

        // Setup contracts
        const router = new ethers.Contract(LIQUIDITY_MANAGER, ROUTER_ABI, wallet);
        const pm = new ethers.Contract(POOL_MANAGER, POOL_MANAGER_ABI, wallet);

        // Get claim balance
        const claimBalance = await pm.balanceOf(wallet.address, tokenAddr);

        let amountToRedeem = claimBalance;
        if (amount && amount !== 'all') {
            amountToRedeem = ethers.parseUnits(amount, decimals);
        }

        if (amountToRedeem === 0n) {
            return NextResponse.json({ success: false, error: "No claims to redeem" });
        }

        if (amountToRedeem > claimBalance) {
            return NextResponse.json({ success: false, error: `Insufficient claims. Have: ${ethers.formatUnits(claimBalance, decimals)}` });
        }

        console.log(`[V4 Redeem] Redeeming ${ethers.formatUnits(amountToRedeem, decimals)} ${tToken} claims...`);

        // Execute redeem
        const tx = await router.redeem(tokenAddr, amountToRedeem, { gasLimit: 500000 });
        console.log(`[V4 Redeem] ⏳ Pending: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`[V4 Redeem] ✅ Success! Block: ${receipt.blockNumber}`);

        return NextResponse.json({
            success: true,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            redeemedAmount: ethers.formatUnits(amountToRedeem, decimals),
            token: tToken
        });

    } catch (error: any) {
        console.error("[V4 Redeem] Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message || "Unknown error during redemption"
        }, { status: 500 });
    }
}
