import { sendableSteps, getVersion } from "prosemirror-collab"
import { Step } from "prosemirror-transform"
import axios from "axios"

export const getDocument = () => {
    return axios.get("http://localhost:3001/api/document")
}

export const getDocumentSteps = (version) => {
    return axios.get(`http://localhost:3001/api/document/steps?version=${version}`)
}

export const postDocumentSteps = (version, steps) => {
    return axios.post(`http://localhost:3001/api/document/steps`, {
        version,
        steps: steps.map(step => step.toJSON())
    })
}


class DocumentClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.onConnected = null;
        this.onConnectionError = null;
        this.onParticipantUpdate = null;
        this.onStepsReceived = null;
        this.onDocumentUpdate = null;
        this.isConnecting = false;
        this.isDestroyed = false;
        this.clientId = null;
        this.getEditorView = null;

        this.syncTimer = null;
        this.pendingSteps = [];
        this.stepsSent = 0;
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

                        if (message.type === 'connected' || message.type === 'init') {
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
            case 'connected':
            case 'init':
                console.log('Received connected message:', message);
                this.clientId = message.clientId;
                if (this.onConnected) {
                    this.onConnected(message);
                }
                break;

            case 'steps':
                this.handleStepsReceived(message);
                break;

            case 'stepAck':
                console.log('Received step acknowledgment:', message);
                this.handleStepAck(message);
                break;

            case 'participantUpdate':
            case 'participant-update':
                if (this.onParticipantUpdate) {
                    this.onParticipantUpdate(message);
                }
                break;

            case 'documentUpdate':
            case 'document-update':
                if (this.onDocumentUpdate) {
                    this.onDocumentUpdate(message);
                }
                break;

            default:
                console.log('Unknown message type:', message.type);
        }
    }

    handleStepsReceived(message) {
        if (!this.getEditorView || !this.onStepsReceived) {
            console.warn('No editor view or steps handler available');
            return;
        }

        try {
            console.log('Processing received steps:', message);

            const view = this.getEditorView();
            if (!view || !view.state || !view.state.schema) {
                console.error('No editor view or schema available for step processing');
                return;
            }

            const schema = view.state.schema;

            const steps = message.steps.map(stepData => {
                const stepJSON = stepData.step || stepData;
                return Step.fromJSON(schema, stepJSON);
            });

            const clientIDs = message.steps.map(stepData => stepData.clientId || stepData.clientID || this.clientId);

            console.log(`Processed ${steps.length} steps from server`);

            if (this.onStepsReceived) {
                this.onStepsReceived({
                    version: message.version,
                    steps,
                    clientIDs
                });
            }
        } catch (error) {
            console.error('Error handling received steps:', error);
            console.error('Message structure:', message);
        }
    }

    handleStepAck(message) {
        const acknowledgedSteps = message.stepsSent;
        this.stepsSent -= acknowledgedSteps;
        this.pendingSteps.splice(0, acknowledgedSteps);

        if (this.stepsSent < 0) {
            console.warn('Step acknowledgment mismatch, resetting');
            this.stepsSent = 0;
            this.pendingSteps = [];
        }
    }

    startSync(getEditorView) {
        if (this.isDestroyed) {
            console.log('Client is destroyed, not starting sync');
            return;
        }

        if (this.syncTimer) {
            this.stopSync();
        }

        this.getEditorView = getEditorView;

        this.syncTimer = setInterval(() => {
            if (!this.isDestroyed) {
                this.syncSteps();
            }
        }, 1000);

        console.log('Step sync started (1000ms intervals)');
    }

    stopSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            console.log('Step sync stopped');
        }
    }

    syncSteps() {
        if (this.isDestroyed || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        if (!this.getEditorView) {
            return;
        }

        try {
            const view = this.getEditorView();
            if (!view || !view.state) {
                return;
            }

            const sendable = sendableSteps(view.state);

            if (!sendable || !sendable.steps || !sendable.steps.length) {
                return;
            }

            console.log(`SyncSteps: Found ${sendable.steps.length} steps to send, version: ${sendable.version}`);

            const stepsData = sendable.steps.map((step, index) => {
                console.log(`SyncSteps: Step ${index}:`, step);
                return {
                    step: step.toJSON(),
                    clientId: sendable.clientID
                };
            });

            this.pendingSteps.push(...sendable.steps);
            this.stepsSent += sendable.steps.length;

            const message = {
                type: 'steps',
                version: sendable.version,
                steps: stepsData,
                clientID: sendable.clientID,
                timestamp: new Date().toISOString()
            };

            console.log('SyncSteps: Sending message:', message);
            this.ws.send(JSON.stringify(message));

        } catch (error) {
            console.error('SyncSteps: Error syncing steps:', error);
        }
    }

    sendStep(step) {
        if (this.isDestroyed || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return false;
        }

        try {
            const view = this.getEditorView();
            if (!view || !view.state) {
                return false;
            }

            const version = getVersion(view.state);

            console.log('Sending immediate step to server');

            this.pendingSteps.push(step);
            this.stepsSent += 1;

            this.ws.send(JSON.stringify({
                type: 'steps',
                version: version,
                steps: [{
                    step: step.toJSON(),
                    clientId: this.clientId
                }],
                clientID: this.clientId,
                timestamp: new Date().toISOString()
            }));

            return true;
        } catch (error) {
            console.error('Error sending step:', error);
            return false;
        }
    }

    getCollabState() {
        const view = this.getEditorView();
        if (!view || !view.state) {
            return null;
        }

        return {
            version: getVersion(view.state),
            pendingSteps: this.pendingSteps.length,
            stepsSent: this.stepsSent
        };
    }

    disconnect() {
        console.log('Disconnecting client');
        this.isDestroyed = true;
        this.stopSync();

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close(1000, 'Normal closure');
            this.ws = null;
        }

        this.pendingSteps = [];
        this.stepsSent = 0;
    }
}

export default DocumentClient;