# Yellow Channel Test Script

This is the official Yellow Network channel management script, now fixed to work without top-level await errors.

## What Was Fixed

The script had 3 top-level `await` statements that caused ESBuild errors:
- Line 46: `await askQuestion()` for private key input
- Line 117: `await fetchConfig()` for configuration
- Line 160: `await createAuthRequestMessage()` for authentication

## Solution

Wrapped the entire script in an `async function main()` and called it at the end:

```typescript
async function main() {
    // All the original code here...
}

// Call the main function
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
```

## How to Run

```bash
cd /Users/khalid/Projects/UniFlow/frontend/scripts

# Make sure PRIVATE_KEY is set in .env.local
npx tsx yellow-channel.ts
```

## What It Does

This script demonstrates the full Yellow Network channel lifecycle:
1. **Authentication** - EIP-712 signatures with session keys
2. **Channel Creation** - Creates payment channel on Sepolia
3. **Channel Funding** - Funds channel from Unified Balance
4. **Channel Resize** - Adjusts channel capacity
5. **Channel Closure** - Closes channel and withdraws funds

## Status

✅ **Script now runs without errors!**

The top-level await errors are fixed. The script will:
- Prompt for PRIVATE_KEY if not in environment
- Connect to Yellow Network Sandbox
- Execute the full channel lifecycle

## Integration with Our Code

The data transformation logic from this official script confirms our fix in `yellow-state-management.ts` was correct:

```typescript
// Transform state from server format to SDK format
const unsignedInitialState = {
    intent: state.intent,
    version: BigInt(state.version),  // String → BigInt
    data: state.state_data,
    allocations: state.allocations.map((a: any) => ({
        destination: a.destination,
        token: a.token,
        amount: BigInt(a.amount),  // String → BigInt
    })),
};
```

This matches exactly what we implemented! 🎉
