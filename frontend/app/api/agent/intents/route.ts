import { NextRequest, NextResponse } from 'next/server';
import { activeIntents } from '@/lib/intentStore';

export async function GET(request: NextRequest) {
    // For this demo, we return ALL intents in memory.
    // In a real system, filter by agentId from URL query
    // const { searchParams } = new URL(request.url);
    // const agentId = searchParams.get('agentId');

    try {
        const intents = Array.from(activeIntents.values()).map(i => {
            try {
                return {
                    id: i.id,
                    type: i.type || (i.recipient ? 'PAYMENT' : 'SWAP'),
                    status: i.status || 'unknown',
                    result: i.result || null,
                    createdAt: i.createdAt || Date.now(),
                    network: i.network || 'unknown'
                };
            } catch (err) {
                return null;
            }
        }).filter(Boolean);

        return NextResponse.json({ success: true, intents });
    } catch (e: any) {
        return NextResponse.json({ error: e.message, intents: [] }, { status: 500 });
    }
}
