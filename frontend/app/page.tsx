'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="max-w-5xl mx-auto text-center">
          {/* ASCII Art Logo */}
          <pre className="text-[#FFEB3B] text-xs md:text-sm mb-8 font-mono overflow-x-auto">
            {`
██╗███╗   ██╗████████╗███████╗███╗   ██╗████████╗
██║████╗  ██║╚══██╔══╝██╔════╝████╗  ██║╚══██╔══╝
██║██╔██╗ ██║   ██║   █████╗  ██╔██╗ ██║   ██║   
██║██║╚██╗██║   ██║   ██╔══╝  ██║╚██╗██║   ██║   
██║██║ ╚████║   ██║   ███████╗██║ ╚████║   ██║   
╚═╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝  ╚═══╝   ╚═╝   
                                                  
███████╗████████╗██████╗ ███████╗ █████╗ ███╗   ███╗
██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔══██╗████╗ ████║
███████╗   ██║   ██████╔╝█████╗  ███████║██╔████╔██║
╚════██║   ██║   ██╔══██╗██╔══╝  ██╔══██║██║╚██╔╝██║
███████║   ██║   ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║
╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝
`}
          </pre>

          <h1 className="text-5xl md:text-7xl font-mono font-bold uppercase mb-6">
            THE VISA NETWORK<br />FOR AI AGENT TRADING
          </h1>

          <p className="text-xl md:text-2xl font-mono mb-12 text-gray-400">
            MEV-PROOF • SUB-SECOND • USDC-NATIVE
          </p>

          <div className="flex gap-4 justify-center mb-16">
            <Link href="/dashboard">
              <Button variant="primary" className="text-lg px-12 h-16">
                LAUNCH DASHBOARD
              </Button>
            </Link>
            <Link href="/yellow-official">
              <Button variant="secondary" className="text-lg px-12 h-16">
                YELLOW NETWORK
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="border-2 border-[#FFEB3B] p-6">
              <div className="text-5xl font-mono font-bold text-[#FFEB3B] mb-2">&lt;1s</div>
              <div className="text-sm font-mono uppercase">Execution Time</div>
            </div>
            <div className="border-2 border-[#00FF00] p-6">
              <div className="text-5xl font-mono font-bold text-[#00FF00] mb-2">0%</div>
              <div className="text-sm font-mono uppercase">MEV Loss</div>
            </div>
            <div className="border-2 border-[#FF007A] p-6">
              <div className="text-5xl font-mono font-bold text-[#FF007A] mb-2">98%</div>
              <div className="text-sm font-mono uppercase">Cost Reduction</div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="border-t-4 border-[#FFEB3B] py-20 px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-mono font-bold uppercase mb-12 text-center text-[#FFEB3B]">
            HOW IT WORKS
          </h2>

          <div className="space-y-8">
            <div className="border-2 border-white p-6">
              <div className="text-[#FFEB3B] font-mono font-bold mb-2">1. YELLOW STATE CHANNELS</div>
              <div className="font-mono">Private mempool for agent intents. 100,000+ TPS, fully encrypted.</div>
            </div>

            <div className="border-2 border-white p-6">
              <div className="text-[#FF007A] font-mono font-bold mb-2">2. UNISWAP V4 HOOKS</div>
              <div className="font-mono">MEV-resistant execution gates. Only pre-validated intents can trade.</div>
            </div>

            <div className="border-2 border-white p-6">
              <div className="text-[#00FF00] font-mono font-bold mb-2">3. ARC SETTLEMENT</div>
              <div className="font-mono">USDC-native finality in 350ms. Predictable costs for agent budgets.</div>
            </div>

            <div className="border-2 border-white p-6">
              <div className="text-white font-mono font-bold mb-2">4. ASI AGENTS</div>
              <div className="font-mono">Autonomous payment executors with secure authorization.</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="border-t-4 border-[#FFEB3B] py-20 px-8 text-center">
        <h2 className="text-4xl font-mono font-bold uppercase mb-6">
          READY TO STREAM?
        </h2>
        <p className="text-xl font-mono mb-8 text-gray-400">
          Join the future of MEV-proof DeFi execution
        </p>
        <Link href="/dashboard">
          <Button variant="primary" className="text-xl px-16 h-20">
            GET STARTED
          </Button>
        </Link>
      </div>

      {/* Footer */}
      <footer className="border-t-2 border-gray-800 py-8 px-8">
        <div className="max-w-5xl mx-auto flex justify-between items-center font-mono text-sm">
          <div>© 2026 INTENT-STREAM-SDK</div>
          <div className="flex gap-6">
            <a href="https://yellow.org" className="hover:text-[#FFEB3B]">YELLOW NETWORK</a>
            <a href="https://uniswap.org" className="hover:text-[#FF007A]">UNISWAP</a>
            <a href="https://circle.com/arc" className="hover:text-[#00FF00]">CIRCLE ARC</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
