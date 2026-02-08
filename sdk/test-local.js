/**
 * Test script for TINT Protocol SDK
 * Run: node sdk/test-local.js
 */

const { TintClient } = require('./dist/index.js');
require('dotenv').config({ path: '../frontend/.env.local' });

async function test() {
    console.log('🧪 Testing TINT Protocol SDK\n');

    // Initialize client
    const client = new TintClient({
        privateKey: process.env.PRIVATE_KEY || process.env.MAIN_WALLET_PRIVATE_KEY,
        rpcUrl: 'https://1rpc.io/sepolia',
        backendUrl: 'http://localhost:3000/api',
        verifierAddress: '0x3837C39afF6A207C8B89fa9e4DAa45e3FBB35443'
    });

    console.log('✅ Client initialized');
    console.log('   Wallet:', client.getAddress());

    // Initialize Yellow Network
    try {
        await client.init();
        console.log('✅ Yellow Network connected\n');
    } catch (error) {
        console.log('⚠️  Yellow Network unavailable (using fallback)\n');
    }

    // Create intents
    console.log('📝 Creating intents...');

    const intent1 = await client.createIntent({
        type: 'SWAP',
        fromToken: 'USDC',
        toToken: 'WETH',
        amount: 10
    });
    console.log('   Intent 1: Swap 10 USDC → WETH');
    if (intent1.commitment) {
        console.log('   🔒 Commitment:', intent1.commitment.commitmentHex.substring(0, 18) + '...');
    }

    const intent2 = await client.createIntent({
        type: 'SWAP',
        fromToken: 'USDC',
        toToken: 'WETH',
        amount: 5
    });
    console.log('   Intent 2: Swap 5 USDC → WETH');
    if (intent2.commitment) {
        console.log('   🔒 Commitment:', intent2.commitment.commitmentHex.substring(0, 18) + '...');
    }

    // Submit intents
    console.log('\n📤 Submitting intents...');
    await client.submitIntent(intent1);
    await client.submitIntent(intent2);
    console.log('   ✅ Pending intents:', client.getPendingCount());

    // Execute batch
    console.log('\n🚀 Executing batch with netting...');
    const result = await client.executeBatch();

    console.log('\n📊 Results:');
    console.log('   Success:', result.success);
    if (result.txHash) {
        console.log('   Tx Hash:', result.txHash);
    }
    if (result.amountOut) {
        console.log('   Amount Out:', result.amountOut);
    }
    if (result.efficiency !== undefined) {
        console.log('   Netting Efficiency:', result.efficiency.toFixed(1) + '%');
    }
    if (result.error) {
        console.log('   Error:', result.error);
    }

    console.log('\n✅ Test complete!');
}

test().catch(error => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
});
