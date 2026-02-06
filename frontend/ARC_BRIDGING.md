Quickstart: Transfer USDC from Arc to Base

Copy page

Learn how to use Bridge Kit to transfer USDC from Arc to Base.

This quickstart helps you write a server-side script that transfers USDC from Arc Testnet to Base Sepolia.
​
Prerequisites
Before you begin, ensure that you’ve:
Installed Node.js v22+ and npm.
Created an Arc Testnet wallet and Base Sepolia wallet. You will fund these wallets in this quickstart.
​
Step 1. Set up the project
This step shows you how to prepare your project and environment.
​
1.1. Set up your development environment
Create a new directory and install Bridge Kit and its dependencies:
Shell
# Set up your directory and initialize a Node.js project
mkdir bridge-kit-quickstart-transfer-arc-to-base
cd bridge-kit-quickstart-transfer-arc-to-base
npm init -y

# Install Bridge Kit and tools
npm install @circle-fin/bridge-kit @circle-fin/adapter-viem-v2 viem typescript tsx
​
1.2. Initialize and configure the project
First, initialize the project. This command creates a tsconfig.json file:
Shell
# Initialize a TypeScript project
npx tsc --init
Then, edit the tsconfig.json file:
Shell
# Replace the contents of the generated file
cat <<'EOF' > tsconfig.json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true
  }
}
EOF
​
1.3. Configure environment variables
Create a .env file in the project directory and add your wallet private key, replacing {YOUR_PRIVATE_KEY} with the private key from your EVM wallet.
Tip: You can find and export your private key in MetaMask.
Shell
echo "PRIVATE_KEY={YOUR_PRIVATE_KEY}" > .env
Warning: This is strictly for testing purposes. Never share your private key.
​
1.4. Fund your wallets (optional)
For this quickstart, you need USDC in your Arc Testnet wallet, and native tokens in your Base Sepolia wallet. If you need USDC testnet tokens, use the Circle Faucet to get 1 USDC in your Arc Testnet wallet. You can use the Superchain Faucet faucet to get native tokens for Base Sepolia.
Tip: Alternatively, you can use the Ethereum Sepolia faucet, then transfer some tokens to Base via SuperBridge.
​
Step 2. Bridge USDC
This step shows you how to set up your script, execute the bridge transfer, and check the result.
​
2.1. Create the script
Create an index.ts file in the project directory and add the following code. This code sets up your script. It transfers 1 USDC from Base Sepolia to Ethereum Sepolia:
TypeScript
// Import Bridge Kit and its dependencies
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { inspect } from "util";

// Initialize the SDK
const kit = new BridgeKit();

const bridgeUSDC = async (): Promise<void> => {
  try {
    // Initialize the adapter which lets you transfer tokens from your wallet on any EVM-compatible chain
    const adapter = createViemAdapterFromPrivateKey({
      privateKey: process.env.PRIVATE_KEY as string,
    });

    console.log("---------------Starting Bridging---------------");

    // Use the same adapter for the source and destination blockchains
    const result = await kit.bridge({
      from: { adapter, chain: "Arc_Testnet" },
      to: { adapter, chain: "Base_Sepolia" },
      amount: "1.00",
    });

    console.log("RESULT", inspect(result, false, null, true));
  } catch (err) {
    console.log("ERROR", inspect(err, false, null, true));
  }
};

void bridgeUSDC();
Tip: Collect a fee on transfers and estimate gas and provider fees before a transfer, only proceeding if the cost is acceptable.
​
2.2. Run the script
Save the index.ts file and run the script in your terminal:
Shell
npx tsx --env-file=.env index.ts
​
2.3. Verify the transfer
After the script finishes, find the returned steps array in the terminal output. Each transaction step includes an explorerUrl. Use that link to verify that the USDC amount matches the amount you transferred.
The following code is an example of how an approve step might look in the terminal output. The values are used in this example only and are not a real transaction:
Shell
steps: [
  {
    name: "approve",
    state: "success",
    txHash: "0xdeadbeefcafebabe1234567890abcdef1234567890abcdef1234567890abcd",
    data: {
      txHash:
        "0xdeadbeefcafebabe1234567890abcdef1234567890abcdef1234567890abcd",
      status: "success",
      cumulativeGasUsed: 17138643n,
      gasUsed: 38617n,
      blockNumber: 8778959n,
      blockHash:
        "0xbeadfacefeed1234567890abcdef1234567890abcdef1234567890abcdef12",
      transactionIndex: 173,
      effectiveGasPrice: 1037232n,
      explorerUrl:
        "https://testnet.arcscan.app/tx/0xdeadbeefcafebabe1234567890abcdef1234567890abcdef1234567890abcd",
    },
  },
];