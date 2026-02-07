
const { ethers } = require("ethers");
const readline = require("readline");
const path = require("path");
const fs = require("fs");
const WebSocket = require("ws");

// Import Yellow SDK utilities
const {
    createECDSAMessageSigner,
    createEIP712AuthMessageSigner,
    createAuthVerifyMessageFromChallenge,
    createAuthRequestMessage,
    createGetLedgerBalancesMessage,
    createCreateChannelMessage,
    createTransferMessage,
} = require("@erc7824/nitrolite");
const { privateKeyToAccount, generatePrivateKey } = require("viem/accounts");
const { createWalletClient, createPublicClient, http } = require("viem");
const { sepolia } = require("viem/chains");

// Load environment variables
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
} else {
    require("dotenv").config();
}

const PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const YELLOW_WS_URL = "wss://clearnet-sandbox.yellow.com/ws";
const YTEST_USD_TOKEN = "0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb";

// Latest Deployed Addresses on Base Sepolia
const LIQUIDITY_MANAGER = ethers.getAddress("0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0".toLowerCase());
const POOL_MANAGER = ethers.getAddress("0x1b832D5395A41446b508632466cf32c6C07D63c7".toLowerCase());
const USDC_ADDR = ethers.getAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e".toLowerCase());
const WETH_ADDR = ethers.getAddress("0x4200000000000000000000000000000000000006".toLowerCase());

const MIN_SQRT_RATIO = BigInt("4295128739") + BigInt(1);
const MAX_SQRT_RATIO = BigInt("1461446703485210103287273052203988822378723970342") - BigInt(1);

const ERC20_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function symbol() view returns (string)"
];

const POOL_MANAGER_ABI = [
    "function balanceOf(address owner, uint256 id) view returns (uint256)",
    "function getSlot0(bytes32 id) view returns (uint160 sqrtPriceX96, int24 tick, uint16 protocolFee, uint24 lpFee)",
    "function getLiquidity(bytes32 id) view returns (uint128)"
];

const ROUTER_ABI = [
    "function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, bytes hookData) external payable",
    "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable",
    "function redeem(address currency, uint256 amount) external",
    "function getPoolStatus((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key) view returns (uint160 sqrtPriceX96, uint128 liquidity)"
];

async function ask(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => rl.question(question, answer => {
        rl.close();
        resolve(answer);
    }));
}

async function checkAllBalances(wallet, usdc, weth, pm, router) {
    const uBal = await usdc.balanceOf(wallet.address);
    const wBal = await weth.balanceOf(wallet.address);
    const uClaim = await pm.balanceOf(wallet.address, USDC_ADDR);
    const wClaim = await pm.balanceOf(wallet.address, WETH_ADDR);

    // Also check Pool Liquidity (Total Locked)
    const pmUSDC = await usdc.balanceOf(POOL_MANAGER);
    const pmWETH = await weth.balanceOf(POOL_MANAGER);

    console.log(`\n💰 Current Balances on Base Sepolia:`);
    console.log(`   ERC-20 USDC:   ${ethers.formatUnits(uBal, 6).padEnd(12)} (Units: ${uBal.toString()})`);
    console.log(`   ERC-20 WETH:   ${ethers.formatUnits(wBal, 18).padEnd(12)} (Units: ${wBal.toString()})`);
    console.log(`   Claim USDC:    ${ethers.formatUnits(uClaim, 6).padEnd(12)} (ERC-6909)`);
    console.log(`   Claim WETH:    ${ethers.formatUnits(wClaim, 18).padEnd(12)} (ERC-6909)`);

    console.log(`\n📊 PoolManager Total Tokens Locked (All Pools):`);
    console.log(`   USDC Locked:   ${parseFloat(ethers.formatUnits(pmUSDC, 6)).toFixed(8)}`);
    console.log(`   WETH Locked:   ${parseFloat(ethers.formatUnits(pmWETH, 18)).toFixed(8)}`);

    // Check specific pool state
    const isUSDC0 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase();
    const activeKeyArray = [
        isUSDC0 ? USDC_ADDR : WETH_ADDR,
        isUSDC0 ? WETH_ADDR : USDC_ADDR,
        3000,
        60,
        ethers.ZeroAddress
    ];

    try {
        const [sqrtPriceX96, liquidity] = await router.getPoolStatus(activeKeyArray);
        console.log(`\n🎯 Active Pool State (3000, 60):`);
        console.log(`   SqrtPriceX96: ${sqrtPriceX96.toString()}`);
        console.log(`   Active Liq L: ${liquidity.toString()}`);
    } catch (e) {
        console.log(`\n🎯 Active Pool State (3000, 60): ❌ (${e.message})`);
    }

    if (parseFloat(ethers.formatUnits(pmUSDC, 6)) < 0.1) {
        console.log(`   ⚠️  WARNING: VERY LOW LIQUIDITY. Swaps will be 'capped' by pool depth.`);
    }
}

