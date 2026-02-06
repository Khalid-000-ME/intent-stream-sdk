// Yellow Network Client - Browser Adaptation of Official Implementation
// Based on official index.ts from Yellow Network
import {
    createECDSAMessageSigner,
    createEIP712AuthMessageSigner,
    createAuthVerifyMessageFromChallenge,
    createAuthRequestMessage,
    createGetLedgerBalancesMessage,
    createCreateChannelMessage,
    createResizeChannelMessage,
    createTransferMessage,
    createCloseChannelMessage,
} from '@erc7824/nitrolite';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

export interface YellowOfficialClientConfig {
    wsUrl?: string;
    userAddress: string;
    walletClient: any; // viem wallet client
}

export class YellowOfficialClient {
    private ws: WebSocket | null = null;
    private messageHandlers: ((message: any) => void)[] = [];
    private connected: boolean = false;
    private authenticated: boolean = false;
    private sessionPrivateKey: `0x${string}` | null = null;
    private sessionSigner: any = null;
    private sessionAddress: string | null = null;
    private userAddress: string;
    private walletClient: any;
    private activeChannelId: string | null = null;
    private wsUrl: string;
    private authParams: any = null; // Store auth params for challenge signing

    constructor(config: YellowOfficialClientConfig) {
        this.userAddress = config.userAddress;
        this.walletClient = config.walletClient;
        this.wsUrl = config.wsUrl || 'wss://clearnet-sandbox.yellow.com/ws';
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                console.log('✅ Connected to Yellow Network!');
                this.connected = true;
                resolve();
            };

