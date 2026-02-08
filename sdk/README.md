# TINT Protocol SDK

Privacy-preserving intent execution with **AI-powered natural language processing** and cryptographic netting on Uniswap V4.

## 🤖 **NEW: AI Agent Interface**

The TINT SDK now includes a **Gemini AI agent** that lets users interact using plain English!

```typescript
import { TintClient } from '@tint-protocol/sdk';

const client = new TintClient({
    privateKey: process.env.PRIVATE_KEY,
    rpcUrl: 'https://1rpc.io/sepolia',
    backendUrl: 'https://your-app.vercel.app/api',
    geminiApiKey: process.env.GEMINI_API_KEY // Enable AI agent
});

// Just talk to it!
await client.processNaturalLanguage('Swap 10 USDC to WETH');
// ✅ Intent parsed, commitment created, swap executed!
```

## Features

✅ **AI-Powered Natural Language** - Talk to your wallet like a human  
✅ **Real Pedersen Commitments** - Cryptographically hiding and binding  
✅ **On-Chain Verification** - TINTNettingVerifier contract (deployed on Sepolia)  
✅ **Yellow Network Integration** - State channel support via Nitrolite  
✅ **Automatic Netting** - 50-90% gas savings through intent aggregation  
✅ **MEV Resistance** - Only net amounts visible on-chain  

## Installation

```bash
npm install @tint-protocol/sdk @noble/curves @noble/hashes ethers @google/generative-ai
```

## Quick Start

### Option 1: AI Agent Interface (Recommended)

```typescript
import { TintClient } from '@tint-protocol/sdk';

const client = new TintClient({
    privateKey: process.env.PRIVATE_KEY,
    rpcUrl: 'https://1rpc.io/sepolia',
    backendUrl: 'http://localhost:3000/api',
    geminiApiKey: process.env.GEMINI_API_KEY
});

await client.init();

// Natural language!
await client.processNaturalLanguage('Swap 10 USDC to WETH');
await client.processNaturalLanguage('Bridge 5 USDC from ethereum to base');
await client.processNaturalLanguage('Send 0.1 ETH to 0x123...');

// Chat with the agent
const response = await client.chat('How does TINT Protocol work?');
console.log(response);
```

### Option 2: Programmatic API

```typescript
import { TintClient } from '@tint-protocol/sdk';

const client = new TintClient({
    privateKey: process.env.PRIVATE_KEY,
    rpcUrl: 'https://1rpc.io/sepolia',
    backendUrl: 'https://your-app.vercel.app/api',
    verifierAddress: '0x3837C39afF6A207C8B89fa9e4DAa45e3FBB35443'
});

await client.init();

// Create intents programmatically
const intent1 = await client.createIntent({
    type: 'SWAP',
    fromToken: 'USDC',
    toToken: 'WETH',
    amount: 100
});

await client.submitIntent(intent1);

// Execute with netting
const result = await client.executeBatch();
console.log(`Netting Efficiency: ${result.efficiency}%`);
```

## How It Works

### 1. Natural Language → Intent
```
"Swap 10 USDC to WETH" 
    ↓ (Gemini AI)
{type: "SWAP", fromToken: "USDC", toToken: "WETH", amount: 10}
```

### 2. Intent → Pedersen Commitment
```typescript
C = keccak256(amount, randomness)
// Hides the amount until execution
```

### 3. Commitment → Yellow Channel
```
Encrypted transmission through state channels
Privacy-preserving aggregation
```

### 4. Netting Calculation
```
Total Sell: 150 USDC
Total Buy: 0 USDC (from network counter-parties)
Net Residual: 150 USDC
Efficiency: 60% (90 USDC netted off-chain)
```

### 5. On-Chain Execution
```
Only net residual (150 USDC) executed on Uniswap V4
Verified by TINTNettingVerifier contract
60% gas saved, 60% fees saved, 60% MEV saved
```

## Deployed Contracts

### Ethereum Sepolia
- **TINTNettingVerifier**: `0x3837C39afF6A207C8B89fa9e4DAa45e3FBB35443`

## API Reference

### TintClient

#### `constructor(config: TintClientConfig)`
Initialize the TINT client.

**Config:**
- `privateKey`: Wallet private key
- `rpcUrl`: RPC endpoint
- `backendUrl`: TINT backend API URL
- `verifierAddress`: TINTNettingVerifier contract address
- `geminiApiKey`: (Optional) Gemini API key for AI agent

#### `async processNaturalLanguage(prompt: string): Promise<ExecutionResult>`
🤖 **AI Agent Feature** - Process natural language intent.

```typescript
await client.processNaturalLanguage('Swap 10 USDC to WETH');
```

#### `async chat(message: string): Promise<string>`
🤖 **AI Agent Feature** - Chat with the AI agent.

```typescript
const response = await client.chat('What is netting?');
```

#### `hasAgent(): boolean`
Check if AI agent is enabled.

### TintAgent

#### `async parseIntent(prompt: string): Promise<ParsedIntent[]>`
Parse natural language into structured intents.

#### `async summarizeExecution(intents, results): Promise<string>`
Generate human-friendly execution summary.

## Examples

### Multi-Intent Natural Language

```typescript
await client.processNaturalLanguage(
    'Swap 10 USDC to WETH and then swap 5 USDC to WETH'
);
// ✅ Parses 2 intents, creates 2 commitments, nets them, executes once
```

### Conversational Interface

```typescript
const client = new TintClient({...config, geminiApiKey: 'your_key'});

await client.chat('How much gas can I save?');
// "With TINT Protocol, you can save 50-90% on gas fees through netting..."

await client.chat('What is a Pedersen commitment?');
// "A Pedersen commitment is a cryptographic primitive that..."
```

## Development

```bash
# Build
npm run build

# Test cryptography
node test-crypto.js

# Test AI agent
GEMINI_API_KEY=your_key node test-agent.js
```

## Environment Variables

```bash
PRIVATE_KEY="your_private_key"
GEMINI_API_KEY="your_gemini_api_key"  # For AI agent features
```

## License

MIT

## Links

- [GitHub](https://github.com/Khalid-000-ME/intent-stream-sdk)
- [Documentation](https://github.com/Khalid-000-ME/intent-stream-sdk/blob/main/SDK_PLAN.md)
- [TINT Protocol Spec](https://github.com/Khalid-000-ME/intent-stream-sdk/blob/main/TINT_PROTOCOL_SPEC.md)

---

**🤖 Powered by Gemini AI | 🔐 Secured by Pedersen Commitments | ⚡ Optimized by Netting**
