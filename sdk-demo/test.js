require('dotenv').config();
const { TintClient } = require('tint-protocol-ai-sdk');

const tint = new TintClient({
  privateKey: process.env.PRIVATE_KEY,
  geminiKey: process.env.GEMINI_API_KEY,
  rpcUrl: 'https://sepolia.base.org'
});

// Execute Natural Language Intent
const result = await tint.processNaturalLanguage(
  "Swap 100 USDC to WETH on Base"
);

console.log(`Tx Hash: ${result.txHash}`);