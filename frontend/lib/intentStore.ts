import WebSocket from 'ws';
import { NitroliteClient } from '@erc7824/nitrolite';

// Use globalThis to persist state in serverless dev environment to simulate stateful backend
const globalStore = globalThis as unknown as {
    activeIntents: Map<string, any>;
    activeSessions: Map<string, SessionData>;
};

// Initialize if not exists
if (!globalStore.activeIntents) globalStore.activeIntents = new Map();
if (!globalStore.activeSessions) globalStore.activeSessions = new Map();

export interface SessionData {
    ws: WebSocket; // Keeps connection open
    sessionSigner: any; // Signer for session key
    sessionPrivateKey: `0x${string}`;
    mainAccount: any; // Main wallet account
    yellowSessionId: string;
    channelId?: string; // Set after creation
    cachedChannels?: any[]; // Channels received during auth/connection
    client: NitroliteClient; // Nitrolite Client instance
    publicClient: any; // Viem Public Client
    walletClient: any; // Viem Wallet Client
}

export const activeIntents = globalStore.activeIntents;
export const activeSessions = globalStore.activeSessions;

export function updateIntentStatus(intentId: string, status: string, message: string) {
    const intent = activeIntents.get(intentId);
    if (!intent) return;
    intent.status = status;
    intent.timeline.push({ stage: status, timestamp: Date.now(), message });
    console.log(`  [${intentId.substring(0, 10)}...] ${status}: ${message}`);
}
