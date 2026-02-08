import { NextRequest, NextResponse } from 'next/server';
import { executeSwap } from '@/lib/swapService';

export async function POST(request: NextRequest) {
    try {
        const { chain, network, fromToken, toToken, amount, recipient } = await request.json();

        // Support 'chain' or 'network' param
        const targetNetwork = chain || network || 'base';

        const result = await executeSwap({
            network: targetNetwork,
            fromToken,
            toToken,
            amount: amount.toString(),
            recipient
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Swap API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
