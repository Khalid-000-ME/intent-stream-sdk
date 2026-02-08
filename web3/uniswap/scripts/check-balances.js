const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`Address: ${deployer.address}`);
    console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);

    const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const WETH = "0x4200000000000000000000000000000000000006";

    const usdc = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDC);
    const weth = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", WETH);

    console.log(`USDC: ${hre.ethers.formatUnits(await usdc.balanceOf(deployer.address), 6)}`);
    console.log(`WETH: ${hre.ethers.formatEther(await weth.balanceOf(deployer.address))}`);
}

main().catch(console.error);
