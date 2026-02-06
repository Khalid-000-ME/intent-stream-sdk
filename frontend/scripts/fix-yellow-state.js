// Quick fix for yellow-state-management.ts line 333
// Replace: unsignedInitialState: channelData.state,
// With proper BigInt conversion

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'yellow-state-management.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the problematic line
const oldCode = `            unsignedInitialState: channelData.state,`;

const newCode = `            unsignedInitialState: {
                intent: channelData.state.intent,
                version: BigInt(channelData.state.version),
                data: channelData.state.state_data,
                allocations: channelData.state.allocations.map((alloc: any) => ({
                    destination: alloc.destination as \`0x\${string}\`,
                    token: alloc.token as \`0x\${string}\`,
                    amount: BigInt(alloc.amount)
                }))
            },`;

content = content.replace(oldCode, newCode);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed state transformation in yellow-state-management.ts');
