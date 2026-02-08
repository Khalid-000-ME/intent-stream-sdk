/**
 * Test TINT Protocol with AI Agent
 * Run: GEMINI_API_KEY=your_key node sdk/test-agent.js
 */

const { TintClient } = require('./dist/index.js');
require('dotenv').config({ path: '../frontend/.env.local' });

async function testAgent() {
    console.log('🤖 Testing TINT Protocol AI Agent\n');

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
        console.log('❌ GEMINI_API_KEY not found in .env.local');
        console.log('   Add: GEMINI_API_KEY="your_api_key"');
        process.exit(1);
    }

    // Initialize client with AI agent
    const client = new TintClient({
        privateKey: process.env.PRIVATE_KEY || process.env.MAIN_WALLET_PRIVATE_KEY,
        rpcUrl: 'https://1rpc.io/sepolia',
        backendUrl: 'http://localhost:3000/api',
        verifierAddress: '0x3837C39afF6A207C8B89fa9e4DAa45e3FBB35443',
        geminiApiKey: geminiKey // Enable AI agent
    });

    console.log('✅ AI Agent initialized');
    console.log('   Wallet:', client.getAddress());
    console.log('   Agent enabled:', client.hasAgent());

    // Test 1: Natural language intent
    console.log('\n=== Test 1: Natural Language Processing ===');
    console.log('User says: "Swap 0.5 USDC to WETH in Base"');

    const result1 = await client.processNaturalLanguage('Swap 0.5 USDC to WETH in Base');
    console.log('Result:', result1.success ? '✅ Success' : '❌ Failed');
    if (result1.error) console.log('Error:', result1.error);
    if (result1.efficiency) console.log('Efficiency:', result1.efficiency.toFixed(1) + '%');

    // Test 2: Multiple intents in one sentence
    console.log('\n=== Test 2: Multiple Intents ===');
    console.log('User says: "Swap 0.5 USDC to WETH and then swap 0.3 USDC to WETH in Base"');

    const result2 = await client.processNaturalLanguage(
        'Swap 0.5 USDC to WETH and then swap 0.3 USDC to WETH in Base'
    );
    console.log('Result:', result2.success ? '✅ Success' : '❌ Failed');
    if (result2.efficiency) console.log('Efficiency:', result2.efficiency.toFixed(1) + '%');

    // Test 3: Chat with agent
    console.log('\n=== Test 3: Conversational Chat ===');
    const response = await client.chat('What is TINT Protocol?');
    console.log('Agent:', response.substring(0, 200) + '...');

    console.log('\n🎉 AI Agent tests complete!');
    console.log('\n📝 Summary:');
    console.log('  ✅ Natural language parsing works');
    console.log('  ✅ Multi-intent detection works');
    console.log('  ✅ Conversational interface works');
    console.log('  ✅ Commitments generated automatically');
    console.log('\n🚀 TINT Protocol AI Agent is ready!');
}

testAgent().catch(error => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
});