            this.ws.onmessage = (event) => {
                try {
                    const response = JSON.parse(event.data);
                    console.log('📨 Received:', response);
                    this.handleMessage(response);
                    this.messageHandlers.forEach(handler => handler(response));
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('Connection error:', error);
                reject(error);
            };

            this.ws.onclose = () => {
                console.log('Connection closed');
                this.connected = false;
                this.authenticated = false;
            };
        });
    }

    private async handleMessage(response: any) {
        if (response.error) {
            console.error('❌ RPC Error:', response.error);
            return;
        }

        // Get method from response.res[1]
        const type = response.res?.[1];
        console.log('📬 Message type:', type);

        // Handle error messages
        if (type === 'error') {
            const errorData = response.res[2];
            console.error('❌ Server Error:', errorData);
            console.error('   Full error response:', JSON.stringify(response, null, 2));
            return;
        }

        // Handle auth_challenge
        if (type === 'auth_challenge' && !this.authenticated) {
            console.log('🔐 Received auth_challenge');
            await this.handleAuthChallenge(response.res[2]);
        }

        // Handle auth_verify
        if (type === 'auth_verify') {
            console.log('✅ Received auth_verify response!');
            console.log('   Full response:', JSON.stringify(response, null, 2));
            this.authenticated = true;
            const sessionKey = response.res[2]?.session_key;
            console.log('✓ Authenticated successfully');
            console.log('  Session key:', sessionKey);
        }

        // Handle ledger_balances
        if (type === 'ledger_balances') {
            console.log('💰 Ledger Balances:', response.res[2]);
        }

        // Handle channels
        if (type === 'channels') {
            console.log('📋 Channels:', response.res[2]);
        }

        // Handle create_channel
        if (type === 'create_channel') {
            console.log('✓ Channel created:', response.res[2]);
            this.activeChannelId = response.res[2].channel_id;
        }

        // Handle resize_channel
        if (type === 'resize_channel') {
            console.log('✓ Channel resized:', response.res[2]);
        }

        // Handle transfer
        if (type === 'transfer') {
            console.log('✓ Transfer complete:', response.res[2]);
        }

        // Handle close_channel
        if (type === 'close_channel') {
            console.log('✓ Channel closed:', response.res[2]);
        }
    }

    private async handleAuthChallenge(challengeData: any) {
        console.log('🔐 Handling auth challenge...');
        console.log('   Challenge data:', challengeData);

        const challenge = challengeData.challenge_message;

        if (!challenge) {
            console.error('❌ No challenge_message found in:', challengeData);
            return;
        }

        console.log('   Challenge message:', challenge);

        // Use the SAME authParams that were sent in auth_request
        if (!this.authParams) {
            console.error('❌ No authParams stored! This should not happen.');
            return;
        }

        console.log('   Using stored auth params:', this.authParams);

        try {
            // Create EIP-712 signer with MAIN wallet
            const signer = createEIP712AuthMessageSigner(
                this.walletClient,
                this.authParams,  // Use stored params!
                { name: 'Test app' }  // Must match auth_request application name
            );

            console.log('📝 Signing challenge with main wallet...');
            console.log('   (MetaMask should prompt now)');

            // Create and send verification message
            const verifyMsg = await createAuthVerifyMessageFromChallenge(
                signer,
                challenge
            );

            console.log('✅ Challenge signed successfully!');
            console.log('   Verify message:', verifyMsg);
            console.log('   Verify message (parsed):', JSON.parse(verifyMsg));
            console.log('📤 Sending auth verification...');
            this.send(verifyMsg);
            console.log('✓ Auth verification sent, waiting for response...');
        } catch (error) {
            console.error('❌ Error during challenge signing:', error);
            throw error;
        }
    }

    async authenticate(): Promise<void> {
        if (!this.connected) {
            throw new Error('Not connected. Call connect() first.');
        }

        // Generate session keypair
        this.sessionPrivateKey = generatePrivateKey();
        const sessionAccount = privateKeyToAccount(this.sessionPrivateKey);
        this.sessionAddress = sessionAccount.address;
        this.sessionSigner = createECDSAMessageSigner(this.sessionPrivateKey);

        console.log('🔑 Generated session key:', this.sessionAddress);

        // Create auth params and STORE them for challenge signing
        this.authParams = {
            session_key: this.sessionAddress as `0x${string}`,
            allowances: [{
                asset: 'ytest.usd',
                amount: '1000000000'
            }],
            expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
            scope: 'test.app',
        };

        console.log('📝 Auth params created:', this.authParams);

        // Create and send auth request
        const authRequestMsg = await createAuthRequestMessage({
            address: this.userAddress as `0x${string}`,
            application: 'Test app',  // Must match EIP-712 domain name
            ...this.authParams  // Spread the stored params
        });

        console.log('📤 Sending auth request...');
        this.send(authRequestMsg);

        // Wait for authentication
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Authentication timeout'));
            }, 30000);

            const checkAuth = () => {
                if (this.authenticated) {
                    clearTimeout(timeout);
                    resolve();
                } else {
                    setTimeout(checkAuth, 100);
                }
            };
            checkAuth();
        });
    }

    async getBalances(): Promise<any> {
        if (!this.authenticated || !this.sessionSigner) {
            throw new Error('Not authenticated');
        }

        const ledgerMsg = await createGetLedgerBalancesMessage(
            this.sessionSigner,
            this.userAddress,
            Date.now()
        );

        this.send(ledgerMsg);
    }

    async createChannel(chainId: number, token: string): Promise<void> {
        if (!this.authenticated || !this.sessionSigner) {
            throw new Error('Not authenticated');
        }

        const createChannelMsg = await createCreateChannelMessage(
            this.sessionSigner,
            {
                chain_id: chainId,
                token: token,
            }
        );

        this.send(createChannelMsg);
    }

    async resizeChannel(channelId: string, allocateAmount: bigint): Promise<void> {
        if (!this.authenticated || !this.sessionSigner) {
            throw new Error('Not authenticated');
        }

        const resizeMsg = await createResizeChannelMessage(
            this.sessionSigner,
            {
                channel_id: channelId as `0x${string}`,
                allocate_amount: allocateAmount,
                funds_destination: this.userAddress as `0x${string}`,
            }
        );

        this.send(resizeMsg);
    }

    async transfer(destination: string, asset: string, amount: string): Promise<void> {
        if (!this.authenticated || !this.sessionSigner) {
            throw new Error('Not authenticated');
        }

        const transferMsg = await createTransferMessage(
            this.sessionSigner,
            {
                destination: destination,
                allocations: [{
                    asset: asset,
                    amount: amount
                }]
            },
            Date.now()
        );

        this.send(transferMsg);
    }

    async closeChannel(channelId: string): Promise<void> {
        if (!this.authenticated || !this.sessionSigner) {
            throw new Error('Not authenticated');
        }

        const closeMsg = await createCloseChannelMessage(
            this.sessionSigner,
            channelId as `0x${string}`,
            this.userAddress as `0x${string}`
        );

        this.send(closeMsg);
    }

    onMessage(handler: (message: any) => void) {
        this.messageHandlers.push(handler);
    }

    send(message: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const messageToSend = typeof message === 'string' ? message : JSON.stringify(message);
            this.ws.send(messageToSend);
        } else {
            throw new Error('WebSocket not connected');
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.connected = false;
            this.authenticated = false;
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    isAuthenticated(): boolean {
        return this.authenticated;
    }

    getActiveChannelId(): string | null {
        return this.activeChannelId;
    }
}
