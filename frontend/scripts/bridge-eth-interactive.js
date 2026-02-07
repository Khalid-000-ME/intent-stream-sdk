const { ethers } = require("ethers");
const readline = require("readline");
const path = require("path");
const fs = require("fs");

// Load .env.local
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
} else {
    require("dotenv").config();
}

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;

const CHAINS = {
    'ethereum': {
        name: 'Ethereum Sepolia',
        id: 11155111,
        rpc: 'https://1rpc.io/sepolia',
        explorer: 'https://sepolia.etherscan.io'
    },
    'base': {
        name: 'Base Sepolia',
        id: 84532,
        rpc: 'https://sepolia.base.org',
        explorer: 'https://sepolia.basescan.org',
        portal: '0x49f53e214d0092f689f66c04f58097b87569bda6' // OptimismPortal on L1
    },
    'arbitrum': {
        name: 'Arbitrum Sepolia',
        id: 421614,
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        explorer: 'https://sepolia.arbiscan.io',
        inbox: '0xaAe29B0366299461418F5324a79Afc425BE5ae21' // Inbox on L1
    }
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function getBalance(rpc, address) {
    const provider = new ethers.JsonRpcProvider(rpc);
    const bal = await provider.getBalance(address);
    return ethers.formatEther(bal);
}

async function main() {
    console.log("\n\x1b[36m" + "=".repeat(50));
    console.log("   🌊  UNIFLOW INTERACTIVE ETH BRIDGE  🌊");
    console.log("=".repeat(50) + "\x1b[0m\n");

    if (!PRIVATE_KEY) {
        console.log("\x1b[31m❌ Error: MAIN_WALLET_PRIVATE_KEY not found in .env.local\x1b[0m");
        process.exit(1);
    }

    const wallet = new ethers.Wallet(PRIVATE_KEY);
    console.log(`\x1b[34mOperator:\x1b[0m \x1b[33m${wallet.address}\x1b[0m\n`);

    console.log("Available Chains:");
    Object.keys(CHAINS).forEach((k, i) => console.log(` [${i + 1}] ${CHAINS[k].name}`));

    const srcIdx = await question("\nSelect Source Chain [1-3]: ");
    const srcKey = Object.keys(CHAINS)[parseInt(srcIdx) - 1];

    const destIdx = await question("Select Destination Chain [1-3]: ");
    const destKey = Object.keys(CHAINS)[parseInt(destIdx) - 1];

    if (!srcKey || !destKey || srcKey === destKey) {
        console.log("\x1b[31mInvalid selection.\x1b[0m");
        process.exit(1);
    }

    const source = CHAINS[srcKey];
    const dest = CHAINS[destKey];

    console.log(`\n\x1b[90mChecking balances...\x1b[0m`);
    const srcBal = await getBalance(source.rpc, wallet.address);
    const destBal = await getBalance(dest.rpc, wallet.address);

    console.log(`\n\x1b[32mBalances:\n   ${source.name}: ${srcBal} ETH\n   ${dest.name}: ${destBal} ETH\x1b[0m`);

    const amount = await question(`\nEnter amount to bridge (ETH): `);
    const val = parseFloat(amount);

    if (isNaN(val) || val <= 0 || val >= parseFloat(srcBal)) {
        console.log("\x1b[31mInvalid amount or insufficient balance.\x1b[0m");
        process.exit(1);
    }

    console.log(`\n\x1b[33mSummary:`);
    console.log(`   Route:  ${source.name} ➔ ${dest.name}`);
    console.log(`   Amount: ${amount} ETH\x1b[0m`);

    const confirm = await question(`\nConfirm transaction? (y/n): `);
    if (confirm.toLowerCase() !== 'y') {
        process.exit(0);
    }

    console.log(`\n\x1b[36m🚀 Initiating Bridge Transaction...\x1b[0m`);

    try {
        const provider = new ethers.JsonRpcProvider(source.rpc);
        const signer = new ethers.Wallet(PRIVATE_KEY, provider);
        const bridgeVal = ethers.parseEther(amount);

        let tx;

        // ETHEREUM -> L2 (Deposit)
        if (srcKey === 'ethereum') {
            if (destKey === 'base') {
                console.log(`[Base] Calling depositTransaction on OptimismPortal...`);
                const portal = new ethers.Contract(dest.portal, [
                    "function depositTransaction(address _to, uint256 _value, uint64 _gasLimit, bool _isCreation, bytes calldata _data) payable"
                ], signer);
                tx = await portal.depositTransaction(wallet.address, bridgeVal, 100000, false, "0x", { value: bridgeVal });
            } else if (destKey === 'arbitrum') {
                console.log(`[Arbitrum] Calling depositEth on Inbox...`);
                const inbox = new ethers.Contract(dest.inbox, [
                    "function depositEth() payable"
                ], signer);
                tx = await inbox.depositEth({ value: bridgeVal });
            }
        }
        // L2 -> ETHEREUM (Withdrawal)
        else if (destKey === 'ethereum') {
            if (srcKey === 'base') {
                console.log(`[Base] Calling initiateWithdrawal...`);
                const messenger = new ethers.Contract("0x4200000000000000000000000000000000000016", [
                    "function initiateWithdrawal(address _target, uint256 _gasLimit, bytes calldata _data) payable"
                ], signer);
                tx = await messenger.initiateWithdrawal(wallet.address, 100000, "0x", { value: bridgeVal });
            } else if (srcKey === 'arbitrum') {
                console.log(`[Arbitrum] Calling withdrawEth on ArbSys...`);
                const arbSys = new ethers.Contract("0x0000000000000000000000000000000000000064", [
                    "function withdrawEth(address destination) payable"
                ], signer);
                tx = await arbSys.withdrawEth(wallet.address, { value: bridgeVal });
            }
        }
        else {
            console.log("\x1b[31mNative L2-L2 bridge is not supported in one step. Please go through Ethereum Sepolia.\x1b[0m");
            process.exit(1);
        }

        if (tx) {
            console.log(`\n\x1b[32mTransaction Broadcast! Waiting for L2 confirmation...\x1b[0m`);
            console.log(`TX Hash: ${tx.hash}`);
            await tx.wait();
            console.log(`\n\x1b[32m✅ L2 Transaction Confirmed!\x1b[0m`);
            console.log(`\x1b[90mExplorer: ${source.explorer}/tx/${tx.hash}\x1b[0m`);

            if (destKey === 'ethereum') {
                console.log(`\n\x1b[33m📢 IMPORTANT: L2 ➔ L1 Withdrawal started!\x1b[0m`);
                console.log(`\x1b[33mYour 0.07 ETH has been burned on Arbitrum and is now in the "Challenge Period".\x1b[0m`);
                console.log(`\x1b[33mIt will NOT appear in your Ethereum Sepolia (SepoliaETH) balance automatically.\x1b[0m`);

                const bridgeUrl = srcKey === 'arbitrum'
                    ? `https://bridge.arbitrum.io/?l2ChainId=421614`
                    : `https://bridge.base.org/withdraw`;

                console.log(`\n\x1b[36mNext Steps:\x1b[0m`);
                console.log(` 1. Wait ~1-2 hours for the batch to be confirmed on Sepolia.`);
                console.log(` 2. You MUST perform a \x1b[1m"Manual Claim"\x1b[0m to receive the SepoliaETH.`);
                console.log(` 3. Track & Claim here: \x1b[34m${bridgeUrl}\x1b[0m`);
            } else {
                console.log(`\x1b[33m\n⏳ Estimated Arrival:`);
                console.log(`   L1 ➔ L2 Deposit: ~5-15 minutes (Automatic Arrival)`);
            }
        }

    } catch (e) {
        console.log(`\n\x1b[31m❌ Bridge Failed!\x1b[0m`);
        console.error(e.message);
    } finally {
        rl.close();
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
