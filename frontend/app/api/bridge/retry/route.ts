import { NextRequest, NextResponse } from 'next/server';
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";

const MAIN_WALLET_PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

export async function POST(request: NextRequest) {
    try {
        const { bridgeResult } = await request.json();

        if (!MAIN_WALLET_PRIVATE_KEY) {
            console.error("[Server Bridge Retry] Error: MAIN_WALLET_PRIVATE_KEY is not set");
            return NextResponse.json({ error: 'Server wallet not configured' }, { status: 500 });
        }

        if (!bridgeResult) {
            return NextResponse.json({ error: 'Missing bridgeResult' }, { status: 400 });
        }

        const pk = MAIN_WALLET_PRIVATE_KEY.startsWith('0x')
            ? MAIN_WALLET_PRIVATE_KEY as `0x${string}`
            : `0x${MAIN_WALLET_PRIVATE_KEY}` as `0x${string}`;

        const sourceChain = bridgeResult.source?.chain?.chain || "unknown";
        const destChain = bridgeResult.destination?.chain?.chain || "unknown";

        console.log(`[RECOVERY] Initiating server-side protocol for ${sourceChain} -> ${destChain}`);
        console.log(`[RECOVERY] Client-side failure detected in steps:`,
            bridgeResult.steps?.filter((s: any) => s.state === 'error').map((s: any) => s.name)
        );

        const adapter = createViemAdapterFromPrivateKey({ privateKey: pk });
        const kit = new BridgeKit();

        // Perform the recovery (retry)
        const result = await kit.retry(bridgeResult, {
            from: adapter,
            to: adapter
        });

        console.log(`[RECOVERY] Final State: ${result.state}`);

        const mintStep = result.steps?.find((s: any) => s.name === 'mint');

        if (result.state === 'success' || (mintStep && mintStep.state === 'success')) {
            console.log(`[RECOVERY] ✅ SUCCESS. Mint TX: ${mintStep?.txHash}`);

            return NextResponse.json({
                success: true,
                txHash: mintStep?.txHash,
                state: result.state
            });
        } else {
            const errorMsg = (mintStep as any)?.errorMessage || "Unknown retry error";
            console.error(`[RECOVERY] ❌ FAILED: ${errorMsg}`);

            return NextResponse.json({
                success: false,
                error: errorMsg,
                result: result
            }, { status: 500 });
        }

    } catch (e: any) {
        console.error('[RECOVERY] Critical Exception:', e);
        return NextResponse.json({
            success: false,
            error: e.message || 'Bridge recovery exception'
        }, { status: 500 });
    }
}

