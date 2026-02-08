import { NextRequest, NextResponse } from 'next/server';
import { executeSwap } from '@/lib/swapService';
import { ethers } from 'ethers';

// Simple queue to prevent nonce conflicts
let swapQueue = Promise.resolve();
const queueSwap = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = swapQueue.then(fn).catch(fn);
    swapQueue = result.then(() => { }, () => { });
    return result;
};

// Config
const CONFIG = {
    base: {
        rpc: "https://sepolia.base.org",
        router: "0x3213d0d87bc3215dac5719db385aaf094b8c4a32",
        tokens: {
            USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            WETH: "0x4200000000000000000000000000000000000006",
            ETH: "0x4200000000000000000000000000000000000006"
        }
    },
    arbitrum: {
        rpc: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
        router: "0x72166b1ec9da1233cec8d742abc9890608ba4097",
        tokens: {
            USDC: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
            WETH: "0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed",
            ETH: "0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed"
        }
    },
    ethereum: {
        rpc: "https://1rpc.io/sepolia",
        router: "0xd42d0554eb98163fe5915031183441745ead65a9",
        tokens: {
            USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
            WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
            ETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
        }
    }
};

export async function POST(req: NextRequest) {
    return queueSwap(async () => {
        try {
            const body = await req.json();
            const { network, tokenIn, tokenOut, amount, recipient } = body;

            console.log(`🦄 API: Swap Request on ${network}: ${amount} ${tokenIn} -> ${tokenOut}`);

            const config = CONFIG[network as keyof typeof CONFIG];
            if (!config) throw new Error("Invalid Network");

            const addrIn = config.tokens[tokenIn as keyof typeof config.tokens];
            const addrOut = config.tokens[tokenOut as keyof typeof config.tokens];

            if (!addrIn || !addrOut) throw new Error(`Token not supported: ${tokenIn} -> ${tokenOut}`);

            const privateKey = process.env.MAIN_WALLET_PRIVATE_KEY;
            if (!privateKey) throw new Error("Server Misconfigured: Missing Main Wallet Private Key");

            // Execute Swap using TypeScript Service (No Forge Dependency)
            const result = await executeSwap({
                rpcUrl: config.rpc,
                privateKey: privateKey,
                routerAddress: config.router,
                tokenIn: addrIn,
                tokenOut: addrOut,
                amount: amount.toString(),
                recipient: recipient
            });

            // Format Output
            // Result.amountOut is in Wei (BigInt string)
            const outDecimals = tokenOut === 'USDC' ? 6 : 18;
            const formattedOut = ethers.formatUnits(result.amountOut || "0", outDecimals);

            return NextResponse.json({
                success: true,
                txHash: result.txHash || "0x...",
                amountOut: formattedOut,
                rawOut: result.amountOut
            });

        } catch (e: any) {
            console.error("Swap Failed:", e);
            return NextResponse.json({ success: false, error: e.message || "Swap Execution Failed" }, { status: 500 });
        }
    });
}
