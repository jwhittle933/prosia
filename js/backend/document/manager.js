const { schema } = require('./schema');
const { createDocument } = require('./doc');
const { v4: uuidv4 } = require('uuid');
const { Node } = require('prosemirror-model');
const { Step } = require('prosemirror-transform');

class DocumentManager {
    constructor() {
        this.doc = createDocument();
        this.version = 1;
        this.steps = [];
        this.clients = new Map();
        this.lastDocumentHash = this.getDocumentHash();

        this.cleanupInterval = setInterval(() => {
            this.cleanupDeadConnections();
        }, 30000);
    }

    getDocumentHash() {
        return JSON.stringify(this.doc.toJSON());
    }

    addClient(ws) {
        const clientId = uuidv4();
        const connectionTime = new Date().toISOString();

        this.clients.set(clientId, {
            ws,
            version: this.version,
            connectionTime,
            lastActivity: Date.now()
        });

        console.log(`Client ${clientId} connected at ${connectionTime}. Total participants: ${this.clients.size}`);

        ws.send(JSON.stringify({
            type: 'connected',
            doc: this.doc.toJSON(),
            version: this.version,
            clientId,
            totalParticipants: this.clients.size
        }));

        setTimeout(() => {
            this.broadcastParticipantUpdate();
        }, 100);

        return clientId;
    }

    removeClient(clientId) {
        if (this.clients.has(clientId)) {
            this.clients.delete(clientId);
            console.log(`Client ${clientId} disconnected. Total participants: ${this.clients.size}`);
            this.broadcastParticipantUpdate();
        }
    }

    handleSteps(clientId, stepData) {
        const client = this.clients.get(clientId);
        if (!client) {
            console.error(`Client ${clientId} not found`);
            return { success: false, error: 'Client not found', version: this.version };
        }

        try {
            client.lastActivity = Date.now();

            const { version, steps: stepsJSON, clientID, timestamp } = stepData;

            if (version !== this.version) {
                console.warn(`Version mismatch: client ${clientId} has version ${version}, server has ${this.version}`);

                client.ws.send(JSON.stringify({
                    type: 'documentUpdate',
                    doc: this.doc.toJSON(),
                    version: this.version,
                    timestamp: new Date().toISOString()
                }));

                return {
                    success: false,
                    error: `Version mismatch. Expected ${this.version}, got ${version}`,
                    version: this.version
                };
            }

            const steps = stepsJSON.map(stepJSON => Step.fromJSON(schema, stepJSON.step || stepJSON));

            console.log(`Processing ${steps.length} steps from client ${clientId} at version ${version}`);

            let currentDoc = this.doc;
            const appliedSteps = [];
            const clientIDs = [];

            for (const step of steps) {
                try {
                    const result = step.apply(currentDoc);
                    if (result.failed) {
                        console.error('Step application failed:', result.failed);
                        return {
                            success: false,
                            error: `Step application failed: ${result.failed}`,
                            version: this.version
                        };
                    }

                    currentDoc = result.doc;
                    appliedSteps.push(step);
                    clientIDs.push(clientID);

                } catch (error) {
                    console.error('Error applying step:', error);
                    return {
                        success: false,
                        error: `Error applying step: ${error.message}`,
                        version: this.version
                    };
                }
            }

            this.doc = currentDoc;
            this.version += steps.length;

            this.steps.push(...appliedSteps.map((step, index) => ({
                step: step.toJSON(),
                clientID: clientIDs[index],
                version: this.version - steps.length + index + 1,
                timestamp
            })));

            client.version = this.version;

            console.log(`Successfully applied ${steps.length} steps. New version: ${this.version}`);

            const processedSteps = appliedSteps.map((step, index) => ({
                step: step.toJSON(),
                clientId: clientIDs[index],
                schema: schema.spec
            }));

            client.ws.send(JSON.stringify({
                type: 'steps',
                version: this.version,
                steps: processedSteps,
                timestamp: new Date().toISOString()
            }));

            this.broadcastSteps(clientId, {
                version: this.version,
                steps: appliedSteps.map(step => step.toJSON()),
                clientIDs,
                doc: this.doc
            });

            return {
                success: true,
                version: this.version,
                stepsApplied: steps.length
            };

        } catch (error) {
            console.error('Error handling steps:', error);
            return {
                success: false,
                error: error.message,
                version: this.version
            };
        }
    }

