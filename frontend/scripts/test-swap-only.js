// Test the swap functionality without Yellow Network
async function testSwapOnly() {
    console.log('🧪 Testing Swap Only (No Yellow Network)\\n');
    console.log('━'.repeat(60));

    // Step 1: Create intent with minimal flow
    console.log('\\n📝 Step 1: Creating swap intent...');

    const createResponse = await fetch('http://localhost:3000/api/swap-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fromToken: 'WETH',
            toToken: 'USDC',
            amount: '0.000001',
            network: 'ethereum',
            slippage: 5.0
        })
    });

    if (createResponse.ok) {
        const data = await createResponse.json();
        console.log('✅ Swap executed successfully!');
        console.log('Result:', JSON.stringify(data, null, 2));
    } else {
        console.error('❌ Swap failed:', await createResponse.text());
    }
}

// Run the test
console.log(`
██╗   ██╗███╗   ██╗██╗███████╗██╗    ██╗ █████╗ ██████╗ 
██║   ██║████╗  ██║██║██╔════╝██║    ██║██╔══██╗██╔══██╗
██║   ██║██╔██╗ ██║██║███████╗██║ █╗ ██║███████║██████╔╝
██║   ██║██║╚██╗██║██║╚════██║██║███╗██║██╔══██║██╔═══╝ 
╚██████╔╝██║ ╚████║██║███████║╚███╔███╔╝██║  ██║██║     
 ╚═════╝ ╚═╝  ╚═══╝╚═╝╚══════╝ ╚══╝══╝ ╚═╝  ╚═╝╚═╝     

        SWAP TEST (NO YELLOW NETWORK)
        Testing Direct Uniswap V4 Swap
`);

testSwapOnly().catch(console.error);
