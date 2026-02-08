const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const USDC_ADDR = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const usdc = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDC_ADDR);

    const balance = await usdc.balanceOf(deployer.address);
    console.log(`USDC Balance: ${balance.toString()}`);

    console.log("Testing self-transfer of 1 unit...");
    try {
        const tx = await usdc.transfer(deployer.address, 1n);
        await tx.wait();
        console.log("✅ Success!");
    } catch (e) {
        console.log("❌ Failed!");
        console.log(e.message);
    }
}

main().catch(console.error);
