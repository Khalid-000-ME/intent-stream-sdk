Quickstart Guide
This guide provides a step-by-step walkthrough of integrating with the Yellow Network using the Nitrolite SDK. We will build a script to connect to the network, authenticate, manage state channels, and transfer funds.

Prerequisites
Node.js (v18 or higher)
npm
Setup
Install Dependencies

npm install

Environment Variables

Create a .env file in your project root:

# .env
PRIVATE_KEY=your_sepolia_private_key_here
ALCHEMY_RPC_URL=your_alchemy_rpc_url_here

1. Getting Funds
Before we write code, you need test tokens (ytest.usd). In the Sandbox, these tokens land in your Unified Balance (Off-Chain), which sits in the Yellow Network's clearing layer.

Request tokens via the Faucet:

curl -XPOST https://clearnet-sandbox.yellow.com/faucet/requestTokens \
  -H "Content-Type: application/json" \
  -d '{"userAddress":"<your_wallet_address>"}'


2. Initialization
First, we setup the NitroliteClient with Viem. This client handles all communication with the Yellow Network nodes and smart contracts.

import { NitroliteClient, WalletStateSigner, createECDSAMessageSigner } from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import WebSocket from 'ws';
import 'dotenv/config';

// Setup Viem Clients
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: sepolia, transport: http(process.env.ALCHEMY_RPC_URL) });
const walletClient = createWalletClient({ chain: sepolia, transport: http(), account });

// Initialize Nitrolite Client
const client = new NitroliteClient({
    publicClient,
    walletClient,
    stateSigner: new WalletStateSigner(walletClient),
    addresses: {
        custody: '0x019B65A265EB3363822f2752141b3dF16131b262',
        adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2',
    },
    chainId: sepolia.id,
    challengeDuration: 3600n,
});

// Connect to Sandbox Node
const ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');


3. Authentication
Authentication involves generating a temporary Session Key and verifying your identity using your main wallet (EIP-712).

// Generate temporary session key
const sessionPrivateKey = generatePrivateKey();
const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);
const sessionAccount = privateKeyToAccount(sessionPrivateKey);

// Send auth request
const authRequestMsg = await createAuthRequestMessage({
    address: account.address,
    application: 'Test app',
    session_key: sessionAccount.address,
    allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
    expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour
    scope: 'test.app',
});
ws.send(authRequestMsg);

// Handle Challenge (in ws.onmessage)
if (type === 'auth_challenge') {
    const challenge = response.res[2].challenge_message;
    // Sign with MAIN wallet
    const signer = createEIP712AuthMessageSigner(walletClient, authParams, { name: 'Test app' });
    const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge);
    ws.send(verifyMsg);
}


4. Channel Lifecycle
Creating a Channel
If no channel exists, we request the Node to open one.

const createChannelMsg = await createCreateChannelMessage(
    sessionSigner, // Sign with session key
    {
        chain_id: 11155111, // Sepolia
        token: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // ytest.usd
    }
);
ws.send(createChannelMsg);

// Listen for 'create_channel' response, then submit to chain
const createResult = await client.createChannel({
    channel,
    unsignedInitialState,
    serverSignature,
});


Funding (Resizing)
To fund the channel, we perform a "Resize". Since your funds are in your Unified Balance (from the Faucet), we use allocate_amount to move them into the Channel.

Important: Do NOT use resize_amount unless you have deposited funds directly into the L1 Custody Contract.

const resizeMsg = await createResizeChannelMessage(
    sessionSigner,
    {
        channel_id: channelId,
        allocate_amount: 20n, // Moves 20 units from Unified Balance -> Channel
        funds_destination: account.address,
    }
);
ws.send(resizeMsg);

// Submit resize proof to chain
await client.resizeChannel({ resizeState, proofStates });


Closing & Withdrawing
Finally, we cooperatively close the channel. This settles the balance on the L1 Custody Contract, allowing you to withdraw.

// Close Channel
const closeMsg = await createCloseChannelMessage(sessionSigner, channelId, account.address);
ws.send(closeMsg);

// Submit close to chain
await client.closeChannel({ finalState, stateData });

// Withdraw from Custody Contract to Wallet
const withdrawalTx = await client.withdrawal(tokenAddress, withdrawableBalance);
console.log('Funds withdrawn:', withdrawalTx);


Troubleshooting
Here are common issues and solutions:

InsufficientBalance:

Cause: Trying to use resize_amount (L1 funds) without depositing first.
Fix: Use allocate_amount to fund from your Off-chain Unified Balance (Faucet).
DepositAlreadyFulfilled:

Cause: Double-submitting a funding request or channel creation.
Fix: Check if the channel is already open or funded before sending requests.
InvalidState:

Cause: Resizing a closed channel or version mismatch.
Fix: Ensure you are using the latest channel state from the Node.
operation denied: non-zero allocation:

