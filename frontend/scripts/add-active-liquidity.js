const { spawn } = require("child_process");
const path = require("path");
require("dotenv").config({ path: "frontend/.env.local" });

const SCRIPT_PATH = "script/AddActiveLiquidity.s.sol";
const PROJECT_ROOT = path.resolve(__dirname, "../../web3/uniswap");

function runScript(networkName, rpcUrl) {
    return new Promise((resolve, reject) => {
        console.log(`\n🌊 Adding ACTIVE Liquidity to ${networkName}...`);

        const args = [
            "script",
            SCRIPT_PATH,
            "--rpc-url", rpcUrl,
            "--broadcast",
            "-vvvv"
        ];

        const child = spawn("forge", args, {
            cwd: PROJECT_ROOT,
            env: { ...process.env, FORCE_COLOR: true },
            stdio: "inherit"
        });

        child.on("close", (code) => {
            if (code === 0) {
                console.log(`✅ ${networkName} Success!`);
                resolve();
            } else {
                console.error(`❌ ${networkName} Failed (Exit ${code})`);
                reject(new Error(`Exit ${code}`));
            }
        });
    });
}

async function main() {
    try {
        // Base Sepolia
        await runScript("Base Sepolia", "https://sepolia.base.org");

        console.log("\n🏁 Done. Active Liquidity Added.");
    } catch (e) {
        console.error("Workflow failed:", e);
        process.exit(1);
    }
}

main();
