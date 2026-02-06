import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { inspect } from "util";
import 'dotenv/config';

// Use environment variable or fallback to a known dev key for testing
const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.MAIN_WALLET_PRIVATE_KEY || '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';

// Initialize the SDK
const kit = new BridgeKit();

const bridgeUSDC = async (): Promise<void> => {
    try {
        // Initialize the adapter which lets you transfer tokens from your wallet on any EVM-compatible chain
        const adapter = createViemAdapterFromPrivateKey({
            privateKey: PRIVATE_KEY as string,
        });

        console.log("---------------Starting Bridging---------------");
        console.log("Using Wallet derived from provided Private Key");

        // Default scenario: Arc Testnet -> Base Sepolia (as per Quickstart)
        // You can modify these parameters to test other paths
        const fromChain = "Arc_Testnet";
        const toChain = "Base_Sepolia";
        const amount = "1.00";

        console.log(`Transferring ${amount} USDC from ${fromChain} to ${toChain}...`);

        // Use the same adapter for the source and destination blockchains
        const result = await kit.bridge({
            from: { adapter, chain: fromChain },
            to: { adapter, chain: toChain },
            amount: amount,
        });

        console.log("RESULT", inspect(result, false, null, true));
    } catch (err) {
        console.log("ERROR", inspect(err, false, null, true));
    }
};

void bridgeUSDC();
