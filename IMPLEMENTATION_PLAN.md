# Intent-Stream-SDK Implementation Plan

**Status:** In Progress  
**Last Updated:** February 4, 2026

---

## Project Structure

```
UniFlow/
├── frontend/          # Next.js Web Dashboard
├── backend/           # CLI SDK + Integration Logic
├── web3/             # Smart Contracts + Deployment
└── INTENT_STREAM_SDK_PRD.md
```

---

## Phase 1: Foundation Setup ✅

### 1.1 Yellow Network Integration ✅
- [x] Yellow Network authentication working (server-side)
- [x] WebSocket connection established
- [x] State channel management
- [x] Test script created (`frontend/scripts/yellow-auth.js`)

**Files:**
- `frontend/app/api/yellow-full/route.ts` - Server-side auth with private key
- `frontend/lib/yellowServerClient.ts` - Client wrapper
- `frontend/scripts/yellow-auth.js` - Test script

---

## Phase 2: API Routes Architecture (CURRENT PRIORITY)

### 2.1 Core API Routes Structure

**Location:** `frontend/app/api/`

```
frontend/app/api/
├── yellow/
│   └── route.ts          # Yellow Network operations
├── uniswap/
│   └── route.ts          # Uniswap v4 interactions
├── arc/
│   └── route.ts          # Arc settlement operations
├── intents/
│   ├── create/route.ts   # Create new intent
│   ├── status/route.ts   # Check intent status
│   └── history/route.ts  # Get intent history
├── channels/
│   ├── open/route.ts     # Open state channel
│   ├── fund/route.ts     # Fund channel
│   └── close/route.ts    # Close channel
└── agents/
    ├── create/route.ts   # Create agent wallet
    ├── authorize/route.ts # Set spending limits
    └── activity/route.ts  # Get agent activity
```

### 2.2 API Route Implementation Priority

**Week 1: Core Infrastructure**
1. ✅ Yellow Network (`/api/yellow-full`)
2. ⏳ Uniswap Integration (`/api/uniswap`)
3. ⏳ Arc Settlement (`/api/arc`)

**Week 2: Intent Management**
4. ⏳ Intent Creation (`/api/intents/create`)
5. ⏳ Intent Status (`/api/intents/status`)
6. ⏳ Intent History (`/api/intents/history`)

**Week 3: Channel Management**
7. ⏳ Channel Operations (`/api/channels/*`)
8. ⏳ Agent Management (`/api/agents/*`)

---

## Phase 3: Backend SDK Development

### 3.1 CLI Structure

**Location:** `backend/`

```
backend/
├── src/
│   ├── commands/
│   │   ├── init.ts       # Initialize agent wallet
│   │   ├── stream.ts     # Stream intent
│   │   ├── status.ts     # Check status
│   │   ├── fund.ts       # Fund channel
│   │   └── history.ts    # View history
│   ├── lib/
│   │   ├── wallet.ts     # Wallet management
│   │   ├── channel.ts    # State channel ops
│   │   ├── broker.ts     # Broker communication
│   │   ├── intent.ts     # Intent creation
│   │   └── asi-agent.ts  # ASI agent integration
│   ├── utils/
│   │   ├── logger.ts     # Colored logging
│   │   ├── formatter.ts  # Output formatting
│   │   └── ascii.ts      # ASCII art
│   └── index.ts
├── package.json
└── tsconfig.json
```

### 3.2 SDK Integration Logic

**Purpose:** Provide developer-friendly SDK for integration

```typescript
// Example usage
import { IntentStreamSDK } from '@intent-stream/sdk';

const sdk = new IntentStreamSDK({
  privateKey: process.env.PRIVATE_KEY,
  network: 'arbitrum',
});

await sdk.init();
const intent = await sdk.stream({
  from: 'ETH',
  to: 'USDC',
  amount: '1.5',
  slippage: 0.5,
});

console.log(intent.status);
```

---

## Phase 4: Smart Contracts

