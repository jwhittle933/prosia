# ProseMirror Collaborative Editing Application

This project is a collaborative editing application built using ProseMirror for rich text editing and real-time collaboration. It consists of a backend server that manages the ProseMirror document and a frontend React application that provides the user interface for editing.

## Project Structure

```
prosemirror-collab-app
├── backend
│   ├── server.js          # Entry point for the Node.js server
│   ├── prosemirror
│   │   └── doc.js         # ProseMirror document structure and management
│   ├── package.json       # Backend dependencies and scripts
│   └── README.md          # Documentation for the backend
├── frontend
│   ├── public
│   │   └── index.html     # Main HTML file for the React application
│   ├── src
│   │   ├── App.js         # Main component of the React application
│   │   ├── editor
│   │   │   └── ProseMirrorEditor.js # ProseMirror rich text editor component
│   │   └── index.js       # Entry point for the React application
│   ├── package.json       # Frontend dependencies and scripts
│   └── README.md          # Documentation for the frontend
└── README.md              # Overview of the entire project
```

## Getting Started

### Backend Setup

1. Navigate to the `backend` directory:
   ```
   cd backend
   ```

2. Install the required dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm start
   ```

### Frontend Setup

1. Navigate to the `frontend` directory:
   ```
   cd frontend
   ```

2. Install the required dependencies:
   ```
   npm install
   ```

3. Start the React application:
   ```
   npm start
   ```

## Features

- Real-time collaborative editing using ProseMirror.
- Basic formatting options available in the rich text editor.
- WebSocket integration for handling concurrent edits.

## License

This project is licensed under the MIT License.