# Yellow Network Integration Demo

This project demonstrates integration with Yellow Network and MetaMask wallet functionality.

## 🚀 Features

- **MetaMask Wallet Connection**: Connect your MetaMask wallet and sign messages
- **Yellow Network WebSocket**: Real-time connection to Yellow Network sandbox
- **Message Signing**: Sign messages using your MetaMask wallet
- **Real-time Updates**: Receive and display Yellow Network messages in real-time
- **Beautiful UI**: Modern, responsive interface with glassmorphism design

## 📁 Project Structure

```
/web3/yellow/
  ├── app.js              # Node.js Yellow Network client (standalone)
  └── package.json

/frontend/
  ├── app/
  │   ├── api/
  │   │   └── yellow/
  │   │       └── route.ts    # API route for server-side Yellow Network
  │   └── yellow-demo/
  │       └── page.tsx        # Demo page with wallet integration
  └── lib/
      └── yellowClient.ts     # Browser-compatible Yellow Network client
```

## 🛠️ Setup

### 1. Node.js Script (Standalone)

```bash
cd /Users/khalid/Projects/UniFlow/web3/yellow
npm install
node app.js
```

This will connect to Yellow Network and display incoming messages.

### 2. Frontend Demo

```bash
cd /Users/khalid/Projects/UniFlow/frontend
npm install
npm run dev
```

Then visit: **http://localhost:3000/yellow-demo**

## 🦊 MetaMask Setup

1. Install [MetaMask browser extension](https://metamask.io/download/)
2. Create or import a wallet
3. Visit the demo page and click "Connect Wallet"

## 📡 Yellow Network

The demo connects to Yellow Network's sandbox environment:
- **WebSocket URL**: `wss://clearnet-sandbox.yellow.com/ws`
- **Environment**: Sandbox (for testing)

## 🎯 How to Use

1. **Connect MetaMask**: Click "Connect Wallet" to connect your MetaMask wallet
2. **Connect Yellow Network**: Click "Connect to Yellow Network" to establish WebSocket connection
3. **Sign Messages**: Click "Sign Test Message" to sign a message with your wallet
4. **View Activity**: All messages and signatures appear in the activity feed

## 🔧 API Routes

### POST /api/yellow
Manage Yellow Network connections from the server side.

**Actions:**
- `connect`: Establish a new WebSocket connection
- `disconnect`: Close an existing connection
- `status`: Check connection status

**Example:**
```javascript
const response = await fetch('/api/yellow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'connect',
    sessionId: 'unique-session-id'
  })
});
```

## 📚 Code Examples

### Browser: Connect Wallet
```javascript
import { setupMessageSigner } from '@/lib/yellowClient';

const { userAddress, messageSigner } = await setupMessageSigner();
console.log('Connected:', userAddress);

// Sign a message
const signature = await messageSigner('Hello Yellow Network!');
```

### Browser: Connect to Yellow Network
```javascript
import { YellowNetworkClient } from '@/lib/yellowClient';

const client = new YellowNetworkClient();

client.onMessage((message) => {
  console.log('Received:', message);
});

await client.connect();
```

### Node.js: Yellow Network Connection
```javascript
import pkg from '@erc7824/nitrolite';
const { parseAnyRPCResponse } = pkg;

const ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');

ws.onmessage = (event) => {
  const message = parseAnyRPCResponse(event.data);
  console.log('Received:', message);
};
```

## 🎨 UI Features

- **Glassmorphism Design**: Modern frosted glass effect
- **Gradient Backgrounds**: Beautiful purple-to-orange gradients
- **Real-time Status**: Live connection indicators
- **Responsive Layout**: Works on desktop and mobile
- **Smooth Animations**: Hover effects and transitions

## 🔐 Security Notes

- Never commit private keys or seed phrases
- Use sandbox environment for testing
- Validate all user inputs
- Sign messages only from trusted sources

## 📦 Dependencies

### Node.js Script
- `@erc7824/nitrolite`: Yellow Network SDK

### Frontend
- `next`: React framework
- `ws`: WebSocket library for Node.js
- `@types/ws`: TypeScript types for ws

## 🐛 Troubleshooting

### "MetaMask not detected"
- Install MetaMask browser extension
- Refresh the page after installation

### "Failed to connect to Yellow Network"
- Check your internet connection
- Verify the WebSocket URL is accessible
- Check browser console for detailed errors

### Module errors in Node.js
- Ensure `package.json` has `"type": "module"`
- Use `import` instead of `require`

## 📝 License

MIT

## 🤝 Contributing

Feel free to submit issues and enhancement requests!