    broadcastSteps(excludeClientId, stepData) {
        const stepsMessage = JSON.stringify({
            type: 'steps',
            version: stepData.version,
            steps: stepData.steps.map((step, index) => ({
                step: step,
                clientId: stepData.clientIDs[index],
                schema: schema.spec
            })),
            timestamp: new Date().toISOString()
        });

        console.log(`Broadcasting ${stepData.steps.length} steps (version ${stepData.version}) to all clients except ${excludeClientId}`);

        let successfulBroadcasts = 0;
        const clientsToRemove = [];

        this.clients.forEach((client, clientId) => {
            if (clientId !== excludeClientId && client.ws.readyState === 1) {
                try {
                    client.ws.send(stepsMessage);
                    client.version = stepData.version;
                    successfulBroadcasts++;
                } catch (error) {
                    console.error(`Failed to send steps to client ${clientId}:`, error);
                    clientsToRemove.push(clientId);
                }
            }
        });

        clientsToRemove.forEach(clientId => {
            this.removeClient(clientId);
        });

        console.log(`Successfully broadcast steps to ${successfulBroadcasts} clients`);
    }

    updateDocument(clientId, documentJSON) {
        const client = this.clients.get(clientId);
        if (!client) {
            console.error(`Client ${clientId} not found`);
            return { success: false, error: 'Client not found' };
        }

        try {
            client.lastActivity = Date.now();
            const newDoc = Node.fromJSON(schema, documentJSON);

            const newDocHash = JSON.stringify(newDoc.toJSON());
            if (newDocHash === this.lastDocumentHash) {
                console.log(`No changes detected from client ${clientId}`);
                return { success: true, noChanges: true };
            }

            console.log(`Document updated by client ${clientId}`);

            this.doc = newDoc;
            this.version += 1;
            this.lastDocumentHash = newDocHash;

            this.broadcastDocumentUpdate(clientId);

            return { success: true, version: this.version };

        } catch (error) {
            console.error('Error updating document:', error);
            return { success: false, error: error.message };
        }
    }

    broadcastDocumentUpdate(excludeClientId) {
        const updateMessage = JSON.stringify({
            type: 'documentUpdate',
            doc: this.doc.toJSON(),
            version: this.version,
            timestamp: new Date().toISOString(),
            updatedBy: excludeClientId
        });

        console.log(`Broadcasting document update (version ${this.version}) to all clients except ${excludeClientId}`);

        let successfulBroadcasts = 0;
        const clientsToRemove = [];

        this.clients.forEach((client, clientId) => {
            if (clientId !== excludeClientId && client.ws.readyState === 1) {
                try {
                    client.ws.send(updateMessage);
                    client.version = this.version;
                    successfulBroadcasts++;
                } catch (error) {
                    console.error(`Failed to send document update to client ${clientId}:`, error);
                    clientsToRemove.push(clientId);
                }
            }
        });

        clientsToRemove.forEach(clientId => {
            this.removeClient(clientId);
        });

        console.log(`Successfully broadcast document update to ${successfulBroadcasts} clients`);
    }

    cleanupDeadConnections() {
        const deadClients = [];

        this.clients.forEach((client, clientId) => {
            if (client.ws.readyState !== 1) { // WebSocket.OPEN
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

        console.log(`Broadcasting participant update: ${participantCount} participants`);

        this.clients.forEach((client, clientId) => {
            if (client.ws.readyState === 1) {
                try {
                    client.ws.send(participantUpdateMessage);
                } catch (error) {
                    console.error(`Failed to send participant update to client ${clientId}:`, error);
                    this.removeClient(clientId);
                }
            }
        });
    }

    getDocument() {
        return {
            doc: this.doc.toJSON(),
            version: this.version,
            totalParticipants: this.clients.size,
            stepHistory: this.steps.length,
            steps: this.steps
        };
    }

    addSteps(steps) {
        this.version += steps.length;
        this.steps = this.steps.concat(steps);
    }

    getSteps(version) {
        let start = this.steps.length - (this.version - version)
        return {
            steps: this.steps.slice(start),
            users: this.clients.size
        }
    }

    getClientStats() {
        const clientStats = [];
        this.clients.forEach((client, clientId) => {
            clientStats.push({
                id: clientId,
                connectionTime: client.connectionTime,
                version: client.version,
                lastActivity: new Date(client.lastActivity).toISOString(),
                isActive: Date.now() - client.lastActivity < 30000,
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