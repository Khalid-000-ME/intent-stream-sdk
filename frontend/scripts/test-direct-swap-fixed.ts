import { ethers } from 'ethers';

const PRIVATE_KEY = '0xe844e40e45c5d163f0142b255799d239802bdcf867f45385c7e54735fe721d59';
const RPC_URL = 'https://ethereum-sepolia.publicnode.com';

const ROUTER_ADDRESS = '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E';
const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; // ✅ FIXED: Using actual USDC
// const UNI_ADDRESS = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'; // UNI pool doesn't exist

const ROUTER_ABI = [
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)'
];

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)'
];

const WETH_ABI = ['function deposit() payable'];

async function testDirectSwap() {
    console.log('🧪 Testing DIRECT Router Swap (Bypassing Executor)...');

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`  Wallet: ${wallet.address}`);

    // 1. Check Balance
    const weth = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, wallet);
    let bal = await weth.balanceOf(wallet.address);
    console.log(`  WETH Balance: ${ethers.formatUnits(bal, 18)}`);

    const amountIn = ethers.parseUnits('0.001', 18);

    if (bal < amountIn) {
        console.log('  ⚠️ Low Balance - Wrapping ETH...');
        const wethDeposit = new ethers.Contract(WETH_ADDRESS, WETH_ABI, wallet);
        await (await wethDeposit.deposit({ value: amountIn })).wait();
        console.log('  ✅ Wrapped');
    }

    // 2. Approve Router
    console.log('  🔐 Checking Router Approval...');
    const allowance = await weth.allowance(wallet.address, ROUTER_ADDRESS);
    if (allowance < amountIn) {
        console.log('  📝 Approving Router...');
        await (await weth.approve(ROUTER_ADDRESS, ethers.MaxUint256)).wait();
        console.log('  ✅ Approved');
    } else {
        console.log('  ✅ Already Approved');
    }

    // 3. Execute Swap
    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);

    const params = {
        tokenIn: WETH_ADDRESS,
        tokenOut: USDC_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 1800,
        amountIn: amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
    };

    console.log('  🚀 Sending Swap Transaction...');

    try {
        await router.exactInputSingle.estimateGas(params);
        console.log('  ✅ Gas Estimated successfully!');

        const tx = await router.exactInputSingle(params);
        console.log(`  📤 Tx Sent: ${tx.hash}`);
        await tx.wait();
        console.log('  ✅ Swap Confirmed!');
    } catch (e: any) {
        console.error('  ❌ Swap Failed:', e.message);
        if (e.data) console.error('  Data:', e.data);
    }
}

testDirectSwap().catch(console.error);