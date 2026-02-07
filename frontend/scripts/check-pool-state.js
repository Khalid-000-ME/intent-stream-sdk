
const { ethers } = require('ethers');
require('dotenv').config({ path: '../.env' });

async function checkPool() {
    const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');

    // Base Sepolia Addresses
    const POOL_MANAGER = '0x1b832D5395A41446b508632466cf32c6C07D63c7';
    const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
    const WETH = '0x4200000000000000000000000000000000000006';

    const pm = new ethers.Contract(POOL_MANAGER, [
        "function getSlot0(bytes32 id) view returns (uint160 sqrtPriceX96, int24 tick, uint16 protocolFee, uint24 lpFee)",
        "function pools(bytes32 id) view returns (uint128 liquidity, uint24 fee, int24 tickSpacing, address hooks)"
    ], provider);

    // PoolKey
    const token0 = USDC.toLowerCase() < WETH.toLowerCase() ? USDC : WETH;
    const token1 = USDC.toLowerCase() < WETH.toLowerCase() ? WETH : USDC;

    // Hash PoolId
    const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint24", "int24", "address"],
        [token0, token1, 3000, 60, ethers.ZeroAddress]
    ));

    const [slot0, pool] = await Promise.all([
        pm.getSlot0(poolId),
        pm.pools(poolId)
    ]);

    console.log('Pool ID:', poolId);
    console.log('Liquidity:', pool.liquidity.toString());
    console.log('SqrtPriceX96:', slot0.sqrtPriceX96.toString());
    console.log('Tick:', slot0.tick);

    const p_raw = (Number(slot0.sqrtPriceX96) / 2 ** 96) ** 2;
    console.log('P_raw:', p_raw);

    // Price = Token1 / Token0
    // Token0 = USDC (6), Token1 = WETH (18)
    // Price in units = P_raw * 10^(6-18) = P_raw * 10^-12 WETH/USDC
    // USDC per WETH = 1 / (P_raw * 10^-12) = 10^12 / P_raw
    console.log('USDC per WETH:', 10 ** 12 / p_raw);
}

checkPool();
