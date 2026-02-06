text
# Yellow Network Quickstart Guide

## Overview
Build your first Yellow App in 5 minutes - a complete beginner's guide for creating a simple payment application using state channels.

## What You'll Build
A basic payment app where users can:
- Deposit funds into a state channel
- Send instant payments to another user  
- Withdraw remaining funds

No blockchain knowledge required - handles complexity automatically.

## Prerequisites
- Node.js environment
- Ethereum wallet (MetaMask)
- USDC tokens for testing (sandbox environment)

## Step 1: Project Setup & Installation

Create a new project directory and install Yellow SDK:

**Using npm:**
```bash
mkdir my-yellow-app
cd my-yellow-app
npm init -y
npm install @erc7824/nitrolite
Using yarn:

bash
mkdir my-yellow-app
cd my-yellow-app
yarn init -y
yarn add @erc7824/nitrolite
Using pnpm:

bash
mkdir my-yellow-app
cd my-yellow-app
pnpm init
pnpm add @erc7824/nitrolite
Step 2: Connect to ClearNode
Create app.js and establish WebSocket connection:

ClearNode Endpoints:

Production: wss://clearnet.yellow.com/ws

Sandbox (recommended): wss://clearnet-sandbox.yellow.com/ws

javascript
import { createAppSessionMessage, parseRPCResponse } from '@erc7824/nitrolite';

// Connect to Yellow Network (sandbox)
const ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');

ws.onopen = () => {
  console.log('✅ Connected to Yellow Network!');
};

ws.onmessage = (event) => {
  const message = parseRPCResponse(event.data);
  console.log('📨 Received:', message);
};

ws.onerror = (error) => {
  console.error('Connection error:', error);
};

console.log('Connecting to Yellow Network...');
Step 3: Create Payment Session
Session Configuration:

javascript
const message = {
  method: 'app_session',
  params: {
    definition: 'simple_payment_v1', // App definition
    quorum: 100, // Both participants must agree
    challenge: 0,
    nonce: Date.now()
  }
};

// Initial balances (1 USDC = 1,000,000 units with 6 decimals)
const allocations = [
  { participant: userAddress, asset: 'usdc', amount: '800000' }, // 0.8 USDC
  { participant: partnerAddress, asset: 'usdc', amount: '200000' } // 0.2 USDC
];

// Create signed session message
const sessionMessage = await createAppSessionMessage(
  messageSigner,
  [{ definition: appDefinition, allocations }]
);

// Send to ClearNode
ws.send(sessionMessage);
console.log('✅ Payment session created!');
Step 4: Complete Application Class
Full SimplePaymentApp implementation:

javascript
class SimplePaymentApp {
  constructor() {
    this.sessionId = null;
  }

  async init() {
    // Step 1: Set up wallet
    const { userAddress, messageSigner } = await this.setupWallet();
    this.userAddress = userAddress;
    this.messageSigner = messageSigner;

    // Step 2: Connect to ClearNode
    this.ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');
    this.ws.onopen = () => {
      console.log('🟢 Connected to Yellow Network!');
    };
    this.ws.onmessage = (event) => {
      this.handleMessage(parseRPCResponse(event.data));
    };
    return userAddress;
  }

  async setupWallet() {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });
    // ... wallet setup logic
  }

  handleMessage(message) {
    switch (message.type) {
      case 'session_ready':
        this.sessionId = message.sessionId;
        console.log('✅ Session ready:', this.sessionId);
        break;
      case 'payment':
        console.log('💰 Payment received:', message.amount);
        break;
    }
  }
}
Step 5: Usage Example
javascript
// Initialize app
const app = new SimplePaymentApp();
await app.init();

// Create session with partner
await app.createSession('0xPartnerAddress');

// Send payment (0.1 USDC)
await app.sendPayment('100000', '0xPartnerAddress');
Next Steps
Advanced Topics: Multi-party apps, production deployment

API Reference: Full SDK documentation

Examples: GitHub repository samples

Community: Developer Discord support [web:21]

Key Features Demonstrated
✅ Instant off-chain payments via state channels

✅ Cross-chain settlement capabilities

✅ Non-custodial security

✅ Sub-second transaction finality

✅ Batch settlement optimization [page:1]

text

*This Markdown file captures the complete Yellow Network Quickstart workflow from their official documentation, structured for easy reference and implementation. All code examples and endpoints are directly from the source material.*[1]