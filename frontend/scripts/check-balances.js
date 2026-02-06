const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");

// Load environment variables
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
} else {
    require("dotenv").config();
}

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;
const RPC_URL = "https://sepolia.base.org"; // Base Sepolia

const USDC_ADDR = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const WETH_ADDR = "0x4200000000000000000000000000000000000006";

const ERC20_ABI = ["function balanceOf(address account) view returns (uint256)"];

async function main() {
    if (!PRIVATE_KEY) {
        console.error("❌ Error: PRIVATE_KEY is missing.");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`\n🔍 Checking Balances on Base Sepolia for: ${wallet.address}`);

    const ethBal = await provider.getBalance(wallet.address);
    const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, provider);
    const weth = new ethers.Contract(WETH_ADDR, ERC20_ABI, provider);

    const usdcBal = await usdc.balanceOf(wallet.address);
    const wethBal = await weth.balanceOf(wallet.address);

    console.log(`\n💰 Wallet Balance:`);
    console.log(`   ETH:  ${ethers.formatEther(ethBal)}`);
    console.log(`   USDC: ${ethers.formatUnits(usdcBal, 6)}`);
    console.log(`   WETH: ${ethers.formatEther(wethBal)}`);
}

main().catch(console.error);
