import { NextRequest, NextResponse } from 'next/server';
import WebSocket from 'ws';
import {
    createECDSAMessageSigner,
    createAuthRequestMessage,
    createEIP712AuthMessageSigner,
    createAuthVerifyMessageFromChallenge,
    createGetLedgerBalancesMessage,
} from '@erc7824/nitrolite';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';

// User's main wallet private key (from environment or hardcoded for testing)
const MAIN_WALLET_PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY ||
    '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';

// Store WebSocket connections
const connections = new Map<string, WebSocket>();

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { action, sessionId } = body;

    console.log('📨 API Request:', body);
    console.log('🎯 Action:', action, ', SessionId:', sessionId);

    try {
        switch (action) {
            case 'connect':
                console.log('🔌 Handling connect...');
                return handleConnect(sessionId);

            case 'auth_full':
                console.log('🔐 Handling full authentication (server-side)...');
                return handleFullAuth(sessionId);

            case 'get_balances':
                console.log('💰 Handling get_balances...');
                return handleGetBalances(sessionId);

            case 'disconnect':
                console.log('👋 Handling disconnect...');
                return handleDisconnect(sessionId);

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('❌ Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function handleConnect(sessionId: string): Promise<NextResponse> {
    console.log('  Creating WebSocket connection...');

    return new Promise((resolve) => {
        const ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');

        ws.on('open', () => {
            console.log('  ✅ WebSocket opened');
            connections.set(sessionId, ws);
            resolve(NextResponse.json({ success: true }));
        });

        ws.on('error', (error) => {
            console.error('  ❌ WebSocket error:', error);
            resolve(NextResponse.json({ error: 'WebSocket connection failed' }, { status: 500 }));
        });

        ws.on('message', (data: Buffer) => {
            try {
                const response = JSON.parse(data.toString());
                console.log('  📨 Received:', response);
            } catch (error) {
                console.error('  ❌ Message parsing error:', error);
            }
        });

        // Timeout
        setTimeout(() => {
            if (!connections.has(sessionId)) {
                ws.close();
                resolve(NextResponse.json({ error: 'Connection timeout' }, { status: 500 }));
            }
        }, 5000);
    });
}

async function handleFullAuth(sessionId: string): Promise<NextResponse> {
    console.log('  🔐 Starting full server-side authentication...');

    const ws = connections.get(sessionId);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.error('  ❌ WebSocket not connected');
        return NextResponse.json({ error: 'Not connected' }, { status: 400 });
    }

    return new Promise(async (resolve) => {
        try {
            // Setup main wallet
            const mainAccount = privateKeyToAccount(MAIN_WALLET_PRIVATE_KEY as `0x${string}`);
            const walletClient = createWalletClient({
                chain: sepolia,
                transport: http('https://eth-sepolia.g.alchemy.com/v2/demo'),
                account: mainAccount
            });

            console.log('  🔑 Main wallet:', mainAccount.address);

            // Generate session key
            const sessionPrivateKey = generatePrivateKey();
            const sessionAccount = privateKeyToAccount(sessionPrivateKey);
            const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

            console.log('  🔑 Session key:', sessionAccount.address);

            // Store session info
            (ws as any).sessionPrivateKey = sessionPrivateKey;
            (ws as any).sessionSigner = sessionSigner;
            (ws as any).sessionAddress = sessionAccount.address;

            // Create auth params
            const authParams = {
                session_key: sessionAccount.address as `0x${string}`,
                allowances: [{
                    asset: 'ytest.usd',
                    amount: '1000000000'
                }],
                expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
                scope: 'test.app',
            };

            (ws as any).authParams = authParams;

            console.log('  📝 Auth params:', {
                ...authParams,
                expires_at: authParams.expires_at.toString()
            });

            // Send auth_request
            const authRequestMsg = await createAuthRequestMessage({
                address: mainAccount.address,
                application: 'Test app',
                ...authParams
            });

            console.log('  📤 Sending auth_request...');

            // Set up message handler for auth_challenge
            const messageHandler = async (data: Buffer) => {
                try {
                    const response = JSON.parse(data.toString());
                    const type = response.res?.[1];

                    console.log('  📨 Received message type:', type);

                    if (type === 'auth_challenge') {
                        const challenge = response.res[2].challenge_message;
                        console.log('  🔐 Received challenge:', challenge);

                        // Create EIP-712 signer with main wallet
                        console.log('  📝 Creating EIP-712 signer...');
                        const signer = createEIP712AuthMessageSigner(
                            walletClient,
                            authParams,
                            { name: 'Test app' }
                        );

                        console.log('  ✍️  Signing challenge...');
                        const verifyMsg = await createAuthVerifyMessageFromChallenge(
                            signer,
                            challenge
                        );

                        console.log('  📤 Sending auth_verify...');
                        ws.send(verifyMsg);
                    }

                    if (type === 'auth_verify') {
                        console.log('  ✅ AUTHENTICATION SUCCESSFUL!');
                        console.log('  📋 Response:', response.res[2]);

                        ws.off('message', messageHandler);
                        (ws as any).authenticated = true;

                        resolve(NextResponse.json({
                            success: true,
                            address: mainAccount.address,
                            sessionKey: sessionAccount.address,
                            jwtToken: response.res[2]?.jwt_token
                        }));
                    }

                    if (type === 'error') {
                        console.error('  ❌ Error:', response.res[2]);
                        ws.off('message', messageHandler);
                        resolve(NextResponse.json({
                            error: response.res[2]?.error || 'Authentication failed'
                        }, { status: 400 }));
                    }
                } catch (error) {
                    console.error('  ❌ Message parsing error:', error);
                }
            };

            ws.on('message', messageHandler);
            ws.send(authRequestMsg);

            // Timeout
            setTimeout(() => {
                ws.off('message', messageHandler);
                resolve(NextResponse.json({ error: 'Authentication timeout' }, { status: 500 }));
            }, 30000);

        } catch (error: any) {
            console.error('  ❌ Auth error:', error);
            resolve(NextResponse.json({ error: error.message }, { status: 500 }));
        }
    });
}

async function handleGetBalances(sessionId: string): Promise<NextResponse> {
    const ws = connections.get(sessionId);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        return NextResponse.json({ error: 'Not connected' }, { status: 400 });
    }

    if (!(ws as any).authenticated) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return new Promise(async (resolve) => {
        const sessionSigner = (ws as any).sessionSigner;
        const sessionAddress = (ws as any).sessionAddress;

        if (!sessionSigner || !sessionAddress) {
            resolve(NextResponse.json({ error: 'Session not initialized' }, { status: 400 }));
            return;
        }

        // Create get_ledger_balances message
        const balancesMsg = await createGetLedgerBalancesMessage(
            sessionSigner,
            sessionAddress,
            Date.now()
        );

        const messageHandler = (data: Buffer) => {
            try {
                const response = JSON.parse(data.toString());
                const type = response.res?.[1];

                if (type === 'get_ledger_balances') {
                    ws.off('message', messageHandler);
                    resolve(NextResponse.json({
                        success: true,
                        balances: response.res[2]
                    }));
                }
            } catch (error) {
                console.error('Message parsing error:', error);
            }
        };

        ws.on('message', messageHandler);
        ws.send(balancesMsg);

        // Timeout
        setTimeout(() => {
            ws.off('message', messageHandler);
            resolve(NextResponse.json({ error: 'Get balances timeout' }, { status: 500 }));
        }, 10000);
    });
}

async function handleDisconnect(sessionId: string): Promise<NextResponse> {
    const ws = connections.get(sessionId);

    if (ws) {
        ws.close();
        connections.delete(sessionId);
    }

    return NextResponse.json({ success: true });
}
