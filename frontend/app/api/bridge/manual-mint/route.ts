import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const MAIN_WALLET_PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

// Base Sepolia MessageTransmitter contract address
const MESSAGE_TRANSMITTER = '0xe737e5cebeeba77efe34d4aa090756590b1ce275';

// MessageTransmitter ABI (receiveMessage function)
const MESSAGE_TRANSMITTER_ABI = [
    {
        inputs: [
            { name: 'message', type: 'bytes' },
            { name: 'attestation', type: 'bytes' }
        ],
        name: 'receiveMessage',
        outputs: [{ name: 'success', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function'
    }
] as const;

export async function POST(request: NextRequest) {
    try {
        const { message, attestation } = await request.json();

        if (!MAIN_WALLET_PRIVATE_KEY) {
            return NextResponse.json({ error: 'Server wallet not configured' }, { status: 500 });
        }

        if (!message || !attestation) {
            return NextResponse.json({ error: 'Missing message or attestation' }, { status: 400 });
        }

        // Ensure proper private key format
        const pk = MAIN_WALLET_PRIVATE_KEY.startsWith('0x')
            ? MAIN_WALLET_PRIVATE_KEY as `0x${string}`
            : `0x${MAIN_WALLET_PRIVATE_KEY}` as `0x${string}`;

        const account = privateKeyToAccount(pk);

        // Create wallet client
        const client = createWalletClient({
            account,
            chain: baseSepolia,
            transport: http()
        }).extend(publicActions);

        console.log(`[Manual Mint] Calling receiveMessage on Base Sepolia...`);
        console.log(`[Manual Mint] Message length: ${message.length}`);
        console.log(`[Manual Mint] Attestation length: ${attestation.length}`);

        // Call receiveMessage on MessageTransmitter
        const hash = await client.writeContract({
            address: MESSAGE_TRANSMITTER as `0x${string}`,
            abi: MESSAGE_TRANSMITTER_ABI,
            functionName: 'receiveMessage',
            args: [message as `0x${string}`, attestation as `0x${string}`]
        });

        console.log(`[Manual Mint] Transaction sent: ${hash}`);

        // Wait for transaction confirmation
        const receipt = await client.waitForTransactionReceipt({ hash });

        console.log(`[Manual Mint] Transaction confirmed in block ${receipt.blockNumber}`);

        return NextResponse.json({
            success: true,
            txHash: hash,
            blockNumber: receipt.blockNumber.toString(),
            explorerUrl: `https://sepolia.basescan.org/tx/${hash}`
        });

    } catch (e: any) {
        console.error('[Manual Mint] Error:', e);
        return NextResponse.json({
            success: false,
            error: e.message || 'Manual mint failed',
            details: e.shortMessage || e.details || ''
        }, { status: 500 });
    }
}
