
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const POOL_MANAGER = "0x1b832D5395A41446b508632466cf32c6C07D63c7";
const USDC_ADDR = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const WETH_ADDR = "0x4200000000000000000000000000000000000006";
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Sort tokens
    const [token0, token1] = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase()
        ? [USDC_ADDR, WETH_ADDR]
        : [WETH_ADDR, USDC_ADDR];

    console.log(`Token0: ${token0}`);
    console.log(`Token1: ${token1}`);

    const fees = [100, 500, 3000, 10000];
    const spacings = [1, 10, 60, 200];

    const pm = new ethers.Contract(POOL_MANAGER, [
        "function pools(bytes32 id) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
    ], provider);

    for (const fee of fees) {
        for (const tickSpacing of spacings) {
            const key = {
                currency0: token0,
                currency1: token1,
                fee: fee,
                tickSpacing: tickSpacing,
                hooks: ethers.ZeroAddress
            };

            // Compute PoolID
            // keccak256(abi.encode(PoolKey))
            const id = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "uint24", "int24", "address"],
                [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
            ));

            try {
                const pool = await pm.pools(id);
                if (pool.sqrtPriceX96 > 0n) {
                    console.log(`✅ Found Pool: Fee=${fee}, Spacing=${tickSpacing}`);
                    console.log(`   ID: ${id}`);
                    console.log(`   PriceX96: ${pool.sqrtPriceX96}`);
                }
            } catch (e) { }
        }
    }
}

main().catch(console.error);
