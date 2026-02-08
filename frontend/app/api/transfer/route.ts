import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { MAIN_WALLET_PRIVATE_KEY, CHAINS, CONTRACTS } from '@/lib/config';

export async function POST(request: NextRequest) {
    try {
        const { network, token, amount, recipient } = await request.json();

        if (!network || !CONTRACTS[network]) {
            return NextResponse.json({ success: false, error: `Invalid network: ${network}` }, { status: 400 });
        }

        const provider = new ethers.JsonRpcProvider(CHAINS[network].rpc);
        const wallet = new ethers.Wallet(MAIN_WALLET_PRIVATE_KEY, provider);

        console.log(`[Transfer API] Initiating transfer on ${network}...`);
        console.log(`Type: ${token}, Amount: ${amount}, To: ${recipient}`);

        let tx;
        if (token === 'USDC') {
            const usdcAddr = CONTRACTS[network].usdc;
            if (!usdcAddr) throw new Error(`USDC address not found for ${network}`);

            const usdc = new ethers.Contract(usdcAddr, ["function transfer(address to, uint256 amount) returns (bool)"], wallet);
            // USDC typically has 6 decimals
            tx = await usdc.transfer(recipient, ethers.parseUnits(amount.toString(), 6));
        } else {
            // Native ETH Transfer
            tx = await wallet.sendTransaction({
                to: recipient,
                value: ethers.parseEther(amount.toString())
            });
        }

        console.log(`[Transfer API] Tx Sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`[Transfer API] Confirmed in block ${receipt.blockNumber}`);

        return NextResponse.json({
            success: true,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber
        });

    } catch (e: any) {
        console.error('[Transfer API] Error:', e);
        return NextResponse.json({
            success: false,
            error: e.message || 'Transfer failed'
        }, { status: 500 });
    }
}
