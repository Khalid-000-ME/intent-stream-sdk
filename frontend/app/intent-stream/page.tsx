'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { ethers } from 'ethers';
import { StorkTicker } from '@/components/StorkTicker';

export default function IntentStreamPage() {
    // Wallet State
    const [account, setAccount] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [agentId, setAgentId] = useState<string | null>(null);

    // Intent Input State
    const [prompt, setPrompt] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Workflow State
    const [step, setStep] = useState<'input' | 'review' | 'executing' | 'completed' | 'failed'>('input');

    // NEW STATE for Multi-Intent
    const [parsedIntents, setParsedIntents] = useState<any[]>([]);
    const [currentIntentIndex, setCurrentIntentIndex] = useState(0);
    const [intentId, setIntentId] = useState<string | null>(null);

    // Execution details
    const [timeline, setTimeline] = useState<any[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    // Connect Wallet & Register Agent
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
                const userAddress = accounts[0];
                setAccount(userAddress);

                // Register Agent for this user
                await registerAgent(userAddress);
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
                console.log('Agent registered:', data.agent.id);
            }
        } catch (e) {
            console.error('Agent registration failed:', e);
        }
    };

    // Analyze Prompt
    const analyzeIntent = async () => {
        if (!prompt.trim()) return;
        if (!account) {
            await connectWallet();
            if (!account && !(window.ethereum as any)?.selectedAddress) return;
        }

        setIsAnalyzing(true);
        setError(null);

        try {
            const res = await fetch('/api/agent/intelligent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    agentId: agentId || 'temp-agent',
                    network: 'ethereum' // Default context
                })
            });
            const data = await res.json();

            if (!data.success) throw new Error(data.error || 'Failed to analyze intent');

            // Handle Array of Intents
            setParsedIntents(data.intents || (data.intent ? [data.intent] : []));
            setCurrentIntentIndex(0);
            setStep('review');
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Trigger Execution (Start Queue)
    const triggerExecution = () => {
        if (parsedIntents.length === 0) return;

        setStep('executing');
        setTimeline([]);
        setLogs(['🚀 Initializing Execution Sequence...']);
        setError(null);
        setResult(null);
        setIntentId(null);
        setCurrentIntentIndex(0);
    };

    // Execution Loop Effect
    useEffect(() => {
        if (step !== 'executing') return;

        const intent = parsedIntents[currentIntentIndex];
        if (!intent) return;

        // Only run if we don't have an active intentId (meaning starting new one)
        if (intentId) return;

        const runIntent = async () => {
            try {
                setLogs(prev => [...prev, `👉 Starting Intent ${currentIntentIndex + 1}/${parsedIntents.length}: ${intent.type}`]);
                setLogs(prev => [...prev, '🔐 Authenticating intent...']);

                const authRes = await fetch('/api/yellow/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...intent,
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
                setStep('failed');
                setLogs(prev => [...prev, `❌ Error: ${err.message}`]);
            }
        };

        runIntent();
    }, [step, currentIntentIndex, intentId, parsedIntents, account]);

    // Polling Effect
    useEffect(() => {
        if (step !== 'executing' || !intentId) return;

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

                if (!res.ok || !data.success) {
                    return;
                }

                const intent = data.intent;
                if (intent.timeline) setTimeline(intent.timeline);

                if (intent.status === 'completed') {
                    if (currentIntentIndex < parsedIntents.length - 1) {
                        // Next Intent
                        setLogs(prev => [...prev, `✅ Intent #${currentIntentIndex + 1} Done. Proceeding to next...`]);
                        setIntentId(null);
                        setCurrentIntentIndex(prev => prev + 1);
                        clearInterval(interval);
                    } else {
                        // All Done
                        setStep('completed');
                        setResult(intent.result);
                        setLogs(prev => [...prev, '✅ All Intents Executed Successfully!']);
                        clearInterval(interval);
                    }
                } else if (intent.status === 'failed') {
                    setStep('failed');
                    setError(intent.error);
                    setLogs(prev => [...prev, `❌ Execution Failed: ${intent.error}`]);
                    clearInterval(interval);
                }

            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [step, intentId, currentIntentIndex, parsedIntents.length]);


    // UI Helpers
    const getStepStatus = (stepName: string) => {
        const stepDetail = timeline.find(t => t.stage === stepName);
        if (stepDetail) return 'completed';
        const order = ['connecting', 'authenticating', 'channel_creating', 'encrypting', 'executing', 'settling', 'completed'];
        const currentStageIndex = timeline.length > 0 ? order.indexOf(timeline[timeline.length - 1].stage) : -1;
        const thisStageIndex = order.indexOf(stepName);
        if (currentStageIndex >= thisStageIndex) return 'completed';
        if (currentStageIndex === thisStageIndex - 1) return 'active';
        return 'pending';
    };

    const reset = () => {
        setStep('input');
        setPrompt('');
        setParsedIntents([]);
        setCurrentIntentIndex(0);
        setIntentId(null);
        setTimeline([]);
        setResult(null);
        setError(null);
        setLogs([]);
    };

    return (
        <div className="min-h-screen bg-black text-white font-mono selection:bg-yellow-400 selection:text-black">
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 py-12">
                <div className="mb-12 border-b-2 border-yellow-400 pb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl md:text-6xl font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200 mb-4">
                            Agent Stream
                        </h1>
                        <p className="text-gray-400 max-w-2xl text-lg">
                            AI-powered intent execution. Just describe what you want.
                        </p>
                    </div>
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
                    <div className="space-y-8">
                        <div className={`border-2 p-8 transition-all duration-300 relative overflow-hidden ${step === 'completed' ? 'border-green-500 bg-green-900/10' :
                            step === 'failed' ? 'border-red-500 bg-red-900/10' :
                                'border-white/20 bg-white/5'
                            }`}>

                            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                                <h2 className="text-xl font-bold uppercase text-white">
                                    {step === 'input' ? 'Describe Intent' : 'Intent Review'}
                                </h2>
                                <StorkTicker />
                            </div>

                            {step === 'input' && (
                                <div className="space-y-6">
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="e.g., Swap 1 ETH to USDC on Base then send 100 USDC to 0x123 on Arbitrum..."
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
                                                            <span className="font-mono">{parsedIntent.fromChain || parsedIntent.network}</span>
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
                                                            <span className="font-mono">{parsedIntent.fromChain || parsedIntent.network}</span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-white/10 pb-2">
                                                            <span className="text-gray-400">To Chain</span>
                                                            <span className="font-mono">{parsedIntent.toChain || 'Same Chain'}</span>
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
                                                Approve All
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

                        {result && (
                            <div className="border border-white/10 bg-white/5 p-6 rounded-lg space-y-4">
                                <h3 className="text-green-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                    <span>✅ Execution Verified</span>
                                </h3>

                                <div className="grid grid-cols-2 gap-6 text-sm">
                                    <div>
                                        <div className="text-gray-500 mb-1">Time</div>
                                        <div className="font-mono text-lg">{result.executionTimeMs || 'N/A'}ms</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-500 mb-1">Status</div>
                                        <div className="font-mono text-lg text-green-400">Confirmed</div>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-white/10">
                                    {result.txHash && (
                                        <div className="pt-2">
                                            <div className="text-gray-500 text-xs uppercase mb-1">Execution Hash</div>
                                            <a href={`https://sepolia.etherscan.io/tx/${result.txHash}`} target="_blank" className="text-blue-400 text-xs font-mono break-all hover:underline block bg-black/30 p-2 rounded">
                                                {result.txHash}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-8">
                        <div className="bg-black/50 p-8 border border-white/10 rounded-lg">
                            <h3 className="text-gray-400 font-bold uppercase tracking-widest mb-6">Execution Pipeline</h3>
                            <div className="relative pl-8 border-l-2 border-white/10 space-y-8">
                                {[
                                    { id: 'connecting', label: 'Yellow Network Handshake', desc: 'Secure P2P connection' },
                                    { id: 'authenticating', label: 'Agent Authentication', desc: 'Verifying session keys' },
                                    { id: 'channel_creating', label: 'State Channel Setup', desc: 'Opening or Reusing Channel' },
                                    { id: 'encrypting', label: 'Intent Encryption', desc: 'Zero-knowledge packaging' },
                                    { id: 'executing', label: 'Chain Execution', desc: 'On-chain settlement' },
                                    { id: 'settling', label: 'Final Settlement', desc: 'Cross-chain finality' }
                                ].map((pipelineStep) => {
                                    const stepStatus = getStepStatus(pipelineStep.id);
                                    return (
                                        <div key={pipelineStep.id} className="relative">
                                            <div className={`absolute -left-[37px] top-1 w-4 h-4 rounded-full border-2 transition-all duration-300 ${stepStatus === 'completed' ? 'bg-green-500 border-green-500' :
                                                stepStatus === 'active' ? 'bg-yellow-400 border-yellow-400 animate-ping' :
                                                    'bg-black border-gray-600'
                                                }`} />
                                            <div className={`transition-opacity duration-300 ${stepStatus === 'pending' ? 'opacity-40' : 'opacity-100'}`}>
                                                <h4 className={`font-bold uppercase ${stepStatus === 'active' ? 'text-yellow-400' :
                                                    stepStatus === 'completed' ? 'text-green-500' : 'text-white'
                                                    }`}>{pipelineStep.label}</h4>
                                                <p className="text-sm text-gray-400">{pipelineStep.desc}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-gray-900 rounded-lg overflow-hidden border border-white/10 flex flex-col h-[400px] shadow-2xl font-mono text-sm">
                            <div className="bg-black px-4 py-2 border-b border-white/10 flex justify-between items-center">
                                <span className="text-xs text-gray-400 uppercase">Agent Live Stream</span>
                                <div className="flex gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                </div>
                            </div>
                            <div className="p-4 overflow-y-auto flex-1 space-y-1">
                                {logs.length === 0 && <div className="text-gray-600 italic">Waiting to process stream...</div>}
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
