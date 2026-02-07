const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");

// Load .env.local
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
} else {
    require("dotenv").config();
}

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;

const CONFIG = {
    base: {
        rpc: 'https://sepolia.base.org',
        manager: '0x1b832D5395A41446b508632466cf32c6C07D63c7',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006'
    },
    arbitrum: {
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        manager: '0x4e650C85801e9dC44313669b491d20DB864a5451',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed'
    },
    ethereum: {
        rpc: 'https://1rpc.io/sepolia',
        manager: '0xf448192241A9BBECd36371CD1f446de81A5399d2',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
    }
};

async function main() {
    for (const [net, chain] of Object.entries(CONFIG)) {
        console.log(`\n🔍 Checking ${net.toUpperCase()}...`);
        const provider = new ethers.JsonRpcProvider(chain.rpc);
        const manager = new ethers.Contract(chain.manager, [
            "function getSlot0(bytes32 id) view returns (uint160, int24, uint16, uint24)"
        ], provider);

        const isUSDC0 = chain.usdc.toLowerCase() < chain.weth.toLowerCase();
        const tokens = isUSDC0 ? [chain.usdc, chain.weth] : [chain.weth, chain.usdc];

        // Check fee 3000
        const id3000 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "uint24", "int24", "address"],
            [tokens[0], tokens[1], 3000, 60, ethers.ZeroAddress]
        ));

        try {
            const [price] = await manager.getSlot0(id3000);
            const ratio = Number(price) / Number(2n ** 96n);
            console.log(`   Fee 3000 Price: ${ratio.toFixed(6)} unit0/unit1`);
        } catch (e) {
            console.log(`   Fee 3000: Not Initialized`);
        }

        // Check fee 2000
        const id2000 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "uint24", "int24", "address"],
            [tokens[0], tokens[1], 2000, 60, ethers.ZeroAddress]
        ));

        try {
            const [price] = await manager.getSlot0(id2000);
            const ratio = Number(price) / Number(2n ** 96n);
            console.log(`   Fee 2000 Price: ${ratio.toFixed(10)} unit0/unit1`);
            console.log(`   (1 ETH = ${(1 / (ratio ** 2)).toFixed(2)} USDC)`);
        } catch (e) {
            console.log(`   Fee 2000: Not Initialized`);
        }

        // Check fee 2500
        const id2500 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "uint24", "int24", "address"],
            [tokens[0], tokens[1], 2500, 60, ethers.ZeroAddress]
        ));

        try {
            const [price] = await manager.getSlot0(id2500);
            const ratio = Number(price) / Number(2n ** 96n);
            console.log(`   Fee 2500 Price: ${ratio.toFixed(10)} unit0/unit1`);
            console.log(`   (1 ETH = ${(1 / (ratio ** 2)).toFixed(2)} USDC)`);
        } catch (e) {
            console.log(`   Fee 2500: Not Initialized`);
        }

        // Check fee 5000
        const id5000 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "uint24", "int24", "address"],
            [tokens[0], tokens[1], 5000, 60, ethers.ZeroAddress]
        ));

        try {
            const [price] = await manager.getSlot0(id5000);
            const ratio = Number(price) / Number(2n ** 96n);
            console.log(`   Fee 5000 Price: ${ratio.toFixed(10)} unit0/unit1`);
            console.log(`   (1 ETH = ${(1 / (ratio ** 2)).toFixed(2)} USDC)`);
        } catch (e) {
            console.log(`   Fee 5000: Not Initialized`);
        }

        // Check fee 500
        const id500 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "uint24", "int24", "address"],
            [tokens[0], tokens[1], 500, 10, ethers.ZeroAddress]
        ));

        try {
            const [price] = await manager.getSlot0(id500);
            const ratio = Number(price) / Number(2n ** 96n);
            console.log(`   Fee 500 Price: ${ratio.toFixed(6)} unit0/unit1`);
        } catch (e) {
            console.log(`   Fee 500: Not Initialized`);
        }
    }
}

main().catch(console.error);
