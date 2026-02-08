import { ethers } from 'ethers';

const POOL_MANAGER_ABI = [
    "function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
    "function getLiquidity(bytes32 poolId) external view returns (uint128)"
];

// Common fee tiers in Uniswap V4
const FEE_TIERS = [
    { fee: 100, tickSpacing: 1 },    // 0.01%
    { fee: 500, tickSpacing: 10 },   // 0.05%
    { fee: 3000, tickSpacing: 60 },  // 0.3%
    { fee: 10000, tickSpacing: 200 } // 1%
];

interface PoolInfo {
    poolId: string;
    fee: number;
    tickSpacing: number;
    sqrtPriceX96: bigint;
    tick: number;
    liquidity: bigint;
    exists: boolean;
}

export async function findBestPool(
    poolManagerAddress: string,
    token0: string,
    token1: string,
    rpcUrl: string
): Promise<PoolInfo | null> {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const poolManager = new ethers.Contract(poolManagerAddress, POOL_MANAGER_ABI, provider);

    // Ensure token0 < token1 (Uniswap convention)
    const [currency0, currency1] = token0.toLowerCase() < token1.toLowerCase()
        ? [token0, token1]
        : [token1, token0];

    const pools: PoolInfo[] = [];

    // Check all fee tiers
    for (const { fee, tickSpacing } of FEE_TIERS) {
        const key = {
            currency0,
            currency1,
            fee,
            tickSpacing,
            hooks: ethers.ZeroAddress
        };

        // Compute pool ID
        const poolId = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "uint24", "int24", "address"],
                [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
            )
        );

        try {
            const [sqrtPriceX96, tick] = await poolManager.getSlot0(poolId);
            const liquidity = await poolManager.getLiquidity(poolId);

            if (sqrtPriceX96 > 0n && liquidity > 0n) {
                pools.push({
                    poolId,
                    fee,
                    tickSpacing,
                    sqrtPriceX96,
                    tick: Number(tick),
                    liquidity,
                    exists: true
                });

                console.log(`[Pool Discovery] Found pool: Fee ${fee / 100}%, Liquidity: ${ethers.formatUnits(liquidity, 18)}`);
            }
        } catch (e) {
            // Pool doesn't exist or error querying
        }
    }

    if (pools.length === 0) {
        console.log(`[Pool Discovery] No pools found for ${currency0}/${currency1}`);
        return null;
    }

    // Select best pool (highest liquidity)
    const bestPool = pools.reduce((best, current) =>
        current.liquidity > best.liquidity ? current : best
    );

    console.log(`[Pool Discovery] Best pool: Fee ${bestPool.fee / 100}%, Liquidity: ${ethers.formatUnits(bestPool.liquidity, 18)}`);

    return bestPool;
}

export function computePoolKey(
    token0: string,
    token1: string,
    fee: number,
    tickSpacing: number
) {
    const [currency0, currency1] = token0.toLowerCase() < token1.toLowerCase()
        ? [token0, token1]
        : [token1, token0];

    return {
        currency0,
        currency1,
        fee,
        tickSpacing,
        hooks: ethers.ZeroAddress
    };
}
