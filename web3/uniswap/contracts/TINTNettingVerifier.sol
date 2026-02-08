// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";

/// @title TINTNettingVerifier - Simplified Netting Verification Contract
/// @notice Verifies commitment openings and netting calculations off-hook
/// @dev This can be called before submitting to Uniswap to verify netting correctness
contract TINTNettingVerifier {
    using PoolIdLibrary for PoolKey;

    struct NetProof {
        bytes32[] commitments;        // All agent commitments
        uint256[] amounts;            // Revealed amounts
        bytes32[] randomness;         // Opening randomness
        bool[] directions;            // true = sell, false = buy
        uint256 totalSell;            // Sum of sell amounts
        uint256 totalBuy;             // Sum of buy amounts
        uint256 residual;             // Net position to execute
    }

    struct IntentCommitment {
        bytes32 commitment;
        address agent;
        bool isSell;
        uint256 timestamp;
    }

    // Pool-specific commitment storage
    mapping(PoolId => IntentCommitment[]) public poolCommitments;
    mapping(PoolId => uint256) public lastNettingBlock;
    
    // Events
    event IntentCommitted(PoolId indexed poolId, address indexed agent, bytes32 commitment, bool isSell);
    event NettingVerified(PoolId indexed poolId, uint256 totalSell, uint256 totalBuy, uint256 residual, uint256 efficiency);
    event CommitmentVerified(bytes32 commitment, uint256 amount, bool valid);

    /// @notice Submit a commitment for an intent
    function commitIntent(
        PoolKey calldata key,
        bytes32 commitment,
        bool isSell
    ) external {
        PoolId poolId = key.toId();
        
        poolCommitments[poolId].push(IntentCommitment({
            commitment: commitment,
            agent: msg.sender,
            isSell: isSell,
            timestamp: block.timestamp
        }));

        emit IntentCommitted(poolId, msg.sender, commitment, isSell);
    }

    /// @notice Verify a commitment opening: C = keccak256(amount, randomness)
    function verifyCommitment(
        bytes32 commitment,
        uint256 amount,
        bytes32 randomness
    ) public pure returns (bool) {
        bytes32 computed = keccak256(abi.encodePacked(amount, randomness));
        return computed == commitment;
    }

    /// @notice Verify a complete netting proof
    /// @return isValid Whether the proof is valid
    /// @return netAmount The verified net amount that should be swapped
    function verifyNetProof(
        PoolKey calldata key,
        NetProof calldata proof
    ) external returns (bool isValid, uint256 netAmount) {
        PoolId poolId = key.toId();

        // Verify all commitment openings
        require(proof.commitments.length == proof.amounts.length, "Length mismatch");
        require(proof.commitments.length == proof.randomness.length, "Length mismatch");
        require(proof.commitments.length == proof.directions.length, "Length mismatch");

        uint256 computedSell = 0;
        uint256 computedBuy = 0;

        for (uint256 i = 0; i < proof.commitments.length; i++) {
            // Verify commitment opening
            bool valid = verifyCommitment(
                proof.commitments[i],
                proof.amounts[i],
                proof.randomness[i]
            );
            require(valid, "Invalid commitment opening");
            emit CommitmentVerified(proof.commitments[i], proof.amounts[i], valid);

            // Accumulate totals
            if (proof.directions[i]) {
                computedSell += proof.amounts[i];
            } else {
                computedBuy += proof.amounts[i];
            }
        }

        // Verify arithmetic
        require(computedSell == proof.totalSell, "Sell total mismatch");
        require(computedBuy == proof.totalBuy, "Buy total mismatch");

        // Verify residual calculation
        uint256 netPosition = proof.totalSell > proof.totalBuy 
            ? proof.totalSell - proof.totalBuy
            : proof.totalBuy - proof.totalSell;
        require(netPosition == proof.residual, "Residual mismatch");

        // Calculate netting efficiency
        uint256 totalVolume = proof.totalSell + proof.totalBuy;
        uint256 nettedVolume = totalVolume > proof.residual ? totalVolume - proof.residual : 0;
        uint256 efficiency = totalVolume > 0 ? (nettedVolume * 100) / totalVolume : 0;

        emit NettingVerified(poolId, proof.totalSell, proof.totalBuy, proof.residual, efficiency);
        
        lastNettingBlock[poolId] = block.number;

        return (true, proof.residual);
    }

    /// @notice Get all pending commitments for a pool
    function getPoolCommitments(PoolKey calldata key) external view returns (IntentCommitment[] memory) {
        return poolCommitments[key.toId()];
    }

    /// @notice Get commitment count for a pool
    function getCommitmentCount(PoolKey calldata key) external view returns (uint256) {
        return poolCommitments[key.toId()].length;
    }
}
