# 🔒 Locked Liquidity - Redemption Guide

## 📊 Current Situation

You have liquidity locked in Uniswap V4 pools across three chains:

### Base Sepolia
- **Locked**: 22.36 USDC + 0.124 WETH
- **PoolManager**: `0x1b832D5395A41446b508632466cf32c6C07D63c7`
- **Router**: `0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0`

### Arbitrum Sepolia
- **Locked**: 11.76 USDC + 0.081 WETH
- **PoolManager**: `0x4e650C85801e9dC44313669b491d20DB864a5451`
- **Router**: `0x87bD55Ea0505005799a28D34B5Ca17f4c8d24301`

### Ethereum Sepolia
- **Locked**: 8.43 USDC + 0.019 WETH
- **PoolManager**: `0xf448192241A9BBECd36371CD1f446de81A5399d2`
- **Router**: `0x6127b25A12AB31dF2B58Fe9DfFCba595AB927eA3`

## ❌ Why Removal is Failing

Uniswap V4 liquidity positions are identified by specific parameters:
1. **Pool Key** (currency0, currency1, fee, tickSpacing, hooks)
2. **Position Parameters** (tickLower, tickUpper, salt)

To remove liquidity, you MUST use the **exact same parameters** that were used when adding it.

The transactions are reverting because:
- We don't know the exact tick ranges used
- We don't know which salt values were used
- There might be multiple positions with different parameters

## 🔍 How to Find Your Position Parameters

### Option 1: Check Transaction History
1. Go to the block explorer for each chain
2. Find your liquidity addition transactions
3. Decode the transaction input data to see the exact parameters used

### Option 2: Query the PoolManager
The PoolManager contract stores position data. You need to:
1. Know your position ID (derived from parameters)
2. Query the position to see its liquidity amount
3. Use those exact parameters to remove

### Option 3: Try Different Parameters
Since the dashboard shows pools with different fees (200, 3000, 5000), try removing from each:

```javascript
// Try fee 200
const poolKey = { ..., fee: 200, ... };

// Try fee 3000  
const poolKey = { ..., fee: 3000, ... };

// Try fee 5000
const poolKey = { ..., fee: 5000, ... };
```

## 📝 Recommended Approach

### Step 1: Find Your Liquidity Addition Transactions

**Base Sepolia:**
- Go to: https://sepolia.basescan.org/address/0x1111d87736c9C90Bb9eAE83297BE83ae990699cE
- Filter for transactions to router: `0x8C85937cB4EFe36F6Df3dc4632B0b010afB440A0`
- Look for `modifyLiquidity` calls

**Arbitrum Sepolia:**
- Go to: https://sepolia.arbiscan.io/address/0x1111d87736c9C90Bb9eAE83297BE83ae990699cE
- Filter for transactions to router: `0x87bD55Ea0505005799a28D34B5Ca17f4c8d24301`

**Ethereum Sepolia:**
- Go to: https://sepolia.etherscan.io/address/0x1111d87736c9C90Bb9eAE83297BE83ae990699cE
- Filter for transactions to router: `0x6127b25A12AB31dF2B58Fe9DfFCba595AB927eA3`

### Step 2: Decode the Transaction Input

For each liquidity addition transaction:
1. Click on the transaction hash
2. Go to "Input Data" section
3. Decode it to see:
   - `tickLower`
   - `tickUpper`
   - `liquidityDelta` (the amount added)
   - `salt`
   - `fee`

### Step 3: Remove Liquidity with Exact Parameters

Use the script `/frontend/scripts/remove-all-liquidity.js` but update it with the exact parameters you found.

## 🎯 Alternative: Wait for Position NFT Support

Uniswap V4 is working on Position NFTs that will make managing liquidity much easier. Once available, you'll be able to:
1. See all your positions in a UI
2. Remove liquidity with one click
3. Transfer positions to others

## 💡 Important Notes

1. **Liquidity is NOT lost** - It's safely locked in the PoolManager contract
2. **You CAN redeem it** - You just need the exact position parameters
3. **No time limit** - There's no deadline to remove your liquidity
4. **Gas costs** - Removing liquidity costs gas, so make sure you have enough ETH

## 🔧 Scripts Available

- `/frontend/scripts/remove-all-liquidity.js` - Remove from all chains
- `/frontend/scripts/check-multichain-liquidity.js` - Check current status

## 📞 Need Help?

If you can't find the transaction parameters:
1. Share the transaction hashes of when you added liquidity
2. I can help decode them and create a custom removal script
3. Or we can query the PoolManager contract directly to find your positions

---

**Summary**: Your liquidity is safe but locked. To redeem it, you need to find the exact parameters used when adding it (tick ranges, salt, fee tier) and use those same parameters to remove it.
