const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

// Base Sepolia Addresses
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const POSITION_MANAGER = "0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80";
const POOL_MANAGER = "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408";
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const WETH = "0x4200000000000000000000000000000000000006";
const RPC = "https://sepolia.base.org";

// Actions enum
const Actions = {
    MINT_POSITION: 0,
    INCREASE_LIQUIDITY: 1,
    DECREASE_LIQUIDITY: 2,
    BURN_POSITION: 3,
    SETTLE_PAIR: 4,
    TAKE_PAIR: 5,
    SETTLE: 6,
    TAKE: 7,
    CLOSE_CURRENCY: 8,
    CLEAR_OR_TAKE: 9,
    SWEEP: 10
};

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
];

const PERMIT2_ABI = [
    "function approve(address token, address spender, uint160 amount, uint48 expiration) external"
];

const POSITION_MANAGER_ABI = [
    "function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)",
    "function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable"
];

async function main() {
    console.log("\n🚀 Creating Pool & Adding Liquidity via PositionManager\n");

    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Wallet: ${wallet.address}`);
    console.log(`Balance: ${ethers.formatEther(await provider.getBalance(wallet.address))} ETH\n`);

    const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);
    const weth = new ethers.Contract(WETH, ERC20_ABI, wallet);
    const permit2 = new ethers.Contract(PERMIT2, PERMIT2_ABI, wallet);
    const posm = new ethers.Contract(POSITION_MANAGER, POSITION_MANAGER_ABI, wallet);

    // 1. Pool Configuration
    const [currency0, currency1] = USDC.toLowerCase() < WETH.toLowerCase()
        ? [USDC, WETH]
        : [WETH, USDC];

    const poolKey = {
        currency0,
        currency1,
        fee: 3000,
        tickSpacing: 60,
        hooks: ethers.ZeroAddress
    };

    console.log("Pool Key:");
    console.log(`  Currency0: ${poolKey.currency0}`);
    console.log(`  Currency1: ${poolKey.currency1}`);
    console.log(`  Fee: 3000 (0.3%)\n`);

    // 2. Approve Permit2 and PositionManager
    console.log("1️⃣ Setting up Permit2 approvals...");

    const setupPermit2 = async (token, tokenContract, name) => {
        // Step 1: Approve Permit2 to spend tokens
        const permit2Allowance = await tokenContract.allowance(wallet.address, PERMIT2);
        if (permit2Allowance < ethers.parseUnits("1000", 18)) {
            console.log(`   Approving Permit2 for ${name}...`);
            await (await tokenContract.approve(PERMIT2, ethers.MaxUint256)).wait();
        }

        // Step 2: Approve PositionManager via Permit2
        console.log(`   Approving PositionManager via Permit2 for ${name}...`);
        const tx = await permit2.approve(
            token,
            POSITION_MANAGER,
            ethers.MaxUint160, // max amount
            ethers.MaxUint48   // max expiration
        );
        await tx.wait();
        console.log(`   ✅ ${name} approved`);
    };

    await setupPermit2(USDC, usdc, "USDC");
    await setupPermit2(WETH, weth, "WETH");

    // 3. Prepare multicall parameters
    console.log("\n2️⃣ Preparing pool initialization and liquidity...");

    const params = [];

    // 3a. Initialize Pool
    const SQRT_PRICE_1_1 = "79228162514264337593543950336";

    const initializePoolData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(address,address,uint24,int24,address)", "uint160"],
        [[poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks], SQRT_PRICE_1_1]
    );

    // Function selector for initializePool
    const initializePoolSelector = "0x13ead562"; // initializePool(PoolKey,uint160)
    params.push(initializePoolSelector + initializePoolData.slice(2));

    // 3b. Mint Position
    const tickLower = -600;
    const tickUpper = 600;
    const liquidity = ethers.parseUnits("1", 18);
    const amount0Max = ethers.parseUnits("10", 6);  // 10 USDC
    const amount1Max = ethers.parseUnits("0.01", 18); // 0.01 WETH
    const recipient = wallet.address;
    const hookData = "0x";

    const actions = ethers.solidityPacked(
        ["uint8", "uint8"],
        [Actions.MINT_POSITION, Actions.SETTLE_PAIR]
    );

    const mintParams = [
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["tuple(address,address,uint24,int24,address)", "int24", "int24", "uint256", "uint256", "uint256", "address", "bytes"],
            [[poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks], tickLower, tickUpper, liquidity, amount0Max, amount1Max, recipient, hookData]
        ),
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address"],
            [poolKey.currency0, poolKey.currency1]
        )
    ];

    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    const modifyLiquiditiesData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes", "bytes[]", "uint256"],
        [actions, mintParams, deadline]
    );

    const modifyLiquiditiesSelector = "0x0c49ccbe"; // modifyLiquidities(bytes,uint256)
    params.push(modifyLiquiditiesSelector + modifyLiquiditiesData.slice(2));

    // 4. Execute multicall
    console.log("\n3️⃣ Executing multicall...");
    console.log(`   Initializing pool at 1:1 price`);
    console.log(`   Adding liquidity: ${ethers.formatUnits(liquidity, 18)} units\n`);

    try {
        const tx = await posm.multicall(params, { gasLimit: 2000000, value: 0 });
        console.log(`   Tx: ${tx.hash}`);
        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log(`   ✅ Success! Block: ${receipt.blockNumber}`);
            console.log(`   Gas Used: ${receipt.gasUsed.toString()}\n`);
            console.log(`🎉 Pool created and liquidity added!`);
            console.log(`   View: https://sepolia.basescan.org/tx/${tx.hash}\n`);
        } else {
            console.log(`   ❌ Transaction failed\n`);
        }
    } catch (e) {
        console.error(`   ❌ Failed:`, e.message);
        if (e.data) console.error(`   Error data:`, e.data);
    }
}

main().catch(e => {
    console.error("\n❌ Error:", e.message);
    process.exit(1);
});
