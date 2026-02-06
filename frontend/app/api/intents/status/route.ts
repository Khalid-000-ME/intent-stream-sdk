import { NextRequest, NextResponse } from 'next/server';

// Import intents storage from create route
// In production, this would be a database query
const intents = new Map<string, any>();

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const intentId = searchParams.get('id');

    if (!intentId) {
        return NextResponse.json({
            error: 'Missing intent ID'
        }, { status: 400 });
    }

    console.log('📊 Getting intent status:', intentId);

    // In production, fetch from database
    // For now, return mock data
    const intent = {
        id: intentId,
        status: 'completed',
        timeline: [
            { stage: 'created', timestamp: Date.now() - 1200, message: 'Intent created' },
            { stage: 'encrypted', timestamp: Date.now() - 1100, message: 'Encrypted & signed' },
            { stage: 'streamed', timestamp: Date.now() - 950, message: 'Streamed to broker' },
            { stage: 'batched', timestamp: Date.now() - 750, message: 'Added to batch #847' },
            { stage: 'executing', timestamp: Date.now() - 450, message: 'Executing on Uniswap v4' },
            { stage: 'settling', timestamp: Date.now() - 250, message: 'Settlement posted to Arc' },
            { stage: 'confirmed', timestamp: Date.now() - 100, message: 'Confirmation received' }
        ],
        result: {
            inputAmount: '1.5',
            inputToken: 'ETH',
            outputAmount: '3842.17',
            outputToken: 'USDC',
            expectedOutput: '3847.23',
            slippage: '0.13',
            gasCost: '0.21',
            mevSavings: '96.05',
            executionTime: 1267,
            txHash: '0x4a3b2c1d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b',
            blockNumber: 184728392,
            network: 'arbitrum'
        }
    };

    console.log('✅ Intent status:', intent.status);

    return NextResponse.json({
        success: true,
        intent
    });
}
