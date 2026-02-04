const hre = require("hardhat");

async function main() {
    console.log("Deploying SettlementRegistry to Arc Testnet...");

    // REAL USDC Address on Arc Testnet
    const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

    const SettlementRegistry = await hre.ethers.getContractFactory("SettlementRegistry");
    const registry = await SettlementRegistry.deploy(USDC_ADDRESS);

    await registry.waitForDeployment();

    console.log(`SettlementRegistry deployed to: ${await registry.getAddress()}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
