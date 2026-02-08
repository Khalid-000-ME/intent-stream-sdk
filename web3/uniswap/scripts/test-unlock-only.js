const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const POOL_MANAGER = "0xe70dD8675D6635488Ca2b391ffDfE82E7F68510B";
    const manager = await hre.ethers.getContractAt("PoolManager", POOL_MANAGER);

    console.log("Calling manager.unlock with empty data...");
    try {
        await manager.unlock.staticCall("0x");
        console.log("✅ Success!");
    } catch (e) {
        console.log("❌ Failed!");
        console.log(JSON.stringify(e, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    }
}

main().catch(console.error);
