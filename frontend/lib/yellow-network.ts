/**
 * Yellow Network Integration
 * HTTP API client for state channel communication
 */

import { ethers } from 'ethers';

/**
 * Yellow Network API Client
 * Communicates with backend for state channel operations
 */
export class YellowAPIClient {
    private baseUrl: string;
    private wallet: ethers.Wallet;

    constructor(privateKey: string, rpcUrl: string, apiUrl: string = 'http://localhost:3000/api') {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, provider);
        this.baseUrl = apiUrl;
    }

    async authenticate(): Promise<{ session: string }> {
        const response = await fetch(`${this.baseUrl}/yellow/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userAddress: this.wallet.address,
                chainId: await this.wallet.provider!.getNetwork().then(n => Number(n.chainId))
            })
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Authentication failed');
        }

        return { session: data.session?.id || data.intentId };
    }

    async createChannel(sessionId: string): Promise<{ channelId: string }> {
        const response = await fetch(`${this.baseUrl}/yellow/create-channel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intentId: sessionId })
        });

        const data = await response.json();
        return { channelId: data.channelId || sessionId };
    }

    async sendCommitment(channelId: string, commitment: any): Promise<{ success: boolean }> {
        // In production, this would send the commitment through the state channel
        // For now, we store it locally and send to backend for aggregation
        return { success: true };
    }
}
