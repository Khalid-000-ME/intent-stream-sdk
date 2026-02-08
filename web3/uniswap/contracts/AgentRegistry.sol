// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentRegistry
 * @notice Registry for AI Agents participating in the Intent-Stream Network
 */
contract AgentRegistry {
    struct Agent {
        uint256 id;
        address walletAddress;
        string metadata; // IPFS hash or JSON string
        uint256 createdAt;
        bool isActive;
    }

    uint256 public nextAgentId;
    mapping(uint256 => Agent) public agents;
    mapping(address => uint256) public walletToAgentId;

    event AgentRegistered(uint256 indexed agentId, address indexed wallet, string metadata);
    event AgentUpdated(uint256 indexed agentId, string metadata);

    constructor() {
        nextAgentId = 1;
    }

    /**
     * @notice Register a new agent
     * @param _metadata Additional info about the agent
     */
    function registerAgent(string calldata _metadata) external returns (uint256) {
        require(walletToAgentId[msg.sender] == 0, "Wallet already registered");

        uint256 agentId = nextAgentId++;
        agents[agentId] = Agent({
            id: agentId,
            walletAddress: msg.sender,
            metadata: _metadata,
            createdAt: block.timestamp,
            isActive: true
        });

        walletToAgentId[msg.sender] = agentId;

        emit AgentRegistered(agentId, msg.sender, _metadata);
        return agentId;
    }

    /**
     * @notice Get agent details by ID
     */
    function getAgent(uint256 _agentId) external view returns (Agent memory) {
        return agents[_agentId];
    }

    /**
     * @notice Get agent ID by wallet
     */
    function getAgentId(address _wallet) external view returns (uint256) {
        return walletToAgentId[_wallet];
    }
}
