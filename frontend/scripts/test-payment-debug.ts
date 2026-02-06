
import fetch from 'node-fetch';

async function testPaymentDebug() {
    console.log('🐞 Debugging Payment Flow Only\n');

    // 1. Register Agent
    console.log('\n📝 Step 1: Register Agent');
    let agentId = '';
    try {
        const res = await fetch('http://localhost:3000/api/agent/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentWallet: '0x' + Array(40).fill('b').join(''),
                metadata: { role: 'PaymentTester', strategy: 'Debug' }
            })
        });
        const data: any = await res.json();
        if (!data.success) throw new Error(data.error);

        agentId = data.agent.id;
        console.log(`✅ Agent Registered: ${agentId}`);
    } catch (e) {
        console.error('Registration Failed:', e);
        return;
    }

    // ---------------------------------------------------------
    // SCENARIO: PAYMENT INTENT
    // ---------------------------------------------------------
    console.log('\n' + '━'.repeat(20) + ' DEBUG: PAYMENT ' + '━'.repeat(20));
    // Use 'arc' explicitly
    await executeAgentTask(agentId, "Pay 0.1 USDC to 0x43DDBD19381C8Ea8C1e4670d18DdB97c43fbEFDC on Base network", undefined, 'arc');

    console.log('\n✨ Payment Debug Test Complete');
}

async function executeAgentTask(agentId: string, prompt: string, existingChannelId?: string, network?: string): Promise<string | undefined> {
    console.log(`\n🧠 Processing Prompt: "${prompt}"`);
    let parsedIntent: any = {};

    // 1. AI Parsing
    try {
        const res = await fetch('http://localhost:3000/api/agent/intelligent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, agentId, network })
        });
        const data: any = await res.json();
        if (!data.success) throw new Error(data.error);

        parsedIntent = data.intent;
        console.log(`   ✅ Parsed: ${parsedIntent.type} | ${parsedIntent.amount} ${parsedIntent.fromToken || ''} -> ${parsedIntent.toToken || parsedIntent.recipient} on ${parsedIntent.network || parsedIntent.toChain}`);
    } catch (e) {
        console.error('   ❌ AI Parsing Failed:', e);
        return undefined;
    }

    // 2. Execution Flow
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    while (attempts < MAX_ATTEMPTS) {
        attempts++;
        try {
            // Auth
            const authRes = await fetch('http://localhost:3000/api/yellow/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsedIntent)
            });
            const authData: any = await authRes.json();
            if (!authData.success) {
                // If auth is failing intermittently, we retry.
                throw new Error(`Auth failed: ${authData.error}`);
            }
            const intentId = authData.intentId;
            console.log(`   ✅ Authenticated (Intent ID: ${intentId})`);

            // Create Channel
            const reqBody: any = { intentId };

            const chanRes = await fetch('http://localhost:3000/api/yellow/create-channel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqBody)
            });
            const chanData: any = await chanRes.json();
            if (!chanData.success) throw new Error(chanData.error);

            const activeChannelId = chanData.channelId;
            console.log(`   ✅ Channel Ready: ${activeChannelId?.substring(0, 10)}...`);

            // Submit
            console.log(`   🚀 Submitting Intent ${intentId}...`);
            const subRes = await fetch('http://localhost:3000/api/intent/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intentId })
            });
            const subData: any = await subRes.json();
            if (!subData.success) throw new Error(subData.error);
            console.log(`   ✅ Execution Started: ${subData.message}`);

            // Poll for Completion
            process.stdout.write('   ⏳ Polling status: ');
            let completed = false;
            let polls = 0;
            while (!completed && polls < 120) { // Timeout after 120s
                polls++;
                await new Promise(r => setTimeout(r, 1000));
                try {
                    const sRes = await fetch('http://localhost:3000/api/intent-flow', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'get_intent_status', intentId })
                    });
                    const sData: any = await sRes.json();
                    const intent = sData.intent;

                    if (intent.status === 'completed' || intent.status === 'failed') {
                        completed = true;
                        console.log(`\n   ✅ Final Status: ${intent.status}`);
                        if (intent.status === 'completed') {
                            console.log(`      Result: ${JSON.stringify(intent.result).substring(0, 100)}...`);
                        } else {
                            console.log(`      Error: ${intent.error}`);
                        }
                    } else {
                        process.stdout.write('.');
                    }
                } catch (e) {
                    // ignore polling error
                }
            }

            if (!completed) {
                console.log('\n   ⚠️ Polling Timeout. Check logs.');
            }

            break; // Success!

        } catch (e: any) {
            console.error(`   ⚠️ Attempt ${attempts}/${MAX_ATTEMPTS} failed: ${e.message}`);
            if (attempts === MAX_ATTEMPTS) {
                console.error('   ❌ All execution attempts failed.');
            } else {
                console.log('   Retrying in 5s...');
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }
    return undefined;
}

testPaymentDebug();
