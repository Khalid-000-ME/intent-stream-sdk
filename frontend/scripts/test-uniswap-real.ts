import { UniswapService } from '../lib/uniswapService';

const PRIVATE_KEY = '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';

async function testUniswapSwap() {
    console.log(`
██╗   ██╗███╗   ██╗██╗███████╗██╗    ██╗ █████╗ ██████╗ 
██║   ██║████╗  ██║██║██╔════╝██║    ██║██╔══██╗██╔══██╗
██║   ██║██╔██╗ ██║██║███████╗██║ █╗ ██║███████║██████╔╝
██║   ██║██║╚██╗██║██║╚════██║██║███╗██║██╔══██║██╔═══╝ 
╚██████╔╝██║ ╚████║██║███████║╚███╔███╔╝██║  ██║██║     
 ╚═════╝ ╚═╝  ╚═══╝╚═╝╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝     
                                                         
        REAL UNISWAP INTEGRATION TEST
        Testing on Ethereum Sepolia
`);

    console.log('━'.repeat(60));
    console.log('\n🧪 Initializing Uniswap Service...\n');

    // Use 'ethereum' (Sepolia)
    const uniswap = new UniswapService('ethereum', PRIVATE_KEY);

    try {
        // Step 1: Check balances
        console.log('📊 Step 1: Checking balances on Sepolia...\n');

        const ethBalance = await uniswap.getBalance('ETH');
        const wethBalance = await uniswap.getBalance('WETH');
        const usdcBalance = await uniswap.getBalance('USDC');

        console.log('\n' + '━'.repeat(60));

        // Use a TINY amount to ensure liquidity
        const swapAmount = '0.000001';

        if (parseFloat(wethBalance) < parseFloat(swapAmount)) {
            console.log(`\n⚠️ Insufficient WETH (${wethBalance} < ${swapAmount})`);
            console.log('🔄 Wrapping ETH to WETH...');

            const { ethers } = await import('ethers');
            const provider = new ethers.JsonRpcProvider('https://1rpc.io/sepolia');
            const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

            const WETH_ADDR = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
            const WETH_ABI = ['function deposit() payable'];
            const wethContract = new ethers.Contract(WETH_ADDR, WETH_ABI, wallet);

            const wrapTx = await wethContract.deposit({ value: ethers.parseEther('0.001') }); // Wrap a chunk
            console.log(`  📤 Wrapping transaction sent: ${wrapTx.hash}`);
            await wrapTx.wait();
            console.log('  ✅ ETH Wrapped to WETH');
        }

        // Step 2: Execute swap
        console.log('\n🔄 Step 2: Executing REAL swap via Intent Executor...\n');
        console.log(`  Swapping ${swapAmount} WETH → USDC`);
        console.log('  Network: Ethereum Sepolia');
        console.log('  Slippage: 5.0% (High tolerance for testnet)\n');

        // High slippage allowed
        const result = await uniswap.executeSwap('WETH', 'USDC', swapAmount, 5.0);

        console.log('\n' + '━'.repeat(60));
        console.log('\n✅ SWAP SUCCESSFUL!\n');
        console.log('Results:');
        console.log('  Input:         ', result.inputAmount, result.inputToken);
        console.log('  Output:        ', result.outputAmount, result.outputToken);
        console.log('  Price Impact:  ', result.priceImpact, '%');
        console.log('  Gas Used:      ', result.gasUsed);
        console.log('  Execution Time:', result.executionTime, 'ms');
        console.log('  Block:         #', result.blockNumber);
        console.log('  Tx Hash:       ', result.txHash);
        console.log('\n' + '━'.repeat(60));

        // Step 3: Check balances after
        console.log('\n📊 Step 3: Checking balances after swap...\n');
        await uniswap.getBalance('WETH');
        await uniswap.getBalance('USDC');

        console.log('\n✅ TEST COMPLETE!\n');

    } catch (error: any) {
        console.error('\n❌ TEST FAILED\n');
        console.error('Error:', error.message);
        if (error.data) console.error('Data:', error.data);
    }
}

testUniswapSwap().catch(console.error);