async function main() {
    console.log(`
██╗   ██╗███╗   ██╗██╗███████╗██╗      ██████╗ ██╗    ██╗
██║   ██║████╗  ██║██║██╔════╝██║     ██╔═══██╗██║    ██║
██║   ██║██╔██╗ ██║██║█████╗  ██║     ██║   ██║██║ █╗ ██║
██║   ██║██║╚██╗██║██║██╔══╝  ██║     ██║   ██║██║███╗██║
╚██████╔╝██║ ╚████║██║██║     ███████╗╚██████╔╝╚███╔███╔╝
 ╚═════╝ ╚═╝  ╚═══╝╚═╝╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝
    V4 INTERACTIVE SWAP + YELLOW NETWORK INTENTS
    `);

    if (!PRIVATE_KEY) {
        console.error("❌ Error: PRIVATE_KEY or MAIN_WALLET_PRIVATE_KEY is missing in env.");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`🦊 Wallet: ${wallet.address}`);

    const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, wallet);
    const weth = new ethers.Contract(WETH_ADDR, ERC20_ABI, wallet);
    const pm = new ethers.Contract(POOL_MANAGER, POOL_MANAGER_ABI, wallet);
    const router = new ethers.Contract(LIQUIDITY_MANAGER, ROUTER_ABI, wallet);

    await checkAllBalances(wallet, usdc, weth, pm, router);

    // --- STEP :: ADD LIQUIDITY OPTION ---
    const addLiq = await ask("\n💧 Add Liquidity to the pool first? (Recommended if low) (y/n): ");
    if (addLiq.toLowerCase() === 'y') {
        const uAmt = await ask("   USDC Amount: ");
        const wAmt = await ask("   WETH Amount: ");

        const [uBal, wBal] = await Promise.all([usdc.balanceOf(wallet.address), weth.balanceOf(wallet.address)]);
        const uIn = ethers.parseUnits(uAmt, 6);
        const wIn = ethers.parseUnits(wAmt, 18);

        const isUSDC0 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase();
        const key = {
            currency0: isUSDC0 ? USDC_ADDR : WETH_ADDR,
            currency1: isUSDC0 ? WETH_ADDR : USDC_ADDR,
            fee: 200,
            tickSpacing: 60,
            hooks: ethers.ZeroAddress
        };

        // Fetch current price to calculate L properly
        let sqrtPriceX96;
        try {
            const status = await router.getPoolStatus(key);
            sqrtPriceX96 = status.sqrtPriceX96;
        } catch (e) {
            console.log("❌ Failed to fetch pool status:", e.message);
            return;
        }

        if (sqrtPriceX96 === 0n) {
            console.log("❌ Pool not initialized! Can't add liq.");
            return;
        }

        console.log("🔓 Approving tokens for Router and PoolManager...");
        if ((await usdc.allowance(wallet.address, LIQUIDITY_MANAGER)) < uIn) await (await usdc.approve(LIQUIDITY_MANAGER, ethers.MaxUint256)).wait();
        if ((await weth.allowance(wallet.address, LIQUIDITY_MANAGER)) < wIn) await (await weth.approve(LIQUIDITY_MANAGER, ethers.MaxUint256)).wait();
        if ((await usdc.allowance(wallet.address, POOL_MANAGER)) < uIn) await (await usdc.approve(POOL_MANAGER, ethers.MaxUint256)).wait();
        if ((await weth.allowance(wallet.address, POOL_MANAGER)) < wIn) await (await weth.approve(POOL_MANAGER, ethers.MaxUint256)).wait();

        console.log("🌊 Adding liquidity...");

        // Correct L calculation for Full Range: L = amount0 * sqrtPrice / 2^96 (simplified for USDC/WETH)
        const Q96 = 2n ** 96n;
        const L = (uIn * sqrtPriceX96) / Q96;

        const liqParams = {
            tickLower: -887220,
            tickUpper: 887220,
            liquidityDelta: L,
            salt: ethers.ZeroHash
        };

        try {
            const tx = await router.addLiquidity(key, liqParams, "0x", { gasLimit: 2000000 });
            console.log(`⏳ Pending Liq: ${tx.hash}`);
            await tx.wait();
            console.log("✅ Liquidity Added!");
        } catch (e) {
            console.log("❌ Liq Add failed:", e.message);
            if (e.data) console.log("   Revert Data:", e.data);
        }
        await checkAllBalances(wallet, usdc, weth, pm, router);
    }

    // --- STEP 0: YELLOW NETWORK INTENT PROOF ---
    console.log("\n--- Step 0: Yellow Network Intent Proof ---");
    const useYellow = await ask("Send Intent Proof to Yellow Network using test.usd? (y/n): ");

    if (useYellow.toLowerCase() === 'y') {
        console.log("⚡ Connecting to Yellow Network...");
        const ws = new WebSocket(YELLOW_WS_URL);

        await new Promise((res, rej) => {
            ws.on("open", res);
            ws.on("error", rej);
            setTimeout(() => rej("Timeout"), 10000);
        });

        // Setup Clients
        const account = privateKeyToAccount(PRIVATE_KEY);
        const publicClient = createPublicClient({ chain: sepolia, transport: http() });
        const walletClient = createWalletClient({ chain: sepolia, transport: http(), account });

        // Generate Session Key
        const sessionPrivateKey = generatePrivateKey();
        const sessionAccount = privateKeyToAccount(sessionPrivateKey);
        const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

        // 1. Auth Request
        const authParams = {
            address: account.address,
            application: 'Intent Stream SDK',
            session_key: sessionAccount.address,
            allowances: [{ asset: 'ytest.usd', amount: '1000' }],
            expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
            scope: 'test.app',
        };

        ws.send(await createAuthRequestMessage(authParams));

        const authVerified = await new Promise((resolve) => {
            ws.on("message", async (data) => {
                const response = JSON.parse(data.toString());
                const type = response.res?.[1];

                if (type === "auth_challenge") {
                    console.log("🔐 Received Yellow Challenge, signing...");
                    const challenge = response.res[2].challenge_message;
                    const signer = createEIP712AuthMessageSigner(walletClient, authParams, { name: 'Intent Stream SDK' });
                    ws.send(await createAuthVerifyMessageFromChallenge(signer, challenge));
                }
                if (type === "auth_verify") {
                    console.log("✅ Authenticated with Yellow Network!");
                    resolve(true);
                }
            });
            setTimeout(() => resolve(false), 30000);
        });

        if (authVerified) {
            // 2. Get Ledger Balance
            console.log("\n📊 Querying Yellow Network Ledger...");
            ws.send(await createGetLedgerBalancesMessage(sessionSigner, account.address, Date.now()));

            const ledger = await new Promise(res => {
                const timeout = setTimeout(() => {
                    console.log("⚠️  Ledger Balance Timeout (Yellow Node might be slow)");
                    res([]);
                }, 20000);
                const handler = (data) => {
                    const r = JSON.parse(data.toString());
                    if (r.res?.[1] === 'get_ledger_balances') {
                        clearTimeout(timeout);
                        ws.off('message', handler);
                        res(r.res[2].ledger_balances);
                    }
                };
                ws.on('message', handler);
            });
            const usdBal = ledger.find(b => b.asset === 'ytest.usd')?.amount || "Not Found";
            console.log(`💰 Yellow Unified Balance: ${usdBal} test.usd`);
            console.log(`   (This balance is off-chain on the Yellow Sandbox)`);

            // 3. Send Intent Proof (Transfer of 0.1 test.usd as proof)
            console.log("📤 Sending Intent Proof to Yellow Network State Channel...");
            const transferMsg = await createTransferMessage(
                sessionSigner,
                {
                    destination: "0x0000000000000000000000000000000000000000", // Intent Broker
                    allocations: [{ asset: "ytest.usd", amount: "100" }] // 0.0001 usd proof
                },
                Date.now()
            );
            ws.send(transferMsg);

            // Wait for transfer ack
            await new Promise(res => {
                const handler = (data) => {
                    const r = JSON.parse(data.toString());
                    if (r.res?.[1] === 'transfer') {
                        console.log("\n✨ INTENT PROOF VERIFIED!");
                        console.log(`   State Version: ${r.res[2].transfer?.state?.version || 'N/A'}`);
                        console.log(`   Proof Hash:    ${ethers.keccak256(data)}`);
                        console.log(`\n🔍 VERIFICATION INFO:`);
                        console.log(`   In the Yellow Sandbox, this proof is verified cryptographically by the node.`);
                        console.log(`   You can see the state version increment in your balance / channel history.`);
                        console.log(`   Public Explorer: https://sandbox.yellow.network (Coming soon)`);
                        ws.off('message', handler);
                        res(true);
                    }
                };
                ws.on('message', handler);
                setTimeout(() => res(false), 10000);
            });
        }
        ws.close();
    }

    // --- STEP 1: USDC -> WETH ---
    console.log("\n--- Swap 1: USDC to WETH ---");
    const usdcInput = await ask("Enter USDC amount to swap: ");
    if (usdcInput && parseFloat(usdcInput) > 0) {
        const amountIn = ethers.parseUnits(usdcInput, 6);

        const allowance = await usdc.allowance(wallet.address, LIQUIDITY_MANAGER);
        if (allowance < amountIn) {
            console.log("🔓 Approving USDC...");
            await (await usdc.approve(LIQUIDITY_MANAGER, ethers.MaxUint256)).wait();
            console.log("✅ Approved.");
        }

        const isUSDC0 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase();
        const key = {
            currency0: isUSDC0 ? USDC_ADDR : WETH_ADDR,
            currency1: isUSDC0 ? WETH_ADDR : USDC_ADDR,
            fee: 200,
            tickSpacing: 60,
            hooks: ethers.ZeroAddress
        };

        console.log(`🔄 Swapping ${usdcInput} USDC for WETH...`);
        const params = {
            zeroForOne: isUSDC0,
            amountSpecified: -amountIn,
            sqrtPriceLimitX96: isUSDC0 ? MIN_SQRT_RATIO : MAX_SQRT_RATIO
        };

        try {
            const tx = await router.swap(key, params, "0x", { gasLimit: 2000000 });
            console.log(`⏳ Pending: ${tx.hash}`);
            await tx.wait();
            console.log("✅ Swap 1 Success!");
        } catch (e) {
            console.error("❌ Swap 1 Failed:", e.message);
        }
    }

    // --- STEP 2: WETH -> USDC ---
    console.log("\n--- Swap 2: WETH to USDC ---");
    const wethInput = await ask("Enter WETH amount to swap back: ");
    if (wethInput && parseFloat(wethInput) > 0) {
        const amountIn = ethers.parseUnits(wethInput, 18);

        const allowance = await weth.allowance(wallet.address, LIQUIDITY_MANAGER);
        if (allowance < amountIn) {
            console.log("🔓 Approving WETH...");
            await (await weth.approve(LIQUIDITY_MANAGER, ethers.MaxUint256)).wait();
            console.log("✅ Approved.");
        }

        const isUSDC0 = USDC_ADDR.toLowerCase() < WETH_ADDR.toLowerCase();
        const key = {
            currency0: isUSDC0 ? USDC_ADDR : WETH_ADDR,
            currency1: isUSDC0 ? WETH_ADDR : USDC_ADDR,
            fee: 200,
            tickSpacing: 60,
            hooks: ethers.ZeroAddress
        };

        console.log(`🔄 Swapping ${wethInput} WETH for USDC...`);
        const params = {
            zeroForOne: !isUSDC0,
            amountSpecified: -amountIn,
            sqrtPriceLimitX96: !isUSDC0 ? MIN_SQRT_RATIO : MAX_SQRT_RATIO
        };

        try {
            const tx = await router.swap(key, params, "0x", { gasLimit: 2000000 });
            console.log(`⏳ Pending: ${tx.hash}`);
            await tx.wait();
            console.log("✅ Swap 2 Success!");
        } catch (e) {
            console.error("❌ Swap 2 Failed:", e.message);
        }
    }

    console.log("\n🏁 All operations finished.");
    await checkAllBalances(wallet, usdc, weth, pm);

    const doRedeem = await ask("\n🎁 Redeem all ERC-6909 Claims to ERC-20? (y/n): ");
    if (doRedeem.toLowerCase() === 'y') {
        const uClaim = await pm.balanceOf(wallet.address, USDC_ADDR);
        const wClaim = await pm.balanceOf(wallet.address, WETH_ADDR);

        if (uClaim > 0n) {
            console.log("📤 Redeeming USDC Claims...");
            await (await router.redeem(USDC_ADDR, uClaim)).wait();
        }
        if (wClaim > 0n) {
            console.log("📤 Redeeming WETH Claims...");
            await (await router.redeem(WETH_ADDR, wClaim)).wait();
        }
        console.log("✅ Redemption Finished.");
        await checkAllBalances(wallet, usdc, weth, pm);
    }
}

main().catch(console.error);