### 4.1 Contract Structure

**Location:** `web3/`

```
web3/
├── contracts/
│   ├── yellow/
│   │   └── IntentChannel.sol      # State channel contract
│   ├── uniswap/
│   │   └── StreamFlowHook.sol     # Uniswap v4 hook
│   ├── arc/
│   │   └── SettlementRegistry.sol # Settlement contract
│   └── agents/
│       ├── AgentWallet.sol        # Agent wallet
│       └── AgentStaking.sol       # FET staking
├── test/
│   ├── IntentChannel.t.sol
│   ├── StreamFlowHook.t.sol
│   └── SettlementRegistry.t.sol
├── script/
│   ├── Deploy.s.sol
│   └── Setup.s.sol
├── foundry.toml
└── README.md
```

### 4.2 Deployment Plan

**Networks:**
- Arbitrum Sepolia (testnet)
- Base Sepolia (testnet)
- Arc Testnet
- Ethereum Sepolia (optional)

---

## Phase 5: Frontend Dashboard

### 5.1 Component Library

**Location:** `frontend/components/`

```
frontend/components/
├── ui/
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Table.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Modal.tsx
│   ├── ProgressBar.tsx
│   ├── StatusBadge.tsx
│   ├── Spinner.tsx
│   └── Toast.tsx
├── layout/
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── Footer.tsx
├── dashboard/
│   ├── MetricCard.tsx
│   ├── IntentTable.tsx
│   └── ChannelHealth.tsx
├── intents/
│   ├── IntentList.tsx
│   ├── IntentDetail.tsx
│   └── IntentFilters.tsx
├── channels/
│   ├── ChannelCard.tsx
│   └── ChannelActions.tsx
├── settlements/
│   ├── SettlementBatch.tsx
│   └── ArcStatus.tsx
└── agents/
    ├── AgentConfig.tsx
    ├── SpendingLimits.tsx
    └── StrategyManager.tsx
```

### 5.2 Pages

**Location:** `frontend/app/`

```
frontend/app/
├── layout.tsx
├── page.tsx              # Landing page
├── dashboard/
│   └── page.tsx          # Main dashboard
├── intents/
│   ├── page.tsx          # Intent list
│   └── [id]/
│       └── page.tsx      # Intent detail
├── channels/
│   └── page.tsx          # Channel management
├── settlements/
│   └── page.tsx          # Settlement tracking
└── agents/
    └── page.tsx          # Agent configuration
```

---

## Implementation Strategy

### Week 1: API Routes (Current Focus)

**Day 1-2: Uniswap Integration**
- [ ] Create `/api/uniswap/route.ts`
- [ ] Implement Uniswap SDK integration
- [ ] Test swap execution
- [ ] Create test script

**Day 3-4: Arc Settlement**
- [ ] Create `/api/arc/route.ts`
- [ ] Implement Arc blockchain connection
- [ ] Test settlement posting
- [ ] Create test script

**Day 5-7: Intent Management**
- [ ] Create `/api/intents/*` routes
- [ ] Implement intent creation flow
- [ ] Implement status tracking
- [ ] Implement history retrieval

### Week 2: Backend CLI

**Day 8-10: CLI Foundation**
- [ ] Set up TypeScript project
- [ ] Implement command framework
- [ ] Create ASCII art branding
- [ ] Implement wallet management

**Day 11-14: Core Commands**
- [ ] `init` command
- [ ] `stream` command
- [ ] `status` command
- [ ] `fund` command
- [ ] `history` command

### Week 3: Smart Contracts

**Day 15-17: Contract Development**
- [ ] Write IntentChannel.sol
- [ ] Write StreamFlowHook.sol
- [ ] Write SettlementRegistry.sol
- [ ] Write tests

**Day 18-21: Deployment**
- [ ] Deploy to testnets
- [ ] Verify contracts
- [ ] Create deployment scripts
- [ ] Document addresses

### Week 4: Frontend Dashboard

