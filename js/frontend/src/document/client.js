class DocumentClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.onConnected = null;
        this.onConnectionError = null;
        this.onParticipantUpdate = null;
        this.onDocumentUpdate = null;
        this.isConnecting = false;
        this.isDestroyed = false;
        this.clientId = null;

        this.lastSentDocumentHash = null;
        this.syncTimer = null;
        this.pendingSync = false;
        this.getCurrentDocumentState = null;
    }

    connect() {
        if (this.isConnecting || this.isDestroyed) {
            console.log('Already connecting or destroyed, skipping connection');
            return Promise.reject(new Error('Already connecting or destroyed'));
        }

        this.isConnecting = true;

        return new Promise((resolve, reject) => {
            try {
                console.log('Creating WebSocket connection to', this.url);
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    if (this.isDestroyed) {
                        console.log('Client was destroyed during connection, closing');
                        this.ws.close();
                        return;
                    }

                    console.log('WebSocket connected');
                    this.isConnecting = false;
                };

                this.ws.onmessage = (event) => {
                    if (this.isDestroyed) return;

                    try {
                        const message = JSON.parse(event.data);
                        console.log('Received WebSocket message:', message.type);

                        this.handleMessage(message);

                        if (message.type === 'init') {
                            this.clientId = message.clientId;
                            console.log('Received initial document with', message.totalParticipants, 'participants');

                            if (this.onConnected) {
                                this.onConnected(message);
                            }
                            resolve(message);
                        }
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('WebSocket disconnected', event.code, event.reason);
                    this.isConnecting = false;
                    this.stopSync();

                    if (!this.isDestroyed && event.code !== 1000) {
                        console.log('Unexpected disconnect, calling error handler');
                        if (this.onConnectionError) {
                            this.onConnectionError(new Error('Connection lost'));
                        }
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.isConnecting = false;

                    if (!this.isDestroyed && this.onConnectionError) {
                        this.onConnectionError(error);
                    }
                    reject(new Error('WebSocket connection failed'));
                };

            } catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }

    handleMessage(message) {
        if (this.isDestroyed) return;

        switch (message.type) {
            case 'participantUpdate':
                console.log(`Participant update received: ${message.totalParticipants} participants`);
                if (this.onParticipantUpdate) {
                    this.onParticipantUpdate(message);
                }
                break;

            case 'documentUpdate':
                console.log('Document update received from server');
                if (this.onDocumentUpdate) {
                    this.onDocumentUpdate(message);
                }
                break;

            case 'documentUpdateAck':
                console.log('Document update acknowledged:', message);
                this.pendingSync = false;
                break;

            case 'pong':
                break;
        }
    }

    startSync(getCurrentDocument) {
        if (this.isDestroyed) {
            console.log('Client is destroyed, not starting sync');
            return;
        }

        if (this.syncTimer) {
            this.stopSync();
        }

        this.getCurrentDocument = getCurrentDocument;

        this.syncTimer = setInterval(() => {
            if (!this.isDestroyed) {
                this.syncDocument();
            }
        }, 5000);

        console.log('Document sync started (5 second intervals)');
    }

    stopSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            console.log('Document sync stopped');
        }
    }

    syncDocument() {
        if (this.isDestroyed || !this.ws || this.ws.readyState !== WebSocket.OPEN || this.pendingSync) {
            return;
        }

        try {
            let currentDoc;

            if (this.getCurrentDocument) {
                currentDoc = this.getCurrentDocument();
            } else if (this.getCurrentDocumentState) {
                currentDoc = this.getCurrentDocumentState();
            }

            if (!currentDoc) {
                console.log('No document available for sync');
                return;
            }

            const currentDocHash = JSON.stringify(currentDoc.toJSON());

            if (currentDocHash === this.lastSentDocumentHash) {
                console.log('No document changes detected, skipping sync');
                return;
            }

            console.log('Document changes detected, syncing to server...');
            this.pendingSync = true;
            this.lastSentDocumentHash = currentDocHash;

            this.ws.send(JSON.stringify({
                type: 'documentUpdate',
                doc: currentDoc.toJSON(),
                clientId: this.clientId,
                timestamp: new Date().toISOString()
            }));

        } catch (error) {
            console.error('Error syncing document:', error);
            this.pendingSync = false;
        }
    }

    forceSyncDocument() {
        this.lastSentDocumentHash = null;
        this.syncDocument();
    }

    disconnect() {
        console.log('Disconnecting client');
        this.isDestroyed = true;
        this.stopSync();

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close(1000, 'Normal closure');
            this.ws = null;
        }
    }
}

export default DocumentClient;