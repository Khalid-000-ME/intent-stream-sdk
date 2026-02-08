const { ethers } = require("ethers");
require("dotenv").config({ path: "frontend/.env.local" });

// Manually define configs to ensure we use what the script sees
const RAW_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;
if (!RAW_KEY) { console.error("No Private Key"); process.exit(1); }

// Official Config from previous steps
const CONFIG = {
    base: {
        rpc: "https://sepolia.base.org",
        usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        weth: "0x4200000000000000000000000000000000000006"
    },
    arbitrum: {
        rpc: "https://sepolia-rollup.arbitrum.io/rpc",
        usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
        weth: "0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed"
    },
    ethereum: {
        rpc: "https://1rpc.io/sepolia",
        usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
    }
};

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

async function checkChain(name, conf) {
    console.log(`\nChecking ${name.toUpperCase()}...`);
    try {
        const provider = new ethers.JsonRpcProvider(conf.rpc);
        const wallet = new ethers.Wallet(RAW_KEY, provider);
        console.log(`Wallet: ${wallet.address}`);

        const ethBal = await provider.getBalance(wallet.address);
        console.log(`ETH: ${ethers.formatEther(ethBal)}`);

        const usdc = new ethers.Contract(conf.usdc, ERC20_ABI, provider);
        const weth = new ethers.Contract(conf.weth, ERC20_ABI, provider);

        const usdcBal = await usdc.balanceOf(wallet.address);
        const wethBal = await weth.balanceOf(wallet.address);

        console.log(`USDC: ${ethers.formatUnits(usdcBal, 6)}`);
        console.log(`WETH: ${ethers.formatUnits(wethBal, 18)}`);

    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

async function main() {
    await checkChain("base", CONFIG.base);
    await checkChain("arbitrum", CONFIG.arbitrum);
    await checkChain("ethereum", CONFIG.ethereum);
}

main();
