import { createPublicClient, http, formatUnits, defineChain } from 'viem';
import { sepolia } from 'viem/chains';
import 'dotenv/config';

// Define the token contract ABI (just for balanceOf)
const tokenAbi = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  }
];

// Address of the ytest.usd token on Sepolia
const TOKEN_ADDRESS = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb';

// The wallet address to check (derived from the PRIVATE_KEY you used)
// We'll fallback to a known address if we can't derive it or it's not set, 
// but ideally we should derive it from the key to be sure.
import { privateKeyToAccount } from 'viem/accounts';
const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';
const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

async function checkBalance() {
  const client = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com')
  });

  console.log('Wallet Address:', account.address);
  console.log('Checking ytest.usd balance on Sepolia...');

  try {
    const balance = await client.readContract({
      address: TOKEN_ADDRESS,
      abi: tokenAbi,
      functionName: 'balanceOf',
      args: [account.address]
    });

    console.log(`Balance: ${balance.toString()} (Raw)`);
    // Assuming 18 decimals for standard ERC20, usually, but let's check.
    // Actually, create-channel script implies it might be used like '1000000000' for 1 unit if decimals are 9, or maybe much smaller.
    // Let's just output logic.
    console.log(`Balance formatted (18 decimals): ${formatUnits(balance as bigint, 18)}`);
    console.log(`Balance formatted (6 decimals): ${formatUnits(balance as bigint, 6)}`);

    if (balance > 0n) {
        console.log('✅ Balance Found!');
    } else {
        console.log('❌ Zero Balance.');
    }

  } catch (error) {
    console.error('Error fetching balance:', error);
  }
}

checkBalance();
