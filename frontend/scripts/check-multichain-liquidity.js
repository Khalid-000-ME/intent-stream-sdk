const { ethers } = require("ethers");
require("dotenv").config({ path: "../.env" });

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY || 'e844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';

const CONFIG = {
    ethereum: {
        rpc: 'https://1rpc.io/sepolia',
        router: '0x6127b25A12AB31dF2B58Fe9DfFCba595AB927eA3',
        poolManager: '0xf448192241A9BBECd36371CD1f446de81A5399d2',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
        name: 'Ethereum Sepolia'
    },
    arbitrum: {
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        router: '0x87bD55Ea0505005799a28D34B5Ca17f4c8d24301',
        poolManager: '0x4e650C85801e9dC44313669b491d20DB864a5451',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed',
        name: 'Arbitrum Sepolia'
    },
    base: {
        rpc: 'https://sepolia.base.org',
        router: '0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0',
        poolManager: '0x1b832D5395A41446b508632466cf32c6C07D63c7',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006',
        name: 'Base Sepolia'
    }
};

const ERC20_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function symbol() view returns (string)"
];

const POOL_MANAGER_ABI = [
    "function balanceOf(address owner, uint256 id) view returns (uint256)"
];

const ROUTER_ABI = [
    "function getPoolStatus((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key) view returns (uint160 sqrtPriceX96, uint128 liquidity)"
];

async function checkLiquidity(netKey) {
    const chain = CONFIG[netKey];
    console.log(`\n🔍 Checking ${chain.name.toUpperCase()}...`);

    const provider = new ethers.JsonRpcProvider(chain.rpc);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const usdc = new ethers.Contract(chain.usdc, ERC20_ABI, wallet);
    const weth = new ethers.Contract(chain.weth, ERC20_ABI, wallet);
    const pm = new ethers.Contract(chain.poolManager, POOL_MANAGER_ABI, wallet);
    const router = new ethers.Contract(chain.router, ROUTER_ABI, wallet);

    try {
        const [uBal, wBal] = await Promise.all([
            usdc.balanceOf(wallet.address),
            weth.balanceOf(wallet.address)
        ]);

        const uClaim = await pm.balanceOf(wallet.address, chain.usdc.toLowerCase());
        const wClaim = await pm.balanceOf(wallet.address, chain.weth.toLowerCase());

        // PoolManager Total Locked
        const pmUSDC = await usdc.balanceOf(chain.poolManager);
        const pmWETH = await weth.balanceOf(chain.poolManager);

        console.log(`\n💰 Current Balances on ${chain.name}:`);
        console.log(`   ERC-20 USDC:   ${ethers.formatUnits(uBal, 6).padEnd(12)} (Units: ${uBal.toString()})`);
        console.log(`   ERC-20 WETH:   ${ethers.formatUnits(wBal, 18).padEnd(12)} (Units: ${wBal.toString()})`);
        console.log(`   Claim USDC:    ${ethers.formatUnits(uClaim, 6).padEnd(12)} (ERC-6909)`);
        console.log(`   Claim WETH:    ${ethers.formatUnits(wClaim, 18).padEnd(12)} (ERC-6909)`);

        console.log(`\n📊 PoolManager Total Tokens Locked (All Pools):`);
        console.log(`   USDC Locked:   ${parseFloat(ethers.formatUnits(pmUSDC, 6)).toFixed(8)}`);
        console.log(`   WETH Locked:   ${parseFloat(ethers.formatUnits(pmWETH, 18)).toFixed(8)}`);

        // Check old 3000 pool
        const isUSDC0 = chain.usdc.toLowerCase() < chain.weth.toLowerCase();
        const key3000 = [
            isUSDC0 ? chain.usdc : chain.weth,
            isUSDC0 ? chain.weth : chain.usdc,
            3000,
            60,
            ethers.ZeroAddress
        ];

        // Check new 5000 pool
        const key5000 = [
            isUSDC0 ? chain.usdc : chain.weth,
            isUSDC0 ? chain.weth : chain.usdc,
            5000,
            60,
            ethers.ZeroAddress
        ];

        try {
            const [price] = await router.getPoolStatus(key3000);
            console.log(`\n🎯 Old Pool (3000, 60):`);
            console.log(`   SqrtPriceX96: ${price.toString()}`);
            const ratio = Number(price) / Number(2n ** 96n);
            console.log(`   Price Ratio:  ${ratio.toFixed(6)}`);
        } catch (e) {
            console.log(`\n🎯 Old Pool (3000, 60): ❌ (Not initialized)`);
        }

        // Check new 200 pool
        const key200 = [
            isUSDC0 ? chain.usdc : chain.weth,
            isUSDC0 ? chain.weth : chain.usdc,
            200,
            60,
            ethers.ZeroAddress
        ];

        try {
            const [price, liq] = await router.getPoolStatus(key200);
            console.log(`\n💎 New Pool (200, 60):`);
            console.log(`   SqrtPriceX96: ${price.toString()}`);
            const ratio = Number(price) / Number(2n ** 96n);
            console.log(`   Price Ratio:  ${ratio.toFixed(2)}`);
            console.log(`   Liquidity L:  ${liq.toString()}`);
            // Math: Price (USDC/ETH) = 1e12 / Ratio^2 
            const tokensPerEth = 1e12 / (ratio ** 2);
            console.log(`   (1 ETH = ${tokensPerEth.toFixed(2)} USDC)`);
        } catch (e) {
            console.log(`\n💎 New Pool (200, 60): ❌ (Not initialized)`);
        }

        try {
            const [price, liq] = await router.getPoolStatus(key5000);
            console.log(`\n💎 New Pool (5000, 60):`);
            console.log(`   SqrtPriceX96: ${price.toString()}`);
            const ratio = Number(price) / Number(2n ** 96n);
            console.log(`   Price Ratio:  ${ratio.toFixed(6)}`);
            console.log(`   Liquidity L:  ${liq.toString()}`);
            if (ratio < 0.01) {
                console.log(`   (1 ETH = ${(1 / (ratio ** 2)).toFixed(2)} USDC)`);
            }
        } catch (e) {
            console.log(`\n💎 New Pool (5000, 60): ❌ (Not initialized)`);
        }

    } catch (e) {
        console.log(`❌ Error checking ${chain.name}: ${e.message}`);
    }
}

async function main() {
    console.log("🌊 UNIFLOW MULTI-CHAIN LIQUIDITY DASHBOARD 🌊");
    await checkLiquidity('base');
    await checkLiquidity('arbitrum');
    await checkLiquidity('ethereum');
    console.log("\n🏁 Finished.");
}

main().catch(console.error);
