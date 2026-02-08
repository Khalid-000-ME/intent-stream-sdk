import chalk from 'chalk';
import ora from 'ora';
import { logger } from '../utils/logger';
import inquirer from 'inquirer';

interface StreamOptions {
    from?: string;
    to?: string;
    amount?: string;
    slippage?: string;
    network?: string;
    wizard?: boolean;
    prompt?: string; // New: AI Prompt
}

export async function streamCommand(options: StreamOptions) {
    logger.header('STREAM INTENT');
    logger.divider();

    let intentData: any = {};

    // Mode 1: AI Prompt (Intelligent Submission)
    if (options.prompt) {
        const spinner = ora('Analyzing intent with AI Agent...').start();
        try {
            const res = await fetch('http://localhost:3000/api/agent/intelligent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: options.prompt, network: options.network })
            });
            const data: any = await res.json();

            if (!data.success) throw new Error(data.error);

            intentData = data.intent;
            spinner.succeed(chalk.green('Intent Parsed Successfully'));
            console.log(chalk.gray(`Analysis: ${data.analysis}`));
            console.log(chalk.cyan('Proposed Intent:'), JSON.stringify(intentData, null, 2));

            // Must confirm before execution
            const confirmation = await inquirer.prompt([{
                type: 'confirm',
                name: 'proceed',
                message: 'Execute this intent?',
                default: true
            }]);

            if (!confirmation.proceed) {
                console.log(chalk.yellow('Operation cancelled.'));
                return;
            }

        } catch (e: any) {
            spinner.fail(`AI Analysis Failed: ${e.message}`);
            return;
        }
    }
    // Mode 2: Interactive Wizard
    else if (options.wizard) {
        // ... (wizard implementation omitted for brevity)
    }
    // Mode 3: CLI Flags
    else {
        if (!options.from || !options.to || !options.amount) {
            // Check if implicit "prompt" as arguments? No, stick to explicit flags or --prompt
            logger.error('Missing required flags: --from, --to, --amount OR use --prompt "..."');
            return;
        }
        intentData = {
            type: 'SWAP',
            fromToken: options.from,
            toToken: options.to,
            amount: options.amount,
            network: options.network || 'arbitrum'
        };
    }

    // Execution
    const spinnerExec = ora('Streaming intent to network...').start();
    try {
        // Authenticate (Mock - in real SDK, signs with local key)
        const authRes = await fetch('http://localhost:3000/api/yellow/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(intentData)
        });
        const authData: any = await authRes.json();

        if (!authData.success) throw new Error(authData.error);
        const intentId = authData.intentId;
        spinnerExec.text = `Intent ID: ${intentId} - Opening Channel...`;

        await fetch('http://localhost:3000/api/yellow/create-channel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intentId })
        });

        spinnerExec.text = `Submitting for execution...`;
        await fetch('http://localhost:3000/api/intent/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intentId })
        });

        spinnerExec.succeed(chalk.green('Intent Streamed Successfully!'));
        console.log(chalk.gray(`Track status: intent-stream status ${intentId}`));

    } catch (e: any) {
        spinnerExec.fail(`Execution Failed: ${e.message}`);
    }
}
