const { ethers } = require("ethers");
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

const CONFIG = {
    base: {
        rpc: 'https://sepolia.base.org',
        manager: '0x1b832D5395A41446b508632466cf32c6C07D63c7',
        router: '0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006'
    },
    arbitrum: {
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        manager: '0x4e650C85801e9dC44313669b491d20DB864a5451',
        router: '0x87bD55Ea0505005799a28D34B5Ca17f4c8d24301',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed'
    },
    ethereum: {
        rpc: 'https://1rpc.io/sepolia',
        manager: '0xf448192241A9BBECd36371CD1f446de81A5399d2',
        router: '0x6127b25A12AB31dF2B58Fe9DfFCba595AB927eA3',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
    }
};

const FEE = 200;
const TICK_SPACING = 60;
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

async function main() {
    console.log("\n🌊 \x1b[36mSEEDING LIQUIDITY TO THE GOLD-STANDARD POOLS\x1b[0m 🌊");

    for (const [net, chain] of Object.entries(CONFIG)) {
        console.log(`\n🚀 Seeding ${net.toUpperCase()}...`);
        const provider = new ethers.JsonRpcProvider(chain.rpc);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const router = new ethers.Contract(chain.router, [
            "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable"
        ], wallet);

        const usdc = new ethers.Contract(chain.usdc, ERC20_ABI, wallet);
        const weth = new ethers.Contract(chain.weth, ERC20_ABI, wallet);

        const isUSDC0 = chain.usdc.toLowerCase() < chain.weth.toLowerCase();
        const poolKey = {
            currency0: isUSDC0 ? chain.usdc : chain.weth,
            currency1: isUSDC0 ? chain.weth : chain.usdc,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: ethers.ZeroAddress
        };

        // Approvals (with check)
        const checkApprove = async (token, spender) => {
            const allowance = await token.allowance(wallet.address, spender);
            if (allowance < ethers.parseUnits("1.0", 18)) {
                await token.approve(spender, ethers.MaxUint256).then(tx => tx.wait());
            }
        };

        await checkApprove(usdc, chain.router);
        await checkApprove(weth, chain.router);
        await checkApprove(usdc, chain.manager);
        await checkApprove(weth, chain.manager);

        // Add 5 USDC worth of liquidity
        // L = amount0 * sqrtP (approx for full range)
        // amount0 = 5 USDC = 5,000,000 units. sqrtP = 20,000.
        // L = 5,000,000 * 20,000 = 100,000,000,000
        const deltaL = 100000000000n;

        try {
            const tx = await router.addLiquidity(poolKey, {
                tickLower: -887220,
                tickUpper: 887220,
                liquidityDelta: deltaL,
                salt: ethers.ZeroHash
            }, "0x", { gasLimit: 2000000 });
            console.log(`   ⏳ Sent Swap: ${tx.hash}`);
            await tx.wait();
            console.log(`   ✅ Liquidity Provisioned!`);
        } catch (e) {
            console.log(`   ❌ Failed: ${e.message.split('(')[0]}`);
        }
    }
}

main().catch(console.error);
