
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    console.log("🚀 Starting Bridge Finalizer (Manual Mint)...");

    const rawKey = process.env.MAIN_WALLET_PRIVATE_KEY || '';
    if (!rawKey) throw new Error("Missing MAIN_WALLET_PRIVATE_KEY");
    const privateKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;

    // Base Sepolia Configuration
    const rpcUrl = 'https://sepolia.base.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`🦊 Wallet: ${wallet.address}`);

    // Data from User Log
    const message = "0x000000010000001a00000006849610a0f2a713219f2f0aa23ce333f36a420f6d12f74dc30b5d8eafafc92ba40000000000000000000000008fe6b999dc680ccfdd5bf7eb0974218be2542daa0000000000000000000000008fe6b999dc680ccfdd5bf7eb0974218be2542daa0000000000000000000000000000000000000000000000000000000000000000000003e8000007d00000000100000000000000000000000036000000000000000000000000000000000000000000000000000000000000001111d87736c9c90bb9eae83297be83ae990699ce0000000000000000000000000000000000000000000000000000000000989680000000000000000000000000c5567a5e3370d4dbfb0540025078e283e36a363d000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    const attestation = "0x5598880cc6e5d974411b2e1c1cfcc49a830c7464d4aaf7aefd69c72588f13f36366bfb53ca777347056f4ca5b3b94137c5e2d65b49b46bbbc665d6cc16cdfd621bd9892e69f9a6610c3436d8c883b0bf07dbea13d7720dc2d0d7164ae9fbfc98d5362a69491b9b641dcbb22b92f29c9f09fefd34da06758f782b4f79feb193c34b1c";

    // CCTP MessageTransmitter (V2) on Base Sepolia
    // From logs: 0xe737e5cebeeba77efe34d4aa090756590b1ce275
    const transmitterAddress = "0xe737e5cebeeba77efe34d4aa090756590b1ce275";
    const abi = ["function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)"];

    const transmitter = new ethers.Contract(transmitterAddress, abi, wallet);

    console.log(`\n📡 Submitting receiveMessage to Base Sepolia...`);
    // Safe manual gas limit to ensure it processes
    const tx = await transmitter.receiveMessage(message, attestation, { gasLimit: 300000 });

    console.log(`⏳ Pending: ${tx.hash}`);
    console.log(`🔗 Explorer: https://sepolia.basescan.org/tx/${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`\n✅ Payment Finalized! Block: ${receipt.blockNumber}`);
}

main().catch(console.error);
