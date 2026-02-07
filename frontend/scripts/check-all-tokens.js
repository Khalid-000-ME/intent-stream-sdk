const { ethers } = require("ethers");

const CHAINS = {
    arbitrum: {
        rpc: 'https://arbitrum-sepolia.gateway.tenderly.co',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x980B62a498b36E08b31B5e9E3060E53d865c7705'
    },
    ethereum: {
        rpc: 'https://1rpc.io/sepolia',
        usdc: '0x1c7D4B62650b4f6259c5d7967396657c9C7238b6',
        weth: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14'
    },
    base: {
        rpc: 'https://sepolia.base.org',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006'
    }
};

const WALLET = '0x1111d87736c9C90Bb9eAE83297BE83ae990699cE';
const ABI = ["function balanceOf(address) view returns (uint256)", "function symbol() view returns (string)"];

async function check() {
    for (const [name, config] of Object.entries(CHAINS)) {
        console.log(`\n--- Checking ${name.toUpperCase()} ---`);
        const provider = new ethers.JsonRpcProvider(config.rpc);
        try {
            const u = new ethers.Contract(config.usdc, ABI, provider);
            const w = new ethers.Contract(config.weth, ABI, provider);

            const [uBal, wBal, uSym, wSym] = await Promise.all([
                u.balanceOf(WALLET).catch(() => BigInt(0)),
                w.balanceOf(WALLET).catch(() => BigInt(0)),
                u.symbol().catch(() => "N/A"),
                w.symbol().catch(() => "N/A")
            ]);

            console.log(`   USDC: ${uSym} (${config.usdc}) - Bal: ${uBal.toString()}`);
            console.log(`   WETH: ${wSym} (${config.weth}) - Bal: ${wBal.toString()}`);
        } catch (e) {
            console.log(`   ❌ Error: ${e.message}`);
        }
    }
}

check();
