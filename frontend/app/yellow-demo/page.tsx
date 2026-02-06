'use client';

import { useState, useEffect } from 'react';
import { setupMessageSigner, isMetaMaskInstalled, YellowNetworkClient, createPaymentSession, PaymentSessionResult } from '@/lib/yellowClient';
import pkg from '@erc7824/nitrolite';
const { createAppSessionMessage } = pkg;

export default function YellowNetworkDemo() {
    const [walletAddress, setWalletAddress] = useState<string>('');
    const [messageSigner, setMessageSigner] = useState<((message: string) => Promise<string>) | null>(null);
    const [yellowClient, setYellowClient] = useState<YellowNetworkClient | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string>('');
    const [hasMetaMask, setHasMetaMask] = useState(false);

    // Payment Session State
    const [partnerAddress, setPartnerAddress] = useState<string>('');
    const [userAmount, setUserAmount] = useState<string>('800000');
    const [partnerAmount, setPartnerAmount] = useState<string>('200000');
    const [paymentSession, setPaymentSession] = useState<PaymentSessionResult | null>(null);
    const [isCreatingSession, setIsCreatingSession] = useState(false);

    useEffect(() => {
        setHasMetaMask(isMetaMaskInstalled());
    }, []);

    const connectWallet = async () => {
        try {
            setError('');
            const { userAddress, messageSigner: signer } = await setupMessageSigner();
            setWalletAddress(userAddress);
            setMessageSigner(() => signer);
        } catch (err: any) {
            setError(err.message || 'Failed to connect wallet');
            console.error('Wallet connection error:', err);
        }
    };

    const connectYellowNetwork = async () => {
        try {
            setError('');
            setIsConnecting(true);

            const client = new YellowNetworkClient();

            client.onMessage((message) => {
                setMessages(prev => [...prev, message]);
            });

            await client.connect();
            setYellowClient(client);
            setIsConnected(true);
        } catch (err: any) {
            setError(err.message || 'Failed to connect to Yellow Network');
            console.error('Yellow Network connection error:', err);
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnectYellowNetwork = () => {
        if (yellowClient) {
            yellowClient.disconnect();
            setYellowClient(null);
            setIsConnected(false);
            setMessages([]);
        }
    };

    const signMessage = async () => {
        if (!messageSigner) {
            setError('Please connect your wallet first');
            return;
        }

        try {
            setError('');
            const testMessage = `Yellow Network Test Message - ${new Date().toISOString()}`;
            const signature = await messageSigner(testMessage);

            setMessages(prev => [...prev, {
                type: 'signature',
                message: testMessage,
                signature,
                timestamp: Date.now()
            }]);
        } catch (err: any) {
            setError(err.message || 'Failed to sign message');
            console.error('Signing error:', err);
        }
    };

    const createPaymentSessionHandler = async () => {
        if (!messageSigner || !walletAddress) {
            setError('Please connect your wallet first');
            return;
        }

        if (!yellowClient || !isConnected) {
            setError('Please connect to Yellow Network first');
            return;
        }

        if (!partnerAddress || !partnerAddress.startsWith('0x')) {
            setError('Please enter a valid partner address');
            return;
        }

        try {
            setError('');
            setIsCreatingSession(true);

            const sessionResult = await createPaymentSession(
                messageSigner,
                {
                    userAddress: walletAddress,
                    partnerAddress,
                    userAmount,
                    partnerAmount,
                    asset: 'usdc'
                }
            );

            // Create a message signer adapter for nitrolite SDK
            const nitroliteMessageSigner = async (payload: any) => {
                // Convert the payload to a string for signing
                // Handle BigInt serialization
                const message = typeof payload === 'string'
                    ? payload
                    : JSON.stringify(payload, (key, value) =>
                        typeof value === 'bigint' ? value.toString() : value
                    );
                return await messageSigner(message);
            };

            // Create the actual signed message using nitrolite SDK
            const signedMessage = await createAppSessionMessage(
                nitroliteMessageSigner as any,
                {
                    definition: sessionResult.appDefinition as any,
                    allocations: sessionResult.allocations.map(a => ({
                        participant: a.participant,
                        asset: a.asset,
                        amount: a.amount // Keep as string, SDK will handle conversion
                    })) as any
                }
            );

            console.log('Signed message:', signedMessage);
            console.log('Yellow client connected:', yellowClient.isConnected());

            // Send to Yellow Network
            if (!yellowClient.isConnected()) {
                throw new Error('Yellow Network is not connected. Please reconnect.');
            }

            yellowClient.send(signedMessage);

            setPaymentSession(sessionResult);
            setMessages(prev => [...prev, {
                type: 'payment_session',
                session: sessionResult,
                timestamp: Date.now()
            }]);

            console.log('Payment session created:', sessionResult);
        } catch (err: any) {
            setError(err.message || 'Failed to create payment session');
            console.error('Payment session error:', err);
        } finally {
            setIsCreatingSession(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <div className="container mx-auto px-4 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
                        Yellow Network Integration
                    </h1>
                    <p className="text-gray-300 text-lg">
                        Connect your MetaMask wallet and interact with Yellow Network
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

                                <button
                                    onClick={signMessage}
                                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                                >
                                    Sign Test Message
                                </button>
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

                        {isConnected ? (
                            <div className="space-y-4">
                                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                                    <p className="text-green-200 text-sm flex items-center gap-2">
                                        <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                        Connected to Yellow Network
                                    </p>
                                    <p className="text-gray-300 text-xs mt-2">
                                        wss://clearnet-sandbox.yellow.com/ws
                                    </p>
                                </div>

                                <button
                                    onClick={disconnectYellowNetwork}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                                >
                                    Disconnect
                                </button>

                                <div className="text-gray-300 text-sm">
                                    <p className="font-semibold mb-1">Messages Received:</p>
                                    <p className="text-2xl font-bold text-yellow-400">
                                        {messages.filter(m => m.method).length}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={connectYellowNetwork}
                                disabled={isConnecting}
                                className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
                            >
                                {isConnecting ? 'Connecting...' : 'Connect to Yellow Network'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Payment Session Section */}
                {walletAddress && isConnected && (
                    <div className="max-w-6xl mx-auto mt-8">
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <span className="text-3xl">💰</span>
                                Create Payment Session
                            </h2>

                            <div className="space-y-4">
                                {/* Partner Address Input */}
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

                                {/* Amount Inputs */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-300 text-sm font-semibold mb-2">
                                            Your Amount (USDC units)
                                        </label>
                                        <input
                                            type="text"
                                            value={userAmount}
                                            onChange={(e) => setUserAmount(e.target.value)}
                                            placeholder="800000"
                                            className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
                                        />
                                        <p className="text-gray-500 text-xs mt-1">
                                            {(parseInt(userAmount) / 1000000).toFixed(2)} USDC
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-gray-300 text-sm font-semibold mb-2">
                                            Partner Amount (USDC units)
                                        </label>
                                        <input
                                            type="text"
                                            value={partnerAmount}
                                            onChange={(e) => setPartnerAmount(e.target.value)}
                                            placeholder="200000"
                                            className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
                                        />
                                        <p className="text-gray-500 text-xs mt-1">
                                            {(parseInt(partnerAmount) / 1000000).toFixed(2)} USDC
                                        </p>
                                    </div>
                                </div>

                                {/* Session Info */}
                                {paymentSession && (
                                    <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                                        <p className="text-green-200 text-sm font-semibold mb-2">
                                            ✅ Payment Session Created
                                        </p>
                                        <div className="text-gray-300 text-xs space-y-1">
                                            <p><span className="text-gray-500">Protocol:</span> {paymentSession.appDefinition.protocol}</p>
                                            <p><span className="text-gray-500">Participants:</span> {paymentSession.appDefinition.participants.length}</p>
                                            <p><span className="text-gray-500">Nonce:</span> {paymentSession.appDefinition.nonce}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Create Session Button */}
                                <button
                                    onClick={createPaymentSessionHandler}
                                    disabled={isCreatingSession || !partnerAddress}
                                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
                                >
                                    {isCreatingSession ? 'Creating Session...' : 'Create Payment Session'}
                                </button>

                                {/* Info Box */}
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                                    <p className="text-blue-200 text-xs">
                                        <span className="font-semibold">ℹ️ Note:</span> USDC uses 6 decimals.
                                        1,000,000 units = 1 USDC. Default values: 0.8 USDC for you, 0.2 USDC for partner.
                                    </p>
                                </div>
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
                                        {msg.type === 'signature' ? (
                                            <div>
                                                <p className="text-purple-400 text-xs font-semibold mb-2">
                                                    🔐 SIGNED MESSAGE
                                                </p>
                                                <p className="text-gray-300 text-sm mb-2">
                                                    <span className="text-gray-500">Message:</span> {msg.message}
                                                </p>
                                                <p className="text-gray-400 text-xs font-mono break-all">
                                                    {msg.signature}
                                                </p>
                                            </div>
                                        ) : msg.type === 'payment_session' ? (
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
                                                    <p><span className="text-gray-500">Allocations:</span></p>
                                                    {msg.session.allocations.map((a: any, i: number) => (
                                                        <p key={i} className="text-xs ml-4">
                                                            • {a.asset.toUpperCase()}: {(parseInt(a.amount) / 1000000).toFixed(2)}
                                                        </p>
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
                            How it works
                        </h3>
                        <ul className="text-gray-300 text-sm space-y-2">
                            <li>• Connect your MetaMask wallet to sign messages</li>
                            <li>• Connect to Yellow Network to receive real-time updates</li>
                            <li>• Create payment sessions with custom allocations</li>
                            <li>• View all messages and signatures in the activity feed</li>
                            <li>• Using Yellow Network Sandbox environment for testing</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
