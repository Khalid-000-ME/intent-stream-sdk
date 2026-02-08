require('dotenv').config();
const { TintClient } = require('tint-protocol-ai-sdk');

async function run() {
    console.log("🚀 Initializing TINT AI Client...");

    const client = new TintClient({
        privateKey: process.env.MAIN_WALLET_PRIVATE_KEY,
        rpcUrl: "https://sepolia.base.org",
        backendUrl: "http://localhost:3000/api", // Local backend
        geminiApiKey: process.env.GEMINI_API_KEY
    });

    // We skip client.init() for this demo as it connects to Yellow Network P2P which might need specific setup.
    // The core AI logic works without it.

    console.log("🤖 Processing Intent: 'Swap 0.0001 ETH to USDC on base'...");

    try {
        const result = await client.processNaturalLanguage("Swap 0.0001 ETH to USDC on base", "base");
        console.log("✅ Execution Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("❌ Error processing intent:", error.message);
    }
}

run();


