// Full Yellow Network Client with Authentication
import {
    createAuthRequestMessage,
    createAuthVerifyMessageFromChallenge,
    createEIP712AuthMessageSigner,
    createECDSAMessageSigner,
    createGetLedgerBalancesMessage,
    parseAnyRPCResponse,
    createAppSessionMessage
} from '@erc7824/nitrolite';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

export interface YellowAuthParams {
    userAddress: string;
    application?: string;
    scope?: string;
}

export interface YellowBalance {
    asset: string;
    amount: string;
}

export class YellowNetworkAuthClient {
    private ws: WebSocket | null = null;
    private messageHandlers: ((message: any) => void)[] = [];
    private connected: boolean = false;
    private authenticated: boolean = false;
    private sessionPrivateKey: `0x${string}` | null = null;
    private sessionSigner: any = null;
    private sessionAddress: string | null = null;
    private pendingAuthResolve: ((value: boolean) => void) | null = null;
    private balances: YellowBalance[] = [];

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
                    console.log('📨 Raw message:', event.data);
                    const message = parseAnyRPCResponse(event.data);
                    console.log('📨 Parsed message:', message);
                    this.handleMessage(message);
                    this.messageHandlers.forEach(handler => handler(message));
                } catch (error) {
                    console.error('Error parsing message:', error);
                    // Try parsing as plain JSON if parseAnyRPCResponse fails
                    try {
                        const jsonMessage = JSON.parse(event.data);
                        console.log('📨 Fallback JSON parse:', jsonMessage);
                        this.handleMessage(jsonMessage);
                        this.messageHandlers.forEach(handler => handler(jsonMessage));
                    } catch (jsonError) {
                        console.error('Failed to parse as JSON too:', jsonError);
                    }
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

    private handleMessage(message: any) {
        const method = message.method;

        // Handle authentication challenge
        if (method === 'auth_challenge') {
            console.log('🔐 Received auth challenge');
            // Store challenge for verification
            (this as any).pendingChallenge = message.params?.challenge_message;
        }

        // Handle authentication success
        if (method === 'auth_verify') {
            console.log('✅ Authentication successful!');
            this.authenticated = true;
            if (this.pendingAuthResolve) {
                this.pendingAuthResolve(true);
                this.pendingAuthResolve = null;
            }
        }

        // Handle balance response
        if (method === 'ledger_balances') {
            console.log('💰 Received balances');
            this.balances = message.params?.balances || [];
        }
    }

    async authenticate(params: YellowAuthParams): Promise<boolean> {
        if (!this.connected) {
            throw new Error('Not connected to Yellow Network');
        }

        if (typeof window === 'undefined' || !(window as any).ethereum) {
            throw new Error('MetaMask not available');
        }

        return new Promise(async (resolve, reject) => {
            let authHandlerRemoved = false;
            let challengeHandlerRef: ((message: any) => void) | null = null;

            const removeAuthHandler = () => {
                if (!authHandlerRemoved && challengeHandlerRef) {
                    this.messageHandlers = this.messageHandlers.filter(handler => handler !== challengeHandlerRef);
                    authHandlerRemoved = true;
                }
            };

            try {
                // Generate temporary session key
                this.sessionPrivateKey = generatePrivateKey();
                this.sessionSigner = createECDSAMessageSigner(this.sessionPrivateKey);
                const sessionAccount = privateKeyToAccount(this.sessionPrivateKey);
                this.sessionAddress = sessionAccount.address;

                console.log('🔑 Generated session key:', this.sessionAddress);

                // Set up challenge handler
                const challengeHandler = async (message: any) => {
                    console.log('🔍 Challenge handler received message:', message);

                    // Check if this is an auth_challenge by method
                    const isAuthChallenge = message.method === 'auth_challenge'
                        || (Array.isArray(message.result) && message.result[0] === 'auth_challenge')
                        || message.type === 'auth_challenge';

                    if (isAuthChallenge) {
                        console.log('🔐 Received challenge, full message:', JSON.stringify(message, null, 2));

                        try {
                            // Log the params to see what's inside
                            console.log('Message params:', message.params);
                            console.log('Params type:', typeof message.params);
                            console.log('Params keys:', message.params ? Object.keys(message.params) : 'params is null/undefined');

                            // Try different ways to extract the challenge
                            let challenge = message.params?.challenge_message
                                || message.params?.challenge
                                || message.params // The entire params might be the challenge
                                || message.result?.challenge_message
                                || message.result?.challenge
                                || (Array.isArray(message.result) && message.result[2]?.challenge_message)
                                || (Array.isArray(message.result) && message.result[1]?.challenge_message)
                                || message.challenge_message
                                || message.challenge;

                            console.log('Extracted challenge:', challenge);

                            if (!challenge) {
                                console.error('Could not find challenge in message:', message);
                                console.error('Message keys:', Object.keys(message));
                                console.error('Message type:', typeof message);
                                removeAuthHandler();
                                reject(new Error('Invalid challenge format - check console for details'));
                                return;
                            }

                            // Create EIP-712 signer using MetaMask
                            const ethereum = (window as any).ethereum;
                            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

                            console.log('Creating EIP-712 signer for account:', accounts[0]);
                            console.log('Challenge to sign:', challenge);

                            // Use the SDK's EIP-712 auth message signer
                            // This requires a wallet client-like object
                            const walletClientAdapter = {
                                account: { address: accounts[0] as `0x${string}` },
                                signTypedData: async ({ domain, types, primaryType, message }: any) => {
                                    console.log('signTypedData called with:', { domain, types, primaryType, message });

                                    const typedData = {
                                        domain,
                                        types,
                                        primaryType,
                                        message
                                    };

                                    console.log('Sending to MetaMask:', JSON.stringify(typedData, null, 2));

                                    try {
                                        const signature = await ethereum.request({
                                            method: 'eth_signTypedData_v4',
                                            params: [accounts[0], JSON.stringify(typedData)],
                                        });
                                        console.log('Signature received:', signature);
                                        return signature as `0x${string}`;
                                    } catch (signError: any) {
                                        console.error('MetaMask signing error:', signError);
                                        console.error('Error message:', signError.message);
                                        console.error('Error code:', signError.code);
                                        throw signError;
                                    }
                                }
                            };

                            console.log('Creating EIP712AuthMessageSigner...');
                            const authParams = {
                                address: params.userAddress as `0x${string}`,
                                application: params.application || 'Yellow Network Demo',
                                session_key: this.sessionAddress as `0x${string}`,
                                allowances: [
                                    { asset: 'ytest.usd', amount: '10000000' }
                                ],
                                expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
                                scope: params.scope || 'demo.app',
                            };

                            const eip712Signer = createEIP712AuthMessageSigner(
                                walletClientAdapter as any,
                                authParams,
                                { name: 'Yellow Network Demo' }
                            );

                            console.log('📋 Challenge details:');
                            console.log('  - Type:', typeof challenge);
                            console.log('  - Is string:', typeof challenge === 'string');
                            console.log('  - Is object:', typeof challenge === 'object');
                            console.log('  - Keys:', typeof challenge === 'object' ? Object.keys(challenge) : 'N/A');
                            console.log('  - Value:', challenge);
                            console.log('  - JSON:', JSON.stringify(challenge, null, 2));

                            console.log('Calling createAuthVerifyMessageFromChallenge...');
                            const verifyMsg = await createAuthVerifyMessageFromChallenge(
                                eip712Signer as any,
                                challenge
                            );

                            console.log('Verify message created:', verifyMsg);

                            console.log('📤 Sending auth verification...');
                            this.send(verifyMsg);
                        } catch (error: any) {
                            console.error('Challenge signing error:', error);
                            console.error('Error message:', error?.message);
                            console.error('Error stack:', error?.stack);
                            console.error('Error details:', JSON.stringify(error, null, 2));
                            removeAuthHandler();
                            reject(error);
                        }
                    } else if (message.method === 'auth_verify') {
                        console.log('✅ Authentication successful!');
                        this.authenticated = true;
                        removeAuthHandler();
                        resolve(true);
                    }
                };

                challengeHandlerRef = challengeHandler;

                // Add temporary message handler
                this.onMessage(challengeHandler);

                // Create auth request
                const authRequestMsg = await createAuthRequestMessage({
                    address: params.userAddress as `0x${string}`,
                    application: params.application || 'Yellow Network Demo',
                    session_key: this.sessionAddress as `0x${string}`,
                    allowances: [
                        { asset: 'ytest.usd', amount: '10000000' } // 10 USDC
                    ],
                    expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour
                    scope: params.scope || 'demo.app',
                });

                console.log('📤 Sending auth request...');
                this.send(authRequestMsg);

                // Timeout after 30 seconds
                setTimeout(() => {
                    if (!this.authenticated) {
                        removeAuthHandler();
                        reject(new Error('Authentication timeout - please make sure to approve both MetaMask prompts'));
                    }
                }, 30000);

            } catch (error) {
                console.error('Authentication error:', error);
                removeAuthHandler();
                reject(error);
            }
        });
    }

    async getBalances(): Promise<YellowBalance[]> {
        if (!this.authenticated) {
            throw new Error('Not authenticated');
        }

        const balanceMsg = await createGetLedgerBalancesMessage(
            this.sessionSigner
        );

        this.send(balanceMsg);

        // Wait for balance response
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(this.balances);
            }, 2000);
        });
    }

    async createPaymentSession(
        userAddress: string,
        partnerAddress: string,
        userAmount: string,
        partnerAmount: string
    ): Promise<any> {
        if (!this.authenticated || !this.sessionSigner) {
            throw new Error('Not authenticated');
        }

        const appDefinition = {
            protocol: 'payment-app-v1',
            participants: [userAddress, partnerAddress],
            weights: [50, 50],
            quorum: 100,
            challenge: 0,
            nonce: Date.now()
        };

        const allocations = [
            { participant: userAddress, asset: 'ytest.usd', amount: userAmount },
            { participant: partnerAddress, asset: 'ytest.usd', amount: partnerAmount }
        ];

        const sessionMessage = await createAppSessionMessage(
            this.sessionSigner,
            {
                definition: appDefinition as any,
                allocations: allocations as any
            }
        );

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
            this.authenticated = false;
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    isAuthenticated(): boolean {
        return this.authenticated;
    }

    getBalanceList(): YellowBalance[] {
        return this.balances;
    }
}

// Export the old client for backward compatibility
export { YellowNetworkClient, setupMessageSigner, isMetaMaskInstalled, createPaymentSession } from './yellowClient';
