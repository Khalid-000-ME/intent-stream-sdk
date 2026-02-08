const { execSync } = require("child_process");
require("dotenv").config({ path: "frontend/.env.local" });

const SCRIPT_PATH = "script/TestSwapSol.s.sol";
// Ensure we handle absolute path for forge if needed, or rely on PATH
const FORGE_CMD = `/Users/khalid/.foundry/bin/forge script ${SCRIPT_PATH}:TestSwapSol --legacy --broadcast -vv`;

const CHAINS = [
    { name: "Base Sepolia", rpc: "https://sepolia.base.org" },
    { name: "Arbitrum Sepolia", rpc: "https://sepolia-rollup.arbitrum.io/rpc" },
    { name: "Ethereum Sepolia", rpc: "https://ethereum-sepolia-rpc.publicnode.com" }
];

console.log("🚀 Starting Swap Test on All Chains...");

async function run() {
    for (const chain of CHAINS) {
        console.log(`\n🔄 Testing Swap on ${chain.name}...`);
        try {
            let cmd = `${FORGE_CMD} --rpc-url ${chain.rpc}`;
            // Remove priority gas price override for Arbitrum unless needed
            // Default forge behavior is often better

            // Execute with inherited environment (including MAIN_WALLET_PRIVATE_KEY)
            execSync(cmd, {
                stdio: "inherit",
                cwd: "web3/uniswap", // CORRECT CWD
                env: process.env
            });
            console.log(`✅ ${chain.name} Swap Test Completed.`);
        } catch (error) {
            console.error(`❌ Failed to test swap on ${chain.name}.`);
            // console.error(error.message);
        }
    }
    console.log("\n🏁 All Tests Finished.");
}

run();
