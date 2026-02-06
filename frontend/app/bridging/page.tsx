"use client";

import { useState, useEffect } from "react";
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
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
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

    const handleBridge = async () => {
        if (!connected) {
            alert("Connect wallet first!");
            return;
        }
        setIsBridging(true);
        setStatus("Initializing Bridge Kit...");
        try {
            const kit = new BridgeKit();

            setStatus("Creating Adapter...");
            // Create adapter from browser provider
            const adapter = await createViemAdapterFromProvider({
                provider: (window as any).ethereum,
            });

            setStatus(`Bridging ${amount} USDC from ${fromChain} to ${toChain}...`);
            log(`Starting Bridge: ${fromChain} -> ${toChain} (${amount} USDC)`);

            const result = await kit.bridge({
                from: { adapter, chain: fromChain as any },
                to: { adapter, chain: toChain as any },
                amount: amount,
            });

            log("Bridge Transaction Initiated!");
            log("Result: " + JSON.stringify(result, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
                , 2));
            setStatus("Bridge Success! check logs for details.");

            if (result.steps) {
                result.steps.forEach((step: any) => {
                    log(`Step [${step.name}]: ${step.state} - TX: ${step.txHash || 'N/A'}`);
                    if (step.explorerUrl) {
                        log(`Explorer: ${step.explorerUrl}`);
                    }
                });
            }

        } catch (err: any) {
            console.error(err);
            setStatus("Bridging Failed: " + err.message);
            log("Error: " + err.message);
        } finally {
            setIsBridging(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
            <div className="max-w-2xl mx-auto bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-700">
                <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                    Arc Bridge Interface
                </h1>

                {!connected ? (
                    <button
                        onClick={connectWallet}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-all mb-6"
                    >
                        Connect Wallet
                    </button>
                ) : (
                    <div className="mb-6 p-4 bg-gray-700/50 rounded-lg border border-gray-600 flex justify-between items-center">
                        <span className="text-gray-300">Connected:</span>
                        <span className="font-mono text-green-400">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                    </div>
                )}

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">From Network</label>
                            <select
                                value={fromChain}
                                onChange={(e) => setFromChain(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="Arc_Testnet">Arc Testnet</option>
                                <option value="Ethereum_Sepolia">Ethereum Sepolia</option>
                                <option value="Base_Sepolia">Base Sepolia</option>
                                <option value="Arbitrum_Sepolia">Arbitrum Sepolia</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">To Network</label>
                            <select
                                value={toChain}
                                onChange={(e) => setToChain(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="Base_Sepolia">Base Sepolia</option>
                                <option value="Arc_Testnet">Arc Testnet</option>
                                <option value="Ethereum_Sepolia">Ethereum Sepolia</option>
                                <option value="Arbitrum_Sepolia">Arbitrum Sepolia</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Amount (USDC)</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="0.00"
                        />
                    </div>

                    <button
                        onClick={handleBridge}
                        disabled={!connected || isBridging}
                        className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${!connected || isBridging
                            ? "bg-gray-600 cursor-not-allowed opacity-50"
                            : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg hover:shadow-blue-500/25"
                            }`}
                    >
                        {isBridging ? "Bridging..." : "Bridge USDC"}
                    </button>

                    {status && (
                        <div className={`mt-4 p-3 rounded-lg text-center ${status.includes("Success") ? "bg-green-900/50 text-green-200 border border-green-700" : "bg-gray-700 text-gray-300"}`}>
                            {status}
                        </div>
                    )}
                </div>

                <div className="mt-8">
                    <h3 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">Transaction Logs</h3>
                    <div className="bg-black/50 rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs border border-gray-700">
                        {logs.length === 0 ? (
                            <span className="text-gray-600">No logs yet...</span>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="mb-1 border-b border-gray-800/50 pb-1 last:border-0 text-gray-300">
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
