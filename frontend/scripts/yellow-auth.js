import {
    createAuthRequestMessage,
    createEIP712AuthMessageSigner,
    createAuthVerifyMessageFromChallenge,
    createECDSAMessageSigner,
} from '@erc7824/nitrolite';
import { createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import WebSocket from 'ws';

// Your wallet private key
const PRIVATE_KEY = '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';

// Setup main wallet
const account = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({
    chain: sepolia,
    transport: http('https://eth-sepolia.g.alchemy.com/v2/demo'),
    account
});

console.log('🔑 Main wallet address:', account.address);

// Generate temporary session key
const sessionPrivateKey = generatePrivateKey();
const sessionAccount = privateKeyToAccount(sessionPrivateKey);
const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

console.log('🔑 Session key address:', sessionAccount.address);

// Auth params (same for both auth_request and signing)
const authParams = {
    session_key: sessionAccount.address,
    allowances: [{
        asset: 'ytest.usd',
        amount: '1000000000'
    }],
    expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
    scope: 'test.app',
};

console.log('📝 Auth params:', {
    ...authParams,
    expires_at: authParams.expires_at.toString()
});

// Connect to Yellow Network Sandbox
const ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');

ws.on('open', async () => {
    console.log('✅ Connected to Yellow Network Sandbox');

    // Send auth request
    const authRequestMsg = await createAuthRequestMessage({
        address: account.address,
        application: 'Test app',
        ...authParams
    });

    console.log('📤 Sending auth_request...');
    ws.send(authRequestMsg);
});

ws.on('message', async (data) => {
    try {
        const response = JSON.parse(data.toString());
        const type = response.res?.[1];

        console.log('📨 Received message type:', type);

        if (type === 'auth_challenge') {
            const challenge = response.res[2].challenge_message;
            console.log('🔐 Received challenge:', challenge);

            // Create EIP-712 signer with MAIN wallet
            console.log('📝 Creating EIP-712 signer...');
            const signer = createEIP712AuthMessageSigner(
                walletClient,
                authParams,
                { name: 'Test app' }
            );

            console.log('✍️  Signing challenge...');
            const verifyMsg = await createAuthVerifyMessageFromChallenge(
                signer,
                challenge
            );

            console.log('📤 Sending auth_verify...');
            console.log('   Message:', verifyMsg);
            ws.send(verifyMsg);
        }

        if (type === 'auth_verify') {
            console.log('✅ AUTHENTICATION SUCCESSFUL!');
            console.log('   Response:', response.res[2]);
            process.exit(0);
        }

        if (type === 'error') {
            console.error('❌ Error:', response.res[2]);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Message parsing error:', error);
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    process.exit(1);
});

ws.on('close', () => {
    console.log('👋 Connection closed');
});

// Timeout after 30 seconds
setTimeout(() => {
    console.error('❌ Timeout - authentication took too long');
    process.exit(1);
}, 30000);
