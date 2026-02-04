import pkg from '@erc7824/nitrolite';
const { createAppSessionMessage, parseAnyRPCResponse } = pkg;

// ============================================
// MetaMask Wallet Integration (Browser Only)
// ============================================
// NOTE: This function requires a browser environment with MetaMask installed.
// For browser usage, see: /frontend/app/yellow-demo/page.tsx
// For Node.js, you would use a different signing method (e.g., ethers.Wallet)

/**
 * Set up message signer for MetaMask wallet
 * @returns {Promise<{userAddress: string, messageSigner: Function}>}
 */
async function setupMessageSigner() {
  if (typeof window === 'undefined') {
    throw new Error('This function requires a browser environment');
  }

  if (!window.ethereum) {
    throw new Error('Please install MetaMask');
  }

  // Request wallet connection
  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts'
  });

  const userAddress = accounts[0];

  // Create message signer function
  const messageSigner = async (message) => {
    return await window.ethereum.request({
      method: 'personal_sign',
      params: [message, userAddress]
    });
  };

  console.log('✅ Wallet connected:', userAddress);
  return { userAddress, messageSigner };
}

// ============================================
// Yellow Network WebSocket Connection
// ============================================

// Connect to Yellow Network (using sandbox for testing)
const ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');

ws.onopen = () => {
  console.log('✅ Connected to Yellow Network!');
};

ws.onmessage = (event) => {
  const message = parseAnyRPCResponse(event.data);
  console.log('📨 Received:', message);
};

ws.onerror = (error) => {
  console.error('Connection error:', error);
};

console.log('Connecting to Yellow Network...');