
import { ethers } from 'ethers';

const FACTORY_ADDRESS = '0x0227628f3F023bb0B980b67D528571c95c6DaC1c';
const WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; // The USDC we are using

const FACTORY_ABI = [
    'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)'
];

async function checkPools() {
    console.log('🔍 Checking Uniswap V3 Pools on Sepolia...');

    // Connect to RPC
    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia.publicnode.com');

    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

    const fees = [100, 500, 3000, 10000];

    for (const fee of fees) {
        try {
            const poolAddress = await factory.getPool(WETH, USDC, fee);
            console.log(`  Fee: ${fee} (0.0${fee / 10000}%) -> Pool: ${poolAddress}`);

            if (poolAddress !== ethers.ZeroAddress) {
                const POOL_ABI = ['function liquidity() view returns (uint128)', 'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'];
                const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);
                const liquidity = await poolContract.liquidity();
                const slot0 = await poolContract.slot0();

                console.log(`  ✅ Pool Found: ${poolAddress}`);
                console.log(`     💧 Liquidity: ${liquidity.toString()}`);
                console.log(`     💲 Price (SqrtX96): ${slot0.sqrtPriceX96.toString()}`);

                if (liquidity.toString() === '0') {
                    console.log('     ⚠️ WARNING: LIQUIDITY IS ZERO');
                }
            } else {
                console.log('  ❌ No Pool');
            }
        } catch (e) {
            console.error(`  ⚠️ Error checking fee ${fee}:`, e.message);
        }
    }
}

checkPools().catch(console.error);
