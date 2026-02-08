/**
 * TINT Protocol Client
 * Main entry point for TINT SDK
 */

import { ethers } from 'ethers';
import { PedersenCommitment, NettingEngine, SimpleCommitment, NetResult } from '../crypto/commitments';
import { YellowAPIClient } from '../network/yellow';
import { TintAgent, ParsedIntent } from '../agent/gemini';

export interface TintClientConfig {
    privateKey: string;
    rpcUrl: string;
    backendUrl: string;
    verifierAddress?: string; // TINTNettingVerifier contract address
    geminiApiKey?: string; // For AI agent features
}

export interface IntentParams {
    type: 'SWAP' | 'TRANSFER' | 'BRIDGE' | 'PAYMENT';
    fromToken?: string;
    toToken?: string;
    amount: number | string;
    recipient?: string;
    fromChain?: string;
    toChain?: string;
}

export interface ExecutionResult {
    success: boolean;
    txHash?: string;
    amountOut?: string;
    efficiency?: number;
    error?: string;
}

export class TintClient {
    private wallet: ethers.Wallet;
    private pedersen: PedersenCommitment;
    private netting: NettingEngine;
    private yellow: YellowAPIClient;
    private config: TintClientConfig;
    private channelId?: string;
    private pendingIntents: Array<{ intent: IntentParams; commitment?: SimpleCommitment }> = [];
    private agent?: TintAgent;

    constructor(config: TintClientConfig) {
        this.config = config;
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.wallet = new ethers.Wallet(config.privateKey, provider);
        this.pedersen = new PedersenCommitment();
        this.netting = new NettingEngine();
        this.yellow = new YellowAPIClient(config.privateKey, config.rpcUrl, config.backendUrl);

        // Initialize AI agent if API key provided
        if (config.geminiApiKey) {
            this.agent = new TintAgent({ apiKey: config.geminiApiKey });
        }
    }

    /**
     * Initialize the client and open Yellow Network channel
     */
    async init(): Promise<void> {
        const auth = await this.yellow.authenticate();
        const channel = await this.yellow.createChannel(auth.session);
        this.channelId = channel.channelId;
    }

    /**
     * Create an intent with Pedersen commitment
     */
    async createIntent(params: IntentParams): Promise<{ intent: IntentParams; commitment?: SimpleCommitment }> {
        let commitment: SimpleCommitment | undefined;

        // Create commitment for SWAP intents
        if (params.type === 'SWAP') {
            const amount = typeof params.amount === 'string'
                ? ethers.parseUnits(params.amount, 6) // Assuming USDC decimals
                : ethers.parseUnits(params.amount.toString(), 6);

            commitment = this.pedersen.commitSimple(amount);
        }

        return { intent: params, commitment };
    }

    /**
     * Submit an intent to the collection
     */
    async submitIntent(intentData: { intent: IntentParams; commitment?: SimpleCommitment }): Promise<void> {
        this.pendingIntents.push(intentData);

        // Send commitment to Yellow channel if it exists
        if (intentData.commitment && this.channelId) {
            await this.yellow.sendCommitment(this.channelId, {
                commitment: intentData.commitment.commitmentHex,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Execute all pending intents with netting
     */
    async executeBatch(): Promise<ExecutionResult> {
        if (this.pendingIntents.length === 0) {
            return { success: false, error: 'No pending intents' };
        }

        // Separate swap and non-swap intents
        const swapIntents = this.pendingIntents.filter(i => i.intent.type === 'SWAP' && i.commitment);
        const otherIntents = this.pendingIntents.filter(i => i.intent.type !== 'SWAP');

        // Execute non-swap intents directly
        for (const { intent } of otherIntents) {
            // Call appropriate API endpoint
            // This would be implemented based on your backend routes
        }

        // Execute swap intents with netting
        if (swapIntents.length > 0) {
            const sellAmounts = swapIntents.map(i => {
                const amt = typeof i.intent.amount === 'string'
                    ? parseFloat(i.intent.amount)
                    : i.intent.amount;
                return ethers.parseUnits(amt.toString(), 6);
            });

            const netResult = this.netting.computeNetPosition(sellAmounts, []);

            // Prepare hook data
            const hookData = {
                commitments: swapIntents.map(i => i.commitment!.commitmentHex),
                amounts: sellAmounts.map(a => a.toString()),
                randomness: swapIntents.map(i => i.commitment!.randomnessHex),
                directions: swapIntents.map(() => true),
                totalSell: netResult.totalSell.toString(),
                totalBuy: netResult.totalBuy.toString(),
                residual: netResult.residual.toString()
            };

            // Execute swap with net amount
            const firstIntent = swapIntents[0].intent;
            const netAmount = parseFloat(ethers.formatUnits(netResult.residual, 6));

            const response = await fetch(`${this.config.backendUrl}/uniswap/swap`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    network: 'ethereum',
                    tokenIn: firstIntent.fromToken,
                    tokenOut: firstIntent.toToken,
                    amount: netAmount.toFixed(6),
                    recipient: firstIntent.recipient || this.wallet.address,
                    hookData: JSON.stringify(hookData)
                })
            });

            const result: any = await response.json();

            // Clear pending intents
            this.pendingIntents = [];

            return {
                success: result.success,
                txHash: result.txHash,
                amountOut: result.amountOut,
                efficiency: netResult.efficiency,
                error: result.error
            };
        }

        this.pendingIntents = [];
        return { success: true };
    }

    /**
     * Get pending intents count
     */
    getPendingCount(): number {
        return this.pendingIntents.length;
    }

    /**
     * Clear all pending intents
     */
    clearPending(): void {
        this.pendingIntents = [];
    }

    /**
     * Get wallet address
     */
    getAddress(): string {
        return this.wallet.address;
    }

    /**
     * Process natural language intent (AI Agent Feature)
     * Example: "Swap 10 USDC to WETH"
     */
    async processNaturalLanguage(prompt: string, network: string = 'ethereum'): Promise<ExecutionResult> {
        if (!this.agent) {
            return {
                success: false,
                error: 'AI agent not initialized. Provide geminiApiKey in config.'
            };
        }

        try {
            // Parse natural language into structured intents
            const parsedIntents = await this.agent.parseIntent(prompt, network);

            if (parsedIntents.length === 0) {
                return { success: false, error: 'Could not parse intent' };
            }

            // Convert parsed intents to IntentParams and submit
            for (const parsed of parsedIntents) {
                const intentData = await this.createIntent({
                    type: parsed.type,
                    fromToken: parsed.fromToken,
                    toToken: parsed.toToken,
                    amount: parsed.amount,
                    recipient: parsed.recipient,
                    fromChain: parsed.fromChain,
                    toChain: parsed.toChain
                });

                await this.submitIntent(intentData);
            }

            // Execute batch
            const result = await this.executeBatch();

            // Generate summary
            if (this.agent) {
                const summary = await this.agent.summarizeExecution(parsedIntents, [result]);
                console.log('✅', summary);
            }

            return result;
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Chat with AI agent (conversational interface)
     */
    async chat(message: string): Promise<string> {
        if (!this.agent) {
            return 'AI agent not initialized. Provide geminiApiKey in config.';
        }

        return await this.agent.chat(message);
    }

    /**
     * Check if AI agent is available
     */
    hasAgent(): boolean {
        return !!this.agent;
    }
}
