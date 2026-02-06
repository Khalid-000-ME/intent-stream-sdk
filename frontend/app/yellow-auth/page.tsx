'use client';

import { useState, useEffect } from 'react';
import { YellowNetworkAuthClient, YellowBalance } from '@/lib/yellowAuthClient';
import { isMetaMaskInstalled } from '@/lib/yellowClient';

export default function YellowAuthDemo() {
    const [walletAddress, setWalletAddress] = useState<string>('');
    const [yellowClient, setYellowClient] = useState<YellowNetworkAuthClient | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [balances, setBalances] = useState<YellowBalance[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [error, setError] = useState<string>('');
    const [hasMetaMask, setHasMetaMask] = useState(false);

    // Payment Session State
    const [partnerAddress, setPartnerAddress] = useState<string>('');
    const [userAmount, setUserAmount] = useState<string>('800000');
    const [partnerAmount, setPartnerAmount] = useState<string>('200000');
    const [isCreatingSession, setIsCreatingSession] = useState(false);

    useEffect(() => {
        setHasMetaMask(isMetaMaskInstalled());
    }, []);

    const connectWallet = async () => {
        try {
            setError('');
            if (!(window as any).ethereum) {
                throw new Error('Please install MetaMask');
            }

            const accounts = await (window as any).ethereum.request({
                method: 'eth_requestAccounts'
            });

            setWalletAddress(accounts[0]);
            console.log('✅ Wallet connected:', accounts[0]);
        } catch (err: any) {
            setError(err.message || 'Failed to connect wallet');
            console.error('Wallet connection error:', err);
        }
    };

    const connectYellowNetwork = async () => {
        try {
            setError('');
            setIsConnecting(true);

            const client = new YellowNetworkAuthClient();

            client.onMessage((message) => {
                setMessages(prev => [...prev, message]);
            });

            await client.connect();
            setYellowClient(client);
            setIsConnected(true);

            console.log('✅ Connected to Yellow Network');
        } catch (err: any) {
            setError(err.message || 'Failed to connect to Yellow Network');
            console.error('Yellow Network connection error:', err);
        } finally {
            setIsConnecting(false);
        }
    };

    const authenticateWithYellow = async () => {
        if (!yellowClient || !walletAddress) {
            setError('Please connect wallet and Yellow Network first');
            return;
        }

        try {
            setError('');
            setIsAuthenticating(true);

            console.log('🔐 Starting authentication...');

            await yellowClient.authenticate({
                userAddress: walletAddress,
                application: 'Yellow Network Demo',
                scope: 'demo.app'
            });

            setIsAuthenticated(true);
            console.log('✅ Authentication successful!');

            // Fetch balances after authentication
            setTimeout(async () => {
                try {
                    const balanceList = await yellowClient.getBalances();
                    setBalances(balanceList);
                    console.log('💰 Balances:', balanceList);
                } catch (err) {
                    console.error('Failed to fetch balances:', err);
                }
            }, 2000);

        } catch (err: any) {
            setError(err.message || 'Failed to authenticate');
            console.error('Authentication error:', err);
        } finally {
            setIsAuthenticating(false);
        }
    };

    const refreshBalances = async () => {
        if (!yellowClient || !isAuthenticated) {
            setError('Please authenticate first');
            return;
        }

        try {
            setError('');
            const balanceList = await yellowClient.getBalances();
            setBalances(balanceList);
            console.log('💰 Balances refreshed:', balanceList);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch balances');
            console.error('Balance fetch error:', err);
        }
    };

    const createPaymentSessionHandler = async () => {
        if (!yellowClient || !walletAddress) {
            setError('Please connect and authenticate first');
            return;
        }

        if (!isAuthenticated) {
            setError('Please authenticate with Yellow Network first');
            return;
        }

        if (!partnerAddress || !partnerAddress.startsWith('0x')) {
            setError('Please enter a valid partner address');
            return;
        }

        try {
            setError('');
            setIsCreatingSession(true);

            const sessionResult = await yellowClient.createPaymentSession(
                walletAddress,
                partnerAddress,
                userAmount,
                partnerAmount
            );

            setMessages(prev => [...prev, {
                type: 'payment_session',
                session: sessionResult,
                timestamp: Date.now()
            }]);

            console.log('✅ Payment session created:', sessionResult);
        } catch (err: any) {
            setError(err.message || 'Failed to create payment session');
            console.error('Payment session error:', err);
        } finally {
            setIsCreatingSession(false);
        }
    };

    const disconnectYellowNetwork = () => {
        if (yellowClient) {
            yellowClient.disconnect();
            setYellowClient(null);
            setIsConnected(false);
            setIsAuthenticated(false);
            setMessages([]);
            setBalances([]);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <div className="container mx-auto px-4 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
                        Yellow Network Full Integration
                    </h1>
                    <p className="text-gray-300 text-lg">
                        Complete authentication flow with EIP-712 signing
                    </p>
                </div>

                {/* Main Content */}
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Wallet Section */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                            <span className="text-3xl">🦊</span>
                            MetaMask Wallet
                        </h2>

                        {!hasMetaMask ? (
                            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
                                <p className="text-red-200 text-sm">
                                    ⚠️ MetaMask not detected. Please install MetaMask to continue.
                                </p>
                                <a
                                    href="https://metamask.io/download/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-yellow-400 hover:text-yellow-300 underline text-sm mt-2 inline-block"
                                >
                                    Download MetaMask →
                                </a>
                            </div>
                        ) : walletAddress ? (
                            <div className="space-y-4">
                                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                                    <p className="text-green-200 text-sm mb-2">✅ Wallet Connected</p>
                                    <p className="text-white font-mono text-xs break-all">
                                        {walletAddress}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={connectWallet}
                                className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                                Connect Wallet
                            </button>
                        )}
                    </div>

                    {/* Yellow Network Section */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                            <span className="text-3xl">🌐</span>
                            Yellow Network
                        </h2>

                        <div className="space-y-4">
                            {isConnected ? (
                                <>
                                    <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                                        <p className="text-green-200 text-sm flex items-center gap-2">
                                            <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                            Connected to Yellow Network
                                        </p>
                                    </div>

                                    {!isAuthenticated ? (
                                        <button
                                            onClick={authenticateWithYellow}
                                            disabled={isAuthenticating}
                                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
                                        >
                                            {isAuthenticating ? 'Authenticating...' : '🔐 Authenticate'}
                                        </button>
                                    ) : (
                                        <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                                            <p className="text-green-200 text-sm">✅ Authenticated</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={disconnectYellowNetwork}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                                    >
                                        Disconnect
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={connectYellowNetwork}
                                    disabled={isConnecting || !walletAddress}
                                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
                                >
                                    {isConnecting ? 'Connecting...' : 'Connect to Yellow Network'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Balances Section */}
                {isAuthenticated && (
                    <div className="max-w-6xl mx-auto mt-8">
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <span className="text-3xl">💰</span>
                                    Your Balances
                                </h2>
                                <button
                                    onClick={refreshBalances}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200"
                                >
                                    🔄 Refresh
                                </button>
                            </div>

                            {balances.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {balances.map((balance, idx) => (
                                        <div key={idx} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                                            <p className="text-gray-400 text-sm mb-1">Asset</p>
                                            <p className="text-white font-semibold text-lg">{balance.asset}</p>
                                            <p className="text-gray-400 text-sm mt-2 mb-1">Amount</p>
                                            <p className="text-yellow-400 font-bold text-2xl">
                                                {(parseInt(balance.amount) / 1000000).toFixed(2)}
                                            </p>
                                            <p className="text-gray-500 text-xs mt-1">
                                                {balance.amount} units
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-400">No balances found. Click refresh to load.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Payment Session Section */}
                {isAuthenticated && (
                    <div className="max-w-6xl mx-auto mt-8">
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <span className="text-3xl">💸</span>
                                Create Payment Session
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-gray-300 text-sm font-semibold mb-2">
                                        Partner Address
                                    </label>
                                    <input
                                        type="text"
                                        value={partnerAddress}
                                        onChange={(e) => setPartnerAddress(e.target.value)}
                                        placeholder="0x..."
                                        className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-300 text-sm font-semibold mb-2">
                                            Your Amount (ytest.usd units)
                                        </label>
                                        <input
                                            type="text"
                                            value={userAmount}
                                            onChange={(e) => setUserAmount(e.target.value)}
                                            placeholder="800000"
                                            className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
                                        />
                                        <p className="text-gray-500 text-xs mt-1">
                                            {(parseInt(userAmount) / 1000000).toFixed(2)} ytest.usd
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-gray-300 text-sm font-semibold mb-2">
                                            Partner Amount (ytest.usd units)
                                        </label>
                                        <input
                                            type="text"
                                            value={partnerAmount}
                                            onChange={(e) => setPartnerAmount(e.target.value)}
                                            placeholder="200000"
                                            className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
                                        />
                                        <p className="text-gray-500 text-xs mt-1">
                                            {(parseInt(partnerAmount) / 1000000).toFixed(2)} ytest.usd
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={createPaymentSessionHandler}
                                    disabled={isCreatingSession || !partnerAddress}
                                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
                                >
                                    {isCreatingSession ? 'Creating Session...' : 'Create Payment Session'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="max-w-6xl mx-auto mt-8">
                        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                            <p className="text-red-200 text-sm">❌ {error}</p>
                        </div>
                    </div>
                )}

                {/* Messages Display */}
                {messages.length > 0 && (
                    <div className="max-w-6xl mx-auto mt-8">
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <span className="text-3xl">📨</span>
                                Messages & Activity
                            </h2>

                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {messages.slice().reverse().map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 hover:border-yellow-500/50 transition-colors"
                                    >
                                        {msg.type === 'payment_session' ? (
                                            <div>
                                                <p className="text-green-400 text-xs font-semibold mb-2">
                                                    💰 PAYMENT SESSION CREATED
                                                </p>
                                                <div className="text-gray-300 text-sm space-y-1">
                                                    <p><span className="text-gray-500">Protocol:</span> {msg.session.appDefinition.protocol}</p>
                                                    <p><span className="text-gray-500">Participants:</span></p>
                                                    {msg.session.appDefinition.participants.map((p: string, i: number) => (
                                                        <p key={i} className="text-xs font-mono ml-4">• {p}</p>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-yellow-400 text-xs font-semibold mb-2">
                                                    📡 YELLOW NETWORK MESSAGE
                                                </p>
                                                <p className="text-gray-300 text-sm mb-1">
                                                    <span className="text-gray-500">Method:</span> {msg.method || 'N/A'}
                                                </p>
                                                <pre className="text-gray-400 text-xs overflow-x-auto bg-slate-900/50 p-2 rounded mt-2">
                                                    {JSON.stringify(msg, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Info Section */}
                <div className="max-w-6xl mx-auto mt-8">
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
                        <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                            <span>ℹ️</span>
                            Full Authentication Flow
                        </h3>
                        <ul className="text-gray-300 text-sm space-y-2">
                            <li>• Connect your MetaMask wallet</li>
                            <li>• Connect to Yellow Network WebSocket</li>
                            <li>• Authenticate with EIP-712 signature (session key generated)</li>
                            <li>• View your ytest.usd balance (you have 10.00!)</li>
                            <li>• Create payment sessions with authenticated session</li>
                            <li>• All messages signed with temporary session key</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
