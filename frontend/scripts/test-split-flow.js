/* scripts/test-split-flow.js */
async function testSplitFlow() {
    console.log('🧪 Testing Split API Flow\n');
    console.log('━'.repeat(60));

    // 1. Auth & Intent Creation
    console.log('\n📝 Step 1: /api/yellow/auth');
    try {
        const authRes = await fetch('http://localhost:3000/api/yellow/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromToken: 'ETH', toToken: 'USDC', amount: '0.000001', network: 'arbitrum', slippage: 0.5
            })
        });
        const authData = await authRes.json();
        if (!authData.success) {
            console.error('Auth Failed:', authData.error);
            return;
        }
        var intentId = authData.intentId;
        console.log('✅ Intent Created & Authenticated:', intentId);
    } catch (e) {
        console.error('Auth Request Error:', e);
        return;
    }

    // 2. Channel Creation
    console.log('\n📝 Step 2: /api/yellow/create-channel');
    try {
        const chanRes = await fetch('http://localhost:3000/api/yellow/create-channel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intentId })
        });
        const chanData = await chanRes.json();
        if (!chanData.success) {
            console.error('Channel Failed:', chanData.error);
            return;
        }
        console.log('✅ Channel Ready:', chanData.channelId);
    } catch (e) {
        console.error('Channel Request Error:', e);
        return;
    }

    // 3. Submit Execution
    console.log('\n📝 Step 3: /api/intent/submit');
    try {
        const subRes = await fetch('http://localhost:3000/api/intent/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intentId })
        });
        const subData = await subRes.json();
        if (!subData.success) {
            console.error('Submit Failed:', subData.error);
            return;
        }
        console.log('✅ Intent Execution Started (Background Process)');
    } catch (e) {
        console.error('Submit Request Error:', e);
        return;
    }

    // 4. Poll Final Status (to see timeline)
    console.log('\n📊 Monitoring execution logs (from memory store)...\n');
    let completed = false;
    let lastStatus = '';
    while (!completed) {
        await new Promise(r => setTimeout(r, 500));
        try {
            const sRes = await fetch('http://localhost:3000/api/intent-flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_intent_status', intentId })
            });
            const sData = await sRes.json();
            const intent = sData.intent;
            if (!intent) {
                console.error('Intent not found during polling');
                break;
            }

            // Print timeline
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
                    console.log('Channel ID:', intent.result.yellowChannelId);
                    console.log('Arc Settlement:', intent.result.arcTxHash);
                } else {
                    console.error('Error:', intent.error);
                }
            }
        } catch (e) {
            console.error('Polling Error:', e);
            break;
        }
    }
}

testSplitFlow().catch(console.error);
