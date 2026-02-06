'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Table, Input, StatusBadge, Modal, ProgressBar } from '@/components/ui';

export default function DashboardPage() {
    const [fromToken, setFromToken] = useState('ETH');
    const [toToken, setToToken] = useState('USDC');
    const [amount, setAmount] = useState('1.5');
    const [network, setNetwork] = useState('arbitrum');
    const [isExecuting, setIsExecuting] = useState(false);
    const [currentIntent, setCurrentIntent] = useState<any>(null);
    const [showModal, setShowModal] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    // Wallet State
    const [account, setAccount] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // Poll for intent status
    useEffect(() => {
        if (!currentIntent?.id) return;

        const interval = setInterval(async () => {
            try {
                const response = await fetch('/api/intent-flow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'get_intent_status',
                        intentId: currentIntent.id
                    })
                });

                const data = await response.json();

                // Handle server reset or intent loss
                if (!response.ok || !data.success) {
                    console.warn(`Polling stopped: ${data.error}`);
                    setIsExecuting(false);
                    clearInterval(interval);

                    // Mark as failed in local state if relevant
                    if (currentIntent) {
                        setHistory(prev => [{ ...currentIntent, status: 'failed', timeline: [{ stage: 'failed', message: 'Intent lost from server memory' }] }, ...prev]);
                        setCurrentIntent(null);
                    }
                    return;
                }

                if (data.success) {
                    setCurrentIntent(data.intent);

                    if (data.intent.status === 'completed' || data.intent.status === 'failed') {
                        setIsExecuting(false);
                        clearInterval(interval);

                        // Add to history
                        setHistory(prev => [data.intent, ...prev]);
                    }
                }
            } catch (error) {
                console.error('Error polling status:', error);
            }
        }, 500);

        return () => clearInterval(interval);
    }, [currentIntent?.id]);

    const connectWallet = async () => {
        if (typeof window === 'undefined' || !window.ethereum) {
            alert('Please install a wallet like MetaMask to connect.');
            return;
        }

        setIsConnecting(true);
        try {
            // @ts-ignore
            const provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.send("eth_requestAccounts", []);
            if (accounts.length > 0) {
                const ua = accounts[0];
                setAccount(ua);
                await registerAgent(ua);
            }
        } catch (err: any) {
            console.error('Connection failed:', err);
            alert('Failed to connect wallet');
        } finally {
            setIsConnecting(false);
        }
    };

    const registerAgent = async (wallet: string) => {
        try {
            await fetch('/api/agent/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentWallet: wallet,
                    metadata: { role: 'User', strategy: 'Manual-Dashboard' }
                })
            });
        } catch (e) {
            console.warn('Agent registration silent fail:', e);
        }
    };

    const executeIntent = async () => {
        if (!account) {
            await connectWallet();
            // @ts-ignore
            if (!account && !window.ethereum?.selectedAddress) return;
        }

        setIsExecuting(true);
        setShowModal(true);
        setCurrentIntent(null);

        try {
            // 1. Auth
            const authRes = await fetch('/api/yellow/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromToken, toToken, amount, network, slippage: 0.5,
                    userAddress: account
                })
            });
            const authData = await authRes.json();
            if (!authData.success) throw new Error(authData.error || 'Auth failed');
            const intentId = authData.intentId;

            // Trigger polling by setting currentIntent
            setCurrentIntent({ id: intentId, status: 'created', timeline: [] });

            // 2. Channel
            const chanRes = await fetch('/api/yellow/create-channel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intentId })
            });
            const chanData = await chanRes.json();
            if (!chanData.success) throw new Error(chanData.error || 'Channel failed');

            // 3. Submit
            const subRes = await fetch('/api/intent/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intentId })
            });
            const subData = await subRes.json();
            if (!subData.success) throw new Error(subData.error || 'Submit failed');

        } catch (error: any) {
            alert('Error: ' + error.message);
            setIsExecuting(false);
        }
    };

    const getProgress = () => {
        if (!currentIntent) return 0;
        const stages = ['created', 'connecting', 'connected', 'authenticating', 'authenticated',
            'channel_creating', 'channel_created', 'encrypting', 'streaming', 'executing', 'settling', 'confirming', 'completed'];
        const currentIndex = stages.indexOf(currentIntent.status);
        return ((currentIndex + 1) / stages.length) * 100;
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <header className="border-b-4 border-black bg-black text-[#FFEB3B] p-6 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-mono font-bold uppercase">INTENT-STREAM-SDK</h1>
                    <p className="text-sm mt-2 font-mono">MEV-Proof • Sub-Second • USDC-Native</p>
                </div>
                <button
                    onClick={connectWallet}
                    className={`px-4 py-2 font-mono font-bold border-2 border-[#FFEB3B] ${account ? 'bg-[#FFEB3B] text-black' : 'text-[#FFEB3B] hover:bg-[#FFEB3B] hover:text-black'}`}
                >
                    {isConnecting ? 'CONNECTING...' : account ? `CONNECTED: ${account.substring(0, 6)}...` : 'CONNECT WALLET'}
                </button>
            </header>

            <div className="max-w-7xl mx-auto p-8">
                {/* Metrics Row */}
                <div className="grid grid-cols-4 gap-6 mb-8">
                    <Card variant="black">
                        <div className="text-xs uppercase mb-2">Total Streamed</div>
                        <div className="text-4xl font-mono font-bold">$847,293</div>
                    </Card>
                    <Card variant="black">
                        <div className="text-xs uppercase mb-2">MEV Saved</div>
                        <div className="text-4xl font-mono font-bold text-[#00FF00]">$12,847</div>
                    </Card>
                    <Card variant="black">
                        <div className="text-xs uppercase mb-2">Avg Time</div>
                        <div className="text-4xl font-mono font-bold">1.18s</div>
                    </Card>
                    <Card variant="black">
                        <div className="text-xs uppercase mb-2">Success Rate</div>
                        <div className="text-4xl font-mono font-bold text-[#00FF00]">99.2%</div>
                    </Card>
                </div>

                {/* Intent Creation Form */}
                <Card className="mb-8">
                    <h2 className="text-2xl font-mono font-bold uppercase mb-6">STREAM INTENT</h2>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <Input
                            label="FROM TOKEN"
                            value={fromToken}
                            onChange={(e) => setFromToken(e.target.value)}
                            placeholder="ETH"
                        />
                        <Input
                            label="TO TOKEN"
                            value={toToken}
                            onChange={(e) => setToToken(e.target.value)}
                            placeholder="USDC"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <Input
                            label="AMOUNT"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="1.5"
                        />
                        <div>
                            <label className="block mb-2 text-xs font-mono font-bold uppercase">
                                NETWORK
                            </label>
                            <select
                                value={network}
                                onChange={(e) => setNetwork(e.target.value)}
                                className="w-full h-14 px-4 border-2 border-black bg-white text-base focus:border-[#FFEB3B] focus:outline-none"
                            >
                                <option value="arbitrum">Arbitrum</option>
                                <option value="base">Base</option>
                                <option value="ethereum">Ethereum</option>
                            </select>
                        </div>
                    </div>

                    <Button
                        onClick={executeIntent}
                        disabled={isExecuting}
                        className="w-full"
                    >
                        {isExecuting ? 'EXECUTING...' : 'STREAM INTENT'}
                    </Button>
                </Card>

                {/* Intent History */}
                {history.length > 0 && (
                    <Card>
                        <h2 className="text-2xl font-mono font-bold uppercase mb-6">RECENT INTENTS</h2>
                        <Table
                            headers={['ID', 'FROM→TO', 'AMOUNT', 'STATUS', 'TIME', 'MEV SAVED']}
                            rows={history.map(intent => [
                                intent.id.substring(0, 10) + '...',
                                `${intent.fromToken}→${intent.toToken}`,
                                intent.amount,
                                <StatusBadge
                                    key={intent.id}
                                    status={intent.status === 'completed' ? 'success' : intent.status === 'failed' ? 'error' : 'pending'}
                                >
                                    {intent.status}
                                </StatusBadge>,
                                intent.executionTime ? `${(intent.executionTime / 1000).toFixed(2)}s` : '-',
                                intent.result?.mevSavings ? `$${intent.result.mevSavings}` : '-'
                            ])}
                        />
                    </Card>
                )}
            </div>

            {/* Execution Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={`INTENT: ${currentIntent?.id?.substring(0, 16) || ''}...`}
            >
                {currentIntent && (
                    <div>
                        <ProgressBar
                            value={getProgress()}
                            label={`Progress: ${Math.round(getProgress())}%`}
                        />

                        <div className="mt-6 space-y-2">
                            <h3 className="font-mono font-bold uppercase mb-4">EXECUTION TIMELINE</h3>
                            {currentIntent.timeline?.map((item: any, i: number) => (
                                <div key={i} className="flex items-center gap-3 font-mono text-sm">
                                    <span className="text-[#00FF00]">✓</span>
                                    <span className="text-gray-500">
                                        {new Date(item.timestamp).toLocaleTimeString()}
                                    </span>
                                    <span>{item.message}</span>
                                </div>
                            ))}
                        </div>

                        {currentIntent.result && (
                            <div className="mt-6 p-4 border-2 border-black bg-[#1A1A1A] text-white">
                                <h3 className="font-mono font-bold uppercase mb-4 text-[#FFEB3B]">RESULT</h3>
                                <div className="space-y-2 font-mono text-sm">
                                    <div>Input: {currentIntent.result.inputAmount} {currentIntent.result.inputToken}</div>
                                    <div>Output: {currentIntent.result.outputAmount} {currentIntent.result.outputToken}</div>
                                    <div>Slippage: {currentIntent.result.slippage}%</div>
                                    <div>Gas Cost: ${currentIntent.result.gasCost}</div>
                                    <div className="text-[#00FF00]">MEV Savings: ${currentIntent.result.mevSavings}</div>
                                    <div>Yellow Channel: {currentIntent.result.yellowChannelId}</div>
                                    <div>Execution Time: {currentIntent.result.executionTimeMs}ms</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
