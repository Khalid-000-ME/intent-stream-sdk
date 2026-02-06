# Yellow Network State Management

This directory contains scripts for implementing real state channel management with Yellow Network, including state updates during intent submission and automatic channel resizing/funding.

## Scripts

### `yellow-state-management.ts`

Comprehensive demonstration of Yellow Network state channel operations:

- **Channel Creation & Funding**: Initialize payment channels with configurable initial funding
- **State Updates**: Submit intents with proper state channel updates (transfers)
- **Balance Monitoring**: Track channel balances in real-time
- **Auto-Resizing**: Automatically top up channels when balance falls below threshold
- **Channel Closure**: Properly close and settle channels

## Usage

### Running the Demo

```bash
# From frontend directory
npm install  # Ensure dependencies are installed
npx tsx scripts/yellow-state-management.ts
```

### Configuration

Edit the constants at the top of `yellow-state-management.ts`:

```typescript
const MIN_BALANCE_THRESHOLD = BigInt(100000);  // Resize trigger
const RESIZE_AMOUNT = BigInt(500000);          // Amount to add
const INITIAL_CHANNEL_FUNDING = BigInt(1000000); // Initial funding
```

### Environment Variables

Set your wallet private key:

```bash
export MAIN_WALLET_PRIVATE_KEY="0x..."
```

## Integration into Intent Flow API

To integrate this into `/app/api/intent-flow/route.ts`:

### 1. Import the Functions

```typescript
import {
    initializeYellowSession,
    authenticateSession,
    createChannel,
    submitIntentWithStateUpdate,
    checkAndResizeChannel,
    closeChannel,
    YellowSession
} from '@/scripts/yellow-state-management';
```

### 2. Maintain Session State

Create a global session manager:

```typescript
// Global session cache (use Redis in production)
const yellowSessions = new Map<string, YellowSession>();

async function getOrCreateSession(userId: string): Promise<YellowSession> {
    if (!yellowSessions.has(userId)) {
        const session = await initializeYellowSession();
        await authenticateSession(session);
        await createChannel(session);
        yellowSessions.set(userId, session);
    }
    return yellowSessions.get(userId)!;
}
```

### 3. Update Intent Execution

Replace the simulated "streaming" stage:

```typescript
// OLD (Simulated):
updateIntentStatus(intentId, 'streaming', 'Streaming intent to broker...');
await sleep(300);

// NEW (Real State Update):
const session = await getOrCreateSession(mainAccount.address);
const intentAmount = BigInt(50000); // Cost in channel units
const intentData = { fromToken, toToken, amount, network };

updateIntentStatus(intentId, 'streaming', 'Updating state channel...');
const submitted = await submitIntentWithStateUpdate(
    session, 
    intentAmount, 
    intentData
);

if (!submitted) {
    throw new Error('State update failed');
}
```

### 4. Add Balance Monitoring

Before each intent submission:

```typescript
// Check and resize if needed
await checkAndResizeChannel(session);
```

### 5. Session Cleanup

Add cleanup on server shutdown or timeout:

```typescript
// Cleanup inactive sessions
setInterval(async () => {
    for (const [userId, session] of yellowSessions.entries()) {
        const lastActivity = session.lastActivity || 0;
        if (Date.now() - lastActivity > 3600000) { // 1 hour
            await closeChannel(session);
            session.ws.close();
            yellowSessions.delete(userId);
        }
    }
}, 300000); // Every 5 minutes
```

## Architecture

### State Flow

```
1. Initialize Session
   ↓
2. Authenticate (EIP-712 signature)
   ↓
3. Create Channel (with initial funding)
   ↓
4. Submit Intents (with state updates)
   ↓
   ├─→ Check Balance
   │   ├─→ Sufficient? Continue
   │   └─→ Low? Resize Channel
   ↓
5. Close Channel (on completion/timeout)
```

### Message Types

The script handles these Yellow Network message types:

- `auth_challenge` / `auth_verify` - Authentication flow
- `channel_created` - Channel creation confirmation
- `channel_resized` - Resize confirmation
- `transfer_confirmed` - State update confirmation
- `ledger_balances` - Balance query response
- `channel_closed` - Channel closure confirmation

## Testing

### Unit Test Example

```typescript
import { 
    initializeYellowSession, 
    authenticateSession,
    createChannel 
} from './yellow-state-management';

describe('Yellow State Management', () => {
    it('should create and fund a channel', async () => {
        const session = await initializeYellowSession();
        await authenticateSession(session);
        const channelId = await createChannel(session);
        
        expect(channelId).toBeTruthy();
        expect(session.channelState?.balance).toBeGreaterThan(0);
    });
});
```

### Integration Test

Run the full demo to verify end-to-end flow:

```bash
npx tsx scripts/yellow-state-management.ts
```

Expected output:
```
🚀 Yellow Network State Management Demo
✅ Connected to Yellow Network WebSocket
📝 Session Address: 0x...
✅ Authentication successful!
💰 Creating channel with 1000000 funding...
✅ Channel created: ch_...
📤 Submitting intent: {...}
✅ State update confirmed
...
✅ Demo completed successfully!
```

## Production Considerations

### 1. Session Persistence

Use Redis or similar for session state:

```typescript
import Redis from 'ioredis';
const redis = new Redis();

async function saveSession(userId: string, session: YellowSession) {
    await redis.set(
        `yellow:session:${userId}`,
        JSON.stringify(session.channelState),
        'EX',
        3600
    );
}
```

### 2. Error Handling

Implement retry logic for transient failures:

```typescript
async function submitWithRetry(
    session: YellowSession,
    amount: bigint,
    data: any,
    maxRetries = 3
): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await submitIntentWithStateUpdate(session, amount, data);
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
    return false;
}
```

### 3. Monitoring

Add metrics and alerts:

```typescript
import { metrics } from '@/lib/monitoring';

// Track channel balance
metrics.gauge('yellow.channel.balance', session.channelState?.balance);

// Track resize events
metrics.increment('yellow.channel.resize');

// Alert on low balance
if (session.channelState.balance < CRITICAL_THRESHOLD) {
    alerts.send('Yellow channel critically low');
}
```

### 4. Multi-User Support

Implement proper user session isolation:

```typescript
class YellowSessionManager {
    private sessions = new Map<string, YellowSession>();
    
    async getSession(userId: string): Promise<YellowSession> {
        // Load from cache or create new
    }
    
    async cleanupSession(userId: string): Promise<void> {
        // Close channel and cleanup
    }
}
```

## Troubleshooting

### Common Issues

**Issue**: `Authentication failed`
- **Solution**: Verify `MAIN_WALLET_PRIVATE_KEY` is set correctly
- Check that the wallet has sufficient balance for gas

**Issue**: `Channel creation failed`
- **Solution**: Ensure allowances are set correctly in auth params
- Verify Yellow Network sandbox is accessible

**Issue**: `State update failed`
- **Solution**: Check channel balance is sufficient
- Verify nonce is incrementing correctly

**Issue**: `WebSocket connection timeout`
- **Solution**: Check network connectivity
- Verify Yellow Network endpoint is correct

## References

- [Yellow Network Documentation](https://docs.yellow.org)
- [Nitrolite SDK](https://github.com/erc7824/nitrolite)
- [State Channels Overview](https://docs.yellow.org/state-channels)

## Next Steps

1. **Test the demo script** to verify Yellow Network connectivity
2. **Review the integration guide** above
3. **Implement session management** in the API route
4. **Add monitoring and alerts** for production
5. **Test with multiple concurrent intents** using the test-stream page
