const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const DocumentManager = require('./DocumentManager');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Create WebSocket server attached to the HTTP server
const wss = new WebSocket.Server({ server });

// Single document instance for this demo
const documentManager = new DocumentManager();

console.log('Setting up WebSocket and HTTP server...');

// WebSocket connection handling
wss.on('connection', (ws) => {
  const clientId = documentManager.addClient(ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Received message from ${clientId}:`, data.type);

      switch (data.type) {
        case 'documentUpdate':
          const result = documentManager.updateDocument(clientId, data.doc);

          // Send acknowledgment back to the client
          ws.send(
            JSON.stringify({
              type: 'documentUpdateAck',
              success: result.success,
              version: result.version,
              noChanges: result.noChanges,
              error: result.error
            })
          );
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`Client ${clientId} disconnected`);
    documentManager.removeClient(clientId);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
    documentManager.removeClient(clientId);
  });
});

// REST endpoints
app.get('/api/document', (req, res) => {
  res.json(documentManager.getDocument());
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    clients: documentManager.clients.size,
    version: documentManager.version
  });
});

app.get('/api/clients', (req, res) => {
  res.json({
    clients: documentManager.getClientStats(),
    totalClients: documentManager.clients.size
  });
});

const PORT = process.env.PORT || 3001;

// Start the server (this will handle both HTTP and WebSocket)
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`HTTP API available at http://localhost:${PORT}`);
  console.log(`WebSocket server ready at ws://localhost:${PORT}`);
});
