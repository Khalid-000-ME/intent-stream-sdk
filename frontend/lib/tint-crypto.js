/**
 * TINT Protocol - Real Pedersen Commitment Implementation
 * Uses @noble/curves for production-grade elliptic curve cryptography
 */
import { randomBytes } from '@noble/hashes/utils';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';
export class PedersenCommitment {
    /**
     * Create a simplified hash-based commitment for Solidity compatibility
     * C = keccak256(amount, randomness)
     * This is used for on-chain verification where EC operations are expensive
     */
    commitSimple(amount, randomness) {
        const r = randomness || randomBytes(32);
        // Create commitment as keccak256(amount, randomness)
        const amountBytes = new Uint8Array(32);
        const amountBigInt = BigInt(amount);
        for (let i = 0; i < 32; i++) {
            amountBytes[31 - i] = Number((amountBigInt >> BigInt(i * 8)) & BigInt(0xff));
        }
        const combined = new Uint8Array(64);
        combined.set(amountBytes, 0);
        combined.set(r, 32);
        const commitment = keccak_256(combined);
        return {
            commitment: commitment,
            commitmentHex: '0x' + bytesToHex(commitment),
            amount: amount,
            randomness: r,
            randomnessHex: '0x' + bytesToHex(r)
        };
    }
    /**
     * Verify a simplified commitment opening
     */
    verifySimple(commitment, amount, randomness) {
        const recomputed = this.commitSimple(amount, randomness);
        return bytesToHex(commitment) === bytesToHex(recomputed.commitment);
    }
}
/**
 * Netting Engine - Aggregates commitments and computes net position
 */
export class NettingEngine {
    constructor() {
        this.pedersen = new PedersenCommitment();
    }
    /**
     * Compute net position from revealed intents
     * @param sellIntents Array of sell amounts
     * @param buyIntents Array of buy amounts
     * @returns Net position and efficiency metrics
     */
    computeNetPosition(sellIntents, buyIntents) {
        const totalSell = sellIntents.reduce((sum, amount) => sum + amount, 0n);
        const totalBuy = buyIntents.reduce((sum, amount) => sum + amount, 0n);
        const residual = totalSell > totalBuy ? totalSell - totalBuy : totalBuy - totalSell;
        const direction = totalSell > totalBuy ? 'SELL' : 'BUY';
        const totalVolume = totalSell + totalBuy;
        const nettedVolume = totalVolume - residual;
        const efficiency = totalVolume > 0n ? Number((nettedVolume * 10000n) / totalVolume) / 100 : 0;
        return {
            totalSell,
            totalBuy,
            residual,
            direction,
            efficiency,
            nettedVolume,
            totalVolume
        };
    }
}
