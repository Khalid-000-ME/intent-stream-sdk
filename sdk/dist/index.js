"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const figlet_1 = __importDefault(require("figlet"));
const chalk_1 = __importDefault(require("chalk"));
const init_1 = require("./commands/init");
// Placeholder commands (will implement later)
const streamCommand = () => console.log("Stream command not implemented yet.");
const statusCommand = () => console.log("Status command not implemented yet.");
const fundCommand = () => console.log("Fund command not implemented yet.");
const historyCommand = () => console.log("History command not implemented yet.");
// ASCII Art Banner
const banner = figlet_1.default.textSync('INTENT-STREAM', {
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
});
console.log(chalk_1.default.yellow(banner));
console.log(chalk_1.default.white('Intent Streaming SDK for DeFi Agents'));
console.log(chalk_1.default.gray('MEV-Proof • Sub-Second • USDC-Native\n'));
// Initialize Commander
const program = new commander_1.Command();
program
    .name('intent-stream')
    .description('CLI tool for streaming DeFi intents via Yellow Network')
    .version('0.1.0');
// Register commands
program
    .command('init')
    .description('Initialize agent wallet and state channel')
    .option('--network <chain>', 'Target network', 'arbitrum')
    .option('--fund <amount>', 'Initial funding amount')
    .action(init_1.initCommand);
program
    .command('stream')
    .description('Stream a trade intent')
    .requiredOption('--from <asset>', 'Source asset (e.g., ETH)')
    .requiredOption('--to <asset>', 'Destination asset (e.g., USDC)')
    .requiredOption('--amount <value>', 'Amount to swap')
    .option('--slippage <percent>', 'Max slippage %', '0.5')
    .option('--network <chain>', 'Target network', 'arbitrum')
    .option('--wizard', 'Use interactive wizard')
    .action(streamCommand);
program
    .command('status [intentId]')
    .description('Check intent execution status')
    .option('--watch', 'Watch for updates')
    .action(statusCommand);
program
    .command('fund')
    .description('Add funds to state channel')
    .requiredOption('--amount <value>', 'Amount to fund')
    .option('--asset <token>', 'Asset to fund', 'ETH')
    .option('--network <chain>', 'Target network', 'arbitrum')
    .action(fundCommand);
program
    .command('history')
    .description('View past intents')
    .option('--limit <number>', 'Number of intents', '10')
    .option('--all', 'Show all intents')
    .action(historyCommand);
program
    .command('config')
    .description('Manage configuration')
    .argument('<action>', 'get, set, or list')
    .argument('[key]', 'Config key')
    .argument('[value]', 'Config value')
    .action((action, key, value) => {
    // Config management logic
    console.log(`Config action: ${action} key: ${key} value: ${value}`);
});
// Parse command line arguments
program.parse(process.argv);
// If no command provided, show help
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
//# sourceMappingURL=index.js.map