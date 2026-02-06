import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

// In-memory storage for intents (replace with database in production)
const intents = new Map<string, any>();

export async function POST(request: NextRequest) {
    const body = await request.json();

    console.log('📝 Creating intent:', body);

    const {
        fromToken,
        toToken,
        amount,
        network = 'arbitrum',
        slippage = 0.5,
        userAddress
    } = body;

    // Validate input
    if (!fromToken || !toToken || !amount) {
        return NextResponse.json({
            error: 'Missing required fields: fromToken, toToken, amount'
        }, { status: 400 });
    }

    // Generate intent ID
    const intentId = '0x' + randomBytes(16).toString('hex');

    // Create intent object
    const intent = {
        id: intentId,
        fromToken,
        toToken,
        amount,
        network,
        slippage,
        userAddress,
        status: 'created',
        createdAt: Date.now(),
        timeline: [
            {
                stage: 'created',
                timestamp: Date.now(),
                message: 'Intent created'
            }
        ]
    };

    // Store intent
    intents.set(intentId, intent);

    console.log('✅ Intent created:', intentId);

    // Start processing intent asynchronously
    processIntent(intentId).catch(console.error);

    return NextResponse.json({
        success: true,
        intentId,
        intent
    });
}

async function processIntent(intentId: string) {
    const intent = intents.get(intentId);
    if (!intent) return;

    console.log('⚙️  Processing intent:', intentId);

    // Simulate intent processing stages
    const stages = [
        { stage: 'encrypted', delay: 100, message: 'Intent encrypted & signed' },
        { stage: 'streamed', delay: 150, message: 'Streamed to broker' },
        { stage: 'batched', delay: 200, message: 'Added to batch' },
        { stage: 'executing', delay: 300, message: 'Executing on Uniswap v4' },
        { stage: 'settling', delay: 200, message: 'Settlement posted to Arc' },
        { stage: 'confirmed', delay: 150, message: 'Confirmation received' }
    ];

    for (const { stage, delay, message } of stages) {
        await new Promise(resolve => setTimeout(resolve, delay));

        intent.status = stage;
        intent.timeline.push({
            stage,
            timestamp: Date.now(),
            message
        });

        console.log(`  [${intentId.substring(0, 10)}...] ${stage}: ${message}`);
    }

    // Mark as complete
    intent.status = 'completed';
    intent.completedAt = Date.now();
    intent.executionTime = intent.completedAt - intent.createdAt;

    // Add execution results
    intent.result = {
        inputAmount: intent.amount,
        outputAmount: (parseFloat(intent.amount) * 2500).toString(), // Mock: 1 ETH = 2500 USDC
        slippage: '0.13',
        gasCost: '0.21',
        mevSavings: '96.05',
        txHash: '0x' + randomBytes(32).toString('hex'),
        blockNumber: Math.floor(Math.random() * 1000000) + 184000000
    };

    intents.set(intentId, intent);

    console.log('✅ Intent completed:', intentId);
}

// Export intents map for other routes to access
export { intents };
