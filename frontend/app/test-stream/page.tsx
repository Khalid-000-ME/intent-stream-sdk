'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';

export default function TestStreamPage() {
    const [count, setCount] = useState(1);
    const [intervalMs, setIntervalMs] = useState(2000);
    const [promptTemplate, setPromptTemplate] = useState('Swap 0.0001 WETH to USDC on Base');
    const [executionMode, setExecutionMode] = useState<'yellow' | 'v4'>('v4'); // Default to V4
    const [running, setRunning] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [balances, setBalances] = useState<any>(null);

    const logsEndRef = useRef<HTMLDivElement>(null);

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
        const interval = setInterval(fetchBalances, 5000); // 5s poll
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const addLog = (msg: string) => {
        setLogs(p => [...p, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    const redeemToken = async (token: string) => {
        try {
            addLog(`🔓 Initiating Redemption: All ${token} Claims...`);
            const res = await fetch('/api/v4/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, amount: 'all', network: 'base' })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            addLog(`🎉 REDEEMED: ${data.redeemedAmount} ${data.token}`);
            addLog(`   > Tx Hash: ${data.txHash}`);
            fetchBalances();
        } catch (e: any) {
            addLog(`❌ Redemption Failed: ${e.message}`);
        }
    };

    const runSingleIntent = async (index: number) => {
        const idPrefix = `Attempt #${index + 1}`;
        // Generate a simplified UUID for tracking
        const intentId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        try {
            addLog(`${idPrefix}: 🤖 parsed prompt... (${intentId})`);

            // 1. Parse Prompt (Agent) - We use this to get structured data
            // If Agent API is rate limited, we fallback to local defaults for the stress test
            let intentData = {
                type: 'SWAP',
                amount: 0.0001,
                fromToken: 'WETH',
                toToken: 'USDC',
                network: 'base'
            };

            try {
                const agentRes = await fetch('/api/agent/intelligent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: promptTemplate, network: 'base' })
                });
                const agentJson = await agentRes.json();
                if (agentJson.success && agentJson.intents?.[0]) {
                    intentData = agentJson.intents[0];
                    addLog(`${idPrefix}: ✅ Agent Parsed: ${intentData.amount} ${intentData.fromToken}->${intentData.toToken}`);
                } else {
                    addLog(`${idPrefix}: ⚠️ Agent Parse Failed/Limit. Using Defaults.`);
                }
            } catch (ignore) {
                addLog(`${idPrefix}: ⚠️ Agent Network Error. Using Defaults.`);
            }

            // === V4 MODE: Direct Swap (Skip Yellow Network) ===
            if (executionMode === 'v4') {
                addLog(`${idPrefix}: 🔄 Executing V4 Swap...`);
                const v4Res = await fetch('/api/v4/swap', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fromToken: intentData.fromToken,
                        toToken: intentData.toToken,
                        amount: intentData.amount,
                        network: 'base'
                    })
                });
                const v4Data = await v4Res.json();
                if (!v4Data.success) throw new Error(`V4 Swap Failed: ${v4Data.error}`);

                addLog(`${idPrefix}: 🎉 COMPLETED!`);
                addLog(`   > V4 Swap Tx:     ${v4Data.txHash}`);
                addLog(`   > Block Number:   ${v4Data.blockNumber}`);
                addLog(`   > Output Claim:   ${v4Data.outputAmount} ${v4Data.outputToken} (ERC-6909)`);
                addLog(`   > Note: ${v4Data.note}`);
                fetchBalances();
                return; // Exit early - no Yellow Network needed
            }

            // === YELLOW NETWORK MODE: Off-chain Settlement ===
            // 2. Auth (Yellow)
            addLog(`${idPrefix}: 🔐 Authenticating...`);
            const authRes = await fetch('/api/yellow/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const authData = await authRes.json();
            if (!authData.success) throw new Error(`Auth Failed: ${authData.error}`);

            // IMPORTANT: Auth generates the actual Intent ID used for the session
            // We must update our local tracking ID to match it
            const activeIntentId = authData.intentId;
            addLog(`${idPrefix}: ✅ Auth Success (ID: ${activeIntentId.substring(0, 8)}...)`);

            // 3. Create Channel
            addLog(`${idPrefix}: 🔗 Opening Channel...`);
            const chanRes = await fetch('/api/yellow/create-channel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    intentId: activeIntentId,
                    userAddress: authData.userAddress,
                    forceNew: false // Try to reuse cached channels for speed
                })
            });
            const chanData = await chanRes.json();
            if (!chanData.success) throw new Error(`Channel Failed: ${chanData.error}`);
            addLog(`${idPrefix}: ✅ Channel Ready: ${chanData.channelId.substring(0, 8)}...`);

            // Yellow Network Flow (Off-chain)
            addLog(`${idPrefix}: 📤 Submitting Intent...`);
            const submitRes = await fetch('/api/intent/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    intentId: activeIntentId,
                    type: intentData.type,
                    amount: intentData.amount,
                    fromToken: intentData.fromToken,
                    toToken: intentData.toToken,
                    network: 'base',
                    recipient: (intentData as any).recipient
                })
            });
            const submitJson = await submitRes.json();
            if (!submitJson.success) throw new Error(`Submit Failed: ${submitJson.error}`);

            addLog(`${idPrefix}: 🚀 Execution Started!`);

            // Wait 2s before polling to allow backend registration
            await new Promise(r => setTimeout(r, 2000));

            // 5. Poll Status
            let attempts = 0;
            const pollInterval = setInterval(async () => {
                attempts++;
                if (attempts > 60) { // 60s timeout
                    clearInterval(pollInterval);
                    addLog(`${idPrefix}: ⚠️ Timed out polling status.`);
                    return;
                }

                try {
                    const statusRes = await fetch('/api/intent-flow', {
                        method: 'POST', // Only POST supported currently for "get_intent_status" action
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'get_intent_status', intentId: activeIntentId })
                    });
                    const statusData = await statusRes.json();

                    if (!statusData.success || !statusData.intent) return;

                    const intent = statusData.intent;

                    // Log intermediate states if new
                    const lastStage = intent.timeline?.length > 0 ? intent.timeline[intent.timeline.length - 1].stage : null;
                    if (lastStage && lastStage !== 'completed') {
                        // Optional: could add specific logs per stage change here if desired
                    }

                    if (intent.status === 'completed') {
                        clearInterval(pollInterval);
                        const res = intent.result || {};
                        addLog(`${idPrefix}: 🎉 COMPLETED!`);
                        addLog(`   > V4 Swap Tx:     ${res.txHash || 'N/A'}`);
                        addLog(`   > Arc Settlement: ${res.arcTxHash || 'N/A'}`);
                        addLog(`   > Yellow Channel: ${res.yellowChannelId?.substring(0, 16)}...`);
                        addLog(`   > Result: Received ${res.outputAmount} ${res.outputToken}`);
                        fetchBalances(); // Refresh balances immediately
                    } else if (intent.status === 'failed') {
                        clearInterval(pollInterval);
                        addLog(`${idPrefix}: ❌ FAILED: ${intent.error}`);
                    }
                    // Else: running/authenticated...
                } catch (pe) {
                    console.error("Poll error", pe);
                }
            }, 1000);

        } catch (err: any) {
            addLog(`${idPrefix}: ❌ Network Error (${err.message})`);
        }
    };

    const startStream = async () => {
        if (running) return;
        setRunning(true);
        setLogs([]); // Clear previous logs
        addLog(`🚀 Starting Stream (${count} intents)...`);

        for (let i = 0; i < count; i++) {
            runSingleIntent(i); // Fire and forget (async polling handles it)
            if (i < count - 1) await new Promise(r => setTimeout(r, intervalMs));
        }

        setTimeout(() => setRunning(false), 500); // Allow concise UI update
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-yellow-500/30">
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-900/20 via-black to-black pointer-events-none" />

            <Navbar />

            <main className="relative pt-32 pb-20 px-6 max-w-7xl mx-auto">
                <div className="flex flex-col gap-8">

                    {/* Header */}
                    <div>
                        <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter mb-4">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                                Intent Stream
                            </span>
                            <br />
                            <span className="text-white text-3xl md:text-5xl not-italic">Live Dashboard</span>
                        </h1>
                        <p className="text-xl text-gray-400 max-w-2xl">
                            Real-time V4 Intent Execution & Balance Tracking
                        </p>
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

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Config Card */}
                        <div className="lg:col-span-1 bg-white/5 border border-white/10 p-6 rounded-xl backdrop-blur-md h-fit">
                            <h2 className="text-xl font-bold uppercase text-white mb-6 border-b border-white/10 pb-4">Stream Config</h2>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">Execution Mode</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setExecutionMode('v4')}
                                            className={`py-2 px-3 rounded font-bold text-sm transition-all ${executionMode === 'v4'
                                                ? 'bg-yellow-400 text-black'
                                                : 'bg-black/50 border border-white/20 text-gray-400 hover:border-yellow-400'
                                                }`}
                                        >
                                            🦄 Direct V4
                                        </button>
                                        <button
                                            onClick={() => setExecutionMode('yellow')}
                                            className={`py-2 px-3 rounded font-bold text-sm transition-all ${executionMode === 'yellow'
                                                ? 'bg-yellow-400 text-black'
                                                : 'bg-black/50 border border-white/20 text-gray-400 hover:border-yellow-400'
                                                }`}
                                        >
                                            ⚡ Yellow Network
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {executionMode === 'v4'
                                            ? 'On-chain Uniswap V4 swaps with ERC-6909 claims'
                                            : 'Off-chain Yellow Network settlement'}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">Prompt Template</label>
                                    <textarea
                                        value={promptTemplate} onChange={(e) => setPromptTemplate(e.target.value)}
                                        className="w-full bg-black/50 border border-white/20 p-3 rounded text-white font-mono text-sm focus:border-yellow-400 outline-none h-24 resize-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">Count</label>
                                        <input
                                            type="number" value={count} onChange={(e) => setCount(Number(e.target.value))}
                                            className="w-full bg-black/50 border border-white/20 p-3 rounded text-white font-mono focus:border-yellow-400 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">Interval (ms)</label>
                                        <input
                                            type="number" value={intervalMs} onChange={(e) => setIntervalMs(Number(e.target.value))}
                                            className="w-full bg-black/50 border border-white/20 p-3 rounded text-white font-mono focus:border-yellow-400 outline-none"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={startStream}
                                    disabled={running}
                                    className={`w-full py-4 text-xl font-black uppercase rounded shadow-lg transition-all
                                        ${running ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-yellow-400 text-black hover:bg-white hover:shadow-yellow-400/20'}
                                    `}
                                >
                                    {running ? 'Streaming...' : 'Start Stream'}
                                </button>
                            </div>
                        </div>

                        {/* Logs Console */}
                        <div className="lg:col-span-2 bg-black border border-white/20 p-6 rounded-xl font-mono text-xs md:text-sm h-[600px] flex flex-col shadow-inner shadow-black/50">
                            <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                                <span className="text-green-500 font-bold"> &gt; EXECUTION LOGS</span>
                                <span className="text-xs text-gray-500">{running ? '● PROCESSING' : '● IDLE'}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                                {logs.length === 0 && <div className="text-gray-600 italic">Ready to execute...</div>}
                                {logs.map((log, i) => (
                                    <div key={i} className="break-all border-l-2 border-transparent pl-2 hover:border-yellow-500/50 transition-colors py-0.5">
                                        <span className={
                                            log.includes('❌') ? 'text-red-400' :
                                                log.includes('🎉') ? 'text-green-400 font-bold' :
                                                    log.includes('Result:') ? 'text-yellow-300' :
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
