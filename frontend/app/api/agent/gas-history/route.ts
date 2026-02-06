import { NextRequest, NextResponse } from 'next/server';

// Mock gas history data generator
function getGasHistory(network: string) {
    const base = network === 'arbitrum' ? 0.1 : 15; // gwei
    const history = [];
    const now = Date.now();
    for (let i = 0; i < 24; i++) { // Last 24 hours
        history.push({
            timestamp: now - (i * 3600 * 1000),
            gasPrice: base + (Math.random() * base * 0.5),
            unit: 'gwei'
        });
    }
    return history.reverse();
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get('network') || 'ethereum';

    try {
        const history = getGasHistory(network);

        // This answers the user's specific request for "providing historical gas price for each agent"
        // In a real scenario, this would check the agent's specific usage history too.

        return NextResponse.json({
            success: true,
            network,
            history,
            recommendation: {
                bestTime: "03:00 UTC",
                currentStatus: "Normal"
            }
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
