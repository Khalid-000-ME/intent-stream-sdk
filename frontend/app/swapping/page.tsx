'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { ethers } from 'ethers';
import { StorkTicker } from '@/components/StorkTicker';

// Demo Tokens
const TOKENS = [
    { symbol: 'WETH', name: 'Wrapped Ether', icon: '💧' },
    { symbol: 'USDC', name: 'USD Coin', icon: '$' },
    { symbol: 'ETH', name: 'Ether', icon: '⟠' },
];

export default function SwappingPage() {
    // Wallet State
    const [account, setAccount] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // Swap Form State
    const [amount, setAmount] = useState('0.0001');
    const [fromToken, setFromToken] = useState('WETH');
    const [toToken, setToToken] = useState('USDC');
    const [network, setNetwork] = useState('base'); // Default to base for V4

    // Execution State
    const [status, setStatus] = useState('idle'); // idle, executing, completed, failed
    const [intentId, setIntentId] = useState<string | null>(null);
    const [timeline, setTimeline] = useState<any[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    // Connect Wallet
    const connectWallet = async () => {
        if (typeof window === 'undefined' || !window.ethereum) {
            alert('Please install a wallet like MetaMask to connect.');
            return;
        }

        setIsConnecting(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.send("eth_requestAccounts", []);
            if (accounts.length > 0) {
                const ua = accounts[0];
                setAccount(ua);
                // Register Agent (Identity Step)
                await registerAgent(ua);
            }
        } catch (err: any) {
            console.error('Connection failed:', err);
            alert('Failed to connect wallet');
        } finally {
            setIsConnecting(false);
        }
    };

    const registerAgent = async (wallet: string) => {
        try {
            await fetch('/api/agent/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentWallet: wallet,
                    metadata: { role: 'Trader', strategy: 'Manual-Swap' }
                })
            });
            console.log('Agent registered for session');
        } catch (e) {
            console.warn('Agent registration silent fail:', e);
        }
    };

    // Execute Intent

    const startExecution = async () => {
        if (!account) {
            await connectWallet();
            if (!account && !(window.ethereum as any)?.selectedAddress) return;
        }

        setStatus('executing');
        setTimeline([]);
        setLogs([`🚀 Initializing Intent Execution on ${network}...`]);
        setError(null);
        setResult(null);

        try {
            // 1. Auth & Intent Creation
            setLogs(prev => [...prev, '🔐 Authenticating session...']);
            const authRes = await fetch('/api/yellow/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromToken,
                    toToken,
                    amount: amount,
                    network: network,
                    slippage: 5.0,
                    userAddress: account
                })
            });
            const authData = await authRes.json();
            if (!authData.success) throw new Error(authData.error || 'Auth failed');

            const newIntentId = authData.intentId;
            setIntentId(newIntentId);
            setLogs(prev => [...prev, `✅ Intent Created: ${newIntentId}`]);


            // 2. Channel Creation
            setLogs(prev => [...prev, '⚡ Setting up State Channel...']);
            const chanRes = await fetch('/api/yellow/create-channel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intentId: newIntentId })
            });
            const chanData = await chanRes.json();
            if (!chanData.success) throw new Error(chanData.error || 'Channel creation failed');
            setLogs(prev => [...prev, `✅ Channel Ready`]);

            // 3. Submit Execution
            setLogs(prev => [...prev, '📤 Submitting execution...']);
            const subRes = await fetch('/api/intent/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intentId: newIntentId })
            });
            const subData = await subRes.json();
            if (!subData.success) throw new Error(subData.error || 'Submission failed');

            setLogs(prev => [...prev, '✅ Execution Started. Monitoring...']);

        } catch (err: any) {
            console.error(err);
            setError(err.message);
            setStatus('failed');
            setLogs(prev => [...prev, `❌ Error: ${err.message}`]);
        }
    };

    // Polling Effect
    useEffect(() => {
        if (status !== 'executing' || !intentId) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch('/api/intent-flow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'get_intent_status',
                        intentId
                    })
                });

                const data = await res.json();
                if (!data.success) return;

                const intent = data.intent;

                if (intent.timeline) setTimeline(intent.timeline);

                if (intent.status === 'completed') {
                    setStatus('completed');
                    setResult(intent.result);
                    setLogs(prev => [...prev, '✅ Execution Completed Successfully!']);
                    clearInterval(interval);
                } else if (intent.status === 'failed') {
                    setStatus('failed');
                    setError(intent.error);
                    setLogs(prev => [...prev, `❌ Execution Failed: ${intent.error}`]);
                    clearInterval(interval);
                }

            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [status, intentId]);

    // UI Helpers
    const getStepStatus = (stepName: string) => {
        const step = timeline.find(t => t.stage === stepName);
        if (step) return 'completed';
        const order = ['connecting', 'authenticating', 'channel_creating', 'encrypting', 'executing', 'settling', 'completed'];
        const currentStageIndex = timeline.length > 0 ? order.indexOf(timeline[timeline.length - 1].stage) : -1;
        const thisStageIndex = order.indexOf(stepName);
        if (currentStageIndex >= thisStageIndex) return 'completed';
        if (currentStageIndex === thisStageIndex - 1) return 'active';
        return 'pending';
    };

    return (
        <div className="min-h-screen bg-black text-white font-mono selection:bg-yellow-400 selection:text-black">
            <Navbar />

            <main className="max-w-7xl mx-auto px-6 py-12">

                {/* Header */}
                <div className="mb-12 border-b-2 border-yellow-400 pb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl md:text-6xl font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200 mb-4">
                            Intent Swap
                        </h1>
                        <p className="text-gray-400 max-w-2xl text-lg">
                            Stream encrypted intents for MEV-protected execution.
                        </p>
                    </div>

                    {/* Wallet Button */}
                    <button
                        onClick={connectWallet}
                        className={`px-6 py-3 font-bold uppercase border-2 transition-all ${account
                            ? 'bg-green-500/10 border-green-500 text-green-400 hover:bg-green-500/20'
                            : 'bg-yellow-400 text-black border-yellow-400 hover:bg-black hover:text-yellow-400'
                            }`}
                    >
                        {isConnecting ? 'Connecting...' : account ? `Connected: ${account.substring(0, 6)}...${account.substring(38)}` : 'Connect Wallet'}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

                    {/* Left Column: Input & Status */}
                    <div className="space-y-8">

                        {/* Swap Card */}
                        <div className={`border-2 p-8 transition-all duration-300 relative overflow-hidden ${status === 'completed' ? 'border-green-500 bg-green-900/10' :
                            status === 'failed' ? 'border-red-500 bg-red-900/10' :
                                'border-white/20 bg-white/5'
                            }`}>

                            {/* Stork Header */}
                            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                                <h2 className="text-xl font-bold uppercase text-white">Swap</h2>
                                <StorkTicker />
                            </div>

                            {/* Inputs */}
                            <div className="space-y-6 mb-8">
                                <div>
                                    <label className="text-xs text-gray-400 uppercase tracking-widest mb-2 block">You Stream</label>
                                    <div className="flex gap-4">
                                        <input
                                            type="text"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            disabled={status === 'executing'}
                                            className="flex-1 bg-black/50 border border-white/20 p-4 text-2xl font-bold focus:border-yellow-400 outline-none transition-colors rounded"
                                        />
                                        <select
                                            value={fromToken}
                                            onChange={(e) => setFromToken(e.target.value)}
                                            disabled={status === 'executing'}
                                            className="bg-black/50 border border-white/20 p-4 font-bold focus:border-yellow-400 outline-none rounded appearance-none cursor-pointer w-32"
                                        >
                                            {TOKENS.map(t => <option key={t.symbol} value={t.symbol}>{t.icon} {t.symbol}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex justify-center">
                                    <div className="bg-white/10 p-2 rounded-full transform rotate-90 lg:rotate-0">⬇</div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-400 uppercase tracking-widest mb-2 block">You Receive (Est.)</label>
                                    <div className="flex gap-4">
                                        <input
                                            type="text"
                                            value={status === 'completed' && result ? result.outputAmount : '---'}
                                            disabled
                                            className="flex-1 bg-black/30 border border-white/10 p-4 text-2xl font-bold text-gray-500 rounded"
                                        />
                                        <select
                                            value={toToken}
                                            onChange={(e) => setToToken(e.target.value)}
                                            disabled={status === 'executing'}
                                            className="bg-black/30 border border-white/10 p-4 font-bold text-gray-500 rounded appearance-none w-32"
                                        >
                                            {TOKENS.map(t => <option key={t.symbol} value={t.symbol}>{t.icon} {t.symbol}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Action Button */}
                            {status === 'idle' || status === 'completed' || status === 'failed' ? (
                                <button
                                    onClick={startExecution}
                                    disabled={!amount}
                                    className="w-full bg-yellow-400 text-black px-6 py-4 font-black uppercase text-xl border-2 border-transparent hover:bg-black hover:text-yellow-400 hover:border-yellow-400 transition-all shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:shadow-[0_0_40px_rgba(250,204,21,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {status === 'idle' ? 'Start Intent Stream' : 'Stream New Intent'}
                                </button>
                            ) : (
                                <div className="w-full bg-white/5 border-2 border-white/20 px-6 py-4 flex items-center justify-center gap-3">
                                    <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="font-bold uppercase tracking-widest">Processing...</span>
                                </div>
                            )}

                        </div>

                        {/* Result Details */}
                        {result && (
                            <div className="border border-white/10 bg-white/5 p-6 rounded-lg space-y-4">
                                <h3 className="text-green-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                    <span>✅ Execution Verified</span>
                                </h3>

                                <div className="grid grid-cols-2 gap-6 text-sm">
                                    <div>
                                        <div className="text-gray-500 mb-1">Time</div>
                                        <div className="font-mono text-lg">{result.executionTimeMs}ms</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-500 mb-1">Slippage</div>
                                        <div className="font-mono text-lg text-green-400">{result.slippage}%</div>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-white/10">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 uppercase">Input</span>
                                        <span className="font-mono">{result.inputAmount} {result.inputToken}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 uppercase">Output</span>
                                        <span className="font-mono text-yellow-400">{result.outputAmount} {result.outputToken}</span>
                                    </div>

                                    <div className="pt-2">
                                        <div className="text-gray-500 text-xs uppercase mb-1">Execution Hash (Uniswap V4)</div>
                                        <a href={`https://sepolia.etherscan.io/tx/${result.txHash}`} target="_blank" className="text-blue-400 text-xs font-mono break-all hover:underline block bg-black/30 p-2 rounded">
                                            {result.txHash}
                                        </a>
                                    </div>

                                    {result.yellowSessionId && (
                                        <div>
                                            <div className="text-gray-500 text-xs uppercase mb-1">Yellow Session ID</div>
                                            <div className="text-yellow-600 text-xs font-mono break-all bg-black/30 p-2 rounded">
                                                {result.yellowSessionId}
                                            </div>
                                        </div>
                                    )}

                                    {result.yellowChannelId && (
                                        <div>
                                            <div className="text-gray-500 text-xs uppercase mb-1">Yellow Channel ID</div>
                                            <div className="text-yellow-600 text-xs font-mono break-all bg-black/30 p-2 rounded">
                                                {result.yellowChannelId}
                                            </div>
                                        </div>
                                    )}

                                    {result.arcTxHash && (
                                        <div>
                                            <div className="text-gray-500 text-xs uppercase mb-1">Arc Settlement Proof</div>
                                            <div className="text-purple-400 text-xs font-mono break-all bg-black/30 p-2 rounded">
                                                {result.arcTxHash}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Right Column: Visualization & Logs */}
                    <div className="space-y-8">

                        {/* Timeline */}
                        <div className="bg-black/50 p-8 border border-white/10 rounded-lg">
                            <h3 className="text-gray-400 font-bold uppercase tracking-widest mb-6">Execution Pipeline</h3>
                            <div className="relative pl-8 border-l-2 border-white/10 space-y-8">
                                {[
                                    { id: 'connecting', label: 'Yellow Network Handshake', desc: 'Secure P2P connection' },
                                    { id: 'authenticating', label: 'Agent Authentication', desc: 'Verifying session keys' },
                                    { id: 'channel_creating', label: 'State Channel Setup', desc: 'Opening or Reusing Channel' },
                                    { id: 'encrypting', label: 'Intent Encryption', desc: 'Zero-knowledge packaging' },
                                    { id: 'executing', label: 'Uniswap V4 Execution', desc: 'On-chain atomic swap' },
                                    { id: 'settling', label: 'Arc Settlement', desc: 'Cross-chain finality' }
                                ].map((step, idx) => {
                                    const stepStatus = getStepStatus(step.id);
                                    return (
                                        <div key={step.id} className="relative">
                                            <div className={`absolute -left-[37px] top-1 w-4 h-4 rounded-full border-2 transition-all duration-300 ${stepStatus === 'completed' ? 'bg-green-500 border-green-500' :
                                                stepStatus === 'active' ? 'bg-yellow-400 border-yellow-400 animate-ping' :
                                                    'bg-black border-gray-600'
                                                }`} />
                                            <div className={`transition-opacity duration-300 ${stepStatus === 'pending' ? 'opacity-40' : 'opacity-100'}`}>
                                                <h4 className={`font-bold uppercase ${stepStatus === 'active' ? 'text-yellow-400' :
                                                    stepStatus === 'completed' ? 'text-green-500' : 'text-white'
                                                    }`}>{step.label}</h4>
                                                <p className="text-sm text-gray-400">{step.desc}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Terminal */}
                        <div className="bg-gray-900 rounded-lg overflow-hidden border border-white/10 flex flex-col h-[400px] shadow-2xl font-mono text-sm">
                            <div className="bg-black px-4 py-2 border-b border-white/10 flex justify-between items-center">
                                <span className="text-xs text-gray-400 uppercase">Live Stream</span>
                                <div className="flex gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                </div>
                            </div>
                            <div className="p-4 overflow-y-auto flex-1 space-y-1">
                                {logs.map((log, i) => (
                                    <div key={i} className="break-words border-l-2 border-transparent hover:border-white/20 pl-2">
                                        <span className="text-gray-600 mr-2">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                                        <span className={log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : 'text-gray-300'}>
                                            {log}
                                        </span>
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}


