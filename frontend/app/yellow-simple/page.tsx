'use client';

import { useState, useEffect } from 'react';
import { YellowSimpleClient } from '@/lib/yellowSimpleClient';

export default function YellowSimplePage() {
    const [walletAddress, setWalletAddress] = useState<string>('');
    const [isConnected, setIsConnected] = useState(false);
    const [yellowClient, setYellowClient] = useState<YellowSimpleClient | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [partnerAddress, setPartnerAddress] = useState('');
    const [userAmount, setUserAmount] = useState('800000'); // 0.8 USDC
    const [partnerAmount, setPartnerAmount] = useState('200000'); // 0.2 USDC
    const [error, setError] = useState('');
    const [isCreatingSession, setIsCreatingSession] = useState(false);

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
        try {
            const client = new YellowSimpleClient();

            // Set up message handler
            client.onMessage((message) => {
                setMessages(prev => [...prev, message]);
            });

            await client.connect();
            await client.setupWallet(walletAddress);

            setYellowClient(client);
            setIsConnected(true);
            setError('');
        } catch (err: any) {
            setError(err.message || 'Failed to connect to Yellow Network');
        }
    };

    // Create payment session
    const createSession = async () => {
        if (!yellowClient || !walletAddress) return;

        setIsCreatingSession(true);
        setError('');

        try {
            const result = await yellowClient.createPaymentSession({
                userAddress: walletAddress,
                partnerAddress,
                userAmount,
                partnerAmount
            });

            console.log('Session created:', result);
            setMessages(prev => [...prev, {
                type: 'session_created',
                data: result
            }]);
        } catch (err: any) {
            setError(err.message || 'Failed to create session');
            console.error('Session creation error:', err);
        } finally {
            setIsCreatingSession(false);
        }
    };

    // Cleanup on unmount
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
                        Yellow Network Simple Demo
                    </h1>
                    <p className="text-xl text-purple-200">
                        Based on Official Quickstart Guide - No Authentication Required
                    </p>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg">
                        <p className="text-red-200">{error}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Wallet Connection */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <h2 className="text-2xl font-bold text-white mb-4">1. Connect Wallet</h2>
                        {!walletAddress ? (
                            <button
                                onClick={connectWallet}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition"
                            >
                                Connect MetaMask
                            </button>
                        ) : (
                            <div className="text-green-400">
                                ✅ Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                            </div>
                        )}
                    </div>

                    {/* Yellow Network Connection */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <h2 className="text-2xl font-bold text-white mb-4">2. Connect to Yellow</h2>
                        {!isConnected ? (
                            <button
                                onClick={connectToYellow}
                                disabled={!walletAddress}
                                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition"
                            >
                                Connect to Yellow Network
                            </button>
                        ) : (
                            <div className="text-green-400">
                                ✅ Connected to Yellow Network
                            </div>
                        )}
                    </div>
                </div>

                {/* Payment Session Creation */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
                    <h2 className="text-2xl font-bold text-white mb-4">3. Create Payment Session</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-purple-200 mb-2">Partner Address</label>
                            <input
                                type="text"
                                value={partnerAddress}
                                onChange={(e) => setPartnerAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2 text-white"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-purple-200 mb-2">
                                    Your Amount (units)
                                </label>
                                <input
                                    type="text"
                                    value={userAmount}
                                    onChange={(e) => setUserAmount(e.target.value)}
                                    className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2 text-white"
                                />
                                <p className="text-sm text-purple-300 mt-1">
                                    = {(parseInt(userAmount) / 1000000).toFixed(2)} USDC
                                </p>
                            </div>

                            <div>
                                <label className="block text-purple-200 mb-2">
                                    Partner Amount (units)
                                </label>
                                <input
                                    type="text"
                                    value={partnerAmount}
                                    onChange={(e) => setPartnerAmount(e.target.value)}
                                    className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2 text-white"
                                />
                                <p className="text-sm text-purple-300 mt-1">
                                    = {(parseInt(partnerAmount) / 1000000).toFixed(2)} USDC
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={createSession}
                            disabled={!isConnected || !partnerAddress || isCreatingSession}
                            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition"
                        >
                            {isCreatingSession ? 'Creating Session...' : 'Create Payment Session'}
                        </button>
                    </div>
                </div>

                {/* Messages Feed */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h2 className="text-2xl font-bold text-white mb-4">Activity Feed</h2>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {messages.length === 0 ? (
                            <p className="text-purple-300">No messages yet...</p>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={idx} className="bg-white/5 rounded-lg p-3 border border-white/10">
                                    <pre className="text-sm text-purple-200 overflow-x-auto">
                                        {JSON.stringify(msg, null, 2)}
                                    </pre>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Info Box */}
                <div className="mt-6 bg-blue-500/20 border border-blue-500 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-blue-200 mb-2">ℹ️ Simple Implementation</h3>
                    <p className="text-blue-100 mb-2">
                        This demo follows the official Yellow Network Quickstart Guide:
                    </p>
                    <ul className="list-disc list-inside text-blue-100 space-y-1">
                        <li>No authentication required</li>
                        <li>Direct WebSocket connection</li>
                        <li>Simple payment session creation</li>
                        <li>Based on official documentation</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
