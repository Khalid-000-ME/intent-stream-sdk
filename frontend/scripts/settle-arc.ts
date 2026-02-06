import { ethers } from 'ethers';

// ARC TESTNET CONFIGURATION
const RPC_URL = 'https://rpc.testnet.arc.network';
const PRIVATE_KEY = '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';
const REGISTRY_ADDRESS = '0x195758b71dAD14EdB1Dd7E75AAE3e8e7ae69f6A3';

// Minimal ABI for SettlementRegistry
const REGISTRY_ABI = [
    'function postSettlement(bytes32 batchId, address[] traders, int256[] netAmounts) external',
    'function getSettlement(bytes32 batchId) external view returns ((bytes32 batchId, uint256 timestamp, uint256 totalVolume, bool finalized))',
    'event SettlementPosted(bytes32 indexed batchId, uint256 timestamp, uint256 totalVolume, uint256 netSettlementAmount)',
    'event TraderSettled(bytes32 indexed batchId, address indexed trader, int256 netAmount)'
];

// USDC on Arc Testnet
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)'
];

async function main() {
    console.log(`
███████╗███████╗████████╗████████╗██╗     ███████╗
██╔════╝██╔════╝╚══██╔══╝╚══██╔══╝██║     ██╔════╝
███████╗█████╗     ██║      ██║   ██║     █████╗  
╚════██║██╔══╝     ██║      ██║   ██║     ██╔══╝  
███████║███████╗   ██║      ██║   ███████╗███████╗
╚══════╝╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚══════╝
    ARC SETTLEMENT SCRIPT (REAL NETWORK)
`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log('🔄 Connecting to Arc Testnet...');
    console.log(`   RPC: ${RPC_URL}`);
    console.log(`   Operator: ${wallet.address}`);

    // Check Balance (Gas)
    const balance = await provider.getBalance(wallet.address);
    console.log(`   Gas Balance: ${ethers.formatUnits(balance, 18)} ETH/USDC`);

    if (balance === 0n) {
        console.error('\n❌ ERROR: Insufficient Gas!');
        console.error('Please fund your wallet using the Circle Faucet: https://faucet.circle.com/');
        console.error('Select "Arc Testnet" and enter address:', wallet.address);
        return;
    }

    console.log(`   Registry: ${REGISTRY_ADDRESS}\n`);

    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, wallet);
    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);

    // 1. Approve USDC
    console.log('1️⃣  Checking USDC Approval...');
    try {
        const approvalTx = await usdc.approve(REGISTRY_ADDRESS, ethers.MaxUint256);
        await approvalTx.wait();
        console.log('   ✅ Approved Registry to handle settlement funds');
    } catch (e: any) {
        console.error('   ❌ Approval Failed:', e.message);
        return;
    }

    // 2. Prepare Batch
    const batchId = ethers.hexlify(ethers.randomBytes(32));

    // FIXED: Send to SELF to recycle funds (Broker -> Broker)
    // This tests the logic but doesn't lose testnet funds
    const otherTrader = wallet.address;
    const traders = [wallet.address, otherTrader];

    // Check USDC Balance before setting amounts
    const usdcBal = await usdc.balanceOf(wallet.address);
    console.log(`   💰 Broker USDC: ${ethers.formatUnits(usdcBal, 6)}`);

    // CONSERVE FUNDS: Use only 0.01 USDC (10000 units)
    const testAmount = BigInt(10000);

    const amountToSettle = usdcBal >= testAmount ? testAmount : BigInt(0);
    if (amountToSettle === BigInt(0)) {
        console.warn('   ⚠️  No USDC balance, simulating 0-value settlement.');
    }

    const netAmounts = [BigInt(0), amountToSettle];

    console.log('\n2️⃣  Posting Settlement Batch...');
    console.log(`   Batch ID: ${batchId}`);
    console.log(`   Amount: ${ethers.formatUnits(amountToSettle, 6)} USDC`);

    try {
        const tx = await registry.postSettlement(batchId, traders, netAmounts);
        console.log(`   📤 Tx Sent: ${tx.hash}`);
        await tx.wait();
        console.log('\n✅ SETTLEMENT FINALIZED!');
    } catch (e: any) {
        console.error('\n❌ SETTLEMENT FAILED');
        console.error(e.message);
    }
}

main().catch(console.error);
