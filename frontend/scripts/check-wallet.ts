/**
 * Check wallet balance and diagnose channel creation issues
 */

import { createPublicClient, http, formatEther } from 'viem';
import { sepolia } from 'viem/chains';

const WALLET_ADDRESS = '0x1111d87736c9C90Bb9eAE83297BE83ae990699cE';
const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

async function checkWallet() {
    console.log('🔍 Wallet Diagnostics\n');
    console.log('='.repeat(60) + '\n');

    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(SEPOLIA_RPC)
    });

    console.log(`👤 Address: ${WALLET_ADDRESS}\n`);

    try {
        // Check ETH balance
        const balance = await publicClient.getBalance({ address: WALLET_ADDRESS as `0x${string}` });
        const ethBalance = formatEther(balance);

        console.log(`💰 Sepolia ETH Balance: ${ethBalance} ETH`);

        if (balance === 0n) {
            console.log('\n⚠️  WARNING: No Sepolia ETH!');
            console.log('   You need ETH for gas fees to create channels on-chain.');
            console.log('\n📋 Get Sepolia ETH from:');
            console.log('   • https://sepoliafaucet.com/');
            console.log('   • https://www.alchemy.com/faucets/ethereum-sepolia');
            console.log('   • https://faucet.quicknode.com/ethereum/sepolia');
        } else if (balance < 10000000000000000n) { // < 0.01 ETH
            console.log('\n⚠️  Low balance! Recommended: at least 0.01 ETH for gas');
        } else {
            console.log('✅ Sufficient balance for gas fees');
        }

        // Check block number
        const blockNumber = await publicClient.getBlockNumber();
        console.log(`\n📦 Latest Block: ${blockNumber}`);
        console.log('✅ RPC connection working\n');

    } catch (error: any) {
        console.error('❌ Error checking wallet:', error.message);
    }

    console.log('='.repeat(60) + '\n');
}

checkWallet()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
