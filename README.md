# Intent-Stream-SDK

**The Visa Network for AI Agent Trading**

Sub-second, MEV-proof DeFi execution through intent streaming using Yellow Network state channels, Uniswap v4 hooks, and Circle Arc settlement.

---

## 🎯 Overview

Intent-Stream-SDK solves the $12.5B annual MEV problem in agentic DeFi trading by:
- **Yellow State Channels** - Private mempool for encrypted intents (100k+ TPS)
- **Uniswap v4 Hooks** - MEV-resistant execution gates
- **Arc Blockchain** - USDC-native settlement (\u003c350ms finality)
- **ASI Agents** - Autonomous payment executors

**Result:** \u003c1 second execution, zero MEV, 98% cost reduction

---

## 📁 Project Structure

```
UniFlow/
├── frontend/          # Next.js Web Dashboard + API Routes
├── backend/           # CLI SDK + Integration Logic
├── web3/             # Smart Contracts
├── INTENT_STREAM_SDK_PRD.md      # Complete specifications
├── IMPLEMENTATION_PLAN.md         # Development roadmap
└── STATUS.md                      # Current progress
```

---

## ✅ Current Status

### Completed
- ✅ Yellow Network integration (server-side auth)
- ✅ API routes foundation
- ✅ Project structure and documentation

### In Progress
- 🚧 Uniswap SDK integration
- 🚧 Intent management APIs
- 🚧 Arc settlement integration

### Next Steps
- ⏳ CLI SDK development
- ⏳ Smart contracts
- ⏳ Web dashboard UI

**See [STATUS.md](./STATUS.md) for detailed progress**

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn
- MetaMask or compatible wallet

### Installation

```bash
# Clone repository
git clone <repo-url>
cd UniFlow

# Install frontend dependencies
cd frontend
npm install

# Start development server
npm run dev
```

### Environment Variables

Create `frontend/.env.local`:

```env
MAIN_WALLET_PRIVATE_KEY=0x...
YELLOW_BROKER_URL=wss://clearnet-sandbox.yellow.com/ws
ARBITRUM_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
BASE_RPC_URL=https://sepolia.base.org
```

---

## 🧪 Testing

### Yellow Network Authentication

```bash
cd frontend
node scripts/yellow-auth.js
```

**Expected Output:**
```
🔑 Main wallet address: 0x...
🔑 Session key address: 0x...
✅ Connected to Yellow Network Sandbox
✅ AUTHENTICATION SUCCESSFUL!
```

### API Routes

```bash
# Test Uniswap balance
curl -X POST http://localhost:3000/api/uniswap \
  -H "Content-Type: application/json" \
  -d '{"action":"get_balance","network":"arbitrum"}'

# Create intent
curl -X POST http://localhost:3000/api/intents/create \
  -H "Content-Type: application/json" \
  -d '{"fromToken":"ETH","toToken":"USDC","amount":"1.5","network":"arbitrum"}'

# Get intent status
curl http://localhost:3000/api/intents/status?id=0x...

# Get intent history
curl http://localhost:3000/api/intents/history?limit=10
```

---

## 📖 Documentation

### Core Documents
- **[PRD](./INTENT_STREAM_SDK_PRD.md)** - Complete product requirements
- **[Implementation Plan](./IMPLEMENTATION_PLAN.md)** - Development roadmap
- **[Status](./STATUS.md)** - Current progress and next steps

### API Routes

#### Yellow Network
- `POST /api/yellow-full` - Yellow Network operations
  - `action: connect` - Establish WebSocket connection
  - `action: auth_full` - Authenticate (server-side)
  - `action: get_balances` - Get ledger balances
  - `action: disconnect` - Close connection

#### Uniswap
- `POST /api/uniswap` - Uniswap operations
  - `action: get_quote` - Get swap quote
  - `action: execute_swap` - Execute swap
  - `action: get_balance` - Get token balance

#### Intents
- `POST /api/intents/create` - Create new intent
- `GET /api/intents/status?id={id}` - Get intent status
- `GET /api/intents/history?limit={n}` - Get intent history

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AI AGENT LAYER                          │
│  (ASI Alliance Agents with FET-based authorization)          │
└──────────────────┬──────────────────────────────────────────┘
                   │ Intent Submission
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              YELLOW STATE CHANNEL LAYER                      │
│  • Nitrolite SDK (ERC-7824)                                  │
│  • Private intent streaming (encrypted)                      │
│  • Multi-chain liability tracking                            │
└──────────────────┬──────────────────────────────────────────┘
                   │ Batched Execution
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              UNISWAP V4 EXECUTION LAYER                      │
│  • Custom hooks (beforeSwap, afterSwap)                      │
│  • Agent-gated pools (pre-validation)                        │
│  • MEV protection via state channel gates                    │
└──────────────────┬──────────────────────────────────────────┘
                   │ Net Settlement
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              ARC SETTLEMENT LAYER                            │
│  • USDC-native gas fees                                      │
│  • Sub-second finality (\u003c350ms)                              │
│  • Periodic netting of cross-chain positions                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
- Next.js 15 (App Router)
- TypeScript 5.3+
- Tailwind CSS 4.0
- Viem v2 (Ethereum interactions)

### Backend (CLI)
- Node.js 20+
- TypeScript 5.3+
- Commander.js (CLI framework)
- Ethers.js v6

### Smart Contracts
- Solidity 0.8.24
- Foundry (testing & deployment)

### Integrations
- Yellow Network (Nitrolite SDK)
- Uniswap v4 (Hooks)
- Circle Arc (Settlement)
- ASI Alliance (Agent authorization)

---

## 📝 Development Workflow

### 1. API Routes First
All blockchain interactions happen through Next.js API routes:
- Centralized logic
- Easier testing
- Better error handling
- Server-side private key management

### 2. Test Scripts
Create test scripts before integration:
- `scripts/yellow-auth.js` ✅
- `scripts/uniswap-test.js` 🚧
- `scripts/arc-settlement.js` ⏳
- `scripts/intent-flow.js` ⏳

### 3. Mock Data Phase
Build with mock data first, then integrate real SDKs:
- Faster iteration
- Parallel frontend development
- Clear integration points

---

## 🎯 Roadmap

### Week 1: Core Infrastructure ✅
- [x] Yellow Network integration
- [x] API routes foundation
- [x] Project structure

### Week 2: API Completion 🚧
- [ ] Uniswap SDK integration
- [ ] Arc settlement integration
- [ ] End-to-end intent flow

### Week 3: CLI Development ⏳
- [ ] Command framework
- [ ] Core commands (init, stream, status)
- [ ] Interactive features

### Week 4: Smart Contracts ⏳
- [ ] IntentChannel.sol
- [ ] StreamFlowHook.sol
- [ ] SettlementRegistry.sol
- [ ] Deployment to testnets

### Week 5: Frontend Dashboard ⏳
- [ ] Component library
- [ ] Dashboard pages
- [ ] Real-time updates

---

## 🤝 Contributing

This is a HackMoney 2026 submission. Development is currently focused on core functionality.

---

## 📄 License

MIT

---

## 🔗 Links

- [Yellow Network](https://yellow.org)
- [Uniswap v4](https://docs.uniswap.org/contracts/v4/overview)
- [Circle Arc](https://developers.circle.com/arc)
- [ASI Alliance](https://fetch.ai)

---

**Built with ❤️ for HackMoney 2026**
