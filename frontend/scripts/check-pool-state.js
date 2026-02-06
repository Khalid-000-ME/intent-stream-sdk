const { ethers } = require("ethers");

const POOL_MANAGER_ADDR = "0x11708d76f0B3779F1bE3264b64F3892e6d5d977d";
const TOKEN0_USDC = "0x846E331E5ed724E3B18aF1675096F75FD59BDBb6";
const TOKEN1_WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // Real WETH

const MANAGER_ABI = [
    "function getSlot0(bytes32 id) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
    "function getLiquidity(bytes32 id) external view returns (uint128 liquidity)"
];

async function main() {
    // Connect to Sepolia (Public RPC)
    const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");

    console.log("🔍 Checking Pool State...");
    console.log("Token0 (USDC):", TOKEN0_USDC);
    console.log("Token1 (WETH):", TOKEN1_WETH);

    // 1. Calculate Pool ID manually
    // PoolKey: currency0, currency1, fee=3000, tickSpacing=60, hooks=0x...
    // We need to encode this to get ID. Or use library. 
    // Manual hashing mimics Solidity: keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks))

    const abiCoder = new ethers.AbiCoder();
    const encoded = abiCoder.encode(
        ["address", "address", "uint24", "int24", "address"],
        [TOKEN0_USDC, TOKEN1_WETH, 3000, 60, ethers.ZeroAddress]
    );
    const poolId = ethers.keccak256(encoded);
    console.log("Pool ID:", poolId);

    const manager = new ethers.Contract(POOL_MANAGER_ADDR, MANAGER_ABI, provider);

    try {
        const slot0 = await manager.getSlot0(poolId);
        console.log("✅ Slot0 Found:");
        console.log("   SqrtPriceX96:", slot0.sqrtPriceX96.toString());
        console.log("   Tick:", slot0.tick.toString());
        console.log("   ProtocolFee:", slot0.protocolFee);

        const liquidity = await manager.getLiquidity(poolId);
        console.log("   Liquidity:", liquidity.toString());

        if (slot0.sqrtPriceX96.toString() === "0") {
            console.error("⚠️  Pool Exists but Price is 0 (Uninitialized?)");
        }
        if (liquidity.toString() === "0") {
            console.error("⚠️  Pool Initialized but ZERO Liquidity");
        }

    } catch (e) {
        console.error("❌ Failed to get Pool State:", e.message);
        // Sometimes call fails if pool totally doesn't exist? (Usually returns 0s)
    }
}

main();
