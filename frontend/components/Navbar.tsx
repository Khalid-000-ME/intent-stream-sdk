import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navbar() {
    return (
        <nav className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-8 h-8 bg-yellow-400 group-hover:rotate-180 transition-transform duration-500" />
                    <span className="font-mono font-bold text-xl tracking-tighter">INTENT<span className="text-yellow-400">STREAM</span></span>
                </Link>

                {/* Links */}
                <div className="hidden md:flex items-center gap-8 text-sm font-mono uppercase tracking-widest">
                    <NavLink href="/dashboard">Dashboard</NavLink>
                    <NavLink href="/swapping">Swap</NavLink>
                    <NavLink href="/bridging">Bridge</NavLink>
                    <NavLink href="/tint">TINT Demo</NavLink>
                    <NavLink href="/final-stream-tint">TINT Stream</NavLink>
                    <NavLink href="/intents">History</NavLink>
                </div>

                {/* Wallet / Status */}
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/5 rounded border border-white/10 text-xs font-mono">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span>Arbitrum Sepolia</span>
                    </div>
                    <button className="bg-yellow-400 text-black px-4 py-2 font-bold font-mono text-sm uppercase hover:bg-white hover:text-black transition-colors">
                        Connect
                    </button>
                </div>
            </div>
        </nav>
    );
}

function NavLink({ href, children }: { href: string, children: React.ReactNode }) {
    return (
        <Link
            href={href}
            className="text-gray-400 hover:text-yellow-400 transition-colors"
        >
            {children}
        </Link>
    );
}
