import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// In a real app, use process.env.GEMINI_API_KEY
// For this demo, ensure this is set or passed in
const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY';
const genAI = new GoogleGenerativeAI(API_KEY);

export async function POST(request: NextRequest) {
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { prompt, network = 'arbitrum' } = body;
    if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });

    console.log(`[Agent Intelligent] Processing prompt: "${prompt}"`);

    try {
        // Mock check to avoid API call if key is default
        if (API_KEY === 'YOUR_GEMINI_API_KEY' || !API_KEY) {
            throw new Error('Gemini API Key missing (simulated key)');
        }

        const systemInstruction = `
        You are an Intent Parsing Agent. Convert the user prompt into a list of Intent Actions.
        Response Format: JSON object with key "intents" which is an array.
        
        Intent Types:
        1. SWAP: { "type": "SWAP", "fromToken": "sym", "toToken": "sym", "amount": number, "network": "chain" }
        2. PAYMENT: { "type": "PAYMENT", "amount": number, "fromChain": "chain", "toChain": "chain", "recipient": "address" }
        
        Rules:
        - Start Sequence: If prompt implies sequence (e.g. "swap then bridge"), generate multiple items.
        - "fromChain" and "toChain" are critical for cross-chain.
        - For PAYMENT: Default recipient: "0x000000000000000000000000000000000000dEaD"
        - For SWAP: Do NOT include "recipient" field unless explicitly stated (it defaults to user).
        - Default network: "${network}"
        `;

        const model = genAI.getGenerativeModel({ model: "gemini-robotics-er-1.5-preview" });
        const chat = model.startChat({
            history: [{ role: "user", parts: [{ text: "System Instruction: " + systemInstruction }] }]
        });

        const result = await chat.sendMessage(prompt);
        const text = result.response.text();
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(cleanText);

        // Ensure standard format
        const intents = Array.isArray(parsedData.intents) ? parsedData.intents : [parsedData];

        return NextResponse.json({
            success: true,
            analysis: "Intent parsed successfully via Gemini",
            intents: intents
        });

    } catch (e: any) {
        console.warn('Gemini Agent Error (Falling back to Regex Mock):', e.message);

        // Regex Fallback for Multiple Intents
        const p = prompt.toLowerCase();

        // Split by Logical Connectors: " and ", " then ", ". ", " + "
        // Also handle comma? Maybe risky for numbers, but usually spaced. 
        const rawSegments = p.split(/\s+(?:and|then)\s+|\.\s+|\s+\+\s+/);

        const intents = rawSegments.map((segment: string) => {
            const seg = segment.trim();
            if (!seg) return null;

            const intentData: any = { network: network || 'arbitrum' };

            // Determine Type
            if (seg.includes('pay') || seg.includes('send') || seg.includes('bridge')) {
                intentData.type = 'PAYMENT';
                intentData.amount = parseFloat(seg.match(/(\d+(\.\d+)?)/)?.[0] || '1');

                const networks = ['base', 'arbitrum', 'optimism', 'polygon', 'ethereum', 'arc'];

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
                // Default to same chain if not bridged
                if (!intentData.toChain) intentData.toChain = intentData.fromChain;

                // Recipient
                const addr = seg.match(/0x[a-fA-F0-9]{40}/);
                intentData.recipient = addr ? addr[0] : (prompt.match(/0x[a-fA-F0-9]{40}/)?.[0] || '0x1234567890123456789012345678901234567890');

            } else {
                // SWAP
                intentData.type = 'SWAP';
                intentData.amount = parseFloat(seg.match(/(\d+(\.\d+)?)/)?.[0] || '1');
                intentData.fromToken = (seg.includes('usdc') && !seg.includes('to usdc')) ? 'USDC' : 'ETH';
                intentData.toToken = (seg.includes('usdc') && !seg.includes('to usdc')) ? 'ETH' : 'USDC';

                if (seg.includes('base')) intentData.network = 'base';
                else if (seg.includes('arbitrum')) intentData.network = 'arbitrum';
                else if (seg.includes('optimism')) intentData.network = 'optimism';
                else if (seg.includes('polygon')) intentData.network = 'polygon';
                else if (seg.includes('ethereum')) intentData.network = 'ethereum';
            }
            return intentData;
        }).filter(Boolean);

        return NextResponse.json({
            success: true,
            analysis: "Intent parsed successfully via Fallback (Mock Batched)",
            intents: intents
        });
    }
}
