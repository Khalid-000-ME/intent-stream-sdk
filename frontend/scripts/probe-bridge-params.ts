
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import 'dotenv/config';

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';
const kit = new BridgeKit();
const adapter = createViemAdapterFromPrivateKey({ privateKey: PRIVATE_KEY });
const recipientAddress = "0xdAa47b68bA6593e3F430b9d4794145B8321f9C86";

async function probe() {
    console.log("🔍 Probing BridgeKit params...");

    // Test 5: 'recipientAddress' with adapter
    try {
        console.log("Test 5: { adapter, chain, recipientAddress }");
        await kit.bridge({
            from: { adapter, chain: 'Arc_Testnet' },
            to: { adapter, chain: 'Base_Sepolia', recipientAddress } as any,
            amount: '0.1'
        });
        console.log("✅ Test 5 Success!");
        process.exit(0);
    } catch (e: any) {
        console.log("❌ Test 5 Failed:", e.message);
        // Print detailed validation error if available
        if (e.issues) console.log("Issues:", JSON.stringify(e.issues, null, 2));
    }
}

probe();
