"use client";

import { useState } from "react";
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

export default function BridgingPage() {
    const [connected, setConnected] = useState(false);
    const [walletAddress, setWalletAddress] = useState("");
    const [fromChain, setFromChain] = useState("Arc_Testnet");
    const [toChain, setToChain] = useState("Base_Sepolia");
    const [amount, setAmount] = useState("1.00");
    const [status, setStatus] = useState("");
    const [logs, setLogs] = useState<string[]>([]);
    const [isBridging, setIsBridging] = useState(false);

    const log = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
        console.log(msg);
    };

    const connectWallet = async () => {
        try {
            if (typeof window === "undefined" || !(window as any).ethereum) {
                alert("Please install MetaMask!");
                return;
            }
            const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
            setWalletAddress(accounts[0]);
            setConnected(true);
            log("Wallet connected: " + accounts[0]);
        } catch (error: any) {
            log("Error connecting wallet: " + error.message);
        }
    };

    const performRecovery = async (bridgeResult: any) => {
        setStatus("🛠️ Local gas failed. Rescuing via Server Protocol...");
        log("⚠️ Mint step failed (local provider). Attempting high-priority gas recovery...");

        try {
            // Fix: BigInt serialization for bridgeResult
            const body = JSON.stringify({ bridgeResult }, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
            );

            const response = await fetch('/api/bridge/retry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });

            const data = await response.json();

            if (data.success) {
                log(`✅ RECOVERY SUCCESS! Mint TX: ${data.txHash}`);
                setStatus("✨ Bridge Rescued Successfully!");
                return true;
            } else {
                log(`❌ Recovery Protocol Failed: ${data.error}`);
                setStatus("Recovery Failed. Please check explorer manually.");
                return false;
            }
        } catch (err: any) {
            log(`❌ Recovery Communication Error: ${err.message}`);
            return false;
        }
    };

    const handleBridge = async () => {
        if (!connected) {
            alert("Connect wallet first!");
            return;
        }
        setIsBridging(true);
        setLogs([]);
        setStatus("Initializing Bridge Kit...");

        try {
            const kit = new BridgeKit();

            // Real-time Event Logging
            kit.on('*', (payload: any) => {
                const method = payload.method?.toUpperCase() || 'ACTION';
                log(`[SDK] ${method}: ${payload.state}`);
                if (payload.values?.txHash) {
                    log(`[TX] ${payload.values.txHash}`);
                }
            });

            setStatus("Creating Adapter...");
            const adapter = await createViemAdapterFromProvider({
                provider: (window as any).ethereum,
            });

            setStatus(`Bridging ${amount} USDC...`);
            log(`🚀 Starting Multi-Chain Bridge: ${fromChain} -> ${toChain}`);

            const result = await kit.bridge({
                from: { adapter, chain: fromChain as any },
                to: { adapter, chain: toChain as any },
                amount: amount,
            });

            log("🏁 Bridge Process Ended.");

            // Log final summary of all steps
            if (result.steps) {
                result.steps.forEach((step: any) => {
                    log(`Step [${step.name}]: ${step.state} ${step.txHash ? '🔗' : ''}`);
                });
            }

            const errorStep = result.steps?.find((s: any) => s.state === 'error');
            const mintStep = result.steps?.find((s: any) => s.name === 'mint');

            if (result.state === 'error' || errorStep) {
                log(`⚠️ Failure detected in step: ${errorStep?.name || 'unknown'}`);

                // We can only recover if the 'mint' step failed (meaning burn was successful)
                if (mintStep && mintStep.state === 'error') {
                    log("💡 Mint step failed, but burn succeeded. Attempting Server-side recovery...");
                    const success = await performRecovery(result);
                    if (success) return;
                } else {
                    log(`❌ Recovery not possible for ${errorStep?.name || 'this'} failure type.`);
                }

                setStatus("Bridging Failed. Check logs.");
                log("Final SDK Error: " + (errorStep?.errorMessage || (result as any).errorMessage || "Unknown SDK Error"));
            } else {
                log("✅ Bridge Transaction Successful!");
                setStatus("Bridge Success!");
            }

        } catch (err: any) {
            console.error(err);
            setStatus("Bridging Exception: " + err.message);
            log("🛑 Critical Error: " + err.message);

            if (err.message.includes("mint") || err.message.includes("simulation")) {
                log("💡 Gas/Simulation error detected. Try manual recovery if funds were burnt.");
            }
        } finally {
            setIsBridging(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0b10] text-white p-8 font-sans selection:bg-blue-500/30">
            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="max-w-xl mx-auto backdrop-blur-xl bg-white/[0.03] rounded-3xl p-8 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border border-white/10 relative">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">
                            Arc <span className="text-blue-400">Bridge</span>
                        </h1>
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Powered by TINT Protocol</p>
                    </div>
                </div>

                {!connected ? (
                    <button
                        onClick={connectWallet}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-2xl font-bold transition-all mb-8 shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                    >
                        Connect Wallet
                    </button>
                ) : (
                    <div className="mb-8 p-4 bg-white/[0.05] rounded-2xl border border-white/10 flex justify-between items-center group transition-colors hover:border-blue-500/30">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm text-gray-400">Wallet connected</span>
                        </div>
                        <span className="font-mono text-sm text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full border border-blue-400/20">
                            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                        </span>
                    </div>
                )}

                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                            <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">Route Selection</label>
                            <div className="flex items-center gap-4">
                                <select
                                    value={fromChain}
                                    onChange={(e) => setFromChain(e.target.value)}
                                    className="flex-1 bg-transparent text-lg font-semibold text-white outline-none cursor-pointer"
                                >
                                    <option className="bg-[#1a1b23]" value="Arc_Testnet">Arc Testnet</option>
                                    <option className="bg-[#1a1b23]" value="Ethereum_Sepolia">Ethereum Sepolia</option>
                                    <option className="bg-[#1a1b23]" value="Base_Sepolia">Base Sepolia</option>
                                    <option className="bg-[#1a1b23]" value="Arbitrum_Sepolia">Arbitrum Sepolia</option>
                                </select>
                                <div className="w-8 h-8 flex items-center justify-center text-gray-600">
                                    →
                                </div>
                                <select
                                    value={toChain}
                                    onChange={(e) => setToChain(e.target.value)}
                                    className="flex-1 bg-transparent text-lg font-semibold text-white outline-none cursor-pointer text-right"
                                >
                                    <option className="bg-[#1a1b23]" value="Base_Sepolia">Base Sepolia</option>
                                    <option className="bg-[#1a1b23]" value="Arc_Testnet">Arc Testnet</option>
                                    <option className="bg-[#1a1b23]" value="Ethereum_Sepolia">Ethereum Sepolia</option>
                                    <option className="bg-[#1a1b23]" value="Arbitrum_Sepolia">Arbitrum Sepolia</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                            <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">Amount</label>
                            <div className="flex items-baseline gap-2">
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="bg-transparent text-3xl font-bold text-white outline-none w-full"
                                    placeholder="0.00"
                                />
                                <span className="text-gray-400 font-bold">USDC</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleBridge}
                        disabled={!connected || isBridging}
                        className={`w-full py-5 rounded-2xl font-bold text-lg transition-all relative overflow-hidden group ${!connected || isBridging
                            ? "bg-white/5 text-gray-500 cursor-not-allowed"
                            : "bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.5)] active:scale-[0.99]"
                            }`}
                    >
                        <span className="relative z-10">{isBridging ? "Processing Bridge..." : "Bridge USDC"}</span>
                        {isBridging && (
                            <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
                        )}
                    </button>

                    {status && (
                        <div className={`p-4 rounded-2xl text-sm font-medium flex items-center gap-3 ${status.includes("Success") || status.includes("✨")
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : status.includes("Failed") || status.includes("❌")
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${status.includes("Success") || status.includes("✨") ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" :
                                status.includes("Failed") || status.includes("❌") ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" :
                                    "bg-blue-500 animate-pulse"
                                }`}></div>
                            {status}
                        </div>
                    )}
                </div>

                <div className="mt-10">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Timeline</h3>
                        {logs.length > 0 && (
                            <button onClick={() => setLogs([])} className="text-[10px] text-gray-600 hover:text-white transition-colors uppercase font-bold tracking-widest">Clear</button>
                        )}
                    </div>
                    <div className="bg-black/20 rounded-2xl p-5 h-64 overflow-y-auto font-mono text-[11px] border border-white/5 scrollbar-hide">
                        {logs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-700 gap-2 opacity-50">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>Operation history will appear here</span>
                            </div>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="mb-3 pl-3 border-l-[1px] border-white/10 text-gray-400 animate-in fade-in slide-in-from-left-2 duration-300">
                                    {log}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
