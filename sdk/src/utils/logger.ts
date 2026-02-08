import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';

export const logger = {
    header(text: string) {
        console.log(
            boxen(chalk.yellow.bold(text), {
                padding: 1,
                margin: 1,
                borderStyle: 'double',
                borderColor: 'yellow',
            })
        );
    },

    divider() {
        console.log(chalk.gray('━'.repeat(60)));
    },

    success(text: string) {
        console.log(chalk.green('🟢 ' + text));
    },

    error(text: string, error?: any) {
        console.log(chalk.red('🔴 ERROR: ' + text));
        if (error) {
            console.log(chalk.gray(error.message || error));
        }
    },

    info(label: string, value: string) {
        console.log(chalk.gray(`${label}: `) + chalk.white(value));
    },

    step(num: number, text: string) {
        process.stdout.write(chalk.gray(`[${num}] ${text}`));
    },

    stepSuccess() {
        console.log(chalk.green(' [✓]'));
    },

    table(data: Array<[string, string]>) {
        const table = new Table({
            chars: {
                top: '─',
                'top-mid': '┬',
                'top-left': '┌',
                'top-right': '┐',
                bottom: '─',
                'bottom-mid': '┴',
                'bottom-left': '└',
                'bottom-right': '┘',
                left: '│',
                'left-mid': '├',
                mid: '─',
                'mid-mid': '┼',
                right: '│',
                'right-mid': '┤',
                middle: '│',
            },
            style: {
                border: ['gray'],
                head: ['yellow'],
            },
        });

        data.forEach(([key, value]) => {
            table.push([chalk.gray(key), chalk.white(value)]);
        });

        console.log(table.toString());
    },
};
