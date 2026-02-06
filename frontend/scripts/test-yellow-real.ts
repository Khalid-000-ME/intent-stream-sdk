import {
    NitroliteClient,
    WalletStateSigner,
    createECDSAMessageSigner,
    createAuthRequestMessage,
    createEIP712AuthMessageSigner,
    createAuthVerifyMessageFromChallenge
} from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import WebSocket from 'ws';
import 'dotenv/config';

// CONFIGURATION
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';
const RPC_URL = process.env.ALCHEMY_RPC_URL || 'https://1rpc.io/sepolia';

async function main() {
    console.log(`
██╗   ██╗███████╗██╗     ██╗      ██████╗ ██╗    ██╗
╚██╗ ██╔╝██╔════╝██║     ██║     ██╔═══██╗██║    ██║
 ╚████╔╝ █████╗  ██║     ██║     ██║   ██║██║ █╗ ██║
  ╚██╔╝  ██╔══╝  ██║     ██║     ██║   ██║██║███╗██║
   ██║   ███████╗███████╗███████╗╚██████╔╝╚███╔███╔╝
   ╚═╝   ╚══════╝╚══════╝╚══════╝ ╚═════╝  ╚══╝╚══╝
    YELLOW NETWORK REAL INTEGRATION TEST
`);

    console.log('1️⃣  Initializing Clients...');
    const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
    console.log(`   Wallet: ${account.address}`);

    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(RPC_URL)
    });

    const walletClient = createWalletClient({
        chain: sepolia,
        transport: http(RPC_URL),
        account
    });

    // Initialize Nitrolite Client
    const client = new NitroliteClient({
        publicClient,
        walletClient,
        stateSigner: new WalletStateSigner(walletClient),
        addresses: {
            // Sepolia Addresses from Guide
            custody: '0x019B65A265EB3363822f2752141b3dF16131b262',
            adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2',
        },
        chainId: sepolia.id, // Expects number, not BigInt
        challengeDuration: BigInt(3600),
    });

    console.log('2️⃣  Connecting to Yellow Sandbox Node...');
    const ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');

    await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
            console.log('   ✅ Connected to WebSocket');
            resolve();
        };
        ws.onerror = (err) => {
            console.error('   ❌ Connection Failed', err);
            reject(err);
        };
    });

    // 3. Authentication
    console.log('\n3️⃣  Authenticating...');
    const sessionPrivateKey = generatePrivateKey();
    const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);
    console.log(`   Session Key: ${sessionAccount.address}`);

    const authParams = {
        address: account.address,
        application: 'Intent Stream SDK',
        session_key: sessionAccount.address,
        allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
        expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour
        scope: 'test.app',
    };

    const authRequestMsg = await createAuthRequestMessage(authParams);

    // Send Auth Request
    ws.send(authRequestMsg);
    console.log('   📤 Sent Auth Request');

    // Handle Challenge Response Loop
    await new Promise<void>((resolve, reject) => {
        ws.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data.toString());
                const type = data.res?.[1];

                if (type === 'auth_challenge') {
                    console.log('   📩 Received Auth Challenge');
                    const challenge = data.res[2].challenge_message;

                    // Sign with MAIN wallet (EIP-712)
                    const signer = createEIP712AuthMessageSigner(
                        walletClient,
                        authParams,
                        { name: 'Intent Stream SDK' }
                    );

                    const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge);
                    ws.send(verifyMsg);
                    console.log('   📤 Sent Auth Verification');
                }
                else if (type === 'auth_verify') {
                    console.log('   ✅ Authentication Successful!');
                    resolve();
                }
                else if (data.error) {
                    console.error('   ❌ Auth Error:', data.error);
                    reject(new Error(data.error));
                }
            } catch (error) {
                console.error('Message Parse Error:', error);
            }
        };
    });

    // 4. Clean Up
    console.log('\n4️⃣  Closing Connection...');
    ws.close();
    console.log('   ✅ Done.');
}

main().catch(console.error);
