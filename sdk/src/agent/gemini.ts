/**
 * TINT Protocol - AI Agent Interface
 * Natural language intent parsing using Gemini AI with regex fallback
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AgentConfig {
    apiKey: string;
    model?: string;
}

export interface ParsedIntent {
    type: 'SWAP' | 'BRIDGE' | 'TRANSFER' | 'PAYMENT';
    fromToken?: string;
    toToken?: string;
    amount: number;
    recipient?: string;
    fromChain?: string;
    toChain?: string;
    network?: string;
}

export class TintAgent {
    private genai: GoogleGenerativeAI;
    private model: any;

    constructor(config: AgentConfig) {
        this.genai = new GoogleGenerativeAI(config.apiKey);
        this.model = this.genai.getGenerativeModel({
            model: config.model || 'gemini-robotics-er-1.5-preview'
        });
    }

    /**
     * Parse natural language into structured intents
     */
    async parseIntent(prompt: string, network: string = 'ethereum'): Promise<ParsedIntent[]> {
        try {
            const systemInstruction = `
You are an Intent Parsing Agent. Convert the user prompt into a list of Intent Actions.
Response Format: JSON object with key "intents" which is an array.

Intent Types:
1. SWAP: { "type": "SWAP", "fromToken": "sym", "toToken": "sym", "amount": number, "network": "chain" }
2. PAYMENT: { "type": "PAYMENT", "amount": number, "fromChain": "chain", "toChain": "chain", "recipient": "address" }

Rules:
- If prompt implies sequence (e.g. "swap then bridge"), generate multiple items.
- "fromChain" and "toChain" are critical for cross-chain.
- For PAYMENT: Default recipient: "0x000000000000000000000000000000000000dEaD"
- For SWAP: Do NOT include "recipient" field unless explicitly stated.
- Default network: "${network}"
`;

            const chat = this.model.startChat({
                history: [{ role: "user", parts: [{ text: "System Instruction: " + systemInstruction }] }]
            });

            const result = await chat.sendMessage(prompt);
            const text = result.response.text();
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedData = JSON.parse(cleanText);

            const intents = Array.isArray(parsedData.intents) ? parsedData.intents : [parsedData];
            return intents.map((intent: any) => ({
                ...intent,
                network: intent.network || network
            }));

        } catch (error: any) {
            // Only log warning if it's NOT a rate limit error (429) to keep output clean
            if (!error.message.includes('429')) {
                console.warn('Gemini Agent Error (Falling back to Regex):', error.message);
            }
            return this.parseIntentFallback(prompt, network);
        }
    }

    /**
     * Regex fallback parser (no AI needed)
     */
    private parseIntentFallback(prompt: string, network: string): ParsedIntent[] {
        const p = prompt.toLowerCase();

        // Split by logical connectors
        const rawSegments = p.split(/\s+(?:and|then)\s+|\.\s+|\s+\+\s+/);

        const intents = rawSegments.map((segment: string) => {
            const seg = segment.trim();
            if (!seg) return null;

            const intentData: any = { network: network || 'ethereum' };

            // Determine Type
            if (seg.includes('pay') || seg.includes('send') || seg.includes('bridge')) {
                intentData.type = 'PAYMENT';
                intentData.amount = parseFloat(seg.match(/(\d+(\.\d+)?)/)?.[0] || '1');

                const networks = ['base', 'arbitrum', 'optimism', 'polygon', 'ethereum'];

                // From Chain
                const fromMatch = seg.match(/from\s+(\w+)/);
                if (fromMatch && networks.includes(fromMatch[1])) {
                    intentData.network = fromMatch[1];
                    intentData.fromChain = fromMatch[1];
                } else {
                    for (const net of networks) { if (seg.includes(net)) intentData.network = net; }
                    intentData.fromChain = intentData.network;
                }

                // To Chain
                for (const net of networks) {
                    if (seg.includes(`to ${net}`)) {
                        intentData.toChain = net;
                        break;
                    }
                }
                if (!intentData.toChain) intentData.toChain = intentData.fromChain;

                // Recipient
                const addr = seg.match(/0x[a-fA-F0-9]{40}/);
                intentData.recipient = addr ? addr[0] : '0x000000000000000000000000000000000000dEaD';

            } else {
                // SWAP
                intentData.type = 'SWAP';
                intentData.amount = parseFloat(seg.match(/(\d+(\.\d+)?)/)?.[0] || '1');

                // Token detection
                if (seg.includes('usdc') && !seg.includes('to usdc')) {
                    intentData.fromToken = 'USDC';
                    intentData.toToken = seg.includes('weth') ? 'WETH' : 'ETH';
                } else if (seg.includes('weth') && !seg.includes('to weth')) {
                    intentData.fromToken = 'WETH';
                    intentData.toToken = 'USDC';
                } else {
                    intentData.fromToken = 'USDC';
                    intentData.toToken = 'WETH';
                }

                // Network detection
                if (seg.includes('base')) intentData.network = 'base';
                else if (seg.includes('arbitrum')) intentData.network = 'arbitrum';
                else if (seg.includes('optimism')) intentData.network = 'optimism';
                else if (seg.includes('ethereum')) intentData.network = 'ethereum';
            }
            return intentData;
        }).filter(Boolean) as ParsedIntent[];

        return intents;
    }

    /**
     * Generate a natural language summary of execution results
     */
    async summarizeExecution(intents: ParsedIntent[], results: any[]): Promise<string> {
        const summary = `Executed ${intents.length} intent(s):\n` +
            intents.map((intent, i) => {
                const result = results[i];
                const status = result?.success ? '✅' : '❌';
                const txInfo = result?.txHash ? `\n  ↳ Tx: ${result.txHash}` : '';

                if (intent.type === 'SWAP') {
                    return `- Swap ${intent.amount} ${intent.fromToken} → ${intent.toToken}: ${status}${txInfo}`;
                } else {
                    return `- ${intent.type}: ${status}${txInfo}`;
                }
            }).join('\n');

        return summary;
    }

    /**
     * Interactive agent loop (for CLI usage)
     */
    async chat(message: string): Promise<string> {
        try {
            const result = await this.model.generateContent(message);
            return result.response.text();
        } catch (error: any) {
            return `Error: ${error.message}`;
        }
    }
}
