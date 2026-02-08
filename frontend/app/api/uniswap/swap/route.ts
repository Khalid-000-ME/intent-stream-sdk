import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { ethers } from 'ethers';

const execAsync = promisify(exec);

// Config
const CONFIG = {
    base: {
        rpc: "https://sepolia.base.org", // Use public or 1rpc if preferred
        router: "0x3213d0d87bc3215dac5719db385aaf094b8c4a32",
        tokens: {
            USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            WETH: "0x4200000000000000000000000000000000000006",
            ETH: "0x4200000000000000000000000000000000000006"
        }
    },
    arbitrum: {
        rpc: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
        router: "0x72166b1ec9da1233cec8d742abc9890608ba4097",
        tokens: {
            USDC: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
            WETH: "0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed",
            ETH: "0x802CC0F559eBc79DA798bf3F3baB44141a1a06Ed"
        }
    },
    ethereum: {
        rpc: "https://1rpc.io/sepolia",
        router: "0xd42d0554eb98163fe5915031183441745ead65a9",
        tokens: {
            USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
            WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
            ETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
        }
    }
};

const PROJECT_ROOT = path.resolve(process.cwd(), '../web3/uniswap');
const FORGE_CMD = process.env.FORGE_PATH || '/Users/khalid/.foundry/bin/forge';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { network, tokenIn, tokenOut, amount, recipient } = body;

        console.log(`🦄 API: Swap Request on ${network}: ${amount} ${tokenIn} -> ${tokenOut}`);

        const config = CONFIG[network as keyof typeof CONFIG];
        if (!config) throw new Error("Invalid Network");

        const addrIn = config.tokens[tokenIn as keyof typeof config.tokens];
        const addrOut = config.tokens[tokenOut as keyof typeof config.tokens];

        if (!addrIn || !addrOut) throw new Error(`Token not supported: ${tokenIn} -> ${tokenOut}`);

        const decimals = tokenIn === 'USDC' ? 6 : 18;
        const amountWei = ethers.parseUnits(amount.toString(), decimals).toString();

        // Run Foundry Script
        const env = {
            ...process.env,
            SWAP_TOKEN_IN: addrIn,
            SWAP_TOKEN_OUT: addrOut,
            SWAP_AMOUNT: amountWei,
            SWAP_ROUTER: config.router,
            SWAP_RECIPIENT: recipient,
            FORCE_COLOR: 'false'
        };

        // Added --gas-estimate-multiplier 200 to help with Underpriced replacement txs
        // Added --with-gas-price 50000000000 (50 gwei) to force high gas and avoid replacement underpriced errors
        const cmd = `${FORGE_CMD} script script/Swap.s.sol --rpc-url ${config.rpc} --broadcast --legacy --json --gas-estimate-multiplier 200 --with-gas-price 50000000000`;

        console.log("Executing:", cmd);
        let stdout = "";
        try {
            const result = await execAsync(cmd, { cwd: PROJECT_ROOT, env });
            stdout = result.stdout;
        } catch (execError: any) {
            console.error("Exec Failed:", execError);
            if (execError.stderr && execError.stderr.includes("Failed to send transaction")) {
                console.error("Critical: Broadcast failed.");
                throw new Error("Transaction Broadcast Failed: " + execError.stderr.split('\n')[0]);
            }
            if (execError.stdout) stdout = execError.stdout;
            else throw execError;
        }

        // Parse JSON output (Handle multiple JSON objects separated by newlines)
        const lines = stdout.split('\n');
        let logs: string[] = [];
        let receipts: any[] = [];
        let success = false;
        let scriptSuccessFound = false;

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                // Find JSON object in line (sometimes mixed with text)
                const jsonStart = line.indexOf('{');
                const jsonEnd = line.lastIndexOf('}');
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    const jsonStr = line.substring(jsonStart, jsonEnd + 1);
                    const jsonObj = JSON.parse(jsonStr);

                    // Check log entries
                    if (jsonObj.logs) {
                        logs = logs.concat(jsonObj.logs);
                    }

                    // Check receipts or tx status
                    if (jsonObj.receipts) {
                        receipts = receipts.concat(jsonObj.receipts);
                    } else if (jsonObj.result?.receipts) {
                        receipts = receipts.concat(jsonObj.result.receipts);
                    } else if (jsonObj.tx_hash) {
                        // Some outputs have top-level tx_hash
                        receipts.push({ transactionHash: jsonObj.tx_hash });
                    }

                    // Check script success status
                    if (jsonObj.success !== undefined) {
                        success = jsonObj.success;
                        scriptSuccessFound = true;
                    }
                }
            } catch (e) {
                // Ignore non-JSON lines
            }
        }

        if (scriptSuccessFound && !success) {
            // Check if receipts exist (broadcast might have succeeded despite script returning failure code?)
            if (receipts.length === 0) {
                throw new Error("Swap Script Failed (Script returned success: false)");
            }
        }

        let amountOut = "0";
        let txHash = "";

        // Extract Logs for 'Transferred Output'
        for (const log of logs) {
            // Handle both string logs and structured logs if needed (but console.log is usually string)
            if (typeof log === 'string' && log.startsWith("Transferred Output:")) {
                amountOut = log.split(":")[1].trim();
            }
        }

        // Extract Tx Hash
        // Prioritize actual receipt list
        if (receipts.length > 0) {
            const valid = receipts.find(r => r.transactionHash && r.transactionHash.length === 66);
            if (valid) txHash = valid.transactionHash;
        }

        // Fallback Tx Hash extraction from stdout text if JSON missing
        // Be careful not to match random 32-byte hex strings. 
        if (!txHash) {
            const txMatch = stdout.match(/Transaction: (0x[a-fA-F0-9]{64})/);
            if (txMatch) txHash = txMatch[1];
        }

        // Final fallback (Regex search for ANY 64-char hex, but filter for likely topics)
        if (!txHash) {
            // This fallback was catching event topics. Disabled or refined needed? 
            // We'll leave it out to avoid False Positives as User complained about.
            // If we have receipts, we rely on them.
        }

        // Format Output
        const outDecimals = tokenOut === 'USDC' ? 6 : 18;
        const formattedOut = ethers.formatUnits(amountOut, outDecimals);

        return NextResponse.json({
            success: true,
            txHash: txHash || "0x...",
            amountOut: formattedOut,
            rawOut: amountOut
        });

    } catch (e: any) {
        console.error("Swap Failed:", e);
        return NextResponse.json({ success: false, error: e.message || "Swap Execution Failed" }, { status: 500 });
    }
}
