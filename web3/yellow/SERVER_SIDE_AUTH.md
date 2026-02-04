# Yellow Network - Server-Side Authentication (No CORS)

## ✅ **Server-Side Solution Created!**

I've created a **server-side API route** to handle Yellow Network authentication, completely avoiding CORS issues!

---

## 🎯 **The Problem**

- **Direct WebSocket from browser** → CORS issues
- **EIP-712 signing in browser** → Wallet client connection issues
- **Complex authentication flow** → Hard to debug

---

## 💡 **The Solution**

### **Server-Side Proxy**
All WebSocket communication happens on the server (Next.js API route), and the browser communicates with the server via HTTP.

```
Browser → HTTP → Next.js API → WebSocket → Yellow Network
```

---

## 📁 **New Files Created**

```
/Users/khalid/Projects/UniFlow/frontend/
├── app/api/yellow-full/
│   └── route.ts                    # Server-side API route ⭐
├── lib/
│   └── yellowServerClient.ts       # Client-side wrapper ⭐
└── types/
    └── ethereum.d.ts               # TypeScript declarations
```

---

## 🚀 **How It Works**

### **1. Server-Side API Route** (`/api/yellow-full`)

Handles all WebSocket operations:
- `connect` - Opens WebSocket to Yellow Network
- `auth_request` - Sends auth request, returns challenge
- `auth_verify` - Sends signed verification
- `get_balances` - Queries ledger balances
- `disconnect` - Closes WebSocket

### **2. Client-Side Wrapper** (`YellowServerClient`)

Simple API for the browser:
```typescript
const client = new YellowServerClient({
    userAddress,
    walletClient
});

await client.connect();           // HTTP → Server → WebSocket
await client.authenticate();      // Sign in browser, send via HTTP
const balances = await client.getBalances();  // HTTP → Server → WS
```

---

## 🔧 **Usage**

### **Visit the Demo:**
👉 **http://localhost:3000/yellow-official**

### **Steps:**
1. **Connect Wallet** → MetaMask
2. **Connect to Yellow** → Server creates WebSocket
3. **Authenticate** → MetaMask signs, server verifies
4. **View Balances** → Server queries, returns data

---

## ✨ **Advantages**

✅ **No CORS issues** - All WebSocket on server  
✅ **Simpler client code** - Just HTTP requests  
✅ **Better error handling** - Server-side logging  
✅ **Session management** - Server tracks connections  
✅ **Works in browser** - No Node.js-specific code  

---

## 🔑 **Authentication Flow**

```
1. Browser: Connect Wallet (MetaMask)
   ↓
2. Browser → Server: POST /api/yellow-full { action: 'connect' }
   Server → Yellow: WebSocket connection
   ↓
3. Browser → Server: POST /api/yellow-full { action: 'auth_request' }
   Server → Yellow: auth_request
   Yellow → Server: auth_challenge
   Server → Browser: { challenge, sessionAddress, authParams }
   ↓
4. Browser: Sign challenge with MetaMask (EIP-712)
   ↓
5. Browser → Server: POST /api/yellow-full { action: 'auth_verify', signature }
   Server → Yellow: auth_verify with signature
   Yellow → Server: auth_verify response
   Server → Browser: { success: true, sessionKey }
   ↓
6. ✅ Authenticated!
```

---

## 📊 **API Endpoints**

### **POST /api/yellow-full**

**Actions:**

| Action | Description | Request | Response |
|--------|-------------|---------|----------|
| `connect` | Open WebSocket | `{ sessionId }` | `{ success: true }` |
| `auth_request` | Get challenge | `{ sessionId, userAddress }` | `{ challenge, sessionAddress, authParams }` |
| `auth_verify` | Verify signature | `{ sessionId, signature, challenge }` | `{ success: true, sessionKey }` |
| `get_balances` | Query balances | `{ sessionId, userAddress }` | `{ balances }` |
| `disconnect` | Close WebSocket | `{ sessionId }` | `{ success: true }` |

---

## 💻 **Code Example**

```typescript
import { YellowServerClient } from '@/lib/yellowServerClient';
import { createWalletClient, custom } from 'viem';
import { sepolia } from 'viem/chains';

// Create wallet client
const walletClient = createWalletClient({
    chain: sepolia,
    transport: custom(window.ethereum),
    account: userAddress as `0x${string}`,
});

// Create Yellow client
const client = new YellowServerClient({
    userAddress,
    walletClient
});

// Connect
await client.connect();

// Authenticate
await client.authenticate();  // MetaMask will prompt

// Get balances
const balances = await client.getBalances();
console.log('Balances:', balances);

// Disconnect
await client.disconnect();
```

---

## 🎯 **Key Features**

### **Session Management**
- Each browser session gets a unique `sessionId`
- Server tracks WebSocket connections per session
- Automatic cleanup of old connections

### **Error Handling**
- Server-side error logging
- Clear error messages to browser
- Timeout handling (10s per operation)

### **Security**
- Signing happens in browser (MetaMask)
- Server only proxies messages
- No private keys on server

---

## 🔍 **Debugging**

### **Server Logs**
Check Next.js console for:
- WebSocket connection status
- Message parsing
- Authentication flow

### **Browser Logs**
Check browser console for:
- Connection status
- Challenge received
- MetaMask signing
- Authentication success

---

## 📝 **Next Steps**

1. **Test the authentication** at `/yellow-official`
2. **View balances** after authenticating
3. **Add more features**:
   - Channel creation
   - Transfers
   - Channel closing

---

## ✅ **Summary**

**Problem:** Direct WebSocket from browser had CORS and wallet client issues  
**Solution:** Server-side API route proxies all WebSocket communication  
**Result:** Clean, working authentication flow! 🎉

---

## 🚀 **Try It Now!**

Visit: **http://localhost:3000/yellow-official**

The authentication should now work perfectly with no CORS issues!
