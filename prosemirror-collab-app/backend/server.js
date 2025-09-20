const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { EditorState } = require('prosemirror-state');
const { receiveTransaction, sendableSteps, getVersion } = require('prosemirror-collab');
const { Step } = require('prosemirror-transform');
const basicSchema = require('prosemirror-schema-basic').schema;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize document state with collaboration support
let docState = EditorState.create({
  schema: basicSchema,
  plugins: [
    require('prosemirror-collab').collab({ version: 0 })
  ]
});

let version = 0;
let steps = [];

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'steps') {
        const { version: clientVersion, steps: clientSteps, clientID } = data;

        if (clientVersion !== version) {
          // Version mismatch, send current state
          ws.send(JSON.stringify({
            type: 'doc',
            doc: docState.doc.toJSON(),
            version: version
          }));
          return;
        }

        // Apply steps
        const parsedSteps = clientSteps.map(stepJSON => Step.fromJSON(basicSchema, stepJSON));
        let newState = docState;

        for (const step of parsedSteps) {
          const result = newState.apply(newState.tr.step(step));
          if (result.failed) {
            console.error('Step failed:', result.failed);
            return;
          }
          newState = result;
        }

        docState = newState;
        version++;
        steps = steps.concat(clientSteps);

        // Broadcast steps to all other clients
        const broadcast = {
          type: 'steps',
          version: version - 1,
          steps: clientSteps,
          clientID: clientID
        };

        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(broadcast));
          }
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  // Send initial document to newly connected client
  ws.send(JSON.stringify({
    type: 'doc',
    doc: docState.doc.toJSON(),
    version: version
  }));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});