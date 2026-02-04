// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SettlementRegistry
 * @notice Settles net positions from the Intent-Stream network onto the Arc blockchain.
 * @dev Deployed on Circle Arc (USDC-native chain).
 */
contract SettlementRegistry is Ownable {
    using SafeERC20 for IERC20;

    // The Settlement Token (USDC on Arc)
    IERC20 public immutable settlementToken;

    // Events
    event SettlementPosted(
        bytes32 indexed batchId,
        uint256 timestamp,
        uint256 totalVolume,
        uint256 netSettlementAmount
    );

    event TraderSettled(
        bytes32 indexed batchId,
        address indexed trader,
        int256 netAmount
    );

    // Structs
    struct BatchSettlement {
        bytes32 batchId;
        uint256 timestamp;
        uint256 totalVolume;
        bool finalized;
    }

    mapping(bytes32 => BatchSettlement) public settlements;
    mapping(address => bool) public authorizedBrokers;

    constructor(address _settlementToken) Ownable(msg.sender) {
        settlementToken = IERC20(_settlementToken);
    }

    modifier onlyBroker() {
        require(authorizedBrokers[msg.sender] || msg.sender == owner(), "Not authorized broker");
        _;
    }

    function setBroker(address broker, bool active) external onlyOwner {
        authorizedBrokers[broker] = active;
    }

    /**
     * @notice Post a batch settlement to the registry.
     * @dev This records the net outcome of a batch of intents executed off-chain/on-other-chains.
     *      In a full implementation, this would verify proofs. For this version, trusted brokers post.
     * @param batchId Unique ID of the intent batch
     * @param traders List of traders involved
     * @param netAmounts Net USDC change for each trader (positive = receive, negative = pay)
     */
    function postSettlement(
        bytes32 batchId,
        address[] calldata traders,
        int256[] calldata netAmounts
    ) external onlyBroker {
        require(traders.length == netAmounts.length, "Mismatched arrays");
        require(!settlements[batchId].finalized, "Batch already settled");

        uint256 totalVolume = 0;
        int256 netBalance = 0;

        for (uint256 i = 0; i < traders.length; i++) {
            int256 amount = netAmounts[i];
            
            if (amount > 0) {
                // Trader receives funds based on off-chain execution
                // The Broker must have verified the funds are available via the IntentChannel
                settlementToken.safeTransferFrom(msg.sender, traders[i], uint256(amount));
                totalVolume += uint256(amount);
            } else {
                // Trader pays (handled via IntentChannel usually, or pulled here if approved)
                // For this Registry, we assume the Broker has collected funds and is distributing net results
                totalVolume += uint256(-amount);
            }
            netBalance += amount;

            emit TraderSettled(batchId, traders[i], amount);
        }

        // Net balance of the batch should essentially be zero (or positive if fees collected)
        // We log it.

        settlements[batchId] = BatchSettlement({
            batchId: batchId,
            timestamp: block.timestamp,
            totalVolume: totalVolume,
            finalized: true
        });

        emit SettlementPosted(batchId, block.timestamp, totalVolume, uint256(netBalance));
    }

    /**
     * @notice Verify a settlement occurred
     */
    function getSettlement(bytes32 batchId) external view returns (BatchSettlement memory) {
        return settlements[batchId];
    }
}
