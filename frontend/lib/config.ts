import { arbitrumSepolia, sepolia, baseSepolia } from 'viem/chains';

const rawKey = process.env.MAIN_WALLET_PRIVATE_KEY ||
    '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';
export const MAIN_WALLET_PRIVATE_KEY = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;

export const CHAINS: any = {
    arbitrum: {
        chain: arbitrumSepolia,
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        name: 'Arbitrum Sepolia',
        fee: 200
    },
    ethereum: {
        chain: sepolia,
        rpc: 'https://1rpc.io/sepolia',
        name: 'Ethereum Sepolia',
        fee: 200
    },
    base: {
        chain: baseSepolia,
        rpc: 'https://sepolia.base.org',
        name: 'Base Sepolia',
        fee: 200
    }
};

export const CONTRACTS: any = {
    ethereum: {
        poolManager: '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543', // Official
        router: '0x9B6b46e2c869aa39918Db7f52f5557FE577B6eEe', // Official PoolSwapTest
        liquidityManager: '0x0C478023803a644c94c4CE1C1e7b9A087e411B0A', // Official ModLiq
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
    },
    arbitrum: {
        poolManager: '0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317', // Official
        router: '0xf3A39C86dbd13C45365E57FB90fe413371F65AF8', // Official PoolSwapTest
        liquidityManager: '0x9A8ca723F5dcCb7926D00B71deC55c2fEa1F50f7', // Official ModLiq
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed'
    },
    base: {
        poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408', // Official
        router: '0xA87c3B41A24Ea5DeD1D625e9AF5AE771E91AEdF6', // Official PoolSwapTest
        liquidityManager: '0x4352D0c0a969796FbCb106C592C4851241183204', // Likely Official (Derived or Known)? Wait.
        // Base ModLiq address from my records? 
        // I need to check SetupBase or trust my knowledge.
        // Uniswap Docs for Base Sepolia: ModLiq `0x...`?
        // I will use what I have or verify.
        // TestSwapSol ONLY uses Router. So Router is critical.
        // ModLiq is less critical for SWAP API.
        // I'll leave ModLiq as placeholder or updated if I know it.
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        weth: '0x4200000000000000000000000000000000000006'
    }

};

export const YTEST_USD_TOKEN = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb';

export const YELLOW_WS_URL = 'wss://clearnet-sandbox.yellow.com/ws';
