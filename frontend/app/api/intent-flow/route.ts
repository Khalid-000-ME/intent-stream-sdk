import { NextRequest, NextResponse } from 'next/server';
import { activeIntents } from '@/lib/intentStore';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { action } = body;

    console.log('🎯 Intent Flow API (Status Check):', action);

    if (action === 'get_intent_status') {
        const { intentId } = body;
        // activeIntents is shared via global store
        const intent = activeIntents.get(intentId);
        if (!intent) return NextResponse.json({ error: 'Intent not found' }, { status: 404 });
        return NextResponse.json({ success: true, intent });
    }

    if (action === 'execute_intent') {
        return NextResponse.json({
            error: 'API DEPRECATED: This endpoint has been split. Please use /api/yellow/auth, /api/yellow/create-channel, and /api/intent/submit sequentially.'
        }, { status: 410 }); // 410 Gone
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
