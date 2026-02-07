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
        router: '0x6127b25A12AB31dF2B58Fe9DfFCba595AB927eA3',
        poolManager: '0xf448192241A9BBECd36371CD1f446de81A5399d2',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
    },
    arbitrum: {
        router: '0x87bD55Ea0505005799a28D34B5Ca17f4c8d24301',
        poolManager: '0x4e650C85801e9dC44313669b491d20DB864a5451',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        weth: '0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed'
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
