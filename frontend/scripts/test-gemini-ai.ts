// @ts-ignore
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/agent/intelligent';

const TEST_PROMPTS = [
    // 1. Basic Swap
    "Swap 10 USDC to ETH on Arbitrum",

    // 2. Basic Payment
    "Pay 5 USDC to 0x1234567890123456789012345678901234567890",

    // 3. Payment with Network
    "Send 100 USDC to 0x1234567890123456789012345678901234567890 on Base",

    // 4. CROSS-CHAIN Intent (Testing Regex Improvement)
    "Send 1 USDC from Base to Arc",

    // 5. Another Cross-Chain Variation
    "Bridge 50 USDC from Arbitrum to Ethereum",

    // 6. Ambiguous / edge case
    "I want to trade some tokens",

    // 7. Explicit "To [Chain]" test
    "Send 10 USDC to Optimism",

    // 8. Multi-Intent Test
    "Swap 1 ETH to USDC then Bridge 100 USDC from Arbitrum to Base"
];

async function testGeminiRoute() {
    console.log(`🤖 Testing Gemini AI Route: ${API_URL}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    for (const prompt of TEST_PROMPTS) {
        console.log(`\n📝 Prompt: "${prompt}"`);
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                console.error(`❌ Error: ${response.status} ${response.statusText}`);
                continue;
            }

            const data: any = await response.json();

            // Check parsing source
            const source = data.analysis.includes("Fallback") ? "Regex Fallback (Mock)" : "Google Gemini AI";
            const icon = source.includes("Mock") ? "⚠️" : "🧠";

            console.log(`   ${icon} Source: ${source}`);

            const intents = data.intents || (data.intent ? [data.intent] : []);
            console.log(`   ✅ Parsed Result:`, JSON.stringify(intents, null, 2));

            // Specific validation for Cross-Chain fix
            if (prompt.includes("to Arc")) {
                const hasArc = intents.some((i: any) => i.toChain === 'arc');
                if (!hasArc) {
                    console.error(`   ❌ FAILED: specific 'toChain' extraction failed for Arc.`);
                }
            }

        } catch (err: any) {
            console.error(`   ❌ Exception: ${err.message}`);
        }
    }
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

testGeminiRoute();
