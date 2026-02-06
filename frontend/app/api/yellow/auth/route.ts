import { NextRequest, NextResponse } from 'next/server';
import WebSocket from 'ws';
import {
    createECDSAMessageSigner,
    createAuthRequestMessage,
    createEIP712AuthMessageSigner,
    createAuthVerifyMessageFromChallenge,
    NitroliteClient,
    WalletStateSigner,
} from '@erc7824/nitrolite';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http } from 'viem';
import { activeIntents, activeSessions, updateIntentStatus, SessionData } from '@/lib/intentStore';
import { MAIN_WALLET_PRIVATE_KEY, CHAINS, YELLOW_WS_URL } from '@/lib/config';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        // Accepts initial intent params to start the flow
        const { fromToken, toToken, amount, network, slippage, type, recipient: bodyRecipient, toChain, fromChain, userAddress } = body;

        // Default recipient to the sender (userAddress) if not specified, especially for SWAPs
        const recipient = bodyRecipient || userAddress;

        // Create Intent
        const intentId = '0x' + Math.random().toString(16).substring(2, 18);
        const intent = {
            id: intentId,
            fromToken,
            toToken,
            amount,
            network,
            slippage,
            type: type || 'SWAP', // Default to SWAP
            recipient,
            toChain,
            fromChain,
            status: 'created',
            createdAt: Date.now(),
            timeline: []
        };
        activeIntents.set(intentId, intent);
        console.log('🚀 Starting Auth Route for Intent:', intentId);

        // STAGE 1: Connect
        updateIntentStatus(intentId, 'connecting', 'Connecting to Yellow Network...');
        const mainAccount = privateKeyToAccount(MAIN_WALLET_PRIVATE_KEY as `0x${string}`);
        const authRpcObj = CHAINS.ethereum;

        const publicClient = createPublicClient({ chain: authRpcObj.chain, transport: http(authRpcObj.rpc) });
        const walletClient = createWalletClient({ chain: authRpcObj.chain, transport: http(authRpcObj.rpc), account: mainAccount });

        const client = new NitroliteClient({
            publicClient, walletClient,
            stateSigner: new WalletStateSigner(walletClient),
            addresses: { custody: '0x019B65A265EB3363822f2752141b3dF16131b262', adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2' },
            chainId: authRpcObj.chain.id,
            challengeDuration: BigInt(3600),
        });

        const ws = new WebSocket(YELLOW_WS_URL);

        // Capture channels if they arrive spontaneously
        let capturedChannels: any[] | null = null;
        ws.on('message', (data: any) => {
            try {
                const r = JSON.parse(data.toString());
                if (r.res?.[1] === 'channels') {
                    console.log(`[${intentId}] Captured channels msg during Auth`);
                    capturedChannels = r.res[2].channels;
                    const s = activeSessions.get(intentId);
                    if (s) s.cachedChannels = r.res[2].channels;
                }
            } catch { }
        });

        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve();
            ws.onerror = () => reject(new Error('Yellow Connection Failed'));
            setTimeout(() => reject(new Error('Connection timeout')), 10000);
        });
        updateIntentStatus(intentId, 'connected', 'Connected to Yellow Network');

        // STAGE 2: Auth
        updateIntentStatus(intentId, 'authenticating', 'Authenticating...');
        const sessionPrivateKey = generatePrivateKey();
        const sessionAccount = privateKeyToAccount(sessionPrivateKey);
        const yellowSessionId = sessionAccount.address;

        const authParams = {
            address: mainAccount.address, application: 'Intent Stream SDK',
            session_key: sessionAccount.address,
            allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
            expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600), scope: 'test.app',
        };

        const authPromise = new Promise<boolean>((resolve) => {
            const messageHandler = async (data: any) => {
                try {
                    const response = JSON.parse(data.toString());
                    const type = response.res?.[1];
                    if (type === 'auth_challenge') {
                        const challenge = response.res[2].challenge_message;
                        const signer = createEIP712AuthMessageSigner(walletClient, authParams, { name: 'Intent Stream SDK' });
                        ws.send(await createAuthVerifyMessageFromChallenge(signer, challenge));
                    }
                    if (type === 'auth_verify') {
                        ws.off('message', messageHandler);
                        resolve(true);
                    }
                } catch (e) { console.error(e); }
            };
            ws.on('message', messageHandler);
            setTimeout(() => resolve(false), 60000);
        });
        ws.send(await createAuthRequestMessage(authParams));

        const authResult = await authPromise;
        if (!authResult) throw new Error('Authentication failed');

        updateIntentStatus(intentId, 'authenticated', `Authenticated! Session: ${yellowSessionId.substring(0, 8)}...`);

        // Store Session
        const sessionData: SessionData = {
            ws,
            sessionSigner: createECDSAMessageSigner(sessionPrivateKey),
            sessionPrivateKey,
            mainAccount,
            yellowSessionId,
            client,
            publicClient,
            walletClient
        };
        activeSessions.set(intentId, sessionData);

        return NextResponse.json({ success: true, intentId });
    } catch (e: any) {
        console.error('Auth Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
