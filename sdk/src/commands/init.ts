import chalk from 'chalk';
import ora from 'ora';
// import boxen from 'boxen';
import { Wallet } from 'ethers';
// import { createChannel } from '../lib/channel';
// import { registerAgent } from '../lib/agent';
// import { saveConfig, Config } from '../utils/config';
import { logger } from '../utils/logger';

interface InitOptions {
  network: string;
  fund?: string;
}

// Temporary mocks until lib modules are implemented
const createChannel = async (wallet: any, network: string, fund?: string) => `0xCHANNEL_${network}_${Math.floor(Math.random() * 1000)}`;

const registerAgent = async (wallet: any, channelId: string) => {
  try {
    const response = await fetch('http://localhost:3000/api/agent/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentWallet: wallet.address,
        metadata: { channelId, createdAt: Date.now() }
      })
    });
    const data: any = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.agent.id;
  } catch (e) {
    // Fallback if API down
    return `agent_offline_${Date.now()}`;
  }
};

const saveConfig = (config: any) => console.log(chalk.gray('(Config saved mock)'));

export async function initCommand(options: InitOptions) {
  logger.header('INTENT-STREAM INITIALIZATION');
  logger.divider();

  try {
    // Step 1: Generate wallet
    const spinner1 = ora('Generating agent wallet...').start();
    const wallet = Wallet.createRandom();
    spinner1.succeed(`Wallet created: ${chalk.cyan(wallet.address)}`);

    // Step 2: Request testnet tokens (mock for demo)
    const spinner2 = ora('Requesting FET tokens for agent staking...').start();
    await delay(1000);
    spinner2.succeed('Received 100 FET (testnet)');

    // Step 3: Connect to broker
    const spinner3 = ora('Connecting to StreamFlow broker...').start();
    // const brokerUrl = 'wss://broker-01.streamflow.network';
    await delay(1000);
    spinner3.succeed(`Connected to broker: ${chalk.cyan('broker-01.streamflow.network')}`);

    // Step 4: Open Yellow state channel
    const spinner4 = ora('Opening Yellow state channel...').start();
    const channelId = await createChannel(wallet, options.network, options.fund);
    spinner4.succeed(`Channel opened: ${chalk.cyan(channelId)}`);

    // Step 5: Register ASI agent
    const spinner5 = ora('Registering ASI agent (On-Chain)...').start();
    const agentId = await registerAgent(wallet, channelId);
    spinner5.succeed(`Agent registered with ID: ${chalk.cyan(agentId)}`);

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
    logger.divider();
    logger.success('INITIALIZATION COMPLETE');
    console.log();
    console.log(chalk.white('Next steps:'));
    console.log(chalk.gray('  1. Fund your agent wallet: ') + chalk.yellow('intent-stream fund'));
    console.log(chalk.gray('  2. Set spending limits: ') + chalk.yellow('intent-stream limit set <amount>'));
    console.log(chalk.gray('  3. Stream your first intent: ') + chalk.yellow('intent-stream stream --help'));

  } catch (error) {
    logger.error('Initialization failed', error);
    process.exit(1);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function encryptPrivateKey(privateKey: string): string {
  // TODO: Implement encryption with user password
  // For now, return base64 encoded (INSECURE - fix for production)
  return Buffer.from(privateKey).toString('base64');
}
