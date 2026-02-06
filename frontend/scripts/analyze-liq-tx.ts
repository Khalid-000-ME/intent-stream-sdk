
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const TX_HASH = "0xae71aed5f45e50f38b731adeb391b1ecf55cbc7e4c6c21ff64af3b51dcc3e34b";

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const receipt = await provider.getTransactionReceipt(TX_HASH);

    if (!receipt) {
        console.log("Tx not found.");
        return;
    }

    console.log(`Logs from Liquidity Tx ${TX_HASH}:`);
    for (const log of receipt.logs) {
        console.log(`Log Index: ${log.index}`);
        console.log(`Address: ${log.address}`);
        console.log(`Topics: ${log.topics}`);
        console.log(`Data: ${log.data}`);

        // Try to identify Transfer events
        if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
            const from = ethers.ZeroAddress.slice(0, 26) + log.topics[1].slice(26);
            const to = ethers.ZeroAddress.slice(0, 26) + log.topics[2].slice(26);
            const value = BigInt(log.data);
            console.log(`   TRANSFER: From ${from} to ${to}, Value: ${value}`);
        }
        console.log('---');
    }
}

main().catch(console.error);
