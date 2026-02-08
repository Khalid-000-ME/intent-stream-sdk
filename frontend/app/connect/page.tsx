"use client";
import React, { useState, useEffect } from 'react';
import { Navbar } from '../../components/Navbar';
import { ethers } from 'ethers';

export default function ConnectPage() {
    const [address, setAddress] = useState<string | null>(null);
    const [authorized, setAuthorized] = useState(false);
    const [error, setError] = useState("");

    const connectWallet = async () => {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
            try {
                const provider = new ethers.BrowserProvider((window as any).ethereum);
                const signer = await provider.getSigner();
                const addr = await signer.getAddress();
                setAddress(addr);

                // Simulate authorization
                setTimeout(() => setAuthorized(true), 1500);
            } catch (err: any) {
                console.error(err);
                setError("Connection Failed: " + err.message);
            }
        } else {
            setError("No Ethereum wallet found (MetaMask).");
        }
    };

    return (
        <main className="min-h-screen bg-black text-white font-mono selection:bg-yellow-500/30">
            <Navbar />

            <div className="flex flex-col items-center justify-center min-h-[80vh] bg-[url('/grid.svg')] bg-center bg-fixed">
                <div className="backdrop-blur-xl bg-black/40 border border-white/10 p-12 rounded-2xl shadow-2xl max-w-2xl w-full text-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                    <pre className="text-[10px] md:text-xs leading-none text-yellow-500 font-bold mb-8 opacity-90 select-none">
                        {`
████████╗██╗███╗   ██╗████████╗    ███████╗████████╗██████╗ ███████╗ █████╗ ███╗   ███╗
╚══██╔══╝██║████╗  ██║╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔══██╗████╗ ████║
   ██║   ██║██╔██╗ ██║   ██║       ███████╗   ██║   ██████╔╝█████╗  ███████║██╔████╔██║
   ██║   ██║██║╚██╗██║   ██║       ╚════██║   ██║   ██╔══██╗██╔══╝  ██╔══██║██║╚██╔╝██║
   ██║   ██║██║ ╚████║   ██║       ███████║   ██║   ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║
   ╚═╝   ╚═╝╚═╝  ╚═══╝   ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝
`}
                    </pre>

                    <h1 className="text-2xl mb-2 font-light tracking-widest text-white/90">AGENT CLI INTERFACE</h1>
                    <p className="text-white/40 mb-10 text-sm">Please connect your wallet to authorize the CLI session.</p>

                    {!address ? (
                        <>
                            <button
                                onClick={connectWallet}
                                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold tracking-wide transition-all transform hover:scale-105 shadow-lg shadow-blue-900/40"
                            >
                                CONNECT WALLET
                            </button>
                            {error && <p className="mt-4 text-red-500 text-xs">{error}</p>}
                        </>
                    ) : (
                        <div className="space-y-4 animate-in fade-in zoom-in duration-500">
                            <div className="inline-flex items-center space-x-2 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-full text-green-400">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span>{address.substring(0, 6)}...{address.substring(address.length - 4)}</span>
                            </div>

                            {authorized ? (
                                <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-lg">
                                    <p className="text-green-400 font-bold mb-1">✅ AUTHORIZED</p>
                                    <p className="text-xs text-white/40">You may now return to your terminal.</p>
                                </div>
                            ) : (
                                <div className="mt-6 text-white/50 text-sm animate-pulse">
                                    Authorizing Agent...
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
