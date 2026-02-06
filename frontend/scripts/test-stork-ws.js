const WebSocket = require('ws');

const url = 'wss://ws.stork-oracle.network';
console.log(`Connecting to ${url}...`);
const ws = new WebSocket(url);

ws.on('open', function open() {
    console.log('✅ Connected');
    // Try subscribing
    const msg = JSON.stringify({ type: "subscribe", ids: ["ETHUSD", "USDCUSD"] }); // Try 'ids' vs 'data' based on mixed signals? 
    // Summary said `data` containing array.
    // I'll try both messages to be safe or just one if summary was clear.
    // Summary: "type field set to 'subscribe' and a data field containing an array of asset IDs."
    const msg1 = JSON.stringify({ type: "subscribe", data: ["ETHUSD", "USDCUSD"] });

    console.log('Sending:', msg1);
    ws.send(msg1);
});

ws.on('message', function incoming(data) {
    console.log('📨 Received:', data.toString());
    // If we get data, it works.
});

ws.on('error', (err) => {
    console.error('❌ Error:', err.message);
});

ws.on('close', () => console.log('Disconnected'));
