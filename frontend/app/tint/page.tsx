'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { ethers } from 'ethers';

interface Intent {
    id: string;
    agent: string;
    direction: 'BUY' | 'SELL';
    amount: string;
    commitment: string;
    status: 'pending' | 'netted' | 'executed';
}

export default function TintProtocolPage() {
    const [intents, setIntents] = useState<Intent[]>([]);
    const [newAmount, setNewAmount] = useState('1.0');
    const [newDirection, setNewDirection] = useState<'BUY' | 'SELL'>('SELL');
    const [isProcessing, setIsProcessing] = useState(false);

    // Stats
    const totalSell = intents.filter(i => i.direction === 'SELL').reduce((s, i) => s + parseFloat(i.amount), 0);
    const totalBuy = intents.filter(i => i.direction === 'BUY').reduce((s, i) => s + parseFloat(i.amount), 0);
    const residual = Math.abs(totalSell - totalBuy);
    const maxVol = Math.max(totalSell, totalBuy);
    const efficiency = maxVol > 0 ? (1 - (residual / (totalSell + totalBuy))) * 100 : 0;

    // Simulate some initial intents
    useEffect(() => {
        const demoIntents: Intent[] = [
            { id: '1', agent: 'Agent_0x8f', direction: 'SELL', amount: '1.5', commitment: '0xabc...123', status: 'pending' },
            { id: '2', agent: 'Agent_0x2c', direction: 'BUY', amount: '1.2', commitment: '0xdef...456', status: 'pending' },
            { id: '3', agent: 'Agent_0x4a', direction: 'SELL', amount: '0.3', commitment: '0x789...012', status: 'pending' },
        ];
        setIntents(demoIntents);
    }, []);

    const addIntent = () => {
        setIsProcessing(true);
        setTimeout(() => {
            const intent: Intent = {
                id: Math.random().toString(36).substr(2, 4),
                agent: 'You',
                direction: newDirection,
                amount: newAmount,
                commitment: '0x' + Math.random().toString(16).substr(2, 32),
                status: 'pending'
            };
            setIntents(prev => [...prev, intent]);
            setIsProcessing(false);
        }, 800);
    };

    const settleBatch = () => {
        setIsProcessing(true);
        setTimeout(() => {
            setIntents(prev => prev.map(i => ({ ...i, status: 'netted' })));
            setIsProcessing(false);
            alert(`Batch Settled!\nNetted: ${(totalSell + totalBuy - residual).toFixed(4)} ETH\nUniswap Residual: ${residual.toFixed(4)} ETH\nTotal Savings: $${(efficiency * 0.5).toFixed(2)} (Estimated)`);
        }, 2000);
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30">
            {/* Background Glow */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-black to-black pointer-events-none" />

            <Navbar />

            <main className="relative pt-32 pb-20 px-6 max-w-7xl mx-auto">
                <div className="flex flex-col gap-12">

                    {/* Hero Section */}
                    <div className="flex flex-col md:flex-row justify-between items-end border-b-2 border-cyan-400 pb-8 gap-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="bg-cyan-500 text-black text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">Protocol v1.0</span>
                                <span className="text-cyan-400 font-mono text-sm tracking-widest animate-pulse">● NETWORK LIVE</span>
                            </div>
                            <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none mb-4">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                                    TINT
                                </span>
                                <br />
                                <span className="text-white text-3xl md:text-5xl not-italic tracking-normal">Threshold Intent Netting</span>
                            </h1>
                            <p className="text-xl text-gray-400 max-w-2xl font-light">
                                Zero-Slippage execution through Cryptographic Commitment.
                                Match offseting intents off-chain, settle only the residual on Uniswap v4.
                            </p>
                        </div>

                        <div className="flex flex-col gap-2 items-end">
                            <div className="text-xs text-gray-500 font-mono uppercase tracking-widest">Efficiency Multiplier</div>
                            <div className="text-6xl font-black text-cyan-400 tracking-tighter">
                                {efficiency.toFixed(1)}%
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Control Panel */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-gray-900/50 border border-cyan-500/30 p-8 rounded-2xl backdrop-blur-xl shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                                <h2 className="text-xl font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
                                    Commit Intent
                                </h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Direction</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setNewDirection('SELL')}
                                                className={`flex-1 py-3 font-black rounded border-2 transition-all ${newDirection === 'SELL' ? 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-gray-800 text-gray-500 hover:border-gray-700'}`}
                                            >
                                                SELL ETH
                                            </button>
                                            <button
                                                onClick={() => setNewDirection('BUY')}
                                                className={`flex-1 py-3 font-black rounded border-2 transition-all ${newDirection === 'BUY' ? 'bg-green-500/20 border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-gray-800 text-gray-500 hover:border-gray-700'}`}
                                            >
                                                BUY ETH
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Amount</label>
                                        <input
                                            type="number"
                                            value={newAmount}
                                            onChange={(e) => setNewAmount(e.target.value)}
                                            className="w-full bg-black border-2 border-gray-800 focus:border-cyan-500 rounded p-4 text-2xl font-bold outline-none transition-all"
                                        />
                                    </div>

                                    <button
                                        onClick={addIntent}
                                        disabled={isProcessing}
                                        className="w-full bg-cyan-500 text-black py-4 rounded font-black uppercase text-lg tracking-widest hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isProcessing ? 'COMMITTING...' : 'JOIN BATCH'}
                                    </button>
                                </div>

                                <div className="mt-8 pt-8 border-t border-gray-800">
                                    <div className="flex justify-between items-center mb-4 text-xs font-mono">
                                        <span className="text-gray-500">HOMOMORPHIC SUM</span>
                                        <span className="text-cyan-400">VERIFIED ✓</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-black/50 p-2 rounded">
                                            <div className="text-[10px] text-gray-500 uppercase">Sell Vol</div>
                                            <div className="text-lg font-mono">{totalSell.toFixed(2)}</div>
                                        </div>
                                        <div className="bg-black/50 p-2 rounded">
                                            <div className="text-[10px] text-gray-500 uppercase">Buy Vol</div>
                                            <div className="text-lg font-mono">{totalBuy.toFixed(2)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Batch Visualization */}
                        <div className="lg:col-span-2 flex flex-col gap-6">
                            <div className="bg-black/40 border border-gray-800 p-8 rounded-2xl flex-1 relative overflow-hidden group">
                                <div className="flex justify-between items-center mb-8 relative z-10">
                                    <h2 className="text-xl font-bold uppercase tracking-widest">Active Batch Intent Tree</h2>
                                    <button
                                        onClick={settleBatch}
                                        className="text-xs bg-white text-black font-black px-4 py-2 hover:bg-cyan-400 transition-all uppercase tracking-tighter"
                                    >
                                        Settle Batch Now
                                    </button>
                                </div>

                                {/* Simulated Netting Graph area */}
                                <div className="min-h-[400px] flex items-center justify-center relative">
                                    {/* Central Netting Node */}
                                    <div className="w-32 h-32 rounded-full border-4 border-cyan-500 flex items-center justify-center relative z-20 bg-black animate-pulse">
                                        <div className="text-center font-black">
                                            <div className="text-[10px] uppercase text-cyan-400">Residual</div>
                                            <div className="text-xl uppercase">{residual.toFixed(2)}</div>
                                        </div>

                                        {/* Efficiency circle */}
                                        <div
                                            className="absolute inset-[-10px] rounded-full border-2 border-dashed border-cyan-500/20 animate-spin-slow"
                                            style={{ animationDuration: '10s' }}
                                        ></div>
                                    </div>

                                    {/* Intent Nodes */}
                                    {intents.map((intent, idx) => {
                                        const angle = (idx / intents.length) * 2 * Math.PI;
                                        const x = Math.cos(angle) * 150;
                                        const y = Math.sin(angle) * 150;

                                        return (
                                            <div
                                                key={intent.id}
                                                className={`absolute w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all duration-1000 ${intent.status === 'netted' ? 'scale-0 opacity-0' : 'scale-100 opacity-100'} ${intent.direction === 'SELL' ? 'border-red-500/50 bg-red-500/10' : 'border-green-500/50 bg-green-500/10'}`}
                                                style={{
                                                    transform: `translate(${x}px, ${y}px)`,
                                                    transitionDelay: `${idx * 100}ms`
                                                }}
                                            >
                                                <div className="text-[10px] font-bold">{intent.amount}</div>
                                                <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${intent.direction === 'SELL' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                            </div>
                                        );
                                    })}

                                    {/* Connecting Lines (simplified svg) */}
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                                        <defs>
                                            <filter id="glow">
                                                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                                <feMerge>
                                                    <feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" />
                                                </feMerge>
                                            </filter>
                                        </defs>
                                        {intents.filter(i => i.status !== 'netted').map((intent, idx) => {
                                            const angle = (idx / intents.length) * 2 * Math.PI;
                                            const x = 50 + Math.cos(angle) * 40;
                                            const y = 50 + Math.sin(angle) * 40;
                                            return (
                                                <line
                                                    key={idx}
                                                    x1="50%" y1="50%" x2={`${x}%`} y2={`${y}%`}
                                                    stroke={intent.direction === 'SELL' ? '#ef4444' : '#22c55e'}
                                                    strokeWidth="1"
                                                    filter="url(#glow)"
                                                />
                                            );
                                        })}
                                    </svg>
                                </div>

                                {/* Log output bottom */}
                                <div className="mt-8 bg-black/80 border border-gray-800 p-4 rounded-xl font-mono text-xs max-h-32 overflow-y-auto custom-scrollbar">
                                    <div className="text-cyan-400 mb-1 tracking-widest uppercase">Protocol Trace:</div>
                                    <div className="text-gray-500">[BATCH #847] Initialized with threshold K=3</div>
                                    {intents.map(i => (
                                        <div key={i.id} className="text-gray-400">
                                            [COMMIT] {i.agent} verified Pedersen commitment {i.commitment.substring(0, 12)}...
                                        </div>
                                    ))}
                                    {intents.every(i => i.status === 'netted') && (
                                        <div className="text-green-400 font-bold">[SETTLE] Netted volume settled off-chain. Residual sent to v4 Hook.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Technical Specs Footer */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Network', value: 'Base Sepolia', color: 'text-cyan-400' },
                            { label: 'Settlement', value: 'Arc Testnet', color: 'text-cyan-400' },
                            { label: 'Cryptography', value: 'Pedersen-64', color: 'text-cyan-400' },
                            { label: 'Threshold', value: '65% of N', color: 'text-cyan-400' },
                        ].map((spec, i) => (
                            <div key={i} className="bg-gray-900/40 border border-gray-800 p-4 rounded-xl text-center">
                                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1 tracking-tighter">{spec.label}</div>
                                <div className={`font-mono text-sm leading-none ${spec.color}`}>{spec.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
