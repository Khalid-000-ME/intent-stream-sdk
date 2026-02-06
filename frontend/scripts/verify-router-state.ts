
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const LIQUIDITY_MANAGER = "0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0";
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // 1. Check Router's Manager
    const router = new ethers.Contract(LIQUIDITY_MANAGER, [
        "function manager() view returns (address)"
    ], provider);

    try {
        const managerAddr = await router.manager();
        console.log(`✅ Router Manager Address: ${managerAddr}`);

        // 2. Check if this matches our config POOL_MANAGER
        const configPM = "0x1b832D5395A41446b508632466cf32c6C07D63c7";
        if (managerAddr.toLowerCase() === configPM.toLowerCase()) {
            console.log("✅ Manager addresses match config.");
        } else {
            console.log(`⚠️  Mismatch! Config says ${configPM}`);
        }

        // 3. Check for the specific pool that succeeded earlier (500, 10)
        const pm = new ethers.Contract(managerAddr, [
            "function pools(bytes32 id) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
        ], provider);

        const USDC_ADDR = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
        const WETH_ADDR = "0x4200000000000000000000000000000000000006";
        const [token0, token1] = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase() ? [USDC_ADDR, WETH_ADDR] : [WETH_ADDR, USDC_ADDR];

        const id = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "uint24", "int24", "address"],
            [token0, token1, 500, 10, ethers.ZeroAddress]
        ));

        console.log(`\n🔍 Checking Pool (500, 10)...`);
        console.log(`   ID: ${id}`);
        const pool = await pm.pools(id);
        if (pool.sqrtPriceX96 > 0n) {
            console.log(`✅ Pool Exists!`);
            console.log(`   PriceX96: ${pool.sqrtPriceX96}`);
            console.log(`   Current Tick: ${pool.tick}`);
        } else {
            console.log(`❌ Pool DOES NOT exist at this Manager.`);
        }

    } catch (e) {
        console.error(`❌ Error querying router: ${e.message}`);
    }
}

main().catch(console.error);
