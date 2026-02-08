const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

// Simulation Configuration
const NUM_AGENTS = 5;
const DURATION_MS = 60000; // 1 minute simulation
const NETWORK = "arbitrum"; // Default network

// Private Keys provided by user + defaults
const AGENT_KEYS = [
    "d98e3acaac635ed63ed958377df7147a5851921366ec692ea56288e5c614ccea",
    "6de7758fcbceb69059aed7071d36f735c248c3c63d7b36d335edc7023e067189",
    "04726c2d7b3d3d379e6b270d4e047ccc054e7f3fcdd2c61742f5cb160c2abac4",
    // Add more funded keys if needed, or reuse
];

const PROMPTS = [
    "Swap 0.5 USDC to WETH",
    "Swap 0.0001 WETH to USDC", // Opposite direction for netting
    "Swap 0.2 USDC to WETH",
    "Swap 0.0002 WETH to USDC",
    "Swap 0.1 USDC to WETH"
];

// RPC Configuration
const RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc"; // Using Arbitrum Sepolia
const BASE_API = "http://localhost:3000/api";

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Helper for API calls
async function callApi(endpoint, body) {
    try {
        const response = await fetch(`${BASE_API}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await response.json();
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Agent Logic
async function runAgent(agentIndex, privateKey) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const shortAddr = wallet.address.substring(0, 6);
    console.log(`🤖 [Agent ${agentIndex}] Started (${shortAddr})...`);

    // 1. Authenticate / Create Session
    const agentRes = await callApi('/agent/create', { agentWallet: wallet.address, metadata: { name: `SimAgent-${agentIndex}` } });
    if (!agentRes.success) {
        console.error(`❌ [Agent ${agentIndex}] Auth Failed:`, agentRes.error);
        return;
    }
    const agentId = agentRes.agent.id;
    console.log(`✅ [Agent ${agentIndex}] Registered (Session: ${agentId})`);

    // 2. Intent Loop
    const prompt = PROMPTS[agentIndex % PROMPTS.length];
    console.log(`🧠 [Agent ${agentIndex}] Intent: "${prompt}"`);

    // Analyze
    const analysis = await callApi('/agent/intelligent', { prompt, agentId, network: NETWORK });
    if (!analysis.success || !analysis.intents || analysis.intents.length === 0) {
        console.error(`❌ [Agent ${agentIndex}] Analysis Failed`);
        return;
    }
    const intent = analysis.intents[0];

    // TINT Protocol Execution (Simulated Steps)
    try {
        // A. Yellow Auth
        console.log(`🔗 [Agent ${agentIndex}] Opening Yellow Channel...`);
        const authRes = await callApi('/yellow/auth', { ...intent, userAddress: wallet.address, network: NETWORK });
        if (!authRes.success) throw new Error(authRes.error);

        // B. Create Channel
        await callApi('/yellow/create-channel', { intentId: authRes.intentId });

        // C. Commitment
        const amountStr = intent.amount.toString();
        const randomness = ethers.hexlify(ethers.randomBytes(32));
        const commitment = ethers.solidityPackedKeccak256(["uint256", "uint256"], [ethers.parseEther(amountStr), randomness]);

        // D. Submit for Netting
        console.log(`🎯 [Agent ${agentIndex}] Submitting Commitment to TINT Network...`);
        // Note: In a real simulation, we would wait here for a "batch win".
        // For this script, we'll fire the swap request which (currently) executes immediately.
        // To simulate netting, the API would need to hold requests in a queue. 
        // Since the current API executes immediately, we will see parallel execution.

        const startTime = Date.now();
        const swapRes = await callApi('/tint/swap', {
            fromToken: intent.fromToken,
            toToken: intent.toToken,
            amount: amountStr,
            commitment: commitment,
            randomness: BigInt(randomness).toString(),
            network: NETWORK
        });

        if (!swapRes.success) throw new Error(swapRes.error);

        const duration = Date.now() - startTime;
        console.log(`✅ [Agent ${agentIndex}] Execution Complete in ${duration}ms`);
        console.log(`   Tx: ${swapRes.txHash}`);
        console.log(`   Efficiency: ${swapRes.nettingEfficiency}`);

    } catch (e) {
        console.error(`❌ [Agent ${agentIndex}] Execution Failed:`, e.message);
    }
}

async function main() {
    console.log(`
\x1b[36m████████╗██╗███╗   ██╗████████╗
╚══██╔══╝██║████╗  ██║╚══██╔══╝
   ██║   ██║██╔██╗ ██║   ██║   
   ██║   ██║██║╚██╗██║   ██║   
   ██║   ██║██║ ╚████║   ██║   
   ╚═╝   ╚═╝╚═╝  ╚═══╝   ╚═╝\x1b[0m
   \x1b[33mMULTI-AGENT TINT SIMULATION\x1b[0m
    `);

    console.log(`🚀 Spawning ${AGENT_KEYS.length} AI Agents on ${NETWORK}...`);

    // Launch all agents in parallel
    // Launch all agents in parallel with staggered start
    const promises = Array.from({ length: NUM_AGENTS }).map(async (_, idx) => {
        const key = AGENT_KEYS[idx % AGENT_KEYS.length];
        const delay = Math.floor(Math.random() * 5000); // 0-5s delay
        await new Promise(r => setTimeout(r, delay));
        return runAgent(idx + 1, key);
    });

    await Promise.all(promises);

    console.log("\n✅ Simulation Complete.");
}

main().catch(console.error);
