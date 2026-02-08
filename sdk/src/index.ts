/**
 * TINT Protocol SDK
 * Privacy-preserving intent execution with cryptographic netting
 */

export { PedersenCommitment, NettingEngine } from './crypto/commitments';
export { YellowAPIClient } from './network/yellow';
export { TintClient } from './client/tint';
export { TintAgent } from './agent/gemini';

export type {
    SimpleCommitment,
    NetResult
} from './crypto/commitments';

export type {
    IntentParams,
    ExecutionResult,
    TintClientConfig
} from './client/tint';

export type {
    ParsedIntent,
    AgentConfig
} from './agent/gemini';
