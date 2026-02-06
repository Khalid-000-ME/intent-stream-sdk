/**
 * Yellow Network Debug Script
 * 
 * This script adds extensive logging to debug the channel creation flow
 */

import {
    createAuthRequestMessage,
    createEIP712AuthMessageSigner,
    createAuthVerifyMessageFromChallenge,
    createGetLedgerBalancesMessage,
    createCreateChannelMessage,
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
const YTEST_USD_TOKEN = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

async function debugYellowFlow() {
    console.log('🔍 Yellow Network Debug Session\n');
    console.log('='.repeat(60) + '\n');

    // Setup
    const mainAccount = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
    const publicClient = createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC) });
    const walletClient = createWalletClient({ chain: sepolia, transport: http(SEPOLIA_RPC), account: mainAccount });

    console.log(`👤 Main Account: ${mainAccount.address}`);

    const nitroliteClient = new NitroliteClient({
        publicClient,
        walletClient,
        stateSigner: new WalletStateSigner(walletClient),
        addresses: { custody: CUSTODY_ADDRESS, adjudicator: ADJUDICATOR_ADDRESS },
        chainId: sepolia.id,
        challengeDuration: 3600n,
    });

    // Session key
    const sessionPrivateKey = generatePrivateKey();
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);
    const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

    console.log(`🔑 Session Key: ${sessionAccount.address}\n`);

    // Connect
    const ws = new WebSocket(YELLOW_WS_URL);

    // Log ALL messages
    ws.on('message', (data: Buffer) => {
        try {
            const response = JSON.parse(data.toString());
            console.log('\n📨 RECEIVED MESSAGE:');
            console.log(JSON.stringify(response, null, 2));
        } catch (e) {
            console.log('\n📨 RECEIVED (non-JSON):', data.toString());
        }
    });

    await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
            console.log('✅ Connected to Yellow Network\n');
            resolve();
        };
        ws.onerror = () => reject(new Error('Connection failed'));
        setTimeout(() => reject(new Error('Timeout')), 10000);
    });

    // Authenticate
    console.log('🔐 Starting authentication...\n');
    const authParams = {
        address: mainAccount.address,
        application: 'Debug Script',
        session_key: sessionAccount.address,
        allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
        expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
        scope: 'debug',
    };

    const authRequestMsg = await createAuthRequestMessage(authParams);
    console.log('📤 SENDING AUTH REQUEST:');
    console.log(authRequestMsg.substring(0, 200) + '...\n');
    ws.send(authRequestMsg);

    // Wait for auth_verify
    await new Promise<void>((resolve) => {
        const handler = async (data: Buffer) => {
            try {
                const response = JSON.parse(data.toString());
                const type = response.res?.[1];

                if (type === 'auth_challenge') {
                    console.log('\n🔐 Received challenge, signing...\n');
                    const challenge = response.res[2].challenge_message;
                    const signer = createEIP712AuthMessageSigner(walletClient, authParams, { name: 'Debug Script' });
                    const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge);
                    console.log('📤 SENDING AUTH VERIFY:');
                    console.log(verifyMsg.substring(0, 200) + '...\n');
                    ws.send(verifyMsg);
                }

                if (type === 'auth_verify') {
                    console.log('\n✅ Authentication successful!\n');
                    ws.off('message', handler);
                    resolve();
                }
            } catch (e) {
                console.error('Auth error:', e);
            }
        };

        ws.on('message', handler);
        setTimeout(() => resolve(), 30000);
    });

    // Get balances
    console.log('📊 Fetching ledger balances...\n');
    const balancesMsg = await createGetLedgerBalancesMessage(sessionSigner);
    console.log('📤 SENDING GET_LEDGER_BALANCES:');
    console.log(balancesMsg.substring(0, 200) + '...\n');
    ws.send(balancesMsg);

    await new Promise(r => setTimeout(r, 3000));

    // Try to create channel
    console.log('\n📝 Creating payment channel...\n');
    const createChannelMsg = await createCreateChannelMessage(
        sessionSigner,
        {
            chain_id: sepolia.id,
            token: YTEST_USD_TOKEN,
        }
    );

    console.log('📤 SENDING CREATE_CHANNEL:');
    console.log(createChannelMsg.substring(0, 500) + '...\n');
    ws.send(createChannelMsg);

    // Wait for response
    console.log('⏳ Waiting for create_channel response...\n');
    await new Promise(r => setTimeout(r, 20000));

    console.log('\n' + '='.repeat(60));
    console.log('🏁 Debug session complete\n');
    ws.close();
}

debugYellowFlow()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Debug failed:', error);
        process.exit(1);
    });
