const hre = require("hardhat");

const POOL_MANAGERS = {
    'baseSepolia': '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408',
    'arbitrumSepolia': '0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317',
    'sepolia': '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543'
};

async function main() {
    const networkName = hre.network.name;
    console.log(`\n🚀 Deploying Official Router on \x1b[36m${networkName}\x1b[0m...`);

    const pmAddress = POOL_MANAGERS[networkName];
    if (!pmAddress) {
        console.error(`❌ No Official PoolManager configured for network: ${networkName}`);
        console.log("   Available:", Object.keys(POOL_MANAGERS).join(", "));
        process.exit(1);
    }

    console.log(`   Using Official PoolManager: \x1b[33m${pmAddress}\x1b[0m`);

    const [deployer] = await hre.ethers.getSigners();
    console.log(`   Deployer: ${deployer.address}`);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`   Balance: ${hre.ethers.formatEther(balance)} ETH`);

    // Deploy Router
    console.log(`\n📄 Deploying V4TestRouter...`);
    const Router = await hre.ethers.getContractFactory("V4TestRouter");
    const router = await Router.deploy(pmAddress);

    console.log(`   Submitted tx: ${router.deploymentTransaction().hash}`);
    await router.waitForDeployment();

    const routerAddr = await router.getAddress();
    console.log(`\n✅ \x1b[32mV4TestRouter Deployed: ${routerAddr}\x1b[0m`);

    console.log(`\n----------------------------------------`);
    console.log(`network="${networkName}"`);
    console.log(`router="${routerAddr}"`);
    console.log(`poolManager="${pmAddress}"`);
    console.log(`----------------------------------------\n`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
