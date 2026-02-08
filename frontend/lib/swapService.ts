import { ethers } from 'ethers';
import { MAIN_WALLET_PRIVATE_KEY, CONTRACTS, CHAINS } from './config';
import { findBestPool, computePoolKey } from './poolDiscovery';

const ERC20_ABI = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

// Official PoolSwapTest swap signature
const ROUTER_ABI = [
    "function swap(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks), tuple(bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96), tuple(bool takeClaims, bool settleUsingBurn), bytes) external payable returns (int256)"
    // Note: PoolSwapTest.swap has 4 arguments: key, params, testSettings, hookData
    // The previous ABI in tint/swap was wrong/outdated (3 args).
    // Correct V4 PoolSwapTest signature:
    // swap(PoolKey key, IPoolManager.SwapParams params, TestSettings testSettings, bytes hookData)
];

const MIN_SQRT_RATIO = BigInt("4295128739") + BigInt(1);
const MAX_SQRT_RATIO = BigInt("1461446703485210103287273052203988822378723970342") - BigInt(1);

// Global Mutex for Nonce Management
const mutex = {
    _queue: Promise.resolve(),
    lock() {
        let release: () => void;
        const p = new Promise<void>(resolve => { release = resolve; });
        const current = this._queue;
        this._queue = this._queue.then(() => p);
        return current.then(() => release!);
    }
};

export async function executeSwap({
    network,
    fromToken,
    toToken,
    amount, // Readable string amount (e.g. "0.001")
    recipient // Optional recipient check? (PoolSwapTest swaps to msg.sender usually, unless settleFor...)
}: {
    network: string,
    fromToken: string,
    toToken: string,
    amount: string,
    recipient?: string
}) {
    let release: (() => void) | undefined;

    try {
        console.log(`[SwapService] Initiating swap on ${network}: ${amount} ${fromToken} -> ${toToken}`);

        const contracts = CONTRACTS[network];
        const chainConfig = CHAINS[network];

        if (!contracts || !chainConfig) throw new Error(`Unsupported network: ${network}`);

        const ROUTER_ADDR = contracts.router;
        const POOL_MANAGER_ADDR = contracts.poolManager;
        const USDC_ADDR = contracts.usdc;
        const WETH_ADDR = contracts.weth;

        const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
        const wallet = new ethers.Wallet(MAIN_WALLET_PRIVATE_KEY, provider);

        // Resolve Config
        const isUSDC = (t: string) => t.toUpperCase() === 'USDC';
        const fromAddr = isUSDC(fromToken) ? USDC_ADDR : WETH_ADDR;
        const toAddr = isUSDC(toToken) ? USDC_ADDR : WETH_ADDR;

        const fromContract = new ethers.Contract(fromAddr, ERC20_ABI, wallet);
        const fromDecimals = await fromContract.decimals();

        // Parse Amount
        const amountInt = ethers.parseUnits(amount, fromDecimals);
        const amountSpecified = -amountInt; // Negative for Exact Input

        // Discover Pool
        console.log(`[SwapService] Finding pool...`);
        // We know for sure 1% pool exists, so we can try to force it if discovery fails
        let pool = await findBestPool(POOL_MANAGER_ADDR, fromAddr, toAddr, chainConfig.rpc);

        if (!pool) {
            console.warn("[SwapService] Discovery failed. Using fallback 1% pool.");
            pool = {
                fee: 10000,
                tickSpacing: 200,
                // other fields irrelevant for key
            } as any;
        }

        const key = computePoolKey(fromAddr, toAddr, pool!.fee, pool!.tickSpacing);
        const isFromToken0 = fromAddr.toLowerCase() === key.currency0.toLowerCase();

        // EXECUTION (Mutex Protected)
        release = await mutex.lock();

        // Approve
        const allowance = await fromContract.allowance(wallet.address, ROUTER_ADDR);
        if (allowance < (amountInt)) {
            console.log(`[SwapService] Approving ${fromToken}...`);
            const txApprove = await fromContract.approve(ROUTER_ADDR, ethers.MaxUint256);
            await txApprove.wait();
        }

        const router = new ethers.Contract(ROUTER_ADDR, ROUTER_ABI, wallet);

        const params = {
            zeroForOne: isFromToken0,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: isFromToken0 ? (MIN_SQRT_RATIO + BigInt(100)) : (MAX_SQRT_RATIO - BigInt(100))
        };

        const testSettings = {
            takeClaims: false,
            settleUsingBurn: false
        };

        console.log(`[SwapService] Sending transaction...`);

        // Manual Nonce Management for high throughput reliability
        const nonce = await provider.getTransactionCount(wallet.address);

        // Fix Gas Price for Arbitrum if needed
        let overrides: any = { gasLimit: 3000000, nonce };
        // if (network === 'arbitrum') overrides.gasPrice = ... (Foundry handled it, maybe ethers needs it?)
        // Standard provider fee data usually works.

        const tx = await router.swap(key, params, testSettings, "0x", overrides);
        console.log(`[SwapService] Tx sent: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`[SwapService] Tx Confirmed: ${receipt.blockNumber}`);

        if (release) release();

        return {
            success: true,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            fromToken,
            toToken,
            amount
        };

    } catch (error: any) {
        if (release) release();
        console.error(`[SwapService] Failed:`, error);
        throw error;
    }
}
