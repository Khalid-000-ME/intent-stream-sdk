// Yellow Network Client for Browser
export class YellowNetworkClient {
    private ws: WebSocket | null = null;
    private messageHandlers: ((message: any) => void)[] = [];
    private connected: boolean = false;

    constructor(private wsUrl: string = 'wss://clearnet-sandbox.yellow.com/ws') { }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                console.log('✅ Connected to Yellow Network!');
                this.connected = true;
                resolve();
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('📨 Received:', message);
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

    onMessage(handler: (message: any) => void) {
        this.messageHandlers.push(handler);
    }

    send(message: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // If message is already a string, send as-is, otherwise stringify
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
}

// MetaMask Wallet Integration
export async function setupMessageSigner() {
    if (typeof window === 'undefined') {
        throw new Error('This function can only be called in the browser');
    }

    if (!(window as any).ethereum) {
        throw new Error('Please install MetaMask');
    }

    // Request wallet connection
    const accounts = await (window as any).ethereum.request({
        method: 'eth_requestAccounts'
    });

    const userAddress = accounts[0];

    // Create message signer function
    const messageSigner = async (message: string) => {
        return await (window as any).ethereum.request({
            method: 'personal_sign',
            params: [message, userAddress]
        });
    };

    console.log('✅ Wallet connected:', userAddress);
    return { userAddress, messageSigner };
}

// Check if MetaMask is installed
export function isMetaMaskInstalled(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window as any).ethereum;
}

// Payment Session Types
export interface AppDefinition {
    protocol: string;
    participants: string[];
    weights: number[];
    quorum: number;
    challenge: number;
    nonce: number;
}

export interface Allocation {
    participant: string;
    asset: string;
    amount: string;
}

export interface PaymentSessionParams {
    userAddress: string;
    partnerAddress: string;
    userAmount?: string;
    partnerAmount?: string;
    asset?: string;
}

export interface PaymentSessionResult {
    appDefinition: AppDefinition;
    allocations: Allocation[];
    sessionMessage: any;
}

// Create Payment Session
export async function createPaymentSession(
    messageSigner: (message: string) => Promise<string>,
    params: PaymentSessionParams
): Promise<PaymentSessionResult> {
    const {
        userAddress,
        partnerAddress,
        userAmount = '800000', // 0.8 USDC (6 decimals)
        partnerAmount = '200000', // 0.2 USDC
        asset = 'usdc'
    } = params;

    // Define your payment application
    const appDefinition: AppDefinition = {
        protocol: 'payment-app-v1',
        participants: [userAddress, partnerAddress],
        weights: [50, 50], // Equal participation
        quorum: 100, // Both participants must agree
        challenge: 0,
        nonce: Date.now()
    };

    // Initial balances (1 USDC = 1,000,000 units with 6 decimals)
    const allocations: Allocation[] = [
        { participant: userAddress, asset, amount: userAmount },
        { participant: partnerAddress, asset, amount: partnerAmount }
    ];

    console.log('✅ Payment session created!');

    return { appDefinition, allocations, sessionMessage: { appDefinition, allocations } };
}
