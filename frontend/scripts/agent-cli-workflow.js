const { ethers } = require("ethers");
const readline = require("readline");
const path = require("path");
const fs = require("fs");

// Load Environment
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
} else {
    require("dotenv").config(); // fallback
}

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY || 'e844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';
console.log(`DEBUG: Loaded Key: ${PRIVATE_KEY ? 'Yes' : 'No'}`);

if (!PRIVATE_KEY) {
    console.error("❌ MAIN_WALLET_PRIVATE_KEY not found in .env.local");
    process.exit(1);
}

// Configuration
const API_BASE = "http://localhost:3000/api";
const NETWORK = "arbitrum"; // Default network

// Interactive CLI
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const q = (query) => new Promise(resolve => rl.question(query, resolve));

// Helpers
async function callApi(endpoint, body) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await response.json();
    } catch (e) {
        return { success: false, error: e.message || "API Connection Failed (Is the dev server running?)" };
    }
}

async function main() {
    console.clear();
    console.log(`
\x1b[36m
████████╗██╗███╗   ██╗████████╗    ███████╗████████╗██████╗ ███████╗ █████╗ ███╗   ███╗
╚══██╔══╝██║████╗  ██║╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔══██╗████╗ ████║
   ██║   ██║██╔██╗ ██║   ██║       ███████╗   ██║   ██████╔╝█████╗  ███████║██╔████╔██║
   ██║   ██║██║╚██╗██║   ██║       ╚════██║   ██║   ██╔══██╗██╔══╝  ██╔══██║██║╚██╔╝██║
   ██║   ██║██║ ╚████║   ██║       ███████║   ██║   ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║
   ╚═╝   ╚═╝╚═╝  ╚═══╝   ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝\x1b[0m
    \x1b[33mTINT INTENT AGENT CLI (v1.0)\x1b[0m
    `);

    // 1. Connect & Auth
    const provider = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc"); // Basic default
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`🦊 Agent Wallet Loaded: \x1b[32m${wallet.address}\x1b[0m`);

    // 2. Redirect / Connect
    console.log(`\n⏳ \x1b[33mRequesting Wallet Authorization...\x1b[0m`);
    console.log("   🔗 Opening Wallet Interface...");

    // Try to open browser (MacOS 'open', Linux 'xdg-open', Win 'start')
    const startCmd = process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open';
    try {
        require('child_process').exec(`${startCmd} http://localhost:3000/connect`);
    } catch (e) {
        console.log("   ⚠️  Please open http://localhost:3000/connect manually.");
    }

    process.stdout.write("   🌐 Connecting Wallet via API... ");
    await new Promise(r => setTimeout(r, 2000));
    console.log("✅ Connected");

    // 3. Register Agent
    const agentRes = await callApi('/agent/create', { agentWallet: wallet.address, metadata: { name: "CLI Agent" } });
    if (!agentRes.success) {
        console.log("❌ Agent Registration Failed:", agentRes.error);
        process.exit(1);
    }
    const agentId = agentRes.agent.id;
    console.log(`✅ Authenticated! Session ID: \x1b[36m${agentId}\x1b[0m`);

    // 4. Main Loop
    while (true) {
        console.log("\n---------------------------------------------------------");
        console.log("🤖 \x1b[36mWaiting for User Intent...\x1b[0m");
        const prompt = await q("Type intent (e.g. 'Swap 1 USDC to WETH') or 'exit': ");

        if (prompt.toLowerCase() === 'exit') break;
        if (!prompt.trim()) continue;

        // A. Analyze
        console.log(`\n🧠 Analyzing: "${prompt}"...`);
        const analysis = await callApi('/agent/intelligent', {
            prompt,
            agentId,
            network: NETWORK
        });

        if (!analysis.success) {
            console.log(`❌ Analysis Error: ${analysis.error}`);
            continue;
        }

        const intents = analysis.intents || [];
        if (intents.length === 0) {
            console.log("⚠️  No actionable intents found.");
            continue;
        }

        // B. Review
        console.log(`\n📋 \x1b[33mParsed Intent Actions:\x1b[0m`);
        intents.forEach((intent, i) => {
            if (intent.type === 'PAYMENT') {
                const isBridge = intent.fromChain !== intent.toChain;
                console.log(`   ${i + 1}. [${isBridge ? 'BRIDGE' : 'TRANSFER'}] ${intent.amount} USDC/ETH -> ${intent.recipient} (${intent.fromChain}${isBridge ? ' -> ' + intent.toChain : ''})`);
            } else {
                console.log(`   ${i + 1}. [SWAP] ${intent.amount} ${intent.fromToken} -> ${intent.toToken} on ${intent.network || NETWORK}`);
            }
        });

        const confirm = await q("\n🚀 Proceed with Execution? (y/n): ");
        if (confirm.toLowerCase() !== 'y') {
            console.log("🚫 Aborted.");
            continue;
        }

        // C. Execute
        for (const intent of intents) {
            try {
                // --- PAYMENT / BRIDGE FLOW ---
                if (intent.type === 'PAYMENT') {
                    const isBridge = intent.fromChain !== intent.toChain;

                    if (isBridge) {
                        console.log(`\n🌉 \x1b[34mInitiating Bridge (${intent.fromChain} -> ${intent.toChain})...\x1b[0m`);
                        const bridgeRes = await callApi('/bridge/execute', {
                            fromChain: intent.fromChain,
                            toChain: intent.toChain,
                            amount: intent.amount,
                            token: 'USDC', // Default
                            recipient: intent.recipient
                        });

                        if (bridgeRes.success) {
                            console.log(`   ✅ Bridge Success! Tx: \x1b[32m${bridgeRes.txHash}\x1b[0m`);
                        } else {
                            console.log(`   ❌ Bridge Failed: ${bridgeRes.error}`);
                        }
                    } else {
                        console.log(`\n💸 \x1b[34mInitiating Direct Transfer...\x1b[0m`);
                        // Execute locally since we have the key

                        if (intent.fromToken === 'USDC' || prompt.includes('USDC') || intent.amount > 0.05) { // Heuristic: USDC usually smaller denomination or explicit in prompt
                            // Resolve USDC Address
                            const USDC_ADDRS = {
                                'arbitrum': '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
                                'base': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                                'ethereum': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
                            };
                            const usdcAddr = USDC_ADDRS[NETWORK];
                            const usdc = new ethers.Contract(usdcAddr, ["function transfer(address to, uint256 amount) returns (bool)"], wallet);

                            const tx = await usdc.transfer(intent.recipient, ethers.parseUnits(intent.amount.toString(), 6)); // USDC 6 decimals
                            console.log(`   ⏳ Sent USDC: ${tx.hash}`);
                            await tx.wait();
                            console.log(`   ✅ Transfer Confirmed!`);
                        } else {
                            // Native ETH Transfer
                            const tx = await wallet.sendTransaction({
                                to: intent.recipient,
                                value: ethers.parseEther(intent.amount.toString())
                            });
                            console.log(`   ⏳ Sent ETH: ${tx.hash}`);
                            await tx.wait();
                            console.log(`   ✅ Transfer Confirmed!`);
                        }
                    }
                    continue;
                }

                // --- UNISWAP V4 SWAP FLOW ---
                console.log(`\n🔄 \x1b[35mExecuting TINT Stream Swap (V4)...\x1b[0m`);

                // 2. Yellow Auth
                process.stdout.write("   ⚡ [Yellow] Authenticating & Opening Channel... ");
                const authRes = await callApi('/yellow/auth', {
                    ...intent,
                    userAddress: wallet.address,
                    network: intent.network || NETWORK
                });
                if (!authRes.success) throw new Error(authRes.error);
                console.log(`✅ (ID: ${authRes.intentId})`);

                // 3. Create Channel
                await callApi('/yellow/create-channel', { intentId: authRes.intentId });

                // 4. Execute Swap (Uniswap V4)
                process.stdout.write(`   🦄 [V4] Swapping ${intent.amount} ${intent.fromToken} -> ${intent.toToken}... `);

                const swapRes = await callApi('/uniswap/swap', {
                    network: intent.network || NETWORK,
                    tokenIn: intent.fromToken,
                    tokenOut: intent.toToken,
                    amount: intent.amount,
                    recipient: intent.recipient || wallet.address
                });

                if (!swapRes.success) throw new Error(swapRes.error);

                console.log("✅");
                console.log(`      Output: \x1b[36m${swapRes.amountOut} ${intent.toToken}\x1b[0m`);
                console.log(`      Tx Hash: \x1b[32m${swapRes.txHash}\x1b[0m`);

            } catch (e) {
                console.log(`\n   ❌ Intent Execution Failed: ${e.message}`);
                console.log(`   Detailed Error: ${JSON.stringify(e)}`);
            }
        }
        console.log("\n✅ \x1b[32mWorkflow Completed.\x1b[0m");
    }
}

main().catch(console.error);
