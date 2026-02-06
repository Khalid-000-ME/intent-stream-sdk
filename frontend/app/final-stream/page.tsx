'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { ethers } from 'ethers';
import { StorkTicker } from '@/components/StorkTicker';


export default function FinalStreamPage() {
    // Wallet State
    const [account, setAccount] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [agentId, setAgentId] = useState<string | null>(null);

    // Intent Input State
    const [prompt, setPrompt] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Workflow State
    const [step, setStep] = useState<'input' | 'review' | 'executing' | 'completed' | 'failed'>('input');

    // Multi-Intent State
    const [parsedIntents, setParsedIntents] = useState<any[]>([]);
    const [currentIntentIndex, setCurrentIntentIndex] = useState(0);
    const [intentId, setIntentId] = useState<string | null>(null);

    // Execution details
    const [timeline, setTimeline] = useState<any[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [results, setResults] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Balances
    const [balances, setBalances] = useState<any>(null);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Poll balances
    const fetchBalances = async () => {
        try {
            const res = await fetch('/api/debug/balances');
            const data = await res.json();
            if (data.balances) setBalances(data);
        } catch (e) {
            console.error("Balance fetch error", e);
        }
    };

    useEffect(() => {
        fetchBalances();
        const interval = setInterval(fetchBalances, 5000);
        return () => clearInterval(interval);
    }, []);

    const addLog = (msg: string) => {
        setLogs(p => [...p, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    // Connect Wallet & Register Agent
    const connectWallet = async () => {
        if (typeof window === 'undefined' || !window.ethereum) {
            alert('Please install MetaMask to connect.');
            return;
        }

        setIsConnecting(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.send("eth_requestAccounts", []);
            if (accounts.length > 0) {
                const userAddress = accounts[0];
                setAccount(userAddress);
                await registerAgent(userAddress);
                addLog(`✅ Wallet connected: ${userAddress.substring(0, 6)}...${userAddress.substring(38)}`);
            }
        } catch (err: any) {
            console.error('Connection failed:', err);
            alert('Failed to connect wallet');
        } finally {
            setIsConnecting(false);
        }
    };

    const registerAgent = async (userAddress: string) => {
        try {
            const res = await fetch('/api/agent/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentWallet: userAddress,
                    metadata: { role: 'User', strategy: 'Manual' }
                })
            });
            const data = await res.json();
            if (data.success && data.agent?.id) {
                setAgentId(data.agent.id);
                addLog(`✅ Agent registered: ${data.agent.id}`);
            }
        } catch (e) {
            console.error('Agent registration failed:', e);
        }
    };

    // Analyze Prompt with Gemini
    const analyzeIntent = async () => {
        if (!prompt.trim()) return;
        if (!account) {
            await connectWallet();
            if (!account && !(window.ethereum as any)?.selectedAddress) return;
        }

        setIsAnalyzing(true);
        setError(null);
        addLog('🤖 Analyzing intent with Gemini...');

        try {
            const res = await fetch('/api/agent/intelligent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    agentId: agentId || 'temp-agent',
                    network: 'base'
                })
            });
            const data = await res.json();

            if (!data.success) throw new Error(data.error || 'Failed to analyze intent');

            const intents = data.intents || (data.intent ? [data.intent] : []);
            setParsedIntents(intents);
            setCurrentIntentIndex(0);
            setStep('review');
            addLog(`✅ Parsed ${intents.length} intent(s)`);
        } catch (err: any) {
            console.error(err);
            setError(err.message);
            addLog(`❌ Analysis failed: ${err.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Trigger Execution
    const triggerExecution = () => {
        if (parsedIntents.length === 0) return;

        setStep('executing');
        setTimeline([]);
        setLogs([]);
        setError(null);
        setResults([]);
        setIntentId(null);
        setCurrentIntentIndex(0);
        addLog('🚀 Starting execution sequence...');
    };

    // Execute Single Intent
    const executeIntent = async (intent: any, index: number) => {
        const idPrefix = `Intent #${index + 1}`;
        addLog(`${idPrefix}: Starting ${intent.type}...`);

        try {
            if (intent.type === 'SWAP') {
                return await executeSwap(intent, idPrefix);
            } else if (intent.type === 'PAYMENT') {
                return await executePayment(intent, idPrefix);
            } else {
                throw new Error(`Unknown intent type: ${intent.type}`);
            }
        } catch (err: any) {
            addLog(`${idPrefix}: ❌ Failed: ${err.message}`);
            throw err;
        }
    };

    // Execute V4 Swap
    const executeSwap = async (intent: any, idPrefix: string) => {
        addLog(`${idPrefix}: 🔄 Executing V4 Swap...`);

        const res = await fetch('/api/v4/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromToken: intent.fromToken,
                toToken: intent.toToken,
                amount: intent.amount,
                network: intent.network || 'base'
            })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Swap failed');

        addLog(`${idPrefix}: ✅ Swap Complete!`);
        addLog(`${idPrefix}:    Tx: ${data.txHash}`);
        addLog(`${idPrefix}:    Output: ${data.outputAmount} ${data.outputToken} (ERC-6909)`);

        fetchBalances();
        return data;
    };

    // Helper: Map chain names to BridgeChain enum format
    const mapChainName = (chainName: string): string => {
        const chainMap: { [key: string]: string } = {
            'base': 'Base_Sepolia',
            'base_sepolia': 'Base_Sepolia',
            'ethereum': 'Ethereum_Sepolia',
            'ethereum_sepolia': 'Ethereum_Sepolia',
            'arbitrum': 'Arbitrum_Sepolia',
            'arbitrum_sepolia': 'Arbitrum_Sepolia',
            'arc': 'Arc_Testnet',
            'arc_testnet': 'Arc_Testnet',
        };

        const normalized = chainName.toLowerCase().replace(/\s+/g, '_');
        return chainMap[normalized] || chainName;
    };

    // Execute Payment (Bridging)
    const executePayment = async (intent: any, idPrefix: string) => {
        addLog(`${idPrefix}: 🌉 Executing Cross-Chain Payment (via Server)...`);

        // Check if we need to redeem first (heuristic: if bridging from Base and we have claims)
        // For robustness, we ALWAYS try to redeem USDC/WETH on Base before bridging if the source is Base
        const fromChain = mapChainName(intent.fromChain || 'base');

        if (fromChain === 'Base_Sepolia') {
            addLog(`${idPrefix}: 🔓 Checking for claims to redeem first...`);
            try {
                // Try redeeming USDC
                await redeemToken('USDC');
            } catch (ignore) { }
        }

        // Map chain names to correct BridgeChain enum format
        const toChain = mapChainName(intent.toChain || 'arc');

        addLog(`${idPrefix}:    Bridging ${intent.amount} USDC`);
        addLog(`${idPrefix}:    From: ${fromChain}`);
        addLog(`${idPrefix}:    To: ${toChain}`);

        // Call Server API
        const res = await fetch('/api/bridge/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromChain,
                toChain,
                amount: intent.amount,
                token: 'USDC', // Default to USDC for CCTP
                recipient: intent.recipient
            })
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.error || 'Server bridge failed');
        }

        addLog(`${idPrefix}: ✅ Bridge Initiated!`);
        addLog(`${idPrefix}:    Tx: ${data.txHash}`);

        if (data.details?.steps) {
            data.details.steps.forEach((step: any) => {
                addLog(`${idPrefix}:    Step [${step.name}]: ${step.state}`);
            });
        }

        fetchBalances();
        return data;
    };

    // Execution Loop Effect
    useEffect(() => {
        if (step !== 'executing') return;
        if (currentIntentIndex >= parsedIntents.length) {
            setStep('completed');
            addLog('🎉 All intents executed successfully!');
            return;
        }

        const intent = parsedIntents[currentIntentIndex];
        if (!intent) return;

        const runIntent = async () => {
            try {
                const result = await executeIntent(intent, currentIntentIndex);
                setResults(prev => [...prev, result]);

                // Move to next intent
                if (currentIntentIndex < parsedIntents.length - 1) {
                    setCurrentIntentIndex(prev => prev + 1);
                } else {
                    setStep('completed');
                    addLog('🎉 All intents executed successfully!');
                }
            } catch (err: any) {
                setError(err.message);
                setStep('failed');
                addLog(`❌ Execution failed: ${err.message}`);
            }
        };

        runIntent();
    }, [step, currentIntentIndex, parsedIntents]);

    const reset = () => {
        setStep('input');
        setPrompt('');
        setParsedIntents([]);
        setCurrentIntentIndex(0);
        setIntentId(null);
        setTimeline([]);
        setResults([]);
        setError(null);
        setLogs([]);
    };

    const redeemToken = async (token: string) => {
        try {
            addLog(`🔓 Redeeming ${token} claims...`);
            const res = await fetch('/api/v4/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, amount: 'all', network: 'base' })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            addLog(`✅ Redeemed: ${data.redeemedAmount} ${data.token}`);
            addLog(`   Tx: ${data.txHash}`);
            fetchBalances();
        } catch (e: any) {
            addLog(`❌ Redemption failed: ${e.message}`);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-yellow-500/30">
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-900/20 via-black to-black pointer-events-none" />

            <Navbar />

            <main className="relative pt-32 pb-20 px-6 max-w-7xl mx-auto">
                <div className="flex flex-col gap-8">

                    {/* Header */}
                    <div className="flex justify-between items-end border-b-2 border-yellow-400 pb-8">
                        <div>
                            <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter mb-4">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                                    UniFlow
                                </span>
                                <br />
                                <span className="text-white text-3xl md:text-5xl not-italic">Final Stream</span>
                            </h1>
                            <p className="text-xl text-gray-400 max-w-2xl">
                                AI-powered intent execution. Swap & Bridge with natural language.
                            </p>
                        </div>
                        <div className="flex gap-4 items-center">
                            <StorkTicker />
                            <button
                                onClick={connectWallet}
                                className={`px-6 py-3 font-bold uppercase border-2 transition-all ${account
                                    ? 'bg-green-500/10 border-green-500 text-green-400 hover:bg-green-500/20'
                                    : 'bg-yellow-400 text-black border-yellow-400 hover:bg-black hover:text-yellow-400'
                                    }`}
                            >
                                {isConnecting ? 'Connecting...' : account ? `${account.substring(0, 6)}...${account.substring(38)}` : 'Connect Wallet'}
                            </button>
                        </div>
                    </div>

                    {/* Balances Card */}
                    <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 p-6 rounded-xl shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold uppercase text-white">💰 Server Balances (Base Sepolia)</h2>
                            <span className="text-xs font-mono text-gray-500">{balances?.address}</span>
                        </div>

                        {balances ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                    <div className="text-gray-400 text-xs uppercase">ERC20 USDC</div>
                                    <div className="text-2xl font-mono text-blue-400">{balances.balances.usdc}</div>
                                </div>
                                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                    <div className="text-gray-400 text-xs uppercase">ERC20 WETH</div>
                                    <div className="text-2xl font-mono text-purple-400">{Number(balances.balances.weth).toFixed(6)}</div>
                                </div>
                                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 bg-opacity-50 relative group">
                                    <div className="text-gray-400 text-xs uppercase">Claim USDC (6909)</div>
                                    <div className="text-lg font-mono text-yellow-500">{balances.balances.claimUsdc}</div>
                                    <button
                                        onClick={() => redeemToken('USDC')}
                                        className="absolute top-2 right-2 bg-yellow-500 hover:bg-yellow-400 text-black text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        REDEEM
                                    </button>
                                </div>
                                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 bg-opacity-50 relative group">
                                    <div className="text-gray-400 text-xs uppercase">Claim WETH (6909)</div>
                                    <div className="text-lg font-mono text-yellow-500">{Number(balances.balances.claimWeth).toFixed(8)}</div>
                                    <button
                                        onClick={() => redeemToken('WETH')}
                                        className="absolute top-2 right-2 bg-yellow-500 hover:bg-yellow-400 text-black text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        REDEEM
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-gray-500 animate-pulse">Loading balances...</div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Intent Input/Review Card */}
                        <div className={`border-2 p-8 transition-all duration-300 relative overflow-hidden ${step === 'completed' ? 'border-green-500 bg-green-900/10' :
                            step === 'failed' ? 'border-red-500 bg-red-900/10' :
                                'border-white/20 bg-white/5'
                            }`}>

                            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                                <h2 className="text-xl font-bold uppercase text-white">
                                    {step === 'input' ? '📝 Describe Intent' : '📋 Intent Review'}
                                </h2>
                            </div>

                            {step === 'input' && (
                                <div className="space-y-6">
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="e.g., Swap 0.1 WETH to USDC on Base then send 50 USDC to 0x123... on Arbitrum"
                                        className="w-full h-48 bg-black/50 border border-white/20 p-4 text-xl font-bold focus:border-yellow-400 outline-none transition-colors rounded resize-none"
                                        disabled={isAnalyzing}
                                    />
                                    <button
                                        onClick={analyzeIntent}
                                        disabled={!prompt || isAnalyzing}
                                        className="w-full bg-yellow-400 text-black px-6 py-4 font-black uppercase text-xl border-2 border-transparent hover:bg-black hover:text-yellow-400 hover:border-yellow-400 transition-all shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:shadow-[0_0_40px_rgba(250,204,21,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                    >
                                        {isAnalyzing ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                                Analyzing...
                                            </>
                                        ) : (
                                            'Analyze Intent'
                                        )}
                                    </button>
                                </div>
                            )}

                            {(step === 'review' || step === 'executing' || step === 'completed' || step === 'failed') && parsedIntents.length > 0 && (
                                <div className="space-y-6">
                                    <div className="space-y-4 text-lg max-h-[400px] overflow-y-auto">
                                        {parsedIntents.map((parsedIntent, idx) => (
                                            <div key={idx} className={`border p-4 rounded transition-all ${step === 'executing' && idx === currentIntentIndex
                                                ? 'border-yellow-400 bg-yellow-400/10 shadow-[0_0_15px_rgba(250,204,21,0.2)]'
                                                : step === 'executing' && idx < currentIntentIndex
                                                    ? 'border-green-500/50 opacity-50'
                                                    : 'border-white/10'
                                                }`}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className={`text-sm font-bold uppercase ${idx === currentIntentIndex && step === 'executing' ? 'text-yellow-400' : 'text-gray-400'
                                                        }`}>
                                                        Action #{idx + 1}
                                                    </span>
                                                    {idx < currentIntentIndex && step === 'executing' && <span className="text-green-400 text-xs">✔ DONE</span>}
                                                </div>

                                                <div className="flex justify-between border-b border-white/10 pb-2">
                                                    <span className="text-gray-400">Type</span>
                                                    <span className="font-bold text-yellow-400">{parsedIntent.type}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-white/10 pb-2">
                                                    <span className="text-gray-400">Amount</span>
                                                    <span className="font-mono">{parsedIntent.amount}</span>
                                                </div>
                                                {parsedIntent.type === 'SWAP' && (
                                                    <>
                                                        <div className="flex justify-between border-b border-white/10 pb-2">
                                                            <span className="text-gray-400">From</span>
                                                            <span className="font-mono">{parsedIntent.fromToken}</span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-white/10 pb-2">
                                                            <span className="text-gray-400">To</span>
                                                            <span className="font-mono">{parsedIntent.toToken}</span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-white/10 pb-2">
                                                            <span className="text-gray-400">Chain</span>
                                                            <span className="font-mono">{parsedIntent.network || 'base'}</span>
                                                        </div>
                                                    </>
                                                )}
                                                {parsedIntent.type === 'PAYMENT' && (
                                                    <>
                                                        <div className="flex justify-between border-b border-white/10 pb-2">
                                                            <span className="text-gray-400">Recipient</span>
                                                            <span className="font-mono text-xs md:text-base break-all">{parsedIntent.recipient}</span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-white/10 pb-2">
                                                            <span className="text-gray-400">From Chain</span>
                                                            <span className="font-mono">{parsedIntent.fromChain || 'base'}</span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-white/10 pb-2">
                                                            <span className="text-gray-400">To Chain</span>
                                                            <span className="font-mono">{parsedIntent.toChain || 'arbitrum'}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {step === 'review' && (
                                        <div className="flex gap-4">
                                            <button
                                                onClick={reset}
                                                className="flex-1 bg-transparent border-2 border-white/20 text-white px-6 py-4 font-bold uppercase hover:bg-white/10 transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={triggerExecution}
                                                className="flex-1 bg-green-500 text-black px-6 py-4 font-black uppercase text-xl border-2 border-transparent hover:bg-black hover:text-green-500 hover:border-green-500 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                                            >
                                                Execute All
                                            </button>
                                        </div>
                                    )}

                                    {step === 'executing' && (
                                        <div className="w-full bg-white/5 border-2 border-white/20 px-6 py-4 flex items-center justify-center gap-3">
                                            <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                                            <span className="font-bold uppercase tracking-widest">Processing Action {currentIntentIndex + 1}...</span>
                                        </div>
                                    )}

                                    {(step === 'completed' || step === 'failed') && (
                                        <button
                                            onClick={reset}
                                            className="w-full bg-white text-black px-6 py-4 font-bold uppercase hover:bg-gray-200 transition-all"
                                        >
                                            Start New Intent
                                        </button>
                                    )}
                                </div>
                            )}

                            {error && (
                                <div className="mt-4 p-4 bg-red-900/20 border border-red-500/50 text-red-200 text-sm rounded">
                                    ⚠️ {error}
                                </div>
                            )}
                        </div>

                        {/* Logs Console */}
                        <div className="bg-black border border-white/20 p-6 rounded-xl font-mono text-xs md:text-sm h-[600px] flex flex-col shadow-inner shadow-black/50">
                            <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                                <span className="text-green-500 font-bold">&gt; EXECUTION LOGS</span>
                                <span className="text-xs text-gray-500">{step === 'executing' ? '● PROCESSING' : '● IDLE'}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                                {logs.length === 0 && <div className="text-gray-600 italic">Ready to execute...</div>}
                                {logs.map((log, i) => (
                                    <div key={i} className="break-all border-l-2 border-transparent pl-2 hover:border-yellow-500/50 transition-colors py-0.5">
                                        <span className={
                                            log.includes('❌') ? 'text-red-400' :
                                                log.includes('🎉') || log.includes('✅') ? 'text-green-400 font-bold' :
                                                    log.includes('Tx:') ? 'text-blue-300' :
                                                        'text-gray-300'
                                        }>
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
