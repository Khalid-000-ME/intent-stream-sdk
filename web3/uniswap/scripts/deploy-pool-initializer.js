const hre = require("hardhat");

async function main() {
    const networkName = hre.network.name;
    console.log(`\n🚀 Deploying PoolInitializer on \x1b[36m${networkName}\x1b[0m...`);

    // PoolManager addresses
    const POOL_MANAGERS = {
        'baseSepolia': '0x1b832D5395A41446b508632466cf32c6C07D63c7',
        'arbitrumSepolia': '0x4e650C85801e9dC44313669b491d20DB864a5451',
        'sepolia': '0xf448192241A9BBECd36371CD1f446de81A5399d2'
    };

    const pmAddress = POOL_MANAGERS[networkName];
    if (!pmAddress) {
        console.error(`❌ No PoolManager configured for network: ${networkName}`);
        process.exit(1);
    }

    console.log(`   Using PoolManager: \x1b[33m${pmAddress}\x1b[0m`);

    const [deployer] = await hre.ethers.getSigners();
    console.log(`   Deployer: ${deployer.address}`);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`   Balance: ${hre.ethers.formatEther(balance)} ETH`);

    // Deploy PoolInitializer
    console.log(`\n📄 Deploying PoolInitializer...`);
    const PoolInitializer = await hre.ethers.getContractFactory("PoolInitializer");
    const initializer = await PoolInitializer.deploy(pmAddress);

    console.log(`   Submitted tx: ${initializer.deploymentTransaction().hash}`);
    await initializer.waitForDeployment();

    const initializerAddr = await initializer.getAddress();
    console.log(`\n✅ \x1b[32mPoolInitializer Deployed: ${initializerAddr}\x1b[0m`);

    console.log(`\n----------------------------------------`);
    console.log(`network="${networkName}"`);
    console.log(`poolInitializer="${initializerAddr}"`);
    console.log(`poolManager="${pmAddress}"`);
    console.log(`----------------------------------------\n`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
