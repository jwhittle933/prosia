# ProseMirror Collaborative Editing Application

This project is a collaborative editing application built using ProseMirror for rich text editing and real-time collaboration. It consists of a backend server that manages the ProseMirror document and a frontend React application that provides the user interface for editing.

## Project Structure

- **backend/**: Contains the Node.js server and ProseMirror document management.
  - **server.js**: Entry point for the Node.js server.
  - **prosemirror/**: Contains ProseMirror document structure and management.
  - **package.json**: Configuration file for backend dependencies.
  - **README.md**: Documentation for the backend setup and usage.

- **frontend/**: Contains the React application for the rich text editor.
  - **public/**: Contains static files for the React application.
    - **index.html**: Main HTML file for the React app.
  - **src/**: Contains the source code for the React application.
    - **App.js**: Main component of the React application.
    - **editor/**: Contains the ProseMirror editor component.
      - **ProseMirrorEditor.js**: React component implementing the ProseMirror editor.
    - **index.js**: Entry point for the React application.
  - **package.json**: Configuration file for frontend dependencies.
  - **README.md**: Documentation for the frontend setup and usage.

## Getting Started

### Backend Setup

1. Navigate to the `backend` directory:
   ```
   cd backend
   ```

2. Install the dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   node server.js
   ```

### Frontend Setup

1. Navigate to the `frontend` directory:
   ```
   cd frontend
   ```

2. Install the dependencies:
   ```
   npm install
   ```

3. Start the React application:
   ```
   npm start
   ```

## Features

- Real-time collaborative editing using ProseMirror.
- Basic rich text formatting options.
- WebSocket support for concurrent edits.

## License

This project is licensed under the MIT License.