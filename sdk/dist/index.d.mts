/**
 * TINT Protocol - Real Pedersen Commitment Implementation
 * Uses @noble/curves for production-grade elliptic curve cryptography
 */
declare class PedersenCommitment {
    /**
     * Create a simplified hash-based commitment for Solidity compatibility
     * C = keccak256(amount, randomness)
     * This is used for on-chain verification where EC operations are expensive
     */
    commitSimple(amount: bigint, randomness?: Uint8Array): SimpleCommitment;
    /**
     * Verify a simplified commitment opening
     */
    verifySimple(commitment: Uint8Array, amount: bigint, randomness: Uint8Array): boolean;
}
interface SimpleCommitment {
    commitment: Uint8Array;
    commitmentHex: string;
    amount: bigint;
    randomness: Uint8Array;
    randomnessHex: string;
}
/**
 * Netting Engine - Aggregates commitments and computes net position
 */
declare class NettingEngine {
    private pedersen;
    constructor();
    /**
     * Compute net position from revealed intents
     * @param sellIntents Array of sell amounts
     * @param buyIntents Array of buy amounts
     * @returns Net position and efficiency metrics
     */
    computeNetPosition(sellIntents: bigint[], buyIntents: bigint[]): NetResult;
}
interface NetResult {
    totalSell: bigint;
    totalBuy: bigint;
    residual: bigint;
    direction: 'SELL' | 'BUY';
    efficiency: number;
    nettedVolume: bigint;
    totalVolume: bigint;
}

/**
 * Yellow Network Integration
 * HTTP API client for state channel communication
 */
/**
 * Yellow Network API Client
 * Communicates with backend for state channel operations
 */
declare class YellowAPIClient {
    private baseUrl;
    private wallet;
    constructor(privateKey: string, rpcUrl: string, apiUrl?: string);
    authenticate(): Promise<{
        session: string;
    }>;
    createChannel(sessionId: string): Promise<{
        channelId: string;
    }>;
    sendCommitment(channelId: string, commitment: any): Promise<{
        success: boolean;
    }>;
}

/**
 * TINT Protocol Client
 * Main entry point for TINT SDK
 */

interface TintClientConfig {
    privateKey: string;
    rpcUrl: string;
    backendUrl: string;
    verifierAddress?: string;
    geminiApiKey?: string;
}
interface IntentParams {
    type: 'SWAP' | 'TRANSFER' | 'BRIDGE' | 'PAYMENT';
    fromToken?: string;
    toToken?: string;
    amount: number | string;
    recipient?: string;
    fromChain?: string;
    toChain?: string;
}
interface ExecutionResult {
    success: boolean;
    txHash?: string;
    amountOut?: string;
    efficiency?: number;
    error?: string;
}
declare class TintClient {
    private wallet;
    private pedersen;
    private netting;
    private yellow;
    private config;
    private channelId?;
    private pendingIntents;
    private agent?;
    constructor(config: TintClientConfig);
    /**
     * Initialize the client and open Yellow Network channel
     */
    init(): Promise<void>;
    /**
     * Create an intent with Pedersen commitment
     */
    createIntent(params: IntentParams): Promise<{
        intent: IntentParams;
        commitment?: SimpleCommitment;
    }>;
    /**
     * Submit an intent to the collection
     */
    submitIntent(intentData: {
        intent: IntentParams;
        commitment?: SimpleCommitment;
    }): Promise<void>;
    /**
     * Execute all pending intents with netting
     */
    executeBatch(): Promise<ExecutionResult>;
    /**
     * Get pending intents count
     */
    getPendingCount(): number;
    /**
     * Clear all pending intents
     */
    clearPending(): void;
    /**
     * Get wallet address
     */
    getAddress(): string;
    /**
     * Process natural language intent (AI Agent Feature)
     * Example: "Swap 10 USDC to WETH"
     */
    processNaturalLanguage(prompt: string, network?: string): Promise<ExecutionResult>;
    /**
     * Chat with AI agent (conversational interface)
     */
    chat(message: string): Promise<string>;
    /**
     * Check if AI agent is available
     */
    hasAgent(): boolean;
}

/**
 * TINT Protocol - AI Agent Interface
 * Natural language intent parsing using Gemini AI with regex fallback
 */
interface AgentConfig {
    apiKey: string;
    model?: string;
}
interface ParsedIntent {
    type: 'SWAP' | 'BRIDGE' | 'TRANSFER' | 'PAYMENT';
    fromToken?: string;
    toToken?: string;
    amount: number;
    recipient?: string;
    fromChain?: string;
    toChain?: string;
    network?: string;
}
declare class TintAgent {
    private genai;
    private model;
    constructor(config: AgentConfig);
    /**
     * Parse natural language into structured intents
     */
    parseIntent(prompt: string, network?: string): Promise<ParsedIntent[]>;
    /**
     * Regex fallback parser (no AI needed)
     */
    private parseIntentFallback;
    /**
     * Generate a natural language summary of execution results
     */
    summarizeExecution(intents: ParsedIntent[], results: any[]): Promise<string>;
    /**
     * Interactive agent loop (for CLI usage)
     */
    chat(message: string): Promise<string>;
}

export { type AgentConfig, type ExecutionResult, type IntentParams, type NetResult, NettingEngine, type ParsedIntent, PedersenCommitment, type SimpleCommitment, TintAgent, TintClient, type TintClientConfig, YellowAPIClient };
