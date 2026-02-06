import { NextRequest, NextResponse } from 'next/server';
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";

const MAIN_WALLET_PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

export async function POST(request: NextRequest) {
    try {
        const { fromChain, toChain, amount, token, recipient } = await request.json();

        if (!MAIN_WALLET_PRIVATE_KEY) {
            return NextResponse.json({ error: 'Server wallet not configured' }, { status: 500 });
        }

        // Ensure proper private key format
        const pk = MAIN_WALLET_PRIVATE_KEY.startsWith('0x')
            ? MAIN_WALLET_PRIVATE_KEY as `0x${string}`
            : `0x${MAIN_WALLET_PRIVATE_KEY}` as `0x${string}`;

        console.log(`[Server Bridge] Initiating bridge: ${amount} ${token} from ${fromChain} to ${toChain}`);
        if (recipient) console.log(`[Server Bridge] Recipient: ${recipient}`);

        // Create Adapter
        const adapter = createViemAdapterFromPrivateKey({
            privateKey: pk
        });

        const kit = new BridgeKit();

        const toParams = recipient
            ? { chain: toChain, adapter, recipientAddress: recipient }
            : { adapter, chain: toChain };

        const result = await kit.bridge({
            from: { adapter, chain: fromChain },
            to: toParams as any,
            amount: amount.toString(),
            // Token is inferred as USDC by default in BridgeKit usually, or parameterizable
        });

        console.log(`[Server Bridge] Success:`, result);

        // Helper to serialize BigInt
        const replacer = (key: string, value: any) =>
            typeof value === "bigint" ? value.toString() : value;

        // Serialize the result first using the replacer
        const serializedDetails = JSON.parse(JSON.stringify(result, replacer));

        return NextResponse.json({
            success: true,
            txHash: result.steps?.[0]?.txHash || 'pending',
            details: serializedDetails
        });

    } catch (e: any) {
        console.error('[Server Bridge] Error:', e);
        return NextResponse.json({
            success: false,
            error: e.message || 'Bridge execution failed'
        }, { status: 500 });
    }
}
