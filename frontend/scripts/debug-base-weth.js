const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;
// Fallback to public RPC to avoid key issues if env var is missing
const BASE_RPC = 'https://sepolia.base.org';
const WETH_ADDR = '0x4200000000000000000000000000000000000006';

async function main() {
    console.log("🔍 Debugging Base Sepolia WETH Activity...");
    // ... (rest is fine, but update range below)

    if (!PRIVATE_KEY) {
        console.error("❌ No Private Key Found");
        return;
    }

    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`👤 Wallet: ${wallet.address}`);

    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 ETH Balance: ${ethers.formatEther(balance)} ETH`);

    const weth = new ethers.Contract(WETH_ADDR, [
        "function balanceOf(address) view returns (uint256)",
        "event Transfer(address indexed from, address indexed to, uint256 value)"
    ], provider);

    const wethBal = await weth.balanceOf(wallet.address);
    console.log(`💰 WETH Balance: ${ethers.formatEther(wethBal)} WETH`);

    console.log("\n📜 Fetching recent WETH 'Transfer' events (Last 1000 blocks)...");

    const latestBlock = await provider.getBlockNumber();
    const range = 2000;
    const fromBlock = Math.max(0, latestBlock - range);
    console.log(`\nScanning from block ${fromBlock} to ${latestBlock} (${range} blocks)...`);

    const filterFrom = weth.filters.Transfer(wallet.address, null);
    const logsFrom = await weth.queryFilter(filterFrom, fromBlock, latestBlock);

    console.log(`\n📤 Sent Transfers (${logsFrom.length}):`);
    logsFrom.forEach(log => {
        console.log(`   - To: ${log.args[1]} | Amount: ${ethers.formatEther(log.args[2])} WETH | Tx: ${log.transactionHash}`);
    });

    const filterTo = weth.filters.Transfer(null, wallet.address);
    const logsTo = await weth.queryFilter(filterTo, fromBlock, latestBlock);

    console.log(`\n📥 Received Transfers (${logsTo.length}):`);
    logsTo.forEach(log => {
        console.log(`   - From: ${log.args[0]} | Amount: ${ethers.formatEther(log.args[2])} WETH | Tx: ${log.transactionHash}`);
    });

    if (logsFrom.length === 0 && logsTo.length === 0) {
        console.log("\n⚠️  No WETH events found in the last 1000 blocks for this wallet.");
    }
}

main().catch(console.error);
