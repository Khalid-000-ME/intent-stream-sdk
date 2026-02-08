import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Address: ${deployer.address}`);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

    const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const WETH = "0x4200000000000000000000000000000000000006";

    const usdc = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDC);
    const weth = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", WETH);

    console.log(`USDC: ${ethers.formatUnits(await usdc.balanceOf(deployer.address), 6)}`);
    console.log(`WETH: ${ethers.formatEther(await weth.balanceOf(deployer.address))}`);
}

main().catch(console.error);
