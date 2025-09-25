const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const DocumentManager = require('./document/manager');
const { Step } = require("prosemirror-transform");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const wss = new WebSocket.Server({ server });

const documentManager = new DocumentManager();

console.log('Setting up WebSocket and HTTP server...');

wss.on('connection', (ws) => {
  const clientId = documentManager.addClient(ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Received message from ${clientId}:`, data.type);

      switch (data.type) {
        case 'steps':
          const result = documentManager.handleSteps(clientId, {
            version: data.version,
            steps: data.steps,
            clientID: data.clientID,
            timestamp: data.timestamp
          });

          ws.send(
            JSON.stringify({
              type: 'stepAck',
              success: result.success,
              stepsSent: data.steps.length,
              currentVersion: result.version,
              error: result.error
            })
          );
          break;

        case 'documentUpdate':
          const updateResult = documentManager.updateDocument(clientId, data.doc);

          ws.send(
            JSON.stringify({
              type: 'documentUpdateAck',
              success: updateResult.success,
              version: updateResult.version,
              noChanges: updateResult.noChanges,
              error: updateResult.error
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

      try {
        const data = JSON.parse(message);
        if (data.type === 'steps') {
          ws.send(JSON.stringify({
            type: 'stepAck',
            success: false,
            stepsSent: 0,
            error: 'Server error processing steps'
          }));
        }
      } catch (parseError) {
        // 
      }
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

app.get('/api/document', (req, res) => {
  res.json(documentManager.getDocument());
});

app.get('/api/document/steps', (req, res) => {
  let v = req.query.version;

  res.json(documentManager.getSteps(v));
});

app.post('/api/document/steps', (req, res) => {
  let v = req.body.version;
  let steps = req.body.steps.map(s => Step.fromJSON(schema, s));

  let doc = documentManager.getDocument();
  steps.forEach(step => {
    let result = step.apply(doc);
    doc = result.doc;
  });

  documentManager.addSteps(steps);

  res.json({ version: documentManager.version });
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

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`HTTP API available at http://localhost:${PORT}`);
  console.log(`WebSocket server ready at ws://localhost:${PORT}`);
});