Cause: Too many "stale" channels open.
Fix: Run the cleanup script npx tsx close_all.ts.
Timeout waiting for User to fund Custody:

Cause: Re-running scripts without closing channels accumulates balance requirements.
Fix: Run close_all.ts to reset.
Cleanup Script
If you get stuck, use this script to close all open channels:

npx tsx close_all.ts

Complete Code
index.ts
Click to view full index.ts
close_all.ts
Click to view full close_all.ts
Edit this page


Advanced concepts are below

Managing Session Keys
This guide covers the operational details of creating, listing, and revoking session keys via the Clearnode API.

Prerequisites
Before diving into session key management, make sure you understand the core concepts: what session keys are, how applications and allowances work, and the expiration rules. See Session Keys for the conceptual foundation.

How to Manage Session Keys
Clearnode
Create and Configure
To create a session key, use the auth_request method during authentication. This registers the session key with its configuration:

Request:

{
  "req": [
    1,
    "auth_request",
    {
      "address": "0x1234567890abcdef...",
      "session_key": "0x9876543210fedcba...",
      "application": "Chess Game",
      "allowances": [
        {
          "asset": "usdc",
          "amount": "100.0"
        },
        {
          "asset": "eth",
          "amount": "0.5"
        }
      ],
      "scope": "app.create",
      "expires_at": 1762417328
    },
    1619123456789
  ],
  "sig": ["0x5432abcdef..."]
}

Parameters:

address (required): The wallet address that owns this session key
session_key (required): The address of the session key to register
application (optional): Name of the application using this session key (defaults to "clearnode" if not provided)
allowances (optional): Array of asset allowances specifying spending limits
scope (optional): Permission scope (e.g., "app.create", "ledger.readonly"). Note: This feature is not yet implemented
expires_at (required): Unix timestamp (in seconds) when this session key expires
note
When authenticating with an already registered session key, you must still fill in all fields in the request, at least with arbitrary values. This is required by the request itself, however, the values will be ignored as the system uses the session key configuration stored during initial registration. This behavior will be improved in future versions.

List Active Session Keys
Use the get_session_keys method to retrieve all active (non-expired) session keys for the authenticated user:

Request:

{
  "req": [1, "get_session_keys", {}, 1619123456789],
  "sig": ["0x9876fedcba..."]
}

Response:

{
  "res": [
    1,
    "get_session_keys",
    {
      "session_keys": [
        {
          "id": 1,
          "session_key": "0xabcdef1234567890...",
          "application": "Chess Game",
          "allowances": [
            {
              "asset": "usdc",
              "allowance": "100.0",
              "used": "45.0"
            },
            {
              "asset": "eth",
              "allowance": "0.5",
              "used": "0.0"
            }
          ],
          "scope": "app.create",
          "expires_at": "2024-12-31T23:59:59Z",
          "created_at": "2024-01-01T00:00:00Z"
        }
      ]
    },
    1619123456789
  ],
  "sig": ["0xabcd1234..."]
}

Response Fields:

id: Unique identifier for the session key record
session_key: The address of the session key
application: Application name this session key is authorized for
allowances: Array of allowances with usage tracking:
asset: Symbol of the asset (e.g., "usdc", "eth")
allowance: Maximum amount the session key can spend
used: Amount already spent by this session key
scope: Permission scope (omitted if empty)
expires_at: When this session key expires (ISO 8601 format)
created_at: When the session key was created (ISO 8601 format)
Revoke a Session Key
To immediately invalidate a session key, use the revoke_session_key method:

Request:

{
  "req": [
    1,
    "revoke_session_key",
    {
      "session_key": "0xabcdef1234567890..."
    },
    1619123456789
  ],
  "sig": ["0x9876fedcba..."]
}

Response:

{
  "res": [
    1,
    "revoke_session_key",
    {
      "session_key": "0xabcdef1234567890..."
    },
    1619123456789
  ],
  "sig": ["0xabcd1234..."]
}

Permission Rules:

A wallet can revoke any of its session keys
A session key can revoke itself
A session key with application: "clearnode" can revoke other session keys belonging to the same wallet
A non-"clearnode" session key cannot revoke other session keys (only itself)
Important Notes:

Revocation is immediate and cannot be undone
After revocation, any operations attempted with the revoked session key will fail with a validation error
The revoked session key will no longer appear in the get_session_keys response
Revocation is useful for security purposes when a session key may have been compromised
Error Cases:

Session key does not exist, belongs to another wallet, or is expired: "operation denied: provided address is not an active session key of this user"
Non-"clearnode" session key attempting to revoke another session key: "operation denied: insufficient permissions for the active session key"
Nitrolite SDK
The Nitrolite SDK provides a higher-level abstraction for managing session keys. For detailed information on using session keys with the Nitrolite SDK, please refer to the SDK documentation.

Edit this page
