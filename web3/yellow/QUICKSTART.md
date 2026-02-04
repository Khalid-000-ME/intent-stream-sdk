# Quick Start Guide

## 🎯 Your Yellow Network Integration is Ready!

### ✅ What's Been Created

1. **Node.js Script** (`/web3/yellow/app.js`)
   - Standalone Yellow Network client
   - Includes MetaMask wallet integration function
   - Ready to run with `node app.js`

2. **Frontend Demo** (`/frontend/app/yellow-demo/page.tsx`)
   - Beautiful interactive demo page
   - MetaMask wallet connection
   - Real-time Yellow Network messaging
   - Live at: http://localhost:3000/yellow-demo

3. **API Route** (`/frontend/app/api/yellow/route.ts`)
   - Server-side Yellow Network management
   - Session-based WebSocket handling
   - RESTful API for connection control

4. **Client Library** (`/frontend/lib/yellowClient.ts`)
   - Reusable Yellow Network client
   - MetaMask integration utilities
   - TypeScript support

## 🚀 How to Use

### Option 1: Node.js Script (Already Running!)
```bash
cd /Users/khalid/Projects/UniFlow/web3/yellow
node app.js
```

### Option 2: Frontend Demo (Also Running!)
Visit: **http://localhost:3000/yellow-demo**

The dev server is already running at:
- Local: http://localhost:3000
- Network: http://192.168.22.186:3000

## 📱 Demo Page Features

### 1. Connect MetaMask Wallet
- Click "Connect Wallet" button
- Approve MetaMask connection
- Your wallet address will be displayed

### 2. Connect to Yellow Network
- Click "Connect to Yellow Network"
- WebSocket connection establishes automatically
- Real-time messages start flowing

### 3. Create Payment Sessions
- Enter partner's Ethereum address
- Set allocation amounts for both parties
- Click "Create Payment Session"
- Session is signed and sent to Yellow Network

### 4. Sign Messages
- Click "Sign Test Message"
- Approve signature in MetaMask
- Signature appears in activity feed

### 5. View Activity
- All Yellow Network messages displayed in real-time
- Wallet signatures shown with full details
- Payment sessions with participant and allocation details
- Beautiful, scrollable activity feed

## 🎨 What You'll See

The demo page features:
- **Glassmorphism Design**: Frosted glass cards with backdrop blur
- **Gradient Backgrounds**: Purple-to-orange gradient
- **Live Status Indicators**: Pulsing green dots for active connections
- **Real-time Updates**: Messages appear instantly
- **Responsive Layout**: Works on all screen sizes

## 🔧 Technical Details

### MetaMask Integration
```javascript
// Browser only - included in app.js for reference
const { userAddress, messageSigner } = await setupMessageSigner();
const signature = await messageSigner('Your message here');
```

### Yellow Network Connection
```javascript
// Works in both Node.js and browser
const client = new YellowNetworkClient();
client.onMessage((msg) => console.log(msg));
await client.connect();
```

### API Usage
```javascript
// Server-side connection management
const response = await fetch('/api/yellow', {
  method: 'POST',
  body: JSON.stringify({ action: 'connect', sessionId: 'abc123' })
});
```

## 📊 Current Status

✅ Node.js script: Running and connected
✅ Frontend dev server: Running on port 3000
✅ Demo page: Compiled and ready
✅ All dependencies: Installed

## 🎯 Next Steps

1. **Open the demo**: Visit http://localhost:3000/yellow-demo
2. **Install MetaMask**: If you haven't already (https://metamask.io)
3. **Connect wallet**: Click the "Connect Wallet" button
4. **Connect Yellow Network**: Click the "Connect to Yellow Network" button
5. **Watch the magic**: See real-time messages flowing!

## 💡 Tips

- The sandbox environment is for testing only
- Messages appear automatically once connected
- You can sign multiple test messages
- All activity is logged in the activity feed
- Disconnect and reconnect anytime

## 🐛 Troubleshooting

**MetaMask not detected?**
- Install MetaMask browser extension
- Refresh the page

**Connection failed?**
- Check your internet connection
- Open browser console (F12) for details

**No messages appearing?**
- Wait a few seconds after connecting
- Yellow Network sends periodic updates

## 📚 Documentation

Full documentation available in:
- `/web3/yellow/README.md` - Complete project documentation
- Code comments in all files
- TypeScript types for better IDE support

---

**Enjoy your Yellow Network integration! 🎉**
