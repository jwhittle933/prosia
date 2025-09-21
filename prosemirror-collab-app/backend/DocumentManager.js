const { Step } = require('prosemirror-transform');
const { schema } = require('./prosemirror/schema');
const { createDocument } = require('./prosemirror/doc');

// Document state management
class DocumentManager {
    constructor() {
        this.doc = createDocument(); // Initial document
        this.version = 0;
        this.steps = [];
        this.clients = new Map(); // clientId -> { ws, version, connectionTime }
        this.nextClientId = 1;

        // Clean up dead connections periodically
        this.cleanupInterval = setInterval(() => {
            this.cleanupDeadConnections();
        }, 30000); // Every 30 seconds
    }

    addClient(ws) {
        const clientId = this.nextClientId++;
        const connectionTime = new Date().toISOString();

        this.clients.set(clientId, {
            ws,
            version: this.version,
            connectionTime,
            lastActivity: Date.now()
        });

        console.log(`Client ${clientId} connected at ${connectionTime}. Total participants: ${this.clients.size}`);

        // Send initial document state with participant count
        ws.send(JSON.stringify({
            type: 'init',
            doc: this.doc.toJSON(),
            version: this.version,
            clientId,
            totalParticipants: this.clients.size
        }));

        // Broadcast to all clients (including the new one) about the updated participant count
        // Use setTimeout to ensure the new client has processed the init message first
        setTimeout(() => {
            this.broadcastParticipantUpdate();
        }, 100);

        return clientId;
    }

    removeClient(clientId) {
        if (this.clients.has(clientId)) {
            const client = this.clients.get(clientId);
            this.clients.delete(clientId);
            console.log(`Client ${clientId} disconnected. Total participants: ${this.clients.size}`);

            // Broadcast the updated participant count to remaining clients
            this.broadcastParticipantUpdate();
        }
    }

    cleanupDeadConnections() {
        const deadClients = [];

        this.clients.forEach((client, clientId) => {
            if (client.ws.readyState !== 1) { // WebSocket.OPEN = 1
                deadClients.push(clientId);
            }
        });

        if (deadClients.length > 0) {
            console.log(`Cleaning up ${deadClients.length} dead connections`);
            let participantCountChanged = false;

            deadClients.forEach(clientId => {
                if (this.clients.has(clientId)) {
                    this.clients.delete(clientId);
                    participantCountChanged = true;
                }
            });

            // Only broadcast if the participant count actually changed
            if (participantCountChanged) {
                this.broadcastParticipantUpdate();
            }
        }
    }

    broadcastParticipantUpdate() {
        const participantCount = this.clients.size;
        const participantUpdateMessage = JSON.stringify({
            type: 'participantUpdate',
            totalParticipants: participantCount,
            timestamp: new Date().toISOString()
        });

        console.log(`Broadcasting participant update: ${participantCount} participants to ${this.clients.size} clients`);

        let successfulBroadcasts = 0;
        const clientsToRemove = [];

        this.clients.forEach((client, clientId) => {
            if (client.ws.readyState === 1) { // WebSocket.OPEN = 1
                try {
                    client.ws.send(participantUpdateMessage);
                    successfulBroadcasts++;
                } catch (error) {
                    console.error(`Failed to send participant update to client ${clientId}:`, error);
                    clientsToRemove.push(clientId);
                }
            } else {
                // Mark dead connections for removal
                clientsToRemove.push(clientId);
            }
        });

        // Remove failed clients (but don't broadcast again to avoid infinite loops)
        clientsToRemove.forEach(clientId => {
            if (this.clients.has(clientId)) {
                console.log(`Removing dead client ${clientId}`);
                this.clients.delete(clientId);
            }
        });

        console.log(`Successfully broadcast participant update to ${successfulBroadcasts} clients`);
    }

    receiveSteps(clientId, version, steps, clientID) {
        const client = this.clients.get(clientId);
        if (!client) {
            console.error(`Client ${clientId} not found`);
            return;
        }

        // Update client activity
        client.lastActivity = Date.now();

        if (version !== this.version) {
            console.log(`Version mismatch. Client ${clientId}: ${version}, Server: ${this.version}`);
            // Send current steps to bring client up to date
            this.sendStepsToClient(clientId);
            return;
        }

        // Apply steps to server document
        try {
            let doc = this.doc;
            const stepInstances = steps.map(stepJSON => Step.fromJSON(schema, stepJSON));

            for (const step of stepInstances) {
                const result = step.apply(doc);
                if (result.failed) {
                    console.error('Step application failed:', result.failed);
                    return;
                }
                doc = result.doc;
            }

            // Update server state
            this.doc = doc;
            this.steps.push(...stepInstances.map((step, i) => ({
                step: steps[i],
                clientID,
                version: this.version + i + 1
            })));
            this.version += steps.length;

            console.log(`Applied ${steps.length} steps from client ${clientId}. New version: ${this.version}`);

            // Broadcast steps to all other clients
            this.broadcastSteps(stepInstances.map((step, i) => ({
                step: steps[i],
                clientID,
                version: this.version - steps.length + i + 1
            })), clientId);

        } catch (error) {
            console.error('Error applying steps:', error);
        }
    }

    sendStepsToClient(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const clientVersion = client.version;
        const stepsToSend = this.steps.filter(s => s.version > clientVersion);

        if (stepsToSend.length > 0) {
            try {
                client.ws.send(JSON.stringify({
                    type: 'steps',
                    version: clientVersion,
                    steps: stepsToSend.map(s => s.step),
                    clientIDs: stepsToSend.map(s => s.clientID)
                }));

                // Update client version
                client.version = this.version;
            } catch (error) {
                console.error(`Failed to send steps to client ${clientId}:`, error);
                this.removeClient(clientId);
            }
        }
    }

    broadcastSteps(newSteps, excludeClientId) {
        const message = JSON.stringify({
            type: 'steps',
            version: this.version - newSteps.length,
            steps: newSteps.map(s => s.step),
            clientIDs: newSteps.map(s => s.clientID)
        });

        this.clients.forEach((client, clientId) => {
            if (clientId !== excludeClientId && client.ws.readyState === 1) { // WebSocket.OPEN = 1
                try {
                    client.ws.send(message);
                    client.version = this.version;
                } catch (error) {
                    console.error(`Failed to broadcast to client ${clientId}:`, error);
                    this.removeClient(clientId);
                }
            }
        });
    }

    getDocument() {
        return {
            doc: this.doc.toJSON(),
            version: this.version,
            totalParticipants: this.clients.size
        };
    }

    // Method to get client statistics
    getClientStats() {
        const clientStats = [];
        this.clients.forEach((client, clientId) => {
            clientStats.push({
                id: clientId,
                connectionTime: client.connectionTime,
                version: client.version,
                lastActivity: new Date(client.lastActivity).toISOString(),
                isActive: Date.now() - client.lastActivity < 30000, // Active if activity within 30 seconds
                connectionState: client.ws.readyState
            });
        });
        return clientStats;
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

module.exports = DocumentManager;