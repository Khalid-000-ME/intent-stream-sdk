
import { ethers } from 'ethers';

const RPC_URL = 'https://1rpc.io/sepolia';
const PRIVATE_KEY = '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';
const WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const SPENDER = '0x35D47dd80F637689692aC3caE1A61DaE20D6C8a6'; // Latest Executor

const ERC20_ABI = [
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)'
];

async function check() {
    console.log('🔍 Verifying Allowance...');
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const weth = new ethers.Contract(WETH, ERC20_ABI, provider);

    console.log(`  Owner: ${wallet.address}`);
    console.log(`  Spender: ${SPENDER}`);

    const balance = await weth.balanceOf(wallet.address);
    const allowance = await weth.allowance(wallet.address, SPENDER);

    console.log(`  Balance: ${ethers.formatUnits(balance, 18)} WETH`);
    console.log(`  Allowance: ${ethers.formatUnits(allowance, 18)} WETH`);

    if (allowance === 0n) {
        console.log('  ❌ NO ALLOWANCE!');
    } else {
        console.log('  ✅ ALLOWANCE SET');
    }
}

check().catch(console.error);
