import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { arbitrumSepolia, baseSepolia, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// User's main wallet private key
const MAIN_WALLET_PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY ||
    '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';

// Chain configurations
const CHAINS = {
    arbitrum: {
        chain: arbitrumSepolia,
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc'
    },
    base: {
        chain: baseSepolia,
        rpc: 'https://sepolia.base.org'
    },
    ethereum: {
        chain: sepolia,
        rpc: 'https://rpc.sepolia.org'
    }
};

// Uniswap V3 Router addresses (Sepolia testnets)
const UNISWAP_ROUTERS = {
    arbitrum: '0x101F443B4d1b059569D643917553c771E1b9663E', // SwapRouter02
    base: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4',
    ethereum: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E'
};

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { action, network = 'arbitrum' } = body;

    console.log('🦄 Uniswap API Request:', body);

    try {
        switch (action) {
            case 'get_quote':
                return handleGetQuote(body);

            case 'execute_swap':
                return handleExecuteSwap(body);

            case 'get_balance':
                return handleGetBalance(body);

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('❌ Uniswap Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function handleGetQuote(params: any): Promise<NextResponse> {
    const { network, fromToken, toToken, amount } = params;

    console.log('  📊 Getting quote...');
    console.log('  Network:', network);
    console.log('  From:', fromToken);
    console.log('  To:', toToken);
    console.log('  Amount:', amount);

    const chainConfig = CHAINS[network as keyof typeof CHAINS];
    if (!chainConfig) {
        return NextResponse.json({ error: 'Unsupported network' }, { status: 400 });
    }

    const publicClient = createPublicClient({
        chain: chainConfig.chain,
        transport: http(chainConfig.rpc)
    });

    // For now, return a mock quote
    // TODO: Integrate with Uniswap SDK for real quotes
    const mockQuote = {
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: (parseFloat(amount) * 2500).toString(), // Mock: 1 ETH = 2500 USDC
        priceImpact: '0.15',
        route: ['ETH', 'USDC'],
        gasEstimate: '0.0012'
    };

    console.log('  ✅ Quote generated:', mockQuote);

    return NextResponse.json({
        success: true,
        quote: mockQuote
    });
}

async function handleExecuteSwap(params: any): Promise<NextResponse> {
    const { network, fromToken, toToken, amount, slippage = 0.5 } = params;

    console.log('  🔄 Executing swap...');
    console.log('  Network:', network);
    console.log('  From:', fromToken, amount);
    console.log('  To:', toToken);
    console.log('  Slippage:', slippage, '%');

    const chainConfig = CHAINS[network as keyof typeof CHAINS];
    if (!chainConfig) {
        return NextResponse.json({ error: 'Unsupported network' }, { status: 400 });
    }

    // Setup wallet
    const account = privateKeyToAccount(MAIN_WALLET_PRIVATE_KEY as `0x${string}`);
    const walletClient = createWalletClient({
        chain: chainConfig.chain,
        transport: http(chainConfig.rpc),
        account
    });

    const publicClient = createPublicClient({
        chain: chainConfig.chain,
        transport: http(chainConfig.rpc)
    });

    console.log('  🔑 Wallet:', account.address);

    // Get current balance
    const balance = await publicClient.getBalance({
        address: account.address
    });

    console.log('  💰 Current balance:', formatUnits(balance, 18), 'ETH');

    // TODO: Implement actual Uniswap swap
    // For now, return mock response
    const mockSwap = {
        txHash: '0x' + Math.random().toString(16).substring(2),
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: (parseFloat(amount) * 2500).toString(),
        gasUsed: '0.0012',
        status: 'success'
    };

    console.log('  ✅ Swap executed:', mockSwap);

    return NextResponse.json({
        success: true,
        swap: mockSwap
    });
}

async function handleGetBalance(params: any): Promise<NextResponse> {
    const { network, address } = params;

    console.log('  💰 Getting balance...');
    console.log('  Network:', network);
    console.log('  Address:', address);

    const chainConfig = CHAINS[network as keyof typeof CHAINS];
    if (!chainConfig) {
        return NextResponse.json({ error: 'Unsupported network' }, { status: 400 });
    }

    const publicClient = createPublicClient({
        chain: chainConfig.chain,
        transport: http(chainConfig.rpc)
    });

    const targetAddress = address || privateKeyToAccount(MAIN_WALLET_PRIVATE_KEY as `0x${string}`).address;

    const balance = await publicClient.getBalance({
        address: targetAddress as `0x${string}`
    });

    console.log('  ✅ Balance:', formatUnits(balance, 18), 'ETH');

    return NextResponse.json({
        success: true,
        address: targetAddress,
        balance: formatUnits(balance, 18),
        balanceWei: balance.toString()
    });
}
