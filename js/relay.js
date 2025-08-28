// relay.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 9001 });

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(msg) {
        // broadcast to everyone else
        wss.clients.forEach(function each(client) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        });
    });
});

console.log('relay listening wss://localhost:9001');