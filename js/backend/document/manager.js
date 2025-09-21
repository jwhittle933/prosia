const { Step } = require('prosemirror-transform');
const { schema } = require('./schema');
const { createDocument } = require('./doc');
const { v4: uuidv4 } = require('uuid');
const { Node } = require('prosemirror-model');

// Document state management
class DocumentManager {
    constructor() {
        this.doc = createDocument();
        this.version = 0;
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

        // Send initial document state with participant count
        ws.send(JSON.stringify({
            type: 'init',
            doc: this.doc.toJSON(),
            version: this.version,
            clientId,
            totalParticipants: this.clients.size
        }));

        // Broadcast to all clients about the updated participant count
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

    // Handle document updates from clients
    updateDocument(clientId, documentJSON) {
        const client = this.clients.get(clientId);
        if (!client) {
            console.error(`Client ${clientId} not found`);
            return { success: false, error: 'Client not found' };
        }

        try {
            // Update client activity
            client.lastActivity = Date.now();

            // Convert JSON to ProseMirror document
            const newDoc = Node.fromJSON(schema, documentJSON);

            // Check if document actually changed
            const newDocHash = JSON.stringify(newDoc.toJSON());
            if (newDocHash === this.lastDocumentHash) {
                console.log(`No changes detected from client ${clientId}`);
                return { success: true, noChanges: true };
            }

            console.log(`Document updated by client ${clientId}`);

            // Update server document
            this.doc = newDoc;
            this.version += 1;
            this.lastDocumentHash = newDocHash;

            // Broadcast the updated document to all other clients
            this.broadcastDocumentUpdate(clientId);

            return { success: true, version: this.version };

        } catch (error) {
            console.error('Error updating document:', error);
            return { success: false, error: error.message };
        }
    }

    // Broadcast document updates to all clients except the sender
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

        // Remove failed clients
        clientsToRemove.forEach(clientId => {
            this.removeClient(clientId);
        });

        console.log(`Successfully broadcast document update to ${successfulBroadcasts} clients`);
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
            totalParticipants: this.clients.size
        };
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