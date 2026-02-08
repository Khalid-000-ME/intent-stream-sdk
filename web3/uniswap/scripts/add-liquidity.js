const hre = require("hardhat");
const { ethers } = require("ethers");
require("dotenv").config();

// Network configurations
const NETWORKS = {
    sepolia: {
        poolModifyTest: '0x0c478023803a644c94c4ce1c1e7b9a087e411b0a',
        poolManager: '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
    },
    arbitrumSepolia: {
        poolModifyTest: '0x9a8ca723f5dccb7926d00b71dec55c2fea1f50f7',
        poolManager: '0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed'
    },
    baseSepolia: {
        poolModifyTest: '0x37429cd17cb1454c34e7f50b09725202fd533039',
        poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006'
    }
};

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

const POOL_MODIFY_TEST_ABI = [
    "function modifyLiquidity(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable"
];

async function main() {
    const networkName = hre.network.name;
    const config = NETWORKS[networkName];

    if (!config) {
        console.error(`❌ Network ${networkName} not configured`);
        process.exit(1);
    }

    console.log(`\n🌊 Adding Liquidity on ${networkName}`);
    console.log(`   PoolModifyTest: ${config.poolModifyTest}\n`);

    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);

    const usdc = new hre.ethers.Contract(config.usdc, ERC20_ABI, deployer);
    const weth = new hre.ethers.Contract(config.weth, ERC20_ABI, deployer);
    const poolModifyTest = new hre.ethers.Contract(
        config.poolModifyTest,
        POOL_MODIFY_TEST_ABI,
        deployer
    );

    // Check balances
    const [usdcBal, wethBal] = await Promise.all([
        usdc.balanceOf(deployer.address),
        weth.balanceOf(deployer.address)
    ]);

    console.log(`Token Balances:`);
    console.log(`  USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    console.log(`  WETH: ${hre.ethers.formatEther(wethBal)}\n`);

    // Sort currencies
    const [currency0, currency1] = config.usdc.toLowerCase() < config.weth.toLowerCase()
        ? [config.usdc, config.weth]
        : [config.weth, config.usdc];

    const poolKey = {
        currency0,
        currency1,
        fee: 3000,      // 0.3% fee
        tickSpacing: 60,
        hooks: hre.ethers.ZeroAddress
    };

    console.log("Pool Configuration:");
    console.log(`  Currency0: ${poolKey.currency0}`);
    console.log(`  Currency1: ${poolKey.currency1}`);
    console.log(`  Fee: 3000 (0.3%)\n`);

    // Approve tokens for PoolManager (not the test contract!)
    console.log("1️⃣ Approving tokens for PoolManager...");

    const approveIfNeeded = async (token, tokenContract, name) => {
        const allowance = await tokenContract.allowance(deployer.address, config.poolManager);
        if (allowance < hre.ethers.parseUnits("1000000", 18)) {
            console.log(`   Approving ${name}...`);
            const tx = await tokenContract.approve(config.poolManager, hre.ethers.MaxUint256);
            await tx.wait();
            console.log(`   ✅ ${name} approved`);
        } else {
            console.log(`   ✅ ${name} already approved`);
        }
    };

    await approveIfNeeded(config.usdc, usdc, "USDC");
    await approveIfNeeded(config.weth, weth, "WETH");

    // Add substantial liquidity across full range
    console.log("\n2️⃣ Adding liquidity...");

    const liquidityDelta = hre.ethers.parseUnits("10000", 18); // 10000 units

    const params = {
        tickLower: -887220,  // Full range
        tickUpper: 887220,
        liquidityDelta: liquidityDelta,
        salt: hre.ethers.ZeroHash
    };

    console.log(`   Liquidity Delta: ${hre.ethers.formatUnits(liquidityDelta, 18)} units`);
    console.log(`   Tick Range: Full range (-887220 to 887220)\n`);

    try {
        const tx = await poolModifyTest.modifyLiquidity(
            poolKey,
            params,
            "0x",
            { gasLimit: 2000000 }
        );

        console.log(`✅ Transaction sent: ${tx.hash}`);
        console.log(`   Waiting for confirmation...`);

        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log(`\n🎉 Liquidity added successfully!`);
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas Used: ${receipt.gasUsed.toString()}\n`);
            console.log(`✅ Pool is ready for swaps!\n`);
        }
    } catch (e) {
        console.error(`\n❌ Failed:`, e.message);

        // Try with smaller liquidity if it fails
        if (e.message.includes("insufficient") || e.message.includes("balance")) {
            console.log(`\n⚠️  Trying with smaller liquidity amount...`);

            const smallerLiquidity = hre.ethers.parseUnits("100", 18);
            params.liquidityDelta = smallerLiquidity;

            const retryTx = await poolModifyTest.modifyLiquidity(
                poolKey,
                params,
                "0x",
                { gasLimit: 2000000 }
            );

            const retryReceipt = await retryTx.wait();

            if (retryReceipt.status === 1) {
                console.log(`\n✅ Smaller liquidity added successfully!`);
                console.log(`   You can add more liquidity later.\n`);
            }
        } else {
            throw e;
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
