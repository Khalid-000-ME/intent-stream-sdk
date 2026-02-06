
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const POOL_MANAGER = "0x1b832D5395A41446b508632466cf32c6C07D63c7";
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    console.log(`Checking PoolManager at ${POOL_MANAGER}...`);

    // 1. Try to call a known view function
    const pm = new ethers.Contract(POOL_MANAGER, [
        "function owner() view returns (address)",
        "function protocolFees() view returns (uint24)",
        "function pools(bytes32 id) view returns (uint160, int24, uint24, uint24)"
    ], provider);

    try {
        const owner = await pm.owner();
        console.log(`✅ Owner: ${owner}`);
    } catch (e) {
        console.log(`❌ owner() failed: ${e.message}`);
    }

    // 2. Try to get bytecode
    const code = await provider.getCode(POOL_MANAGER);
    console.log(`Bytecode length: ${code.length}`);
    if (code.length < 100) {
        console.log("⚠️  Address has no code!");
    }
}

main().catch(console.error);
