/* scripts/test-agent-workflow.ts */
import fetch from 'node-fetch';

async function testAgentWorkflow() {
    console.log('🤖 Testing Agentic Workflow (Registration -> AI -> Execution -> Data)\n');
    console.log('━'.repeat(60));

    // 1. Register Agent
    console.log('\n📝 Step 1: Register Agent');
    let agentId = '';
    try {
        const res = await fetch('http://localhost:3000/api/agent/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentWallet: '0x' + Array(40).fill('a').join(''), // Mock wallet for identity
                metadata: { role: 'Arbitrageur', strategy: 'LowRisk' }
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
    // SCENARIO 1: SWAP INTENT
    // ---------------------------------------------------------
    console.log('\n' + '━'.repeat(20) + ' SCENARIO 1: SWAP ' + '━'.repeat(20));
    // Reduced amount to ensure gas sufficiency
    // Updated for Base Sepolia V4 testing (USDC -> WETH)
    const channelId = await executeAgentTask(agentId, "Swap 0.1 USDC to WETH on Base");

    // const channelId = undefined; // Skip swap for now to debug payment

    // ---------------------------------------------------------
    // SCENARIO 2: PAYMENT INTENT
    // ---------------------------------------------------------
    console.log('\n' + '━'.repeat(20) + ' SCENARIO 2: PAYMENT ' + '━'.repeat(20));
    if (channelId) {
        console.log(`ℹ️ Reusing Agent Channel: ${channelId.substring(0, 10)}...`);
    }
    // Use 'arc' (Arc Testnet) as source chain where funds likely exist
    await executeAgentTask(agentId, "Pay 0.1 USDC to 0xdAa47b68bA6593e3F430b9d4794145B8321f9C86 on Base network", channelId, 'arc');

    // ---------------------------------------------------------
    // FINAL DATA CHECK
    // ---------------------------------------------------------
    console.log('\n📊 Final Data Check');
    try {
        const hRes = await fetch(`http://localhost:3000/api/agent/intents?agentId=${agentId}`, { method: 'GET' });
        const hData: any = await hRes.json();
        console.log(`✅ Intent History: ${hData.intents.length} intents found.`);
        const lastIntent = hData.intents[hData.intents.length - 1];
        if (lastIntent) {
            console.log(`   Latest Status: ${lastIntent.status} (${lastIntent.type})`);
        }
    } catch (e) {
        console.error('Data Fetch Failed:', e);
    }

    console.log('\n✨ Agent Workflow Test Complete');
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

        const intents = data.intents || (data.intent ? [data.intent] : []);
        if (intents.length === 0) throw new Error("No intents parsed");
        parsedIntent = intents[0];
        console.log(`   ✅ Parsed: ${parsedIntent.type} | ${parsedIntent.amount} ${parsedIntent.fromToken || ''} -> ${parsedIntent.toToken || parsedIntent.recipient} on ${parsedIntent.network || parsedIntent.toChain}`);
    } catch (e) {
        console.error('   ❌ AI Parsing Failed:', e);
        return undefined;
    }

    // 2. Execution Flow (Retry Wrapper)
    let activeChannelId = existingChannelId;
    let attempts = 0;
    const MAX_ATTEMPTS = 5; // Increased retries

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
            if (!authData.success) throw new Error(`Auth failed: ${authData.error}`);

            const intentId = authData.intentId;
            console.log(`   ✅ Authenticated (Intent ID: ${intentId})`);

            // Create Channel (or Reuse)
            const reqBody: any = { intentId };
            if (activeChannelId) reqBody.forceChannelId = activeChannelId;

            const chanRes = await fetch('http://localhost:3000/api/yellow/create-channel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqBody)
            });
            const chanData: any = await chanRes.json();
            if (!chanData.success) throw new Error(chanData.error);

            activeChannelId = chanData.channelId;
            console.log(`   ✅ Channel Ready: ${activeChannelId?.substring(0, 10)}...`);

            // Submit
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

                    if (intent.status === 'completed' || intent.status === 'failed') {
                        completed = true;
                        console.log(`\n   ✅ Final Status: ${intent.status}`);
                        if (intent.status === 'completed') {
                            console.log(`      Result: ${JSON.stringify(intent.result, null, 2)}`);
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

            break; // Success!

        } catch (e: any) {
            console.error(`   ⚠️ Attempt ${attempts}/${MAX_ATTEMPTS} failed: ${e.message}`);
            if (attempts === MAX_ATTEMPTS) {
                console.error('   ❌ All execution attempts failed.');
            } else {
                console.log('   Retrying in 10s...');
                await new Promise(r => setTimeout(r, 10000));
            }
        }
    }
    return activeChannelId;
}

testAgentWorkflow();
