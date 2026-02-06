// Simple Yellow Network Client (No Authentication)
// Based on official Yellow Network Quickstart Guide
import {
    createAppSessionMessage,
    parseRPCResponse,
    createECDSAMessageSigner
} from '@erc7824/nitrolite';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

export interface PaymentSessionParams {
    userAddress: string;
    partnerAddress: string;
    userAmount: string;  // in units (6 decimals for USDC)
    partnerAmount: string;
}

export class YellowSimpleClient {
    private ws: WebSocket | null = null;
    private messageHandlers: ((message: any) => void)[] = [];
    private connected: boolean = false;
    private sessionId: string | null = null;
    private messageSigner: any = null;
    private userAddress: string | null = null;

    constructor(private wsUrl: string = 'wss://clearnet-sandbox.yellow.com/ws') { }

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
                    const message = parseRPCResponse(event.data);
                    console.log('📨 Received:', message);
                    this.handleMessage(message);
                    this.messageHandlers.forEach(handler => handler(message));
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
            };
        });
    }

    private handleMessage(message: any) {
        const type = message.type || message.method;

        if (type === 'session_ready') {
            this.sessionId = message.sessionId;
            console.log('✅ Session ready:', this.sessionId);
        } else if (type === 'payment') {
            console.log('💰 Payment received:', message.amount);
        }
    }

    async setupWallet(userAddress: string): Promise<void> {
        this.userAddress = userAddress;

        // Generate a message signer (using a temporary key for demo)
        // In production, this should use the user's actual wallet
        const privateKey = generatePrivateKey();
        this.messageSigner = createECDSAMessageSigner(privateKey);

        console.log('🔑 Wallet setup complete for:', userAddress);
    }

    async createPaymentSession(params: PaymentSessionParams): Promise<any> {
        if (!this.connected) {
            throw new Error('Not connected to Yellow Network');
        }

        if (!this.messageSigner) {
            throw new Error('Wallet not set up. Call setupWallet() first.');
        }

        // App definition
        const appDefinition = {
            protocol: 'simple_payment_v1',
            participants: [params.userAddress, params.partnerAddress],
            quorum: 100, // Both participants must agree
            challenge: 0,
            nonce: Date.now()
        };

        // Initial allocations (amounts in units with 6 decimals)
        const allocations = [
            { participant: params.userAddress, asset: 'ytest.usd', amount: params.userAmount },
            { participant: params.partnerAddress, asset: 'ytest.usd', amount: params.partnerAmount }
        ];

        console.log('Creating payment session with:', { appDefinition, allocations });

        // Create signed session message
        const sessionMessage = await createAppSessionMessage(
            this.messageSigner,
            { definition: appDefinition as any, allocations: allocations as any }
        );

        console.log('📤 Sending session message...');
        this.send(sessionMessage);

        return { appDefinition, allocations, sessionMessage };
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
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    getSessionId(): string | null {
        return this.sessionId;
    }
}
