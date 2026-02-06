
const { ethers } = require("ethers");
const WebSocket = require("ws");
const {
    createECDSAMessageSigner,
    createEIP712AuthMessageSigner,
    createAuthVerifyMessageFromChallenge,
    createAuthRequestMessage,
    createGetLedgerBalancesMessage,
} = require("@erc7824/nitrolite");
const { privateKeyToAccount, generatePrivateKey } = require("viem/accounts");
const { createWalletClient, http } = require("viem");
const { sepolia } = require("viem/chains");
require("dotenv").config({ path: ".env.local" });

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;
const YELLOW_WS_URL = "wss://clearnet-sandbox.yellow.com/ws";

async function main() {
    console.log("🔍 Fetching Yellow Unified Balance...");

    const account = privateKeyToAccount(PRIVATE_KEY);
    const walletClient = createWalletClient({ chain: sepolia, transport: http(), account });
    const sessionPrivateKey = generatePrivateKey();
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);
    const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

    const ws = new WebSocket(YELLOW_WS_URL);

    await new Promise((res) => ws.on("open", res));

    // Auth
    const authParams = {
        address: account.address,
        application: 'Balance Checker',
        session_key: sessionAccount.address,
        allowances: [{ asset: 'ytest.usd', amount: '1000' }],
        expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
        scope: 'test.app',
    };

    ws.send(await createAuthRequestMessage(authParams));

    await new Promise((resolve) => {
        ws.on("message", async (data) => {
            const response = JSON.parse(data.toString());
            const type = response.res?.[1];

            if (type === "auth_challenge") {
                const challenge = response.res[2].challenge_message;
                const signer = createEIP712AuthMessageSigner(walletClient, authParams, { name: 'Balance Checker' });
                ws.send(await createAuthVerifyMessageFromChallenge(signer, challenge));
            }
            if (type === "auth_verify") {
                console.log("✅ Authenticated!");

                // Fetch Balances with correct params
                const ledgerMsg = await createGetLedgerBalancesMessage(
                    sessionSigner,
                    account.address,
                    Date.now()
                );
                ws.send(ledgerMsg);
            }
            if (type === "get_ledger_balances") {
                console.log("\n💰 GOLDEN SOURCE: Yellow Unified Balances:");
                console.log(JSON.stringify(response.res[2].ledger_balances, null, 2));
                ws.close();
                resolve();
            }
        });
        setTimeout(() => {
            console.log("❌ Timeout fetching balance");
            ws.close();
            resolve();
        }, 15000);
    });
}

main().catch(console.error);
