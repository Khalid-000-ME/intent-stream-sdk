#!/usr/bin/env node

// This tells the system to use Node.js to run this file
// IMPORTANT: This must be line 1!

// Load the compiled CLI
// In development, we can use ts-node to run source directly or fallback to dist
try {
    require('../dist/index.js');
} catch (e) {
    // If dist doesn't exist (dev mode), try to register ts-node
    // This is optional but helpful for dev
    console.log("Running in dev mode (ts-node)...");
    require('ts-node/register');
    require('../src/index.ts');
}
