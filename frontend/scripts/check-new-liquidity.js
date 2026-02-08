const { execSync } = require("child_process");
const path = require("path");
require("dotenv").config({ path: ".env.local" });

const SCRIPT_PATH = "script/CheckNewLiquidity.s.sol";
// Ensure correct Foundry Project Root regardless of where script is run
const FOUNDRY_ROOT = path.resolve(__dirname, "../../web3/uniswap");
const FORGE_CMD = `/Users/khalid/.foundry/bin/forge script ${SCRIPT_PATH}:CheckNewLiquidity --legacy`;

const CHAINS = [
    { name: "Base Sepolia", rpc: "https://sepolia.base.org" },
    { name: "Arbitrum Sepolia", rpc: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc" },
    { name: "Ethereum Sepolia", rpc: "https://1rpc.io/sepolia" }
];

async function main() {
    console.log("🌊 UNIFLOW - NEW POOLS LIQUIDITY CHECK (via Foundry) 🌊\n");
    console.log("Using script:", SCRIPT_PATH);
    console.log("Project Root:", FOUNDRY_ROOT);

    for (const chain of CHAINS) {
        console.log(`\n🔍 Checking ${chain.name}...`);
        try {
            // Run Verify Script inside web3/uniswap directory
            const output = execSync(`${FORGE_CMD} --rpc-url ${chain.rpc}`, {
                encoding: "utf8",
                stdio: "pipe",
                cwd: FOUNDRY_ROOT
            });

            // Extract Logs
            const lines = output.split("\n");
            let logsStarted = false;
            for (const line of lines) {
                const trimmed = line.trim();

                if (trimmed.includes("== Logs ==")) {
                    logsStarted = true;
                    continue;
                }

                if (logsStarted && trimmed !== "") {
                    // Check for Raw Values and Format
                    if (trimmed.startsWith("Est. USDC Locked (Raw):")) {
                        const val = trimmed.split(":")[1].trim();
                        try {
                            const formatted = (Number(val) / 1e6).toFixed(6);
                            console.log(`  Est. USDC Locked: ${formatted} USDC`);
                        } catch (e) {
                            console.log("  " + trimmed);
                        }
                    } else if (trimmed.startsWith("Est. WETH Locked (Wei):")) {
                        const val = trimmed.split(":")[1].trim();
                        try {
                            // Manual BigInt formatting to avoid ethers dep if missing, or large number issues
                            const bn = BigInt(val);
                            const integerPart = bn / 1000000000000000000n;
                            const remainder = bn % 1000000000000000000n;
                            // Pad remainder
                            let remStr = remainder.toString().padStart(18, '0');
                            // Trim trailing zeros
                            remStr = remStr.replace(/0+$/, '');
                            if (remStr === "") remStr = "0";
                            console.log(`  Est. WETH Locked: ${integerPart}.${remStr} ETH`);
                        } catch (e) {
                            console.log("  " + trimmed);
                        }
                    } else {
                        console.log("  " + trimmed);
                    }
                }
            }
        } catch (e) {
            console.log(`❌ Failed to check ${chain.name}. (RPC might be down or contract pending)`);
            // console.log(e.message); // basic error
        }
    }

    console.log("\n🏁 Done.");
}

main().catch(console.error);
