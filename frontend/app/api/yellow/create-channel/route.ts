import { NextRequest, NextResponse } from 'next/server';
import { activeIntents, activeSessions, updateIntentStatus } from '@/lib/intentStore';
import { YTEST_USD_TOKEN } from '@/lib/config';

export async function POST(request: NextRequest) {
    try {
        const { intentId, forceChannelId } = await request.json();
        const session = activeSessions.get(intentId);
        if (!session) throw new Error('Session not found. Please authenticate first.');

        const { ws, sessionSigner, mainAccount, client, publicClient } = session;

        let channelId: string;

        if (forceChannelId) {
            console.log(`[${intentId}] Using forced Channel ID: ${forceChannelId}`);
            updateIntentStatus(intentId, 'channel_created', `Using existing channel (Forced): ${forceChannelId.substring(0, 10)}...`);
            channelId = forceChannelId;
        } else {
            // STAGE 3: Check/Create Channel
            updateIntentStatus(intentId, 'channel_creating', 'Checking for existing channels...');

            console.log(`[${intentId}] WS State: ${ws.readyState} (OPEN=1)`);
            if (ws.readyState !== 1) {
                throw new Error(`WebSocket not open (State: ${ws.readyState})`);
            }

            const { createCreateChannelMessage, createGetLedgerBalancesMessage } = await import('@erc7824/nitrolite');

            let channels: any[] = [];

            if (session.cachedChannels) {
                console.log(`[${intentId}] Using cached channels from Auth.`);
                channels = session.cachedChannels;
            } else {
                console.log(`[${intentId}] No cached channels. Querying...`);

                // Setup listener BEFORE sending request (Fix race condition)
                const channelsPromise = new Promise<any>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        console.error(`[${intentId}] Channels query timed out after 60s.`);
                        reject(new Error('Channels query timeout'));
                    }, 60000); // 60s (Testnet latency can be high)

                    const handler = (data: any) => {
                        try {
                            const response = JSON.parse(data.toString());
                            console.log(`[${intentId}] WS Msg (Channels?):`, response.res?.[1]);
                            if (response.res && (response.res[1] === 'channels' || response.res[1] === 'get_ledger_balances')) {
                                clearTimeout(timeout);
                                ws.off('message', handler);
                                resolve(response.res[2]);
                            }
                        } catch (e) {
                            console.error(`[${intentId}] WS Parse Error:`, e);
                        }
                    };
                    ws.on('message', handler);
                });

                // Query ledger balances to trigger channels list response
                console.log(`[${intentId}] Sending Ledger Balance Query...`);
                const ledgerMsg = await createGetLedgerBalancesMessage(
                    sessionSigner,
                    mainAccount.address,
                    Date.now()
                );
                ws.send(ledgerMsg);

                const channelsData = await channelsPromise;
                channels = channelsData.channels || [];
            }

            const openChannel = channels.find((c: any) => c.status === 'open');

            if (openChannel) {
                // Use existing channel
                channelId = openChannel.channel_id;
                updateIntentStatus(intentId, 'channel_created', `Using existing channel: ${channelId.substring(0, 10)}...`);
            } else {
                // Create new channel
                updateIntentStatus(intentId, 'channel_creating', 'Creating new Yellow Network state channel...');

                const createChannelMsg = await createCreateChannelMessage(
                    sessionSigner,
                    {
                        chain_id: 11155111, // Sepolia
                        token: YTEST_USD_TOKEN,
                    }
                );

                // Setup listener BEFORE sending
                const channelPromise = new Promise<any>((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Channel creation timeout')), 60000);
                    const handler = (data: any) => {
                        try {
                            const response = JSON.parse(data.toString());
                            console.log(`[${intentId}] WS Msg (Creating Channel):`, response.res?.[1] || 'unknown', JSON.stringify(response).substring(0, 200));
                            if (response.res && response.res[1] === 'create_channel') {
                                clearTimeout(timeout);
                                ws.off('message', handler);
                                resolve(response.res[2]);
                            }
                        } catch (e) {
                            console.error(`[${intentId}] WS Parse Error during channel creation:`, e);
                        }
                    };
                    ws.on('message', handler);
                });

                ws.send(createChannelMsg);

                const channelData = await channelPromise;
                channelId = channelData.channel_id;

                // Transform state data for SDK
                const unsignedInitialState = {
                    intent: channelData.state.intent,
                    version: BigInt(channelData.state.version),
                    data: channelData.state.state_data,
                    allocations: channelData.state.allocations.map((a: any) => ({
                        destination: a.destination,
                        token: a.token,
                        amount: BigInt(a.amount),
                    })),
                };

                // Submit channel creation to blockchain
                updateIntentStatus(intentId, 'channel_creating', 'Submitting channel to blockchain...');
                const createResult = await client.createChannel({
                    channel: {
                        ...channelData.channel,
                        id: channelId
                    },
                    unsignedInitialState,
                    serverSignature: channelData.server_signature,
                });

                // Get transaction hash
                const txHash = typeof createResult === 'string' ? createResult : createResult.txHash;

                // Wait for transaction confirmation
                updateIntentStatus(intentId, 'channel_creating', 'Waiting for transaction confirmation...');
                await publicClient.waitForTransactionReceipt({ hash: txHash });

                updateIntentStatus(intentId, 'channel_created', `Channel created: ${channelId.substring(0, 10)}...`);
            }
        }

        session.channelId = channelId;
        return NextResponse.json({ success: true, channelId });

    } catch (e: any) {
        console.error('Channel Creation Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}