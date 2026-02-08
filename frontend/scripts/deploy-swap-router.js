const { spawn } = require("child_process");
const path = require("path");
require("dotenv").config({ path: "frontend/.env.local" });

const SCRIPT_PATH = "script/DeploySwapRouter.s.sol";
const PROJECT_ROOT = path.resolve(__dirname, "../../web3/uniswap");

// Addresses map
const MANAGERS = {
    84532: "0x05E7...",
    421614: "0xFB3e...",
    11155111: "0xE03A..."
};

const CHAINS = [
    { name: "Base Sepolia", rpc: "https://sepolia.base.org" },
    { name: "Arbitrum Sepolia", rpc: "https://sepolia-rollup.arbitrum.io/rpc" },
    { name: "Ethereum Sepolia", rpc: "https://1rpc.io/sepolia" }
];

async function runScript(name, rpc) {
    return new Promise((resolve, reject) => {
        console.log(`\n🚀 Deploying to ${name}...`);
        const args = ["script", SCRIPT_PATH, "--rpc-url", rpc, "--broadcast", "--legacy"];
        const child = spawn("forge", args, { cwd: PROJECT_ROOT, env: { ...process.env, FORCE_COLOR: true }, stdio: "inherit" });
        child.on("close", (code) => {
            if (code === 0) resolve(); else reject(new Error(`Exit ${code}`));
        });
    });
}

async function main() {
    try {
        for (const chain of CHAINS) {
            await runScript(chain.name, chain.rpc);
        }
        console.log("Done.");
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();
