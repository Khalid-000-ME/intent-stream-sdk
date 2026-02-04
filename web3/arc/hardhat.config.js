require("@nomicfoundation/hardhat-toolbox");

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.24",
    networks: {
        arc: {
            url: "https://rpc.testnet.arc.network",
            accounts: [PRIVATE_KEY],
            chainId: 5042002
        }
    }
};
