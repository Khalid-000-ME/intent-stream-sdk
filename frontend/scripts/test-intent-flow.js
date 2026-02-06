// Test the complete intent flow
async function testIntentFlow() {
    console.log('🧪 Testing Complete Intent Flow\n');
    console.log('━'.repeat(60));

    // Step 1: Create intent
    console.log('\n📝 Step 1: Creating intent...');

    const createResponse = await fetch('http://localhost:3000/api/intent-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'execute_intent',
            fromToken: 'ETH',
            toToken: 'USDC',
            amount: '0.000001', // Lower amount for testing (liquidity safe)
            network: 'ethereum', // Must be ethereum for IntentSwapExecutor
            slippage: 5.0
        })
    });

    const createData = await createResponse.json();

    if (!createData.success) {
        console.error('❌ Failed to create intent:', createData.error);
        return;
    }

    const intentId = createData.intentId;
    console.log('✅ Intent created:', intentId);

    // Step 2: Poll for status
    console.log('\n📊 Step 2: Monitoring execution...\n');

    let completed = false;
    let lastStatus = '';

    while (!completed) {
        await new Promise(resolve => setTimeout(resolve, 500));

        const statusResponse = await fetch('http://localhost:3000/api/intent-flow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get_intent_status',
                intentId
            })
        });

        const statusData = await statusResponse.json();

        if (!statusData.success) {
            console.error('❌ Failed to get status');
            break;
        }

        const intent = statusData.intent;

        // Print new timeline events
        if (intent.timeline && intent.timeline.length > 0) {
            const lastEvent = intent.timeline[intent.timeline.length - 1];
            if (lastEvent.stage !== lastStatus) {
                const time = new Date(lastEvent.timestamp).toLocaleTimeString();
                console.log(`  [${time}] ${lastEvent.stage}: ${lastEvent.message}`);
                lastStatus = lastEvent.stage;
            }
        }

        // Check if completed
        if (intent.status === 'completed' || intent.status === 'failed') {
            completed = true;

            console.log('\n' + '━'.repeat(60));

            if (intent.status === 'completed') {
                console.log('\n✅ INTENT EXECUTION SUCCESSFUL!\n');
                console.log('Results:');
                console.log('  Input:         ', intent.result.inputAmount, intent.result.inputToken);
                console.log('  Output:        ', intent.result.outputAmount, intent.result.outputToken);
                console.log('  Expected:      ', intent.result.expectedOutput, intent.result.outputToken);
                console.log('  Slippage:      ', intent.result.slippage, '%');
                console.log('  Gas Cost:      $', intent.result.gasCost);
                console.log('  MEV Savings:   $', intent.result.mevSavings);
                console.log('  Execution Time:', intent.result.executionTimeMs, 'ms');
                console.log('  Network:       ', intent.result.network);
                console.log('  Block:         #', intent.result.blockNumber);
                console.log('  Tx Hash:       ', intent.result.txHash);
                console.log('  Yellow Session:', intent.result.yellowSessionId || 'N/A');
                console.log('  Arc Settlement:', intent.result.arcTxHash || 'N/A');
            } else {
                console.log('\n❌ INTENT EXECUTION FAILED\n');
                console.log('Error:', intent.error);
            }

            console.log('\n' + '━'.repeat(60));
        }
    }
}

// Run the test
console.log(`
██╗███╗   ██╗████████╗███████╗███╗   ██╗████████╗
██║████╗  ██║╚══██╔══╝██╔════╝████╗  ██║╚══██╔══╝
██║██╔██╗ ██║   ██║   █████╗  ██╔██╗ ██║   ██║   
██║██║╚██╗██║   ██║   ██╔══╝  ██║╚██╗██║   ██║   
██║██║ ╚████║   ██║   ███████╗██║ ╚████║   ██║   
╚═╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝  ╚═══╝   ╚═╝   

        INTENT FLOW TEST SCRIPT
        Testing Yellow → Uniswap → Arc
`);

testIntentFlow().catch(console.error);
