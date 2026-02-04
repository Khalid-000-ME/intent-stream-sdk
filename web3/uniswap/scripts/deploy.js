const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    // Router addresses
    const ROUTERS = {
        // Arbitrum Sepolia
        "421614": "0x101F443B4d1b059569D643917553c771E1b9663E",
        // Sepolia
        "11155111": "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
    };

    const network = await hre.ethers.provider.getNetwork();
    const chainId = network.chainId.toString();
    const routerAddress = ROUTERS[chainId];

    if (!routerAddress) {
        console.error("No router address for chain ID:", chainId);
        return;
    }

    console.log("Deploying to Chain ID:", chainId);
    console.log("Using SwapRouter:", routerAddress);

    const IntentSwapExecutor = await hre.ethers.getContractFactory("IntentSwapExecutor");
    const contract = await IntentSwapExecutor.deploy(routerAddress);

    await contract.waitForDeployment();

    console.log("IntentSwapExecutor deployed to:", await contract.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
