"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const cli_table3_1 = __importDefault(require("cli-table3"));
exports.logger = {
    header(text) {
        console.log((0, boxen_1.default)(chalk_1.default.yellow.bold(text), {
            padding: 1,
            margin: 1,
            borderStyle: 'double',
            borderColor: 'yellow',
        }));
    },
    divider() {
        console.log(chalk_1.default.gray('━'.repeat(60)));
    },
    success(text) {
        console.log(chalk_1.default.green('🟢 ' + text));
    },
    error(text, error) {
        console.log(chalk_1.default.red('🔴 ERROR: ' + text));
        if (error) {
            console.log(chalk_1.default.gray(error.message || error));
        }
    },
    info(label, value) {
        console.log(chalk_1.default.gray(`${label}: `) + chalk_1.default.white(value));
    },
    step(num, text) {
        process.stdout.write(chalk_1.default.gray(`[${num}] ${text}`));
    },
    stepSuccess() {
        console.log(chalk_1.default.green(' [✓]'));
    },
    table(data) {
        const table = new cli_table3_1.default({
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
            table.push([chalk_1.default.gray(key), chalk_1.default.white(value)]);
        });
        console.log(table.toString());
    },
};
//# sourceMappingURL=logger.js.map