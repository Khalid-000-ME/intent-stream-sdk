'use client';

import { useState, useEffect } from 'react';
import { YellowServerClient } from '@/lib/yellowServerClient';

export default function YellowOfficialPage() {
    const [walletAddress, setWalletAddress] = useState<string>('');
    const [yellowClient, setYellowClient] = useState<YellowServerClient | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [balances, setBalances] = useState<any>(null);

    // Connect wallet
    const connectWallet = async () => {
        try {
            if (typeof window.ethereum === 'undefined') {
                setError('MetaMask not installed');
                return;
            }

            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            setWalletAddress(accounts[0]);
            setError('');
        } catch (err: any) {
            setError(err.message || 'Failed to connect wallet');
        }
    };

    // Connect to Yellow Network
    const connectToYellow = async () => {
        setIsLoading(true);
        setError('');

        try {
            // Create Yellow client (all auth happens server-side)
            const client = new YellowServerClient();

            // Connect
            await client.connect();
            setYellowClient(client);
            setIsConnected(true);
        } catch (err: any) {
            setError(err.message || 'Failed to connect to Yellow Network');
        } finally {
            setIsLoading(false);
        }
    };

    // Authenticate
    const authenticate = async () => {
        if (!yellowClient) return;

        setIsLoading(true);
        setError('');

        try {
            await yellowClient.authenticate();
            setIsAuthenticated(true);

            // Auto-fetch balances after authentication
            setTimeout(() => {
                fetchBalances();
            }, 1000);
        } catch (err: any) {
            setError(err.message || 'Failed to authenticate');
        } finally {
            setIsLoading(false);
        }
    };

    // Get balances
    const fetchBalances = async () => {
        if (!yellowClient) return;

        try {
            const balanceData = await yellowClient.getBalances();
            setBalances(balanceData);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch balances');
        }
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (yellowClient) {
                yellowClient.disconnect();
            }
        };
    }, [yellowClient]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-slate-800 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-white mb-4">
                        Yellow Network Official Implementation
                    </h1>
                    <p className="text-xl text-purple-200">
                        Based on Official index.ts - Full Authentication Flow
                    </p>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg">
                        <p className="text-red-200">{error}</p>
                    </div>
                )}

                {/* Steps */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Step 1: Wallet */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <h2 className="text-2xl font-bold text-white mb-4">1. Wallet</h2>
                        {!walletAddress ? (
                            <button
                                onClick={connectWallet}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition"
                            >
                                Connect MetaMask
                            </button>
                        ) : (
                            <div className="text-green-400">
                                ✅ {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                            </div>
                        )}
                    </div>

                    {/* Step 2: Connect */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <h2 className="text-2xl font-bold text-white mb-4">2. Connect</h2>
                        {!isConnected ? (
                            <button
                                onClick={connectToYellow}
                                disabled={!walletAddress || isLoading}
                                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition"
                            >
                                {isLoading ? 'Connecting...' : 'Connect to Yellow'}
                            </button>
                        ) : (
                            <div className="text-green-400">
                                ✅ Connected
                            </div>
                        )}
                    </div>

                    {/* Step 3: Authenticate */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <h2 className="text-2xl font-bold text-white mb-4">3. Authenticate</h2>
                        {!isAuthenticated ? (
                            <button
                                onClick={authenticate}
                                disabled={!isConnected || isLoading}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition"
                            >
                                {isLoading ? 'Authenticating...' : '🔐 Authenticate'}
                            </button>
                        ) : (
                            <div className="text-green-400">
                                ✅ Authenticated
                            </div>
                        )}
                    </div>
                </div>

                {/* Balances */}
                {isAuthenticated && (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-white">Balances</h2>
                            <button
                                onClick={fetchBalances}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition"
                            >
                                🔄 Refresh
                            </button>
                        </div>
                        {balances ? (
                            <pre className="bg-white/5 rounded-lg p-4 text-purple-200 overflow-x-auto">
                                {JSON.stringify(balances, null, 2)}
                            </pre>
                        ) : (
                            <p className="text-purple-300">Click Refresh to load balances...</p>
                        )}
                    </div>
                )}

                {/* Messages Feed */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h2 className="text-2xl font-bold text-white mb-4">Activity Feed</h2>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {messages.length === 0 ? (
                            <p className="text-purple-300">No messages yet...</p>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={idx} className="bg-white/5 rounded-lg p-3 border border-white/10">
                                    <div className="text-sm text-purple-400 mb-1">
                                        {msg.res?.[1] || msg.method || 'Unknown'}
                                    </div>
                                    <pre className="text-xs text-purple-200 overflow-x-auto">
                                        {JSON.stringify(msg, null, 2)}
                                    </pre>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="mt-6 bg-blue-500/20 border border-blue-500 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-blue-200 mb-2">ℹ️ Official Implementation</h3>
                    <p className="text-blue-100 mb-2">
                        This demo uses the official Yellow Network implementation pattern:
                    </p>
                    <ul className="list-disc list-inside text-blue-100 space-y-1">
                        <li>Full authentication with session keys</li>
                        <li>EIP-712 signing for challenge verification</li>
                        <li>Proper message handling</li>
                        <li>Based on official index.ts</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
