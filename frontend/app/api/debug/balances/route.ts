
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { MAIN_WALLET_PRIVATE_KEY, CONTRACTS, CHAINS } from '@/lib/config';

export async function GET() {
    try {
        const network = 'base'; // Force Base Sepolia for V4
        const chainConfig = CHAINS[network];
        const contracts = CONTRACTS[network];

        if (!chainConfig || !contracts) {
            return NextResponse.json({ error: 'Base Sepolia config missing' }, { status: 500 });
        }

        const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
        const wallet = new ethers.Wallet(MAIN_WALLET_PRIVATE_KEY, provider);

        const ERC20_ABI = [
            "function balanceOf(address account) view returns (uint256)",
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)"
        ];

        const POOL_MANAGER_ABI = [
            "function balanceOf(address owner, uint256 id) view returns (uint256)"
        ];

        const usdc = new ethers.Contract(contracts.usdc, ERC20_ABI, wallet);
        const weth = new ethers.Contract(contracts.weth, ERC20_ABI, wallet);
        const pm = new ethers.Contract(contracts.poolManager, POOL_MANAGER_ABI, wallet);

        const [uBal, wBal, uClaim, wClaim] = await Promise.all([
            usdc.balanceOf(wallet.address),
            weth.balanceOf(wallet.address),
            pm.balanceOf(wallet.address, contracts.usdc),
            pm.balanceOf(wallet.address, contracts.weth)
        ]);

        return NextResponse.json({
            address: wallet.address,
            balances: {
                usdc: ethers.formatUnits(uBal, 6),
                weth: ethers.formatUnits(wBal, 18),
                claimUsdc: ethers.formatUnits(uClaim, 6),
                claimWeth: ethers.formatUnits(wClaim, 18)
            }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
