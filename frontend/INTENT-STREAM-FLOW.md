# Intent-Stream SDK - Simplified Architecture
## Removing Redundancy, Fixing Settlement Flow

**Problem Identified:** Previous design had Yellow Network + TEE (redundant privacy) and backwards settlement flow

**Solution:** Yellow Network provides ALL privacy needs, proper settlement sequence

---

## Correct Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: AGENT INTENT CREATION (Off-Chain, Private)        │
│                                                             │
│  Agent 1 → Creates intent (local)                           │
│  Agent 2 → Creates intent (local)                           │
│  Agent 3 → Creates intent (local)                           │
│  ...                                                        │
│  Agent 50 → Creates intent (local)                          │
│                                                             │
│  Privacy: Intents exist only in agent's memory              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: YELLOW NETWORK STATE CHANNELS (Off-Chain, Private)│
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Yellow State Channel Protocol (Nitrolite)           │   │
│  │                                                     │   │
│  │ Agent 1 ←→ Broker (encrypted channel)               │   │
│  │ Agent 2 ←→ Broker (encrypted channel)               │   │
│  │ Agent 3 ←→ Broker (encrypted channel)               │   │
│  │ ...                                                 │   │
│  │ Agent 50 ←→ Broker (encrypted channel)              │   │
│  │                                                     │   │
│  │ Privacy Mechanisms:                                 │   │
│  │ ✓ Off-chain communication (no mempool)              │   │
│  │ ✓ Encrypted message passing                         │   │
│  │ ✓ Only broker sees decrypted intents                │   │
│  │ ✓ Broker is trusted/bonded (collateral at stake)    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Broker's Batching Queue (Private, Inside Yellow Network): │
│  ├─ ETH→USDC: [Alice: 1.5, Bob: 0.8, Carol: 2.0, ...]      │
│  ├─ USDC→ETH: [Eve: 5000, Frank: 2500, ...]                │
│  └─ WBTC→USDC: [Grace: 0.25, ...]                          │
│                                                             │
│  Trigger: Batch when 50 intents OR 500ms timeout            │
│                                                             │
│  Privacy: MEV bots CANNOT see this (Yellow Network private) │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: UNISWAP V4 EXECUTION (On-Chain, Public but Safe)  │
│                                                             │
│  Broker calls Uniswap v4 with aggregated swap:              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ StreamFlowHook.beforeSwap()                         │   │
│  │ ├─ Receives: "Swap 4.3 ETH → USDC"                  │   │
│  │ ├─ Receives: Merkle root of 50 batched intents      │   │
│  │ ├─ Verifies: Broker signature valid                 │   │
│  │ ├─ Verifies: Merkle proof matches channel states    │   │
│  │ └─ Allows swap to proceed                           │   │
│  │                                                     │   │
│  │ Uniswap executes: 4.3 ETH → 11,024 USDC             │   │
│  │                                                     │   │
│  │ StreamFlowHook.afterSwap()                          │   │
│  │ ├─ Records execution price: $2,563/ETH              │   │
│  │ ├─ Emits event with batch ID                        │   │
│  │ └─ Updates hook state (batch #847 complete)         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  What MEV bots see:                                         │
│  ├─ Single swap: 4.3 ETH → 11,024 USDC                     │
│  ├─ From: StreamFlow Broker (0xBROKER...)                  │
│  ├─ Too large to sandwich profitably                       │
│  └─ NO details about 50 individual agents                  │
│                                                             │
│  Privacy preserved: Aggregate hides individual intents      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4: YELLOW CHANNEL STATE UPDATE (Off-Chain)           │
│                                                             │
│  Broker distributes results to each channel:                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Channel #1 (Alice):                                 │   │
│  │ ├─ Old state: 5 ETH, 10,000 USDC                    │   │
│  │ ├─ Intent: Sell 1.5 ETH                             │   │
│  │ ├─ Execution: 1.5 ETH → 3,847 USDC @ $2,563         │   │
│  │ └─ New state: 3.5 ETH, 13,847 USDC                  │   │
│  │                                                     │   │
│  │ Both broker + Alice sign new state                  │   │
│  │ Old state discarded                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Similar updates for Channels #2-50]                       │
│                                                             │
│  All updates happen in Yellow Network (off-chain)           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 5: ARC SETTLEMENT (On-Chain, Periodic)               │
│                                                             │
│  Every 10 minutes OR $100K volume, broker posts to Arc:     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SettlementRegistry.postSettlement()                 │   │
│  │                                                     │   │
│  │ Data:                                               │   │
│  │ ├─ Batch IDs: #847, #848, #849, #850, #851, #852   │   │
│  │ ├─ Total batches: 6 (since last settlement)        │   │
│  │ ├─ Channel state Merkle root: 0xROOT...             │   │
│  │ ├─ Uniswap execution proofs: [TX1, TX2, TX3...]    │   │
│  │ └─ Broker signature                                │   │
│  │                                                     │   │
│  │ Gas cost: $0.0012 USDC (amortized across all)      │   │
│  │ Finality: 350ms                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Purpose of Arc Settlement:                                 │
│  ├─ Immutable audit trail (fraud detection)                 │
│  ├─ Dispute resolution (if broker cheats)                   │
│  ├─ Cross-chain coordination (reconciles all networks)      │
│  └─ Predictable costs (USDC gas fees)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Why This Works (No TEE Needed)

### Yellow Network Provides Sufficient Privacy

**Yellow's Privacy Guarantees:**

1. **Off-Chain Communication**
   - State channels never touch public blockchain mempool
   - Messages sent peer-to-peer (agent → broker)
   - WebSocket/libp2p connections (encrypted transport)

2. **No On-Chain Intent Broadcasting**
   - Traditional DeFi: Intent → Mempool (PUBLIC) → Execution
   - Yellow: Intent → State Channel (PRIVATE) → Execution
   - MEV bots have no mempool to watch

3. **Trusted Broker with Economic Security**
   - Broker posts collateral (100 ETH + 10,000 FET)
   - If broker reveals intents to MEV bots → Slashed
   - If broker executes unfairly → Slashed
   - Economic incentive keeps broker honest

4. **Cryptographic Commitments**
   - Broker can't lie about batch contents (Merkle proofs)
   - Agents verify execution prices against Uniswap TX
   - Arc settlement provides audit trail
   - Fraud provably detectable

**Why TEE/SGX is Overkill:**

```
TEE adds:
❌ Hardware complexity (Intel SGX setup)
❌ Remote attestation overhead
❌ Limited to SGX-compatible servers
❌ Single point of failure (SGX vulnerability)

Yellow already provides:
✅ Off-chain privacy (no mempool exposure)
✅ Encrypted communication
✅ Economic security (bonded broker)
✅ Cryptographic verification (Merkle proofs)
```

**For HackMoney judging:**
- Simpler architecture = easier to explain
- Fewer dependencies = easier to demo
- Yellow Network is the star (sponsor wants this highlighted)
- TEE would distract from core innovation

---

## Settlement Sequence (CORRECT ORDER)

### Why Arc AFTER Uniswap, Not Before

**Wrong (Previous Design):**
```
Yellow → Arc Settlement → Uniswap Execution
          ↑
    Settling what? Nothing executed yet!
```

**Correct (New Design):**
```
Yellow → Uniswap Execution → Arc Settlement
                               ↑
                         Settling actual trades
```

### Detailed Sequence

**Step 1: Intent Accumulation (Yellow Network)**
```
00:00.000 - Alice submits: Sell 1.5 ETH
00:00.124 - Bob submits: Sell 0.8 ETH
00:00.287 - Carol submits: Sell 2.0 ETH
00:00.445 - Dave submits: Sell 0.3 ETH
...
00:00.500 - 50 intents accumulated in broker's Yellow channels

All private, all off-chain, MEV bots see nothing
```

**Step 2: Uniswap Execution (On-Chain, but Aggregated)**
```
00:00.501 - Broker prepares aggregated swap
            ├─ Total: 4.6 ETH to sell
            ├─ Generates Merkle root of 50 intents
            └─ Signs transaction

00:00.502 - Broker calls StreamFlowHook on Uniswap v4
            ├─ Hook verifies Merkle proof
            ├─ Hook validates broker signature
            └─ Hook allows swap

00:00.723 - Uniswap executes: 4.6 ETH → 11,793 USDC
            ├─ Average price: $2,563/ETH
            └─ TX hash: 0xUNISWAP_TX...

MEV bots see aggregate swap (too large to sandwich)
Individual intents still hidden
```

**Step 3: Yellow Channel Updates (Off-Chain)**
```
00:00.724 - Broker calculates pro-rata distribution
            ├─ Alice: 1.5 ETH → 3,847 USDC
            ├─ Bob: 0.8 ETH → 2,051 USDC
            ├─ Carol: 2.0 ETH → 5,126 USDC
            └─ Dave: 0.3 ETH → 769 USDC

00:00.725 - Broker updates each channel state
            ├─ Channel #1: Sign new state with Alice
            ├─ Channel #2: Sign new state with Bob
            ├─ Channel #3: Sign new state with Carol
            └─ Channel #4: Sign new state with Dave

00:00.950 - All 50 channels updated (off-chain)
            └─ Each agent has mutually-signed new balance

Agents can verify: Their result matches Uniswap TX price
```

**Step 4: Arc Settlement (Periodic, Every 10 min)**
```
[10 minutes later, after 100+ batches]

10:00.000 - Broker aggregates all batches since last settlement
            ├─ Batches: #847-947 (100 batches)
            ├─ Intents: 5,000 total
            ├─ Channels: 500 unique agents
            └─ Uniswap TXs: [0xTX1, 0xTX2, ..., 0xTX100]

10:00.001 - Broker posts to Arc SettlementRegistry
            ├─ Merkle root: 0xROOT (all channel states)
            ├─ Uniswap proof array: [TX1, TX2, ...]
            ├─ Gas: $0.0012 USDC
            └─ Finality: 350ms

10:00.351 - Settlement confirmed on Arc
            ├─ Block: #8473920
            ├─ Immutable audit trail created
            └─ Agents can verify correctness

Purpose: Fraud detection, not real-time execution
```

---

## Why Arc Settlement is NOT Pre-Execution

### What Arc Settlement Actually Does

**Arc is NOT for:**
- ❌ Executing trades (Uniswap does this)
- ❌ Real-time confirmation (Yellow channels do this)
- ❌ Pre-funding swaps (agents pre-fund channels)

**Arc IS for:**
1. **Immutable Audit Trail**
   ```
   Agent suspects fraud:
   ├─ Checks Arc settlement (batch #847)
   ├─ Fetches Uniswap TX (0xUNISWAP_TX)
   ├─ Compares: Expected vs actual
   └─ Submits fraud proof if mismatch
   ```

2. **Dispute Resolution**
   ```
   Alice claims: "Broker said 3,500 USDC but I should get 3,847"
   
   Verification:
   ├─ Arc shows batch #847 Merkle root
   ├─ Alice provides Merkle proof for her intent
   ├─ Uniswap TX shows actual execution price
   ├─ Math proves broker wrong
   └─ Broker slashed, Alice compensated
   ```

3. **Cross-Chain Reconciliation**
   ```
   Agent has intents on:
   ├─ Arbitrum: 10 intents (5 ETH total)
   ├─ Base: 8 intents (3 ETH total)
   └─ Ethereum: 5 intents (2 ETH total)
   
   Arc settlement posts:
   ├─ Net positions across all chains
   ├─ Single source of truth
   └─ Atomic verification (all or nothing)
   ```

4. **Predictable Cost Amortization**
   ```
   Without Arc (settling on Ethereum):
   ├─ 100 batches × $20 gas = $2,000
   
   With Arc:
   ├─ 1 settlement × $0.0012 = $0.0012
   ├─ Amortized: $0.0012 ÷ 100 = $0.000012 per batch
   └─ 166,666× cheaper!
   ```

---

## Simplified Data Flow

### Single Intent Journey

```
[Alice's Computer]
├─ Decide: Sell 1.5 ETH for USDC
├─ Create intent object
├─ Sign with agent key (EIP-712)
└─ Send to broker via Yellow channel (encrypted WebSocket)
           ↓
[Yellow Network - Off-Chain]
├─ Broker receives in Yellow channel
├─ Decrypts (broker is trusted, bonded)
├─ Adds to batching queue (private)
├─ Waits for 49 more intents OR 500ms
└─ Batch ready: 50 intents, 4.6 ETH total
           ↓
[Uniswap v4 - On-Chain]
├─ Broker calls hook with aggregate: 4.6 ETH → USDC
├─ Hook verifies Merkle proof (50 intents committed)
├─ Swap executes: 4.6 ETH → 11,793 USDC
└─ TX confirmed on Arbitrum
           ↓
[Yellow Network - Off-Chain]
├─ Broker calculates Alice's share: 1.5/4.6 × 11,793 = 3,847 USDC
├─ Updates Alice's channel: -1.5 ETH, +3,847 USDC
├─ Both sign new state
└─ Alice receives execution proof
           ↓
[Arc - On-Chain, Later]
├─ 10 minutes pass, 100 batches accumulate
├─ Broker posts settlement to Arc
├─ Alice can verify her batch (#847) included
└─ Permanent audit trail created

Total time: 1.2 seconds (mostly Uniswap execution)
MEV exposure: Zero (intent never in mempool)
Cost: $0.000012 amortized settlement
```

---

## Updated Smart Contracts

### No Changes Needed to Yellow

Yellow's Nitrolite already handles:
- State channels
- Off-chain messaging
- Encrypted communication
- Dispute resolution

We just USE Yellow as-is.

### Simplified Uniswap v4 Hook

```solidity
// StreamFlowHook.sol
contract StreamFlowHook is BaseHook {
    
    mapping(address => bool) public trustedBrokers;
    mapping(bytes32 => bool) public executedBatches;
    
    struct BatchProof {
        bytes32 merkleRoot;      // Root of 50 intent Merkle tree
        bytes32[] intentHashes;  // Individual intent commitments
        bytes signature;         // Broker signature
    }
    
    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4) {
        // Only trusted brokers can call
        require(trustedBrokers[sender], "Unauthorized broker");
        
        // Decode batch proof
        BatchProof memory proof = abi.decode(hookData, (BatchProof));
        
        // Verify broker signature
        address signer = recoverSigner(proof.merkleRoot, proof.signature);
        require(signer == sender, "Invalid signature");
        
        // Prevent replay attacks
        bytes32 batchId = keccak256(abi.encode(proof.merkleRoot, block.number));
        require(!executedBatches[batchId], "Batch already executed");
        executedBatches[batchId] = true;
        
        // Verify Merkle tree is well-formed
        require(proof.intentHashes.length >= 1, "Empty batch");
        require(verifyMerkleRoot(proof.merkleRoot, proof.intentHashes), "Invalid Merkle proof");
        
        // Allow swap to proceed
        return BaseHook.beforeSwap.selector;
    }
    
    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external override returns (bytes4) {
        // Emit event for off-chain verification
        BatchProof memory proof = abi.decode(hookData, (BatchProof));
        
        emit BatchExecuted(
            proof.merkleRoot,
            delta.amount0(),  // Amount in
            delta.amount1(),  // Amount out
            block.timestamp
        );
        
        return BaseHook.afterSwap.selector;
    }
    
    function verifyMerkleRoot(
        bytes32 root,
        bytes32[] memory leaves
    ) internal pure returns (bool) {
        // Simple Merkle tree verification
        // Production: Use OpenZeppelin's MerkleProof
        bytes32 computedRoot = leaves[0];
        for (uint i = 1; i < leaves.length; i++) {
            computedRoot = keccak256(abi.encodePacked(computedRoot, leaves[i]));
        }
        return computedRoot == root;
    }
    
    function recoverSigner(bytes32 hash, bytes memory sig) internal pure returns (address) {
        // ECDSA signature recovery
        // Production: Use OpenZeppelin's ECDSA
        // ...
    }
}
```

**Key Points:**
- No TEE/SGX complexity
- Just verifies broker is authorized
- Validates Merkle proof structure
- Prevents double-execution
- Emits event for agents to verify

### Simplified Arc Settlement Contract

```solidity
// SettlementRegistry.sol on Arc
contract SettlementRegistry {
    
    struct Settlement {
        bytes32 channelStateRoot;     // Merkle root of all channel states
        bytes32[] uniswapTxHashes;    // Uniswap execution proofs
        uint256 timestamp;
        address broker;
    }
    
    mapping(uint256 => Settlement) public settlements;
    uint256 public settlementCount;
    
    event SettlementPosted(
        uint256 indexed settlementId,
        bytes32 channelStateRoot,
        address indexed broker,
        uint256 batchCount
    );
    
    function postSettlement(
        bytes32 channelStateRoot,
        bytes32[] calldata uniswapTxHashes
    ) external {
        // In production: verify broker is authorized
        
        settlements[settlementCount] = Settlement({
            channelStateRoot: channelStateRoot,
            uniswapTxHashes: uniswapTxHashes,
            timestamp: block.timestamp,
            broker: msg.sender
        });
        
        emit SettlementPosted(
            settlementCount,
            channelStateRoot,
            msg.sender,
            uniswapTxHashes.length
        );
        
        settlementCount++;
    }
    
    function verifyChannelState(
        uint256 settlementId,
        bytes32 channelId,
        bytes32[] calldata proof
    ) external view returns (bool) {
        // Agent can verify their channel state was included
        Settlement memory settlement = settlements[settlementId];
        return MerkleProof.verify(proof, settlement.channelStateRoot, channelId);
    }
}
```

**Key Points:**
- Just stores settlement data (audit trail)
- No complex logic (simplicity = security)
- Agents verify inclusion with Merkle proofs
- USDC gas fees (predictable costs)

---

## Benefits of Simplified Architecture

### 1. Easier to Explain to Judges

**Before (Confusing):**
> "We use Yellow for privacy, then TEE for more privacy, then settle on Arc before executing on Uniswap..."
> 
> Judge: "Wait, why two privacy layers? Why settle before execution?"

**After (Clear):**
> "Yellow channels keep intents private off-chain. Broker batches them and executes on Uniswap. Arc provides audit trail. Simple."
> 
> Judge: "Ah, makes sense!"

### 2. Fewer Points of Failure

**Removed:**
- ❌ SGX hardware requirement
- ❌ Remote attestation complexity
- ❌ TEE key management
- ❌ Confusing settlement order

**Result:**
- ✅ Easier to deploy
- ✅ Easier to test
- ✅ Easier to demo
- ✅ More reliable

### 3. Better Sponsor Alignment

**Yellow Network:**
- ✓ Front and center (sole privacy provider)
- ✓ Clear use case (state channels for intent streaming)
- ✓ Novel application (not just payments)

**Uniswap v4:**
- ✓ Clean hook implementation
- ✓ MEV protection mechanism
- ✓ Batched execution innovation

**Arc:**
- ✓ Clear purpose (audit trail, not execution)
- ✓ USDC-native settlement
- ✓ Cost amortization benefit

### 4. Hackathon Feasibility

**Before:**
- Week 1: Yellow integration
- Week 2: TEE/SGX setup (hard!)
- Week 3: Uniswap hooks
- Week 4: Arc settlement
- Result: Rushed, incomplete

**After:**
- Week 1: Yellow integration
- Week 2: Uniswap hooks (no TEE complexity)
- Week 3: Arc settlement
- Week 4: Polish, testing, demo
- Result: Complete, polished submission

---

## Security Without TEE

### How Privacy is Maintained

**Q: Without TEE, can broker see intents?**

A: Yes, but:
1. Broker is economically bonded (100 ETH + 10,000 FET collateral)
2. If broker leaks intents to MEV bots, they get slashed
3. Agents can detect fraud via Arc settlement verification
4. Broker profits more from honest operation than one-time fraud

**Q: Can MEV bots bribe the broker?**

A: Possible, but:
1. Broker's reputation destroyed (multi-million dollar business)
2. Slashing penalty > bribe amount
3. Multiple competing brokers (agents choose honest ones)
4. DAO governance can slash malicious brokers

**Q: What if broker goes rogue?**

A: Agents protected:
1. Funds in Yellow channels (broker can't steal)
2. Emergency withdrawal mechanism (close channel anytime)
3. Arc settlement proves fraud (automatic slashing)
4. Agents only lose execution efficiency, not funds

### Economic Security Model

```
Broker Incentives:
✓ Earn fees: 0.01% of volume ($100/day for $1M volume)
✓ Build reputation: More agents → More fees
✓ Long-term business: Sustainable profit model

Broker Risks:
✗ Slashing: Lose 100 ETH + 10,000 FET ($250K+)
✗ Reputation loss: Lose all future fee income
✗ Criminal liability: Fraud is prosecutable

Rational broker → Stays honest
```

---

## Final Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                         INTENT-STREAM SDK                       │
│                                                                │
│  Agent ──┐                                                     │
│  Agent ──┤                                                     │
│  Agent ──┤─→ Yellow Network ──→ Uniswap v4 ──→ Arc Settlement  │
│  Agent ──┤    (Private)          (Execution)    (Audit Trail) │
│  Agent ──┘                                                     │
│                                                                │
│  Privacy: Yellow channels (off-chain, encrypted)               │
│  Execution: Uniswap hooks (on-chain, aggregated)               │
│  Settlement: Arc (on-chain, periodic, cheap)                   │
│                                                                │
│  Result: MEV-proof, sub-second, USDC-native agent trading      │
└────────────────────────────────────────────────────────────────┘
```

**Three layers, each with clear purpose:**
1. **Yellow:** Privacy (off-chain state channels)
2. **Uniswap:** Execution (on-chain aggregated swaps)
3. **Arc:** Settlement (on-chain audit trail)

**No redundancy, no confusion, easy to explain.**

---

## Summary of Changes

**Removed:**
- ❌ TEE/SGX complexity (Yellow already provides privacy)
- ❌ Pre-execution Arc settlement (backwards logic)
- ❌ Confusing privacy layers

**Simplified:**
- ✅ Yellow Network as sole privacy provider
- ✅ Uniswap executes trades (on-chain)
- ✅ Arc settles afterward (audit trail)
- ✅ Clear sequence: Intent → Batch → Execute → Settle

**Result:**
- Simpler architecture
- Easier to build in 4 weeks
- Easier to explain to judges
- Better sponsor alignment
- More reliable system

This is the architecture we should build for HackMoney 2026!