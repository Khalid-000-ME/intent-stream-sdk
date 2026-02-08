'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { useState } from 'react';
import { Navbar } from '@/components/Navbar';

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<'install' | 'usage'>('install');
  const [copied, setCopied] = useState(false);

  const installCmd = "npm install tint-protocol-ai-sdk ethers @google/generative-ai";

  const snippet = `require('dotenv').config();
const { TintClient } = require('tint-protocol-ai-sdk');

async function run() {
    console.log("🚀 Initializing TINT AI Client...");

    const client = new TintClient({
        privateKey: process.env.MAIN_WALLET_PRIVATE_KEY,
        rpcUrl: "https://sepolia.base.org",
        backendUrl: "http://localhost:3000/api", // Local backend
        geminiApiKey: process.env.GEMINI_API_KEY
    });

    // We skip client.init() for this demo as it connects to Yellow Network P2P which might need specific setup.
    // The core AI logic works without it.

    console.log("🤖 Processing Intent: 'Swap 0.0001 ETH to USDC on base'...");

    try {
        const result = await client.processNaturalLanguage("Swap 0.0001 ETH to USDC on base", "base");
        console.log("✅ Execution Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("❌ Error processing intent:", error.message);
    }
}

run();
`;

  const handleCopy = () => {
    const text = activeTab === 'install' ? installCmd : snippet;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-cyan-500/30">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-bold mb-8 animate-fade-in-up">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          v1.0.0 Public Release
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
          TINT Protocol SDK
        </h1>

        <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mb-10 leading-relaxed">
          The first <span className="text-cyan-400 font-bold">Privacy-Preserving Intent Standard</span> for AI Agents.
          Stream encrypted swaps, net off-chain, and settle on Uniswap V4.
        </p>

        <div className="flex flex-wrap justify-center gap-6 mb-20">
          <Link href="/final-stream-uniswap">
            {/* Explicitly setting text-white and bg-cyan-500 to override any default component styles */}
            <button className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-lg px-8 py-4 rounded-xl shadow-[0_0_30px_-5px_rgba(6,182,212,0.4)] transition-all transform hover:scale-105">
              Launch Agent Demo
            </button>
          </Link>
          <a href="https://www.npmjs.com/package/tint-protocol-ai-sdk" target="_blank" rel="noopener noreferrer">
            {/* Explicitly setting text-white and bg-gray-900 */}
            <button className="bg-gray-900 hover:bg-gray-800 text-white border border-gray-700 font-bold text-lg px-8 py-4 rounded-xl transition-all">
              View on NPM
            </button>
          </a>
        </div>

        {/* Code Preview */}
        <div className="w-full max-w-4xl bg-[#0a0a0a] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl text-left relative group">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/50">
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/20 box-content border border-red-500/30" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/20 box-content border border-yellow-500/30" />
                <div className="w-3 h-3 rounded-full bg-green-500/20 box-content border border-green-500/30" />
              </div>
              <div className="flex gap-4 ml-6 font-mono text-sm">
                <button
                  onClick={() => setActiveTab('install')}
                  className={`transition-colors ${activeTab === 'install' ? 'text-cyan-400 font-bold border-b border-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  install
                </button>
                <button
                  onClick={() => setActiveTab('usage')}
                  className={`transition-colors ${activeTab === 'usage' ? 'text-cyan-400 font-bold border-b border-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  quick-start.ts
                </button>
              </div>
            </div>

            <button
              onClick={handleCopy}
              className="text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1 rounded text-xs font-mono flex items-center gap-2"
            >
              {copied ? (
                <>
                  <span className="text-green-400">✓</span> Copied
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  Copy
                </>
              )}
            </button>
          </div>

          <div className="p-6 font-mono text-sm overflow-x-auto bg-[#050505]">
            {activeTab === 'install' ? (
              <div className="text-gray-300 flex items-center gap-3">
                <span className="text-cyan-400 select-none">$</span>
                <span className="flex-1">{installCmd}</span>
              </div>
            ) : (
              <pre className="text-gray-300 pointer-events-none select-none">
                <code>{snippet}</code>
              </pre>
            )}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 border-t border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon="🔒"
              title="Cryptographic Privacy"
              desc="Intents are shielded using Pedersen Commitments. Solvers match orders without seeing amounts."
            />
            <FeatureCard
              icon="⚡"
              title="Sub-Second Netting"
              desc="Yellow Network state channels allow for high-frequency intent matching before on-chain settlement."
            />
            <FeatureCard
              icon="🦄"
              title="Uniswap V4 Settlement"
              desc="Residual flow is executed atomically on Uniswap V4 hooks, guaranteeing best execution."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 px-6 text-center text-gray-500 text-sm">
        <p>© 2026 TINT Protocol. Open Source MIT License.</p>
        <div className="flex justify-center gap-6 mt-4">
          <a href="#" className="hover:text-white">Documentation</a>
          <a href="#" className="hover:text-white">GitHub</a>
          <a href="#" className="hover:text-white">NPM</a>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string, title: string, desc: string }) {
  return (
    <div className="bg-gray-900/50 p-8 rounded-3xl border border-gray-800 hover:border-cyan-500/30 transition-all">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-3 text-white">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}
