import { ethers } from 'ethers';

// ABIs
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

const POOL_SWAP_TEST_ABI = [
    {
        "inputs": [
            {
                "components": [
                    { "internalType": "Currency", "name": "currency0", "type": "address" },
                    { "internalType": "Currency", "name": "currency1", "type": "address" },
                    { "internalType": "uint24", "name": "fee", "type": "uint24" },
                    { "internalType": "int24", "name": "tickSpacing", "type": "int24" },
                    { "internalType": "contract IHooks", "name": "hooks", "type": "address" }
                ],
                "internalType": "struct PoolKey",
                "name": "key",
                "type": "tuple"
            },
            {
                "components": [
                    { "internalType": "bool", "name": "zeroForOne", "type": "bool" },
                    { "internalType": "int256", "name": "amountSpecified", "type": "int256" },
                    { "internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160" }
                ],
                "internalType": "struct IPoolManager.SwapParams",
                "name": "params",
                "type": "tuple"
            },
            {
                "components": [
                    { "internalType": "bool", "name": "takeClaims", "type": "bool" },
                    { "internalType": "bool", "name": "settleUsingBurn", "type": "bool" }
                ],
                "internalType": "struct PoolSwapTest.TestSettings",
                "name": "testSettings",
                "type": "tuple"
            },
            { "internalType": "bytes", "name": "hookData", "type": "bytes" }
        ],
        "name": "swap",
        "outputs": [{ "internalType": "int256", "name": "delta", "type": "int256" }],
        "stateMutability": "payable",
        "type": "function"
    }
];

interface SwapConfig {
    rpcUrl: string;
    privateKey: string;
    routerAddress: string;
    tokenIn: string;
    tokenOut: string;
    amount: string;
    recipient?: string;
}

export async function executeSwap(config: SwapConfig) {
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const wallet = new ethers.Wallet(config.privateKey, provider);
    const router = new ethers.Contract(config.routerAddress, POOL_SWAP_TEST_ABI, wallet);
    const tokenInContract = new ethers.Contract(config.tokenIn, ERC20_ABI, wallet);

    // 1. Parse Amount
    const decimals = await tokenInContract.decimals();
    const amountIn = ethers.parseUnits(config.amount, decimals);

    // 2. Approve Router
    console.log(`Checking allowance for ${config.tokenIn}...`);
    const allowance = await tokenInContract.allowance(wallet.address, config.routerAddress);
    if (allowance < amountIn) {
        console.log(`Approving ${config.tokenIn}...`);
        const tx = await tokenInContract.approve(config.routerAddress, ethers.MaxUint256);
        await tx.wait();
        console.log("Approved.");
    }

    // 3. Prepare Pool Key
    // Sort tokens
    const isToken0 = config.tokenIn.toLowerCase() < config.tokenOut.toLowerCase();
    const currency0 = isToken0 ? config.tokenIn : config.tokenOut;
    const currency1 = isToken0 ? config.tokenOut : config.tokenIn;
    const zeroForOne = isToken0;

    const poolKey = {
        currency0,
        currency1,
        fee: 10000,        // Matches Swap.s.sol
        tickSpacing: 200,  // Matches Swap.s.sol
        hooks: ethers.ZeroAddress
    };

    // 4. Prepare Swap Params
    const params = {
        zeroForOne,
        amountSpecified: -amountIn, // Exact Input = negative
        sqrtPriceLimitX96: zeroForOne
            ? BigInt("4295128740") // MIN_PRICE + 1
            : BigInt("1461446703485210103287273052203988822378723970341") // MAX_PRICE - 1
    };

    const testSettings = {
        takeClaims: false,
        settleUsingBurn: false
    };

    // 5. Execute Swap
    const tokenOutContract = new ethers.Contract(config.tokenOut, ERC20_ABI, wallet);
    const balanceBefore = await tokenOutContract.balanceOf(wallet.address);

    console.log("Executing swap on-chain...");
    const txResponse = await router.swap(poolKey, params, testSettings, "0x");
    console.log(`Tx sent: ${txResponse.hash}`);

    const receipt = await txResponse.wait();
    console.log("Swap confirmed!");

    const balanceAfter = await tokenOutContract.balanceOf(wallet.address);
    const amountReceived = balanceAfter - balanceBefore;

    // 6. Transfer to Recipient (if specified)
    if (config.recipient && config.recipient.toLowerCase() !== wallet.address.toLowerCase()) {
        if (amountReceived > BigInt(0)) {
            console.log(`Transferring ${amountReceived} to ${config.recipient}...`);
            const transferTx = await tokenOutContract.transfer(config.recipient, amountReceived);
            await transferTx.wait();
            console.log("Transfer complete.");
        }
    }

    return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        amountOut: amountReceived.toString()
    };
}
