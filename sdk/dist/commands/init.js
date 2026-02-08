"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = initCommand;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
// import boxen from 'boxen';
const ethers_1 = require("ethers");
// import { createChannel } from '../lib/channel';
// import { registerAgent } from '../lib/agent';
// import { saveConfig, Config } from '../utils/config';
const logger_1 = require("../utils/logger");
// Temporary mocks until lib modules are implemented
const createChannel = async (wallet, network, fund) => `0xCHANNEL_${network}_${Math.floor(Math.random() * 1000)}`;
const registerAgent = async (wallet, channelId) => `agent_${Date.now()}`;
const saveConfig = (config) => console.log(chalk_1.default.gray('(Config saved mock)'));
async function initCommand(options) {
    logger_1.logger.header('INTENT-STREAM INITIALIZATION');
    logger_1.logger.divider();
    try {
        // Step 1: Generate wallet
        const spinner1 = (0, ora_1.default)('Generating agent wallet...').start();
        const wallet = ethers_1.Wallet.createRandom();
        spinner1.succeed(`Wallet created: ${chalk_1.default.cyan(wallet.address)}`);
        // Step 2: Request testnet tokens (mock for demo)
        const spinner2 = (0, ora_1.default)('Requesting FET tokens for agent staking...').start();
        await delay(1000);
        spinner2.succeed('Received 100 FET (testnet)');
        // Step 3: Connect to broker
        const spinner3 = (0, ora_1.default)('Connecting to StreamFlow broker...').start();
        // const brokerUrl = 'wss://broker-01.streamflow.network';
        await delay(1000);
        spinner3.succeed(`Connected to broker: ${chalk_1.default.cyan('broker-01.streamflow.network')}`);
        // Step 4: Open Yellow state channel
        const spinner4 = (0, ora_1.default)('Opening Yellow state channel...').start();
        const channelId = await createChannel(wallet, options.network, options.fund);
        spinner4.succeed(`Channel opened: ${chalk_1.default.cyan(channelId)}`);
        // Step 5: Register ASI agent
        const spinner5 = (0, ora_1.default)('Registering ASI agent...').start();
        const agentId = await registerAgent(wallet, channelId);
        spinner5.succeed(`Agent registered with ID: ${chalk_1.default.cyan(agentId)}`);
        // Save configuration
        /*
        const config: Config = {
          version: '1.0.0',
          wallet: {
            address: wallet.address,
            encryptedKey: encryptPrivateKey(wallet.privateKey),
          },
          broker: {
            url: brokerUrl,
          },
          channels: {
            [options.network]: channelId,
          },
          agentId,
        };
    
        saveConfig(config);
        */
        saveConfig({});
        // Success message
        logger_1.logger.divider();
        logger_1.logger.success('INITIALIZATION COMPLETE');
        console.log();
        console.log(chalk_1.default.white('Next steps:'));
        console.log(chalk_1.default.gray('  1. Fund your agent wallet: ') + chalk_1.default.yellow('intent-stream fund'));
        console.log(chalk_1.default.gray('  2. Set spending limits: ') + chalk_1.default.yellow('intent-stream limit set <amount>'));
        console.log(chalk_1.default.gray('  3. Stream your first intent: ') + chalk_1.default.yellow('intent-stream stream --help'));
    }
    catch (error) {
        logger_1.logger.error('Initialization failed', error);
        process.exit(1);
    }
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function encryptPrivateKey(privateKey) {
    // TODO: Implement encryption with user password
    // For now, return base64 encoded (INSECURE - fix for production)
    return Buffer.from(privateKey).toString('base64');
}
//# sourceMappingURL=init.js.map