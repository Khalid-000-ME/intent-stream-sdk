
# Intent Stream Page Implementation

A new page has been added to the UniFlow frontend to enable natural language intent processing.

## Key Features

1.  **Natural Language Input**:
    - Users can type prompts like "Swap 1 ETH to USDC" or "Pay 0.1 USDC to 0x123...".
    - The `Analyze Intent` button sends this prompt to the AI Agent API (`/api/agent/intelligent`).

2.  **Agent Workflow Integration**:
    - **Wallet Connection**: Connects the user's browser wallet for authentication.
    - **Agent Registration**: Automatically registers an agent session payload for the user upon connection.
    - **AI Parsing**: Uses the backend Gemini agent to parse text into structured intents (SWAP or PAYMENT).

3.  **Review & Execution**:
    - **Review Step**: Displays the parsed intent details (Type, Amount, Token/Recipient) for user approval.
    - **Execution Pipeline**: Visualizes the steps:
        - Handshake
        - Authentication
        - Channel Setup
        - Encryption
        - Execution
        - Settlement
    - **Live Logs**: Shows real-time status updates from the backend execution process.

## Routes Used
- `/api/agent/create`: To register the user's session.
- `/api/agent/intelligent`: To parse the prompt.
- `/api/yellow/auth`: To authenticate the intent.
- `/api/yellow/create-channel`: To set up the state channel.
- `/api/intent/submit`: To submit the intent for execution.
- `/api/intent-flow`: To poll for status updates.

## UI Components
- Reuses `Navbar` and `StorkTicker` for consistency.
- Uses the same dark/yellow theme as `SwappingPage` and `Dashboard`.
- Implements a responsive grid layout with Input/Review on the left and Status/Logs on the right.
