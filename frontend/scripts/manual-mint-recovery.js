/**
 * Manual Mint Recovery Script
 * 
 * This script manually completes the mint step on Base Sepolia using the attestation data.
 * Run this with: node scripts/manual-mint-recovery.js
 */

// Attestation data from the failed bridge
const message = "0x000000010000001a00000006b9165f19040e3e39b411aeb8b0f1d141e43f76a400a7135eede243ba8bc205160000000000000000000000008fe6b999dc680ccfdd5bf7eb0974218be2542daa0000000000000000000000008fe6b999dc680ccfdd5bf7eb0974218be2542daa0000000000000000000000000000000000000000000000000000000000000000000003e8000007d00000000100000000000000000000000036000000000000000000000000000000000000000000000000000000000000001111d87736c9c90bb9eae83297be83ae990699ce0000000000000000000000000000000000000000000000000000000000e4e1c0000000000000000000000000c5567a5e3370d4dbfb0540025078e283e36a363d000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

const attestation = "0x555ddd6370ec39951d7e44ccb5c0d6979605bd472cbaf7167596b40f6ad8bb677cf9e2710c559bad170fe740432a602393801a76b0dd446f2b412f8ada8fcfa11b7ed0a75a519265132491b449d5193729d900dea31dc41511ecd0d575819306dd78c6a5f9a7ab2ce96420043fb4b1a417a907fd6044d6accbf3e67d4f7aed6f391c";

async function manualMint() {
    console.log('🔧 Manually completing mint on Base Sepolia...');
    console.log('💰 Amount: 15 USDC');
    console.log('📍 Recipient: 0x1111d87736c9c90bb9eae83297be83ae990699ce');
    console.log('');

    try {
        const response = await fetch('http://localhost:3000/api/bridge/manual-mint', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                attestation
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ Manual mint successful!');
            console.log('🔗 TX Hash:', result.txHash);
            console.log('📦 Block:', result.blockNumber);
            console.log('🌐 Explorer:', result.explorerUrl);
            console.log('');
            console.log('🎉 Your 15 USDC should now be in your account on Base Sepolia!');
            console.log('');
            console.log('Check your balance at:');
            console.log('https://sepolia.basescan.org/address/0x1111d87736c9c90bb9eae83297be83ae990699ce#tokentxns');
        } else {
            console.error('❌ Manual mint failed:', result.error);
            if (result.details) {
                console.error('Details:', result.details);
            }
            console.log('');

            // Check if already minted
            if (result.error && result.error.includes('already')) {
                console.log('💡 The funds may have already been minted. Check your balance:');
                console.log('https://sepolia.basescan.org/address/0x1111d87736c9c90bb9eae83297be83ae990699ce#tokentxns');
            } else {
                console.log('💡 Please contact support with this info:');
                console.log('Burn TX: 0x5e58ed423acdff8181276134c4bc5c3754026b42ef1a5878884d66e4076f961c');
                console.log('Message:', message.substring(0, 66) + '...');
            }
        }
    } catch (error) {
        console.error('❌ Error calling manual mint endpoint:', error);
        console.log('');
        console.log('Make sure your dev server is running: npm run dev');
    }
}

manualMint();
