import { NextRequest, NextResponse } from 'next/server';
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";

const MAIN_WALLET_PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

export async function POST(request: NextRequest) {
    try {
        const { bridgeResult } = await request.json();

        if (!MAIN_WALLET_PRIVATE_KEY) {
            return NextResponse.json({ error: 'Server wallet not configured' }, { status: 500 });
        }

        if (!bridgeResult || !bridgeResult.source || !bridgeResult.destination) {
            return NextResponse.json({ error: 'Invalid bridge result' }, { status: 400 });
        }

        // Ensure proper private key format
        const pk = MAIN_WALLET_PRIVATE_KEY.startsWith('0x')
            ? MAIN_WALLET_PRIVATE_KEY as `0x${string}`
            : `0x${MAIN_WALLET_PRIVATE_KEY}` as `0x${string}`;

        const fromChain = bridgeResult.source.chain.chain; // e.g., "Arc_Testnet"
        const toChain = bridgeResult.destination.chain.chain; // e.g., "Base_Sepolia"

        console.log(`[Server Bridge Retry] Retrying failed bridge from ${fromChain} to ${toChain}`);

        // Create Adapters
        const adapter = createViemAdapterFromPrivateKey({ privateKey: pk });

        const kit = new BridgeKit();

        // Retry the bridge operation
        const result = await kit.retry(bridgeResult, {
            from: adapter,
            to: adapter
        });

        console.log(`[Server Bridge Retry] Success:`, result);

        // Helper to serialize BigInt
        const replacer = (key: string, value: any) =>
            typeof value === "bigint" ? value.toString() : value;

        const serializedDetails = JSON.parse(JSON.stringify(result, replacer));

        return NextResponse.json({
            success: true,
            txHash: result.steps?.find(s => s.name === 'mint')?.txHash || 'pending',
            details: serializedDetails
        });

    } catch (e: any) {
        console.error('[Server Bridge Retry] Error:', e);
        return NextResponse.json({
            success: false,
            error: e.message || 'Bridge retry failed'
        }, { status: 500 });
    }
}