**Day 22-24: Component Library**
- [ ] Build UI components
- [ ] Create layout components
- [ ] Implement design system
- [ ] Test responsiveness

**Day 25-28: Pages**
- [ ] Dashboard page
- [ ] Intents page
- [ ] Channels page
- [ ] Settlements page
- [ ] Agents page

---

## Testing Strategy

### Unit Tests
- All API routes
- All CLI commands
- All smart contracts
- All SDK functions

### Integration Tests
- End-to-end intent flow
- Multi-chain operations
- Error scenarios
- Load testing

### Test Scripts
**Location:** `frontend/scripts/` and `backend/scripts/`

- `yellow-auth.js` ✅
- `uniswap-swap.js` ⏳
- `arc-settlement.js` ⏳
- `intent-flow.js` ⏳

---

## Key Learnings from Yellow Integration

### ✅ What Worked
1. **Server-side authentication** - Avoid browser wallet issues
2. **Private key on server** - Reliable signing
3. **Test scripts first** - Validate before integration
4. **Detailed logging** - Essential for debugging

### ⚠️ What to Avoid
1. **Browser wallet signing** - Inconsistent across browsers
2. **Client-side EIP-712** - Complex and error-prone
3. **Assuming SDK works** - Always test in isolation first

### 📝 Best Practices
1. **API routes for all blockchain interactions**
2. **Test scripts for each integration**
3. **Server-side private key management**
4. **Comprehensive error logging**

---

## Next Steps (Immediate)

### Priority 1: Uniswap Integration
1. Create `/api/uniswap/route.ts`
2. Install Uniswap SDK
3. Implement swap function
4. Create test script
5. Test on Arbitrum Sepolia

### Priority 2: Arc Integration
1. Research Arc blockchain SDK
2. Create `/api/arc/route.ts`
3. Implement settlement posting
4. Create test script
5. Test on Arc testnet

### Priority 3: Intent Flow
1. Design intent data structure
2. Create intent creation API
3. Implement status tracking
4. Build history retrieval
5. Test end-to-end flow

---

## Environment Variables

```env
# Yellow Network
MAIN_WALLET_PRIVATE_KEY=0x...
YELLOW_BROKER_URL=wss://clearnet-sandbox.yellow.com/ws

# Uniswap
UNISWAP_ROUTER_ADDRESS=0x...
ARBITRUM_RPC_URL=https://...
BASE_RPC_URL=https://...

# Arc
ARC_RPC_URL=https://...
ARC_SETTLEMENT_CONTRACT=0x...

# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# API Keys
ALCHEMY_API_KEY=...
INFURA_API_KEY=...
```

---

## Documentation

### Developer Docs
- [ ] API Reference
- [ ] CLI Reference
- [ ] SDK Integration Guide
- [ ] Smart Contract Docs

### User Docs
- [ ] Getting Started
- [ ] Dashboard Guide
- [ ] Troubleshooting
- [ ] FAQ

---

## Success Metrics

### Technical
- [ ] \u003c1 second intent execution
- [ ] 99%+ success rate
- [ ] Zero MEV exploitation
- [ ] \u003c$1 average gas cost

### User Experience
- [ ] CLI works on Mac/Linux/Windows
- [ ] Dashboard loads \u003c2 seconds
- [ ] Real-time status updates
- [ ] Clear error messages

---

## Resources

### Documentation
- [Yellow Network Docs](https://docs.yellow.org)
- [Uniswap v4 Docs](https://docs.uniswap.org/contracts/v4/overview)
- [Circle Arc Docs](https://developers.circle.com/arc)
- [ASI Alliance Docs](https://fetch.ai/docs)

### Code Examples
- `frontend/scripts/yellow-auth.js` - Working Yellow auth
- `frontend/lib/yellow_index.ts` - Official Yellow implementation
- PRD - Complete specifications

---

**Last Updated:** February 4, 2026  
**Next Review:** After Uniswap integration complete
