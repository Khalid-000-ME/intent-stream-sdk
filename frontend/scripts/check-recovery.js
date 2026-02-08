const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");

// Load env
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) require("dotenv").config({ path: envPath });
else require("dotenv").config();

const ARB_RPC = "https://sepolia-rollup.arbitrum.io/rpc";
const BASE_RPC = "https://sepolia.base.org";
const ETH_RPC = "https://1rpc.io/sepolia";

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;

// Original Contracts Configuration (Old Locked Assets)
const CONTRACTS = {
    ethereum: {
        router: '0x6127b25A12AB31dF2B58Fe9DfFCba595AB927eA3',
        poolManager: '0xf448192241A9BBECd36371CD1f446de81A5399d2',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
    },
    arbitrum: {
        router: '0x87bD55Ea0505005799a28D34B5Ca17f4c8d24301',
        poolManager: '0x4e650C85801e9dC44313669b491d20DB864a5451',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed'
    },
    base: {
        router: '0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0',
        poolManager: '0x1b832D5395A41446b508632466cf32c6C07D63c7',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006'
    }
};

const NETWORKS = [
    { name: 'arbitrum', rpc: ARB_RPC, ...CONTRACTS.arbitrum },
    { name: 'base', rpc: BASE_RPC, ...CONTRACTS.base },
    { name: 'ethereum', rpc: ETH_RPC, ...CONTRACTS.ethereum }
];



const PM_ABI = [
    "function balanceOf(address owner, uint256 id) view returns (uint256)",
    "function getLiquidity(uint256 poolId) view returns (uint128)" // Only returns active liquidity in current tick, not total
];

const ROUTER_ABI = [
    "function redeem(address currency, uint256 amount) external",
    "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable"
];

async function main() {
    console.log("🔍 \x1b[36mCHECKING FOR LOCKED ASSETS & CLAIMS...\x1b[0m");

    if (!PRIVATE_KEY) return console.error("❌ Key missing");

    for (const net of NETWORKS) {
        if (!net.poolManager || !net.router) continue;

        console.log(`\n🌐 Checking \x1b[33m${net.name.toUpperCase()}\x1b[0m...`);
        const provider = new ethers.JsonRpcProvider(net.rpc);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const pm = new ethers.Contract(net.poolManager, PM_ABI, wallet);
        const router = new ethers.Contract(net.router, ROUTER_ABI, wallet);

        // 1. Check Claims (ERC-6909)
        const tokens = [net.usdc, net.weth];
        for (const token of tokens) {
            const tokenId = BigInt(token);
            try {
                const bal = await pm.balanceOf(wallet.address, tokenId);
                if (bal > 0n) {
                    console.log(`   🚨 Found Claim Balance: ${ethers.formatUnits(bal, 18)} (ID: ${token})`);
                    console.log(`   🔄 Redeeming...`);
                    const tx = await router.redeem(token, bal);
                    await tx.wait();
                    console.log(`   ✅ Redeemed!`);
                } else {
                    // console.log(`   ✅ No claims for ${token}`);
                }
            } catch (e) {
                console.log(`   ⚠️ Error checking claims: ${e.message}`);
            }
        }

        // 2. Try to Remove Liquidity
        // We assume we own the liquidity. We try to remove "all" liquidity from the full range.
        // Since we don't know exactly how much we own, this is tricky.
        // We'll try to remove a massive amount and rely on "partial" revert? No.
        // We will try to guess. If the user put 0.1 ETH, that's roughly 10^17 liquidity units?
        // Let's rely on the user saying "redeem them back".
        // It's safer to just log if there is liquidity in the pool and tell the user. Or try one attempt.
        // Actually, if we just overwrite the config, the keys are lost.
        // The user asked "check if older locked token will remain... if so redeem".
        // If I can't determine amount, I can't redeem liquidity.
        // BUT, for V4TestRouter, if we used `addLiquidity` with full range, we can try to remove with full range.
        // Let's try to remove 1 unit of liquidity just to see if it works/we have position.

        const isUSDC0 = net.usdc.toLowerCase() < net.weth.toLowerCase();
        const key = {
            currency0: isUSDC0 ? net.usdc : net.weth,
            currency1: isUSDC0 ? net.weth : net.usdc,
            fee: 200, // We used 200 in scripts? allow config?
            tickSpacing: 60,
            hooks: ethers.ZeroAddress
        };
        // Wait, script `add-liquidity-arbitrum.js` used fee 200. config might imply 3000.
        // We should check both fee tiers.

        const feeTiers = [200, 3000];

        for (const fee of feeTiers) {
            key.fee = fee;
            // Try to remove a small amount to probe ownership?
            // Or better: Checking claims was the main part.
            // If the user hasn't explicitly minted LP tokens (NFTs), the "position" is held by the router. 
            // The router doesn't know "user owns X".
            // So we CANNOT redeem LP liquidity because the Router (LiquidityManager) contract is stateless regarding user ownership.
            // UNLESS the Router sends liquidity to `msg.sender` in `addLiquidity`.
            // Let's check `V4TestRouter.sol` line 52:
            // `manager.modifyLiquidity(cbData.key, cbData.liqParams, cbData.hookData)`
            // If the router calls this, the Router is the owner of the position in PoolManager.
            // The user has no cryptographic proof of ownership stored in the Router or PoolManager.
            // THEREFORE, IT IS IMPOSSIBLE TO REDEEM LIQUIDITY for a specific user from this specific `V4TestRouter` implementation
            // because it mixes everyone's liquidity into the Router's single position.
            // Everyone who added liquidity via this Router effectively donated it to the Router contract.
            // 
            // EXCEPT if `modifyLiquidity` allows a `recipient` (it doesn't in standard interface, it uses msg.sender).
            // 
            // SO: "Redeeming" liquidity is likely impossible for this specific Router implementation unless we use the Router owner key (if any) to drain it all.
            // But `V4TestRouter.sol` has no owner-only withdraw.
            // It has `addLiquidity` which calls `unlock`. 
            // Anyone can call `addLiquidity` with negative delta?
            // YES. If I call `addLiquidity` with negative delta, the Router calls `modifyLiquidity`.
            // The Router (holding the position) burns liquidity and gets tokens.
            // The Router's `unlockCallback` then sends those tokens to `cbData.sender` (ME).
            // SO I CAN DRAIN THE ROUTER'S LIQUIDITY!
            // This Router is "insecure" but that's good for me now.
            // I can just try to remove liquidity.

            // I will try to remove a large chunk. If it succeeds, great.
            // I'll try to remove 100 liquidity units.

            try {
                // console.log(`   Trying to drain liquidity for fee ${fee}...`);
                // const L_remove = ethers.parseUnits("1", 18); // 1 unit? 
                // We'll proceed if user wants, but maybe just checking Claims is safer to avoid reverting.
            } catch (e) { }
        }
    }
}

main().catch(console.error);
