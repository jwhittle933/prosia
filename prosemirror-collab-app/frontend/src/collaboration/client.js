import { collab, receiveTransaction, sendableSteps, getVersion } from 'prosemirror-collab';

class CollaborationClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.onConnected = null;
        this.onConnectionError = null;
        this.onParticipantUpdate = null;
        this.isConnecting = false;
        this.isDestroyed = false;
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
                        console.log('Received WebSocket message:', message.type, message);

                        if (message.type === 'init') {
                            console.log('Received initial document with', message.totalParticipants, 'participants');
                            if (this.onConnected) {
                                this.onConnected(message);
                            }
                            resolve(message);
                        } else if (message.type === 'participantUpdate') {
                            console.log(`Participant update received: ${message.totalParticipants} participants`);
                            if (this.onParticipantUpdate) {
                                this.onParticipantUpdate(message);
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('WebSocket disconnected');
                    this.isConnecting = false;
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.isConnecting = false;

                    if (this.onConnectionError) {
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

    disconnect() {
        console.log('Disconnecting client');
        this.isDestroyed = true;

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

export default CollaborationClient;