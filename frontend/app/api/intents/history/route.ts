import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('address');
    const limit = parseInt(searchParams.get('limit') || '10');

    console.log('📜 Getting intent history for:', userAddress);

    // Mock intent history
    const history = [
        {
            id: '0x9f8e7d6c5b4a3928',
            timestamp: Date.now() - 7200000, // 2h ago
            fromToken: 'ETH',
            toToken: 'USDC',
            amount: '1.5',
            status: 'completed',
            executionTime: 1180,
            mevSavings: '96.05',
            network: 'arbitrum'
        },
        {
            id: '0x8e7d6c5b4a392817',
            timestamp: Date.now() - 10800000, // 3h ago
            fromToken: 'USDC',
            toToken: 'ETH',
            amount: '5000',
            status: 'completed',
            executionTime: 920,
            mevSavings: '124.18',
            network: 'arbitrum'
        },
        {
            id: '0x7d6c5b4a39281706',
            timestamp: Date.now() - 86400000, // 1d ago
            fromToken: 'ETH',
            toToken: 'USDC',
            amount: '0.75',
            status: 'completed',
            executionTime: 1050,
            mevSavings: '18.42',
            network: 'base'
        },
        {
            id: '0x6c5b4a3928170695',
            timestamp: Date.now() - 86400000, // 1d ago
            fromToken: 'WBTC',
            toToken: 'USDC',
            amount: '0.25',
            status: 'completed',
            executionTime: 1340,
            mevSavings: '203.67',
            network: 'arbitrum'
        },
        {
            id: '0x5b4a392817069584',
            timestamp: Date.now() - 172800000, // 2d ago
            fromToken: 'USDC',
            toToken: 'ETH',
            amount: '10000',
            status: 'completed',
            executionTime: 1120,
            mevSavings: '287.93',
            network: 'arbitrum'
        }
    ];

    // Calculate statistics
    const stats = {
        totalIntents: history.length,
        totalMevSaved: history.reduce((sum, intent) => sum + parseFloat(intent.mevSavings), 0).toFixed(2),
        avgExecutionTime: (history.reduce((sum, intent) => sum + intent.executionTime, 0) / history.length / 1000).toFixed(2),
        successRate: 100
    };

    console.log('✅ Retrieved', history.length, 'intents');

    return NextResponse.json({
        success: true,
        history: history.slice(0, limit),
        stats
    });
}
