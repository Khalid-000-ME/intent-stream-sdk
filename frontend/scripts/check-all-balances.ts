import { createPublicClient, http, formatEther } from 'viem';
import { arbitrumSepolia, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const PRIVATE_KEY = '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';
const account = privateKeyToAccount(PRIVATE_KEY);

async function checkBalances() {
    console.log('Checking balances for:', account.address);

    const arbClient = createPublicClient({ chain: arbitrumSepolia, transport: http('https://sepolia-rollup.arbitrum.io/rpc') });
    const ethClient = createPublicClient({ chain: sepolia, transport: http('https://rpc.sepolia.org') });

    const arbBalance = await arbClient.getBalance({ address: account.address });
    const ethBalance = await ethClient.getBalance({ address: account.address });

    console.log('Arbitrum Sepolia:', formatEther(arbBalance), 'ETH');
    console.log('Ethereum Sepolia:', formatEther(ethBalance), 'ETH');
}

checkBalances();
