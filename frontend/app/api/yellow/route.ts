import { NextRequest, NextResponse } from 'next/server';
import { WebSocket } from 'ws';

// Store active connections (in production, use Redis or similar)
const connections = new Map<string, WebSocket>();

export async function POST(request: NextRequest) {
    try {
        const { action, sessionId } = await request.json();

        switch (action) {
            case 'connect':
                return handleConnect(sessionId);

            case 'disconnect':
                return handleDisconnect(sessionId);

            case 'status':
                return handleStatus(sessionId);

            default:
                return NextResponse.json(
                    { error: 'Invalid action' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

async function handleConnect(sessionId: string): Promise<NextResponse> {
    return new Promise((resolve) => {
        const ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');
        const messages: any[] = [];

        ws.on('open', () => {
            console.log('✅ Connected to Yellow Network for session:', sessionId);
            connections.set(sessionId, ws);
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log('📨 Received:', message);
                messages.push(message);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            resolve(NextResponse.json(
                { error: 'Failed to connect to Yellow Network' },
                { status: 500 }
            ));
        });

        // Wait a bit for initial connection
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                resolve(NextResponse.json({
                    success: true,
                    sessionId,
                    status: 'connected'
                }));
            } else {
                resolve(NextResponse.json(
                    { error: 'Connection timeout' },
                    { status: 500 }
                ));
            }
        }, 2000);
    });
}

function handleDisconnect(sessionId: string): NextResponse {
    const ws = connections.get(sessionId);

    if (ws) {
        ws.close();
        connections.delete(sessionId);
        return NextResponse.json({
            success: true,
            message: 'Disconnected successfully'
        });
    }

    return NextResponse.json(
        { error: 'No active connection found' },
        { status: 404 }
    );
}

function handleStatus(sessionId: string): NextResponse {
    const ws = connections.get(sessionId);

    if (ws) {
        return NextResponse.json({
            connected: ws.readyState === WebSocket.OPEN,
            sessionId
        });
    }

    return NextResponse.json({
        connected: false,
        sessionId
    });
}

export async function GET(request: NextRequest) {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json(
            { error: 'Session ID required' },
            { status: 400 }
        );
    }

    return handleStatus(sessionId);
}
