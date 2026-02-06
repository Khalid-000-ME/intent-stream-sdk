import { arbitrumSepolia, sepolia, baseSepolia } from 'viem/chains';

const rawKey = process.env.MAIN_WALLET_PRIVATE_KEY ||
    '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';
export const MAIN_WALLET_PRIVATE_KEY = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;

export const CHAINS: any = {
    arbitrum: {
        chain: arbitrumSepolia,
        rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
        name: 'Arbitrum Sepolia'
    },
    ethereum: {
        chain: sepolia,
        rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
        name: 'Ethereum Sepolia'
    },
    base: {
        chain: baseSepolia,
        rpc: 'https://sepolia.base.org',
        name: 'Base Sepolia'
    }
};

export const CONTRACTS: any = {
    ethereum: {
        router: '0x33702CB2232aF0284D67FF4cF01eC39B2a1d7031',
        usdc: '0x888303972e735256422d35Cc599B2144DA833762', // Sepolia USDC (Real/Fresh Mock)
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'  // Sepolia WETH (Real)
    },
    arbitrum: {
        router: '0xb869BcB35787D78Da1138F8a75CF76F935f64496',
        usdc: '0xfA7BfA4800D37B81E74FA5B05b2EF6A9FC116733', // Arb Mock USDC
        weth: '0x5B4b4D8fBDbBf37b6B156e80024781861A25219A'  // Arb Mock WETH
    },
    base: {
        router: '0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0', // New LiquidityManager with Redeem
        poolManager: '0x1b832D5395A41446b508632466cf32c6C07D63c7',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
        weth: '0x4200000000000000000000000000000000000006'  // Base Sepolia WETH
    }

};

export const YTEST_USD_TOKEN = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb';

export const YELLOW_WS_URL = 'wss://clearnet-sandbox.yellow.com/ws';
