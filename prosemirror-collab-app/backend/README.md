# Backend README

# ProseMirror Collaborative Editing Backend

This backend server is designed to support real-time collaborative editing using ProseMirror. It maintains a ProseMirror document in memory and allows multiple users to edit the document concurrently.

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm (Node package manager)

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/prosemirror-collab-app.git
   ```

2. Navigate to the backend directory:

   ```
   cd prosemirror-collab-app/backend
   ```

3. Install the required dependencies:

   ```
   npm install
   ```

### Running the Server

To start the server, run the following command:

```
node server.js
```

The server will start and listen for WebSocket connections on the specified port (default is 3000).

### WebSocket Connection

The server uses WebSocket for real-time communication. Clients can connect to the server to receive updates and send edits to the ProseMirror document.

### ProseMirror Document Structure

The initial state of the ProseMirror document is defined in `prosemirror/doc.js`. This file also includes functions to apply changes and manage the document's state for concurrent editing.

## Contributing

If you would like to contribute to this project, please fork the repository and submit a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for details.