import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Your wallet private key
const PRIVATE_KEY = '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';

// Setup wallet
const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia.publicnode.com')
});

const walletClient = createWalletClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia.publicnode.com'),
    account
});

console.log('🔑 Wallet address:', account.address);

// For now, let's just test basic Uniswap v3 swap on Arbitrum Sepolia
// We'll upgrade to v4 once we have the hooks deployed

async function testUniswapSwap() {
    console.log('🦄 Testing Uniswap integration...');

    // Get current balance
    const balance = await publicClient.getBalance({
        address: account.address
    });

    console.log('💰 ETH Balance:', Number(balance) / 1e18, 'ETH');

    // For Phase 1, we'll use Uniswap SDK
    // This is a placeholder - we need to install @uniswap/sdk-core and @uniswap/v3-sdk
    console.log('✅ Wallet connected successfully');
    console.log('📝 Next: Install Uniswap SDK and implement swap logic');
}

testUniswapSwap().catch(console.error);
