
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const TX_HASH = "0x476db20580a2e3321d920798642e868f07ac575261af9465d8bd688dc1af6668";

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const receipt = await provider.getTransactionReceipt(TX_HASH);

    if (!receipt) {
        console.log("Tx not found.");
        return;
    }

    console.log(`Logs from ${TX_HASH}:`);
    for (const log of receipt.logs) {
        console.log(`Log Index: ${log.index}`);
        console.log(`Address: ${log.address}`);
        console.log(`Topics: ${log.topics}`);
        console.log(`Data: ${log.data}`);
        console.log('---');
    }
}

main().catch(console.error);
