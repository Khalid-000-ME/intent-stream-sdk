/**
 * Recovery Script for Failed Bridge Transaction
 * 
 * This script retries the failed mint step for the 15 USDC bridge from Arc to Base.
 * Run this with: node scripts/recover-bridge.js
 */

const bridgeResult = {
    "state": "error",
    "amount": "15.0",
    "token": "USDC",
    "source": {
        "address": "0x1111d87736c9C90Bb9eAE83297BE83ae990699cE",
        "chain": {
            "type": "evm",
            "chain": "Arc_Testnet",
            "chainId": 5042002
        }
    },
    "destination": {
        "address": "0x1111d87736c9C90Bb9eAE83297BE83ae990699cE",
        "chain": {
            "type": "evm",
            "chain": "Base_Sepolia",
            "chainId": 84532
        }
    },
    "steps": [
        {
            "name": "approve",
            "state": "success",
            "txHash": "0x331767a63c6555db37512663d8a84f7702cc27ae36c83a63c4dc8e3335d4e5fa"
        },
        {
            "name": "burn",
            "state": "success",
            "txHash": "0x5e58ed423acdff8181276134c4bc5c3754026b42ef1a5878884d66e4076f961c"
        },
        {
            "name": "fetchAttestation",
            "state": "success",
            "data": {
                "attestation": "0x555ddd6370ec39951d7e44ccb5c0d6979605bd472cbaf7167596b40f6ad8bb677cf9e2710c559bad170fe740432a602393801a76b0dd446f2b412f8ada8fcfa11b7ed0a75a519265132491b449d5193729d900dea31dc41511ecd0d575819306dd78c6a5f9a7ab2ce96420043fb4b1a417a907fd6044d6accbf3e67d4f7aed6f391c",
                "message": "0x000000010000001a00000006b9165f19040e3e39b411aeb8b0f1d141e43f76a400a7135eede243ba8bc205160000000000000000000000008fe6b999dc680ccfdd5bf7eb0974218be2542daa0000000000000000000000008fe6b999dc680ccfdd5bf7eb0974218be2542daa0000000000000000000000000000000000000000000000000000000000000000000003e8000007d00000000100000000000000000000000036000000000000000000000000000000000000000000000000000000000000001111d87736c9c90bb9eae83297be83ae990699ce0000000000000000000000000000000000000000000000000000000000e4e1c0000000000000000000000000c5567a5e3370d4dbfb0540025078e283e36a363d000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
            }
        },
        {
            "name": "mint",
            "state": "error",
            "errorMessage": "mint step failed: RPC endpoint error on Base Sepolia"
        }
    ],
    "config": {
        "transferSpeed": "FAST"
    },
    "provider": "CCTPV2BridgingProvider"
};

async function retryBridge() {
    console.log('🔄 Retrying failed bridge transaction...');
    console.log('📍 From: Arc_Testnet');
    console.log('📍 To: Base_Sepolia');
    console.log('💰 Amount: 15 USDC');
    console.log('');

    try {
        const response = await fetch('http://localhost:3000/api/bridge/retry', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                bridgeResult
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ Bridge retry successful!');
            console.log('🔗 Mint TX Hash:', result.txHash);
            console.log('🌐 Explorer:', `https://sepolia.basescan.org/tx/${result.txHash}`);
            console.log('');
            console.log('Your 15 USDC should now be in your account on Base Sepolia!');
        } else {
            console.error('❌ Bridge retry failed:', result.error);
            console.log('');
            console.log('💡 You can try again in a few minutes, or contact support with this info:');
            console.log('Burn TX:', '0x5e58ed423acdff8181276134c4bc5c3754026b42ef1a5878884d66e4076f961c');
        }
    } catch (error) {
        console.error('❌ Error calling retry endpoint:', error);
        console.log('');
        console.log('Make sure your dev server is running: npm run dev');
    }
}

retryBridge();
