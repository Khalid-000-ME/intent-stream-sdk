const { ethers } = require("ethers");

const POOL_MANAGER = "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408";
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const WETH = "0x4200000000000000000000000000000000000006";
const RPC = "https://sepolia.base.org";

const POOL_MANAGER_ABI = [
    "function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC);
    const poolManager = new ethers.Contract(POOL_MANAGER, POOL_MANAGER_ABI, provider);

    // Calculate pool ID
    const poolKey = {
        currency0: USDC,
        currency1: WETH,
        fee: 3000,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    const poolId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "uint24", "int24", "address"],
            [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
        )
    );

    console.log("Pool ID:", poolId);
    console.log("Checking pool state...\n");

    try {
        const [sqrtPriceX96, tick, protocolFee, lpFee] = await poolManager.getSlot0(poolId);

        console.log("✅ Pool exists!");
        console.log(`  sqrtPriceX96: ${sqrtPriceX96}`);
        console.log(`  tick: ${tick}`);
        console.log(`  protocolFee: ${protocolFee}`);
        console.log(`  lpFee: ${lpFee}`);

        if (sqrtPriceX96 > 0) {
            console.log("\n🎉 Pool is initialized and ready!");
        } else {
            console.log("\n⚠️  Pool exists but not initialized");
        }
    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

main();
