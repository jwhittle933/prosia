const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const DocumentManager = require('./DocumentManager');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Single document instance for this demo
const documentManager = new DocumentManager();

// WebSocket connection handling
wss.on('connection', (ws) => {
  const clientId = documentManager.addClient(ws);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'steps':
          documentManager.receiveSteps(
            clientId,
            message.version,
            message.steps,
            message.clientID
          );
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    documentManager.removeClient(clientId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
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

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});