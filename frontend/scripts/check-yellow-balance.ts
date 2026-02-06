
import {
    initializeYellowSession,
    authenticateSession,
    getLedgerBalances,
    requestFaucetTokens,
} from './yellow-state-management';
import 'dotenv/config';

async function main() {
    console.log("🔍 Checking Yellow Network Ledger Balances...");
    const session = await initializeYellowSession();
    const authenticated = await authenticateSession(session);

    if (authenticated) {
        // Request faucet first to be sure
        await requestFaucetTokens(session.mainAccount.address);
        console.log("⏳ Waiting 3s...");
        await new Promise(r => setTimeout(r, 3000));

        const balances = await getLedgerBalances(session);
        console.log("\n💰 Your Yellow Ledger Balances:");
        console.log(JSON.stringify(balances, null, 2));
    } else {
        console.error("❌ Failed to authenticate with Yellow Network");
    }

    session.ws.close();
}

main().catch(console.error);
