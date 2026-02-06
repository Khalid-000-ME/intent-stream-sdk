/**
 * Close All Yellow Network Channels - Cleanup Script
 * 
 * Run this if you encounter "operation denied: non-zero allocation" errors
 * or if channel creation times out due to stale channels.
 */

import {
    createAuthRequestMessage,
    createEIP712AuthMessageSigner,
    createAuthVerifyMessageFromChallenge,
    createCloseChannelMessage,
    createECDSAMessageSigner,
    NitroliteClient,
    WalletStateSigner,
} from '@erc7824/nitrolite';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import WebSocket from 'ws';

const YELLOW_WS_URL = 'wss://clearnet-sandbox.yellow.com/ws';
const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.MAIN_WALLET_PRIVATE_KEY ||
    '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';

const CUSTODY_ADDRESS = '0x019B65A265EB3363822f2752141b3dF16131b262';
const ADJUDICATOR_ADDRESS = '0x7c7ccbc98469190849BCC6c926307794fDfB11F2';

async function closeAllChannels() {
    console.log('🧹 Yellow Network Channel Cleanup\n');
    console.log('='.repeat(60) + '\n');

    // Setup
    const mainAccount = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
    const publicClient = createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC) });
    const walletClient = createWalletClient({ chain: sepolia, transport: http(SEPOLIA_RPC), account: mainAccount });

    console.log(`👤 Account: ${mainAccount.address}\n`);

    const nitroliteClient = new NitroliteClient({
        publicClient,
        walletClient,
        stateSigner: new WalletStateSigner(walletClient),
        addresses: { custody: CUSTODY_ADDRESS, adjudicator: ADJUDICATOR_ADDRESS },
        chainId: sepolia.id,
        challengeDuration: 3600n,
    });

    // Connect
    const ws = new WebSocket(YELLOW_WS_URL);
    await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
            console.log('✅ Connected to Yellow Network\n');
            resolve();
        };
        ws.onerror = () => reject(new Error('Connection failed'));
        setTimeout(() => reject(new Error('Timeout')), 10000);
    });

    // Generate session key
    const sessionPrivateKey = generatePrivateKey();
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);
    const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

    console.log(`🔑 Session Key: ${sessionAccount.address}\n`);

    // Authenticate
    console.log('🔐 Authenticating...');
    const authParams = {
        address: mainAccount.address,
        application: 'Cleanup Script',
        session_key: sessionAccount.address,
        allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
        expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
        scope: 'cleanup',
    };

    ws.send(await createAuthRequestMessage(authParams));

    const authenticated = await new Promise<boolean>((resolve) => {
        const handler = async (data: Buffer) => {
            try {
                const response = JSON.parse(data.toString());
                const type = response.res?.[1];

                if (type === 'auth_challenge') {
                    console.log('📨 Signing challenge...');
                    const challenge = response.res[2].challenge_message;
                    const signer = createEIP712AuthMessageSigner(walletClient, authParams, { name: 'Cleanup Script' });
                    ws.send(await createAuthVerifyMessageFromChallenge(signer, challenge));
                }

                if (type === 'auth_verify') {
                    console.log('✅ Authenticated\n');
                    ws.off('message', handler);
                    resolve(true);
                }
            } catch (e) {
                console.error('Auth error:', e);
            }
        };

        ws.on('message', handler);
        setTimeout(() => resolve(false), 30000);
    });

    if (!authenticated) {
        console.error('❌ Authentication failed');
        ws.close();
        return;
    }

    // Get list of channels
    console.log('📋 Fetching channel list...');
    ws.send(JSON.stringify({
        req: [1, 'get_channels', {}, Date.now()],
        sig: []
    }));

    const channels = await new Promise<any[]>((resolve) => {
        const handler = (data: Buffer) => {
            try {
                const response = JSON.parse(data.toString());
                const type = response.res?.[1];

                if (type === 'get_channels') {
                    const channelList = response.res[2]?.channels || [];
                    console.log(`✅ Found ${channelList.length} channel(s)\n`);
                    ws.off('message', handler);
                    resolve(channelList);
                }
            } catch (e) {
                console.error('Error:', e);
            }
        };

        ws.on('message', handler);
        setTimeout(() => resolve([]), 10000);
    });

    if (channels.length === 0) {
        console.log('✨ No channels to close. All clean!\n');
        ws.close();
        return;
    }

    // Close each channel
    console.log(`🔒 Closing ${channels.length} channel(s)...\n`);

    for (const channel of channels) {
        const channelId = channel.id;
        console.log(`   Closing channel: ${channelId}`);

        try {
            const closeMsg = await createCloseChannelMessage(
                sessionSigner,
                channelId,
                mainAccount.address
            );

            ws.send(closeMsg);

            const closeData = await new Promise<any>((resolve) => {
                const handler = (data: Buffer) => {
                    try {
                        const response = JSON.parse(data.toString());
                        const type = response.res?.[1];

                        if (type === 'close_channel') {
                            ws.off('message', handler);
                            resolve(response.res[2]);
                        }
                    } catch (e) {
                        console.error('Error:', e);
                    }
                };

                ws.on('message', handler);
                setTimeout(() => resolve(null), 15000);
            });

            if (closeData) {
                await nitroliteClient.closeChannel({
                    finalState: closeData.final_state,
                    stateData: closeData.state_data,
                });
                console.log(`   ✅ Closed: ${channelId}`);
            } else {
                console.log(`   ⚠️  Timeout: ${channelId}`);
            }
        } catch (error: any) {
            console.log(`   ❌ Failed: ${channelId} - ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Cleanup complete!\n');
    ws.close();
}

closeAllChannels()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    });
