import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

import { MAIN_WALLET_PRIVATE_KEY, CONTRACTS, CHAINS } from '@/lib/config';

// Constants
const MIN_SQRT_RATIO = BigInt("4295128739") + BigInt(1);
const MAX_SQRT_RATIO = BigInt("1461446703485210103287273052203988822378723970342") - BigInt(1);

const ERC20_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

const ROUTER_ABI = [
    "function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, bytes hookData) external payable"
];

export async function POST(request: NextRequest) {
    try {
        const { fromToken, toToken, amount, network } = await request.json();

        if (network !== 'base') {
            return NextResponse.json({ error: 'Only Base Sepolia supported' }, { status: 400 });
        }

        const privateKey = process.env.MAIN_WALLET_PRIVATE_KEY;
        if (!privateKey) {
            return NextResponse.json({ error: 'Private key not configured' }, { status: 500 });
        }

        // 1. Setup Provider & Wallet from config
        const chainConfig = CHAINS[network];
        const contracts = CONTRACTS[network];

        if (!chainConfig || !contracts) {
            return NextResponse.json({ error: `Config not found for ${network}` }, { status: 400 });
        }

        const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
        const wallet = new ethers.Wallet(MAIN_WALLET_PRIVATE_KEY, provider);

        const LIQUIDITY_MANAGER = contracts.router;
        const POOL_MANAGER = contracts.poolManager;
        const USDC_ADDR = contracts.usdc;
        const WETH_ADDR = contracts.weth;

        console.log(`[V4 Swap] Executing swap: ${amount} ${fromToken} -> ${toToken}`);

        // Normalize token names
        const fToken = fromToken.toUpperCase();
        const tToken = toToken.toUpperCase();

        // Determine token addresses
        const fromAddr = (fToken === 'WETH' || fToken === 'ETH') ? WETH_ADDR : USDC_ADDR;
        const toAddr = (tToken === 'USDC' || tToken === 'USD') ? USDC_ADDR : WETH_ADDR;
        const fromDecimals = (fToken === 'WETH' || fToken === 'ETH') ? 18 : 6;

        // Sort tokens for PoolKey
        const token0 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase() ? USDC_ADDR : WETH_ADDR;
        const token1 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase() ? WETH_ADDR : USDC_ADDR;

        const key = {
            currency0: token0,
            currency1: token1,
            fee: 3000,
            tickSpacing: 60,
            hooks: ethers.ZeroAddress
        };

        // Determine swap direction
        const isFromToken0 = fromAddr.toLowerCase() === token0.toLowerCase();
        const amountIn = ethers.parseUnits(amount.toString(), fromDecimals);

        // Setup contracts
        const fromTokenContract = new ethers.Contract(fromAddr, ERC20_ABI, wallet);
        const router = new ethers.Contract(LIQUIDITY_MANAGER, ROUTER_ABI, wallet);
        const poolManager = new ethers.Contract(POOL_MANAGER, [
            "function balanceOf(address owner, uint256 id) view returns (uint256)"
        ], wallet);

        // Check and approve if needed
        const allowance = await fromTokenContract.allowance(wallet.address, LIQUIDITY_MANAGER);
        if (allowance < amountIn) {
            console.log(`[V4 Swap] Approving ${fromToken}...`);
            const approveTx = await fromTokenContract.approve(LIQUIDITY_MANAGER, ethers.MaxUint256);
            await approveTx.wait();
            console.log(`[V4 Swap] ✅ Approved`);
        }

        // Get balance before
        const balanceBefore = await poolManager.balanceOf(wallet.address, toAddr);

        // Execute swap
        // In V4: zeroForOne = true means token0 -> token1
        const params = {
            zeroForOne: isFromToken0,
            amountSpecified: -amountIn, // Negative for exact input
            sqrtPriceLimitX96: isFromToken0 ?
                (MIN_SQRT_RATIO + BigInt(100)) :
                (MAX_SQRT_RATIO - BigInt(100))
        };

        console.log(`[V4 Swap] Executing swap transaction...`);
        const swapTx = await router.swap(key, params, "0x", { gasLimit: 2000000 });
        console.log(`[V4 Swap] ⏳ Pending: ${swapTx.hash}`);

        const receipt = await swapTx.wait();
        console.log(`[V4 Swap] ✅ Success! Block: ${receipt.blockNumber}`);

        // Get balance after
        const balanceAfter = await poolManager.balanceOf(wallet.address, toAddr);
        const delta = balanceAfter - balanceBefore;

        const outputDecimals = (tToken === 'USDC' || tToken === 'USD') ? 6 : 18;
        const receivedAmount = ethers.formatUnits(delta, outputDecimals);
        const totalAmount = ethers.formatUnits(balanceAfter, outputDecimals);

        return NextResponse.json({
            success: true,
            txHash: swapTx.hash,
            blockNumber: receipt.blockNumber,
            receivedAmount, // The actual delta
            outputAmount: receivedAmount, // Legacy support
            outputToken: tToken,
            totalClaimBalance: totalAmount,
            note: 'Output received as ERC-6909 claim in PoolManager'
        });

    } catch (e: any) {
        console.error('[V4 Swap] Error:', e);
        return NextResponse.json({
            success: false,
            error: e.message
        }, { status: 500 });
    }
}
