/* scripts/test-unified-flow.ts */
import fetch from 'node-fetch';

async function testUnifiedFlow() {
    console.log('🧪 Testing UNIFIED Intent Flow (Swap + Payment)\n');
    console.log('━'.repeat(60));

    // ---------------------------------------------------------
    // TEST 1: SWAP INTENT (Original Logic)
    // ---------------------------------------------------------
    console.log('\n🟢 TEST 1: SWAP INTENT (Arbitrum ETH -> USDC)');
    const channelId1 = await runIntentTest({
        type: 'SWAP',
        fromToken: 'ETH',
        toToken: 'USDC',
        amount: '0.000001',
        network: 'arbitrum',
        slippage: 0.5
    });

    console.log('\n' + '━'.repeat(60) + '\n');

    // ---------------------------------------------------------
    // TEST 2: PAYMENT INTENT (New Logic)
    // ---------------------------------------------------------
    console.log('🔵 TEST 2: PAYMENT INTENT (Arc Bridging)');

    const intentParams2: any = {
        type: 'PAYMENT',
        amount: '1.0', // 1 USDC
        network: 'ethereum', // From Chain
        toChain: 'base', // To Chain
        recipient: '0x1234567890123456789012345678901234567890'
    };

    if (channelId1) {
        console.log(`💡 Reusing Channel ID from Test 1: ${channelId1.substring(0, 10)}... (Skipping discovery)`);
        intentParams2.forceChannelId = channelId1;
    }

    await runIntentTest(intentParams2);

}

async function runIntentTest(intentParams: any): Promise<string | undefined> {
    // 1. Auth & Intent Creation
    console.log('\n📝 Step 1: /api/yellow/auth');
    try {
        const authRes = await fetch('http://localhost:3000/api/yellow/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(intentParams)
        });
        const authData: any = await authRes.json();
        if (!authData.success) {
            console.error('Auth Failed:', authData.error);
            return undefined;
        }
        var intentId = authData.intentId;
        console.log('✅ Intent Created & Authenticated:', intentId);
    } catch (e) {
        console.error('Auth Request Error:', e);
        return undefined;
    }

    // 2. Channel Creation
    console.log('\n📝 Step 2: /api/yellow/create-channel');
    let channelId: string | undefined;
    try {
        const body: any = { intentId };
        if (intentParams.forceChannelId) {
            body.forceChannelId = intentParams.forceChannelId;
        }

        const chanRes = await fetch('http://localhost:3000/api/yellow/create-channel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const chanData: any = await chanRes.json();
        if (!chanData.success) {
            console.error('Channel Failed:', chanData.error);
            return undefined;
        }
        console.log('✅ Channel Ready:', chanData.channelId);
        channelId = chanData.channelId;
    } catch (e) {
        console.error('Channel Request Error:', e);
        return undefined;
    }

    // 3. Submit Execution
    console.log('\n📝 Step 3: /api/intent/submit');
    try {
        const subRes = await fetch('http://localhost:3000/api/intent/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intentId })
        });
        const subData: any = await subRes.json();
        if (!subData.success) {
            console.error('Submit Failed:', subData.error);
            return channelId;
        }
        console.log('✅ Intent Execution Started (Background Process)');
    } catch (e) {
        console.error('Submit Request Error:', e);
        return channelId;
    }

    // 4. Poll Final Status
    console.log('\n📊 Monitoring execution logs...\n');
    let completed = false;
    let lastStatus = '';
    while (!completed) {
        await new Promise(r => setTimeout(r, 1000));
        try {
            const sRes = await fetch('http://localhost:3000/api/intent-flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_intent_status', intentId })
            });
            const sData: any = await sRes.json();
            const intent = sData.intent;

            if (!intent) {
                console.error('Intent not found');
                break;
            }

            if (intent.timeline && intent.timeline.length > 0) {
                const lastEvent = intent.timeline[intent.timeline.length - 1];
                if (lastEvent.stage !== lastStatus) {
                    const time = new Date(lastEvent.timestamp).toLocaleTimeString();
                    console.log(`  [${time}] ${lastEvent.stage}: ${lastEvent.message}`);
                    lastStatus = lastEvent.stage;
                }
            }

            if (intent.status === 'completed' || intent.status === 'failed') {
                completed = true;
                console.log('\nFinal Status:', intent.status);
                if (intent.status === 'completed') {
                    if (intentParams.type === 'SWAP') {
                        console.log(`Result: ${intent.result.inputAmount} ETH -> ${intent.result.outputAmount} USDC`);
                    } else {
                        console.log(`Result: Bridged ${intent.result.inputAmount} USDC -> ${intent.result.txHash ? 'Success' : 'Pending'}`);
                    }
                } else {
                    console.error('Error:', intent.error);
                }
            }
        } catch (e) {
            console.error('Polling Error:', e);
            break;
        }
    }
    return channelId;
}

testUnifiedFlow().catch(console.error);
