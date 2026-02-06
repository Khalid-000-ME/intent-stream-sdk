Message Envelope (RPC Protocol)
In this guide, you will learn the essentials of how messages are structured and transmitted in Yellow Network.

Goal: Understand the Nitro RPC protocol at a conceptual level.

Protocol Overview
Nitro RPC is a lightweight RPC protocol optimized for state channel communication:

Feature	Benefit
Compact format	~30% smaller than traditional JSON-RPC
Signature-based auth	Every message is cryptographically verified
Bidirectional	Real-time updates via WebSocket
Ordered timestamps	Replay attack prevention
Message Structure
Every Nitro RPC message uses a compact JSON array format:

Component	Type	Description
requestId	uint64	Unique identifier for correlation
method	string	RPC method name (snake_case)
params/result	object	Method-specific data
timestamp	uint64	Unix milliseconds
Request Wrapper
{ "req": [requestId, method, params, timestamp], "sig": [...] }

Response Wrapper
{ "res": [requestId, method, result, timestamp], "sig": [...] }

Error Response
{ "res": [requestId, "error", { "error": "description" }, timestamp], "sig": [...] }

Signature Format
Each signature is a 65-byte ECDSA signature (r + s + v) represented as a 0x-prefixed hex string.

Context	What's Signed	Who Signs
Requests	JSON payload hash	Session key (or main wallet)
Responses	JSON payload hash	Clearnode
Method Categories
Category	Methods
Auth	auth_request, auth_verify
Channels	create_channel, close_channel, resize_channel
Transfers	transfer
App Sessions	create_app_session, submit_app_state, close_app_session
Queries	get_ledger_balances, get_channels, get_app_sessions, etc.
Notifications
The Clearnode pushes real-time updates:

Notification	When Sent
bu (balance update)	Balance changed
cu (channel update)	Channel status changed
tr (transfer)	Incoming/outgoing transfer
asu (app session update)	App session state changed
Communication Flow
Clearnode
Client
Clearnode
Client
Request (signed)
Verify signature
Process
Response (signed)
Verify signature
Notification (async)
Protocol Versions
Version	Status	Key Features
NitroRPC/0.2	Legacy	Basic state updates
NitroRPC/0.4	Current	Intent system, enhanced validation
Always use NitroRPC/0.4 for new implementations.

Key Points
Compact arrays instead of verbose JSON objects
Every message signed for authenticity
Timestamps prevent replay attacks
Bidirectional WebSocket for real-time updates
Deep Dive
For complete technical specifications:

Message Format — Full format specification
Off-Chain Overview — Protocol architecture
Implementation Checklist — Building RPC support
Edit this page


Challenge-Response & Disputes
In this guide, you will learn how Yellow Network resolves disputes and ensures your funds are always recoverable.

Goal: Understand the security guarantees that make off-chain transactions safe.

Why Challenge-Response Matters
In any off-chain system, a critical question arises: What if someone tries to cheat?

State channels solve this with a challenge-response mechanism:

Anyone can submit a state to the blockchain
Counterparties have time to respond with a newer state
The newest valid state always wins
Funds are distributed according to that state
The Trust Model
State channels are trustless because:

Guarantee	How It's Achieved
Fund custody	Smart contract holds funds, not Clearnode
State validity	Only signed states are accepted
Dispute resolution	On-chain fallback if disagreement
Recovery	You can always get your funds back
Channel Dispute Flow
Scenario: Clearnode Becomes Unresponsive
You have a channel with 100 USDC. The Clearnode stops responding.

Your options:

Wait for Clearnode to recover
Force settlement on-chain via challenge
The Process
Initiate Challenge: Submit your latest signed state to the blockchain
Challenge Period: Contract sets a timer (e.g., 24 hours)
Response Window: Counterparty can submit a newer state
Resolution: After timeout, challenged state becomes final
challenge()

checkpoint() with newer state

Timeout expires

ACTIVE

DISPUTE

FINAL

Anyone can submit
newer valid state

Why This Works
States Are Ordered
Every state has a version number. A newer (higher version) state always supersedes older states.

States Are Signed
With the default SimpleConsensus adjudicator, both parties must sign every state. If someone signed a state, they can't later claim they didn't agree.

Other Adjudicators
Different adjudicators may have different signing requirements. For example, a Remittance adjudicator may only require the sender's signature. The signing rules are defined by the channel's adjudicator contract.

Challenge Period Provides Fairness
The waiting window ensures honest parties have time to respond. Network delays don't cause losses.

On-Chain Contract is Neutral
The smart contract accepts any valid signed state, picks the highest version, and distributes funds exactly as specified.

Challenge Period Selection
Duration	Trade-offs
1 hour	Fast resolution, tight response window
24 hours	Balanced (recommended)
7 days	Maximum safety, slow settlement
The Custody Contract enforces a minimum of 1 hour.

Checkpoint vs Challenge
Operation	Purpose	Channel Status
checkpoint()	Record state without dispute	Stays ACTIVE
challenge()	Force dispute resolution	Changes to DISPUTE
Use checkpoint for safety snapshots. Use challenge when you need to force settlement.

What Happens If...
Scenario	Outcome
Clearnode goes offline	Challenge with latest state, withdraw after timeout
You lose state history	Challenge with old state; counterparty submits newer if they have it
Counterparty submits wrong state	Submit your newer state via checkpoint
Block reorg occurs	Replay events from last confirmed block
Key Takeaways
Concept	Remember
Challenge	Force on-chain dispute resolution
Response	Submit newer state to defeat challenge
Timeout	After period, challenged state becomes final
Checkpoint	Record state without dispute
Security Guarantee
You can always recover your funds according to the latest mutually signed state, regardless of counterparty behavior.

Deep Dive
For technical implementation details:

Channel Lifecycle — Full state machine
Security Considerations — Threat model and best practices
Communication Flows — Sequence diagrams
Edit this page