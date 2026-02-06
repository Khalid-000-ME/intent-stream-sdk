/**
 * Yellow Network State Management Script - CORRECTED
 * 
 * Based on official Yellow Network documentation (setup-yellow.md)
 * 
 * Prerequisites:
 * 1. Request test tokens from faucet:
 *    curl -XPOST https://clearnet-sandbox.yellow.com/faucet/requestTokens \
 *      -H "Content-Type: application/json" \
 *      -d '{"userAddress":"YOUR_ADDRESS"}'
 * 
 * 2. Set environment variable:
 *    export PRIVATE_KEY="0x..."
 */

import {
    createAuthRequestMessage,
    createEIP712AuthMessageSigner,
    createAuthVerifyMessageFromChallenge,
    createGetLedgerBalancesMessage,
    createCreateChannelMessage,
    createResizeChannelMessage,
    createTransferMessage,
    createCloseChannelMessage,
    createECDSAMessageSigner,
    NitroliteClient,
    WalletStateSigner,
} from '@erc7824/nitrolite';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import WebSocket from 'ws';

// Configuration
const YELLOW_WS_URL = 'wss://clearnet-sandbox.yellow.com/ws';
const YELLOW_FAUCET_URL = 'https://clearnet-sandbox.yellow.com/faucet/requestTokens';
const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.MAIN_WALLET_PRIVATE_KEY ||
    '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';

// Yellow Network contract addresses (Sepolia)
const CUSTODY_ADDRESS = '0x019B65A265EB3363822f2752141b3dF16131b262';
const ADJUDICATOR_ADDRESS = '0x7c7ccbc98469190849BCC6c926307794fDfB11F2';
// CORRECTED: Use the actual token address from Yellow Network server response
const YTEST_USD_TOKEN = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb';

// Funding amounts
const INITIAL_ALLOCATION = 1000000n; // Allocate from Unified Balance
const MIN_BALANCE_THRESHOLD = 100000n;
const RESIZE_ALLOCATION = 500000n;

interface YellowSession {
    ws: WebSocket;
    sessionAddress: string;
    sessionPrivateKey: `0x${string}`;
    sessionSigner: any;
    mainAccount: any;
    walletClient: any;
    publicClient: any;
    nitroliteClient: NitroliteClient;
    authenticated: boolean;
    channelId: string | null;
    channelBalance: bigint;
    authParams: any;
}

/**
 * Request test tokens from Yellow Network faucet
 */
async function requestFaucetTokens(address: string): Promise<boolean> {
    console.log(`💰 Requesting test tokens from faucet for ${address}...`);

    try {
        const response = await fetch(YELLOW_FAUCET_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userAddress: address })
        });

        if (response.ok) {
            console.log('✅ Faucet request successful! Tokens will arrive in your Unified Balance.');
            return true;
        } else {
            const error = await response.text();
            console.log(`⚠️  Faucet response: ${error}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Faucet request failed:', error);
        return false;
    }
}

/**
 * Initialize Yellow Network session
 */
async function initializeYellowSession(): Promise<YellowSession> {
    console.log('🔄 Initializing Yellow Network Session...\n');

    // Setup wallet clients
    const mainAccount = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(SEPOLIA_RPC)
    });
    const walletClient = createWalletClient({
        chain: sepolia,
        transport: http(SEPOLIA_RPC),
        account: mainAccount
    });

    console.log(`👤 Main Account: ${mainAccount.address}`);

    // Initialize Nitrolite Client
    const nitroliteClient = new NitroliteClient({
        publicClient,
        walletClient,
        stateSigner: new WalletStateSigner(walletClient),
        addresses: {
            custody: CUSTODY_ADDRESS,
            adjudicator: ADJUDICATOR_ADDRESS,
        },
        chainId: sepolia.id,
        challengeDuration: 3600n,
    });

    // Generate session key (temporary key for this session)
    const sessionPrivateKey = generatePrivateKey();
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);
    const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

    console.log(`🔑 Session Key: ${sessionAccount.address}\n`);

    // Connect to WebSocket
    const ws = new WebSocket(YELLOW_WS_URL);
    await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
            console.log('✅ Connected to Yellow Network WebSocket\n');
            resolve();
        };
        ws.onerror = (err) => reject(new Error('WebSocket connection failed'));
        setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });

    const session: YellowSession = {
        ws,
        sessionAddress: sessionAccount.address,
        sessionPrivateKey,
        sessionSigner,
        mainAccount,
        walletClient,
        publicClient,
        nitroliteClient,
        authenticated: false,
        channelId: null,
        channelBalance: 0n,
        authParams: null
    };

    return session;
}

/**
 * Authenticate with Yellow Network
 */
async function authenticateSession(session: YellowSession): Promise<boolean> {
    console.log('🔐 Authenticating with Yellow Network...');

    const authParams = {
        address: session.mainAccount.address,
        application: 'Intent Stream SDK',
        session_key: session.sessionAddress,
        allowances: [{
            asset: 'ytest.usd',
            amount: INITIAL_ALLOCATION.toString()
        }],
        expires_at: BigInt(Math.floor(Date.now() / 1000) + 7200), // 2 hours
        scope: 'test.app',
    };

    // Store for later use in challenge response
    session.authParams = authParams;

    // Send auth request
    const authRequestMsg = await createAuthRequestMessage(authParams);
    session.ws.send(authRequestMsg);

    // Handle auth challenge/verify flow
    const authResult = await new Promise<boolean>((resolve) => {
        const messageHandler = async (data: Buffer) => {
            try {
                const response = JSON.parse(data.toString());
                const type = response.res?.[1];

                if (type === 'auth_challenge') {
                    console.log('📨 Received auth challenge, signing with main wallet...');
                    const challenge = response.res[2].challenge_message;

                    // IMPORTANT: Sign with MAIN wallet (not session key)
                    const signer = createEIP712AuthMessageSigner(
                        session.walletClient,
                        authParams,
                        { name: 'Intent Stream SDK' }
                    );
                    const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge);
                    session.ws.send(verifyMsg);
                }

                if (type === 'auth_verify') {
                    console.log('✅ Authentication successful!\n');
                    session.ws.off('message', messageHandler);
                    resolve(true);
                }
            } catch (e) {
                console.error('Auth error:', e);
            }
        };

        session.ws.on('message', messageHandler);
        setTimeout(() => {
            console.log('⏱️  Auth timeout');
            resolve(false);
        }, 30000);
    });

    session.authenticated = authResult;
    return authResult;
}

/**
 * Get ledger balances (Unified Balance)
 */
async function getLedgerBalances(session: YellowSession): Promise<any> {
    console.log('📊 Fetching ledger balances...');

    try {
        // Pass session signer to the message creation function
        const balancesMsg = await createGetLedgerBalancesMessage(session.sessionSigner);
        session.ws.send(balancesMsg);

        const balances = await new Promise<any>((resolve) => {
            const messageHandler = (data: Buffer) => {
                try {
                    const response = JSON.parse(data.toString());
                    const type = response.res?.[1];

                    if (type === 'ledger_balances') {
                        const balanceData = response.res[2];
                        console.log('✅ Balances:', JSON.stringify(balanceData, null, 2));
                        session.ws.off('message', messageHandler);
                        resolve(balanceData);
                    }
                } catch (e) {
                    console.error('Balance fetch error:', e);
                }
            };

            session.ws.on('message', messageHandler);
            setTimeout(() => resolve(null), 10000);
        });

        return balances;
    } catch (error) {
        console.error('❌ Failed to get balances:', error);
        return null;
    }
}

/**
 * Create a payment channel
 */
async function createChannel(session: YellowSession): Promise<string | null> {
    if (!session.authenticated) {
        console.error('❌ Session not authenticated');
        return null;
    }

    console.log('📝 Creating payment channel...');

    try {
        // IMPORTANT: Sign with SESSION key (not main wallet)
        const createChannelMsg = await createCreateChannelMessage(
            session.sessionSigner,
            {
                chain_id: sepolia.id,
                token: YTEST_USD_TOKEN,
            }
        );

        session.ws.send(createChannelMsg);

        // Wait for create_channel response
        const channelData = await new Promise<any>((resolve) => {
            const messageHandler = (data: Buffer) => {
                try {
                    const response = JSON.parse(data.toString());
                    const type = response.res?.[1];

                    if (type === 'create_channel') {
                        console.log('📨 Received channel creation data from server');
                        session.ws.off('message', messageHandler);
                        resolve(response.res[2]);
                    }
                } catch (e) {
                    console.error('Channel creation error:', e);
                }
            };

            session.ws.on('message', messageHandler);
            setTimeout(() => resolve(null), 15000);
        });

        if (!channelData) {
            console.error('❌ No response from server');
            return null;
        }

        // Debug: Log the FULL channel data structure
        console.log('📋 Full Channel Response from Server:');
        console.log(JSON.stringify(channelData, null, 2));
        console.log();

        // Transform the server response to match Nitrolite SDK expected format
        // Server returns: { channel_id, channel, state, server_signature }
        // SDK expects: { channel: { id, ...}, unsignedInitialState, serverSignature }

        const transformedData = {
            channel: {
                ...channelData.channel,
                id: channelData.channel_id
            },
            unsignedInitialState: {
            intent: channelData.state.intent,
            version: BigInt(channelData.state.version),
            data: channelData.state.state_data,
            allocations: channelData.state.allocations.map((alloc: any) => ({
                destination: alloc.destination,
                token: alloc.token,
                amount: BigInt(alloc.amount)
            }))
        },
            serverSignature: channelData.server_signature
        };

        console.log('📋 Transformed Data for SDK:');
        console.log(`   Channel ID: ${transformedData.channel.id}`);
        console.log(`   Has unsignedInitialState: ${!!transformedData.unsignedInitialState}`);
        console.log(`   Has serverSignature: ${!!transformedData.serverSignature}`);
        console.log();

        // Submit to blockchain
        console.log('⛓️  Submitting channel creation to blockchain...');
        try {
            const createResult = await session.nitroliteClient.createChannel({
                channel: transformedData.channel,
                unsignedInitialState: transformedData.unsignedInitialState,
                serverSignature: transformedData.serverSignature,
            });

            console.log('✅ Channel created on-chain!');
            console.log(`   Channel ID: ${transformedData.channel.id}`);
            console.log(`   Tx Hash: ${createResult}`);

            session.channelId = transformedData.channel.id;
            return transformedData.channel.id;
        } catch (blockchainError: any) {
            console.error('❌ Blockchain submission error:');
            console.error(`   Message: ${blockchainError.message}`);
            console.error(`   Details: ${blockchainError.details || 'N/A'}`);
            console.error(`   Data: ${blockchainError.data || 'N/A'}`);

            // Log the full error object for debugging
            console.error('\\n📋 Full Error Object:');
            console.error(JSON.stringify(blockchainError, null, 2));

            throw blockchainError;
        }

    } catch (error: any) {
        console.error('❌ Channel creation failed:', error.message || error);
        return null;
    }
}

/**
 * Fund channel by allocating from Unified Balance
 */
async function fundChannel(session: YellowSession, amount: bigint): Promise<boolean> {
    if (!session.channelId) {
        console.error('❌ No active channel');
        return false;
    }

    console.log(`💰 Funding channel with ${amount} from Unified Balance...`);

    try {
        // IMPORTANT: Use allocate_amount (NOT resize_amount)
        // This moves funds from Unified Balance -> Channel
        const resizeMsg = await createResizeChannelMessage(
            session.sessionSigner,
            {
                channel_id: session.channelId,
                allocate_amount: amount, // From Unified Balance
                funds_destination: session.mainAccount.address,
            }
        );

        session.ws.send(resizeMsg);

        // Wait for resize response
        const resizeData = await new Promise<any>((resolve) => {
            const messageHandler = (data: Buffer) => {
                try {
                    const response = JSON.parse(data.toString());
                    const type = response.res?.[1];

                    if (type === 'resize_channel') {
                        console.log('📨 Received resize data from server');
                        session.ws.off('message', messageHandler);
                        resolve(response.res[2]);
                    }
                } catch (e) {
                    console.error('Resize error:', e);
                }
            };

            session.ws.on('message', messageHandler);
            setTimeout(() => resolve(null), 15000);
        });

        if (!resizeData) {
            console.error('❌ No resize response from server');
            return false;
        }

        // Submit to blockchain
        console.log('⛓️  Submitting resize to blockchain...');
        await session.nitroliteClient.resizeChannel({
            resizeState: resizeData.resize_state,
            proofStates: resizeData.proof_states,
        });

        session.channelBalance += amount;
        console.log('✅ Channel funded successfully!');
        console.log(`   New Balance: ${session.channelBalance}\n`);

        return true;

    } catch (error: any) {
        console.error('❌ Channel funding failed:', error.message || error);
        return false;
    }
}

/**
 * Close channel
 */
async function closeChannel(session: YellowSession): Promise<boolean> {
    if (!session.channelId) {
        console.error('❌ No active channel to close');
        return false;
    }

    console.log(`🔒 Closing channel ${session.channelId}...`);

    try {
        const closeMsg = await createCloseChannelMessage(
            session.sessionSigner,
            session.channelId,
            session.mainAccount.address
        );

        session.ws.send(closeMsg);

        const closeData = await new Promise<any>((resolve) => {
            const messageHandler = (data: Buffer) => {
                try {
                    const response = JSON.parse(data.toString());
                    const type = response.res?.[1];

                    if (type === 'close_channel') {
                        console.log('📨 Received close data from server');
                        session.ws.off('message', messageHandler);
                        resolve(response.res[2]);
                    }
                } catch (e) {
                    console.error('Close error:', e);
                }
            };

            session.ws.on('message', messageHandler);
            setTimeout(() => resolve(null), 15000);
        });

        if (!closeData) {
            console.error('❌ No close response from server');
            return false;
        }

        // Submit to blockchain
        console.log('⛓️  Submitting channel closure to blockchain...');
        await session.nitroliteClient.closeChannel({
            finalState: closeData.final_state,
            stateData: closeData.state_data,
        });

        console.log('✅ Channel closed successfully!\n');
        session.channelId = null;
        session.channelBalance = 0n;

        return true;

    } catch (error: any) {
        console.error('❌ Channel close failed:', error.message || error);
        return false;
    }
}

/**
 * Main demonstration
 */
async function demonstrateStateManagement() {
    console.log('🚀 Yellow Network State Management Demo\n');
    console.log('='.repeat(60) + '\n');

    let session: YellowSession | null = null;

    try {
        // Step 1: Initialize
        session = await initializeYellowSession();

        // Step 2: Request faucet tokens (if needed)
        console.log('💧 Checking faucet...');
        await requestFaucetTokens(session.mainAccount.address);
        console.log('⏳ Waiting 5 seconds for tokens to arrive...\n');
        await new Promise(r => setTimeout(r, 5000));

        // Step 3: Authenticate
        const authenticated = await authenticateSession(session);
        if (!authenticated) {
            throw new Error('Authentication failed');
        }

        // Step 4: Check balances
        await getLedgerBalances(session);
        console.log();

        // Step 5: Create channel
        const channelId = await createChannel(session);
        if (!channelId) {
            throw new Error('Channel creation failed');
        }
        console.log();

        // Step 6: Fund channel
        const funded = await fundChannel(session, INITIAL_ALLOCATION);
        if (!funded) {
            throw new Error('Channel funding failed');
        }

        // Step 7: Check balances again
        await getLedgerBalances(session);
        console.log();

        // Step 8: Close channel
        await closeChannel(session);

        console.log('='.repeat(60));
        console.log('✅ Demo completed successfully!\n');

    } catch (error: any) {
        console.log('='.repeat(60));
        console.error('\n❌ Demo failed:', error.message || error);
        console.log('\n💡 Troubleshooting:');
        console.log('   1. Ensure you have test tokens from the faucet');
        console.log('   2. Check that PRIVATE_KEY is set correctly');
        console.log('   3. If you have stale channels, run: npx tsx close_all.ts');
        console.log();
    } finally {
        // Cleanup
        if (session?.ws) {
            session.ws.close();
            console.log('🔌 WebSocket connection closed\n');
        }
    }
}

// Run if executed directly
if (require.main === module) {
    demonstrateStateManagement()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export {
    initializeYellowSession,
    authenticateSession,
    createChannel,
    fundChannel,
    closeChannel,
    getLedgerBalances,
    requestFaucetTokens,
    YellowSession
};
