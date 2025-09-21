import React, { useCallback, useState, useEffect, useRef } from "react";
import { EditorState } from "prosemirror-state";
import { baseKeymap, toggleMark, splitBlock } from "prosemirror-commands";
import { gapCursor } from "prosemirror-gapcursor";
import "prosemirror-gapcursor/style/gapcursor.css";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import "prosemirror-view/style/prosemirror.css";
import { Node } from "prosemirror-model";

import { ProseMirror } from "@handlewithcare/react-prosemirror";

import { Toolbar } from './components/toolbar.js';
import PaginatedEditor, { paginationPlugin } from './components/paginatedEditor.js';
import CollaborationClient from './collaboration/client.js';

import { doc } from "./doc.js";
import './App.css';
import { schema } from "./editor/schema.js";

const preserveScreenplayFormatting = (state, dispatch) => {
  const { selection } = state;
  const { $from } = selection;

  let currentClass = null;

  for (let i = $from.depth; i >= 1; i--) {
    const node = $from.node(i);
    if (node.type.name === 'paragraph' && node.attrs.class && node.attrs.class.startsWith('screenplay-')) {
      currentClass = node.attrs.class;
      break;
    }
  }

  if (currentClass) {
    const tr = state.tr;
    tr.split(selection.from);

    const newPos = selection.from + 1;

    if (newPos < tr.doc.content.size) {
      const $newPos = tr.doc.resolve(newPos);

      for (let i = $newPos.depth; i >= 1; i--) {
        const node = $newPos.node(i);
        if (node.type.name === 'paragraph') {
          const paragraphPos = $newPos.before(i);
          tr.setNodeMarkup(paragraphPos, null, { class: currentClass });
          break;
        }
      }
    }

    if (dispatch) dispatch(tr);
    return true;
  }

  return splitBlock(state, dispatch);
};

const nodeViews = {};

function App() {
  const [state, setState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [participantCount, setParticipantCount] = useState(1); // Default to 1 for offline mode
  const clientRef = useRef(null);
  const hasInitialized = useRef(false);

  // Create editor state
  const createEditorState = useCallback((doc) => {
    return EditorState.create({
      schema,
      doc,
      plugins: [
        history(),
        keymap({
          ...baseKeymap,
          "Mod-i": toggleMark(schema.marks.em),
          "Mod-b": toggleMark(schema.marks.strong),
          "Mod-z": undo,
          "Mod-Shift-z": redo,
          "Mod-y": redo,
          "Enter": preserveScreenplayFormatting,
        }),
        gapCursor(),
        paginationPlugin,
      ],
    });
  }, []);

  // Initialize collaboration
  useEffect(() => {
    // Prevent duplicate initialization in React StrictMode
    if (hasInitialized.current) {
      console.log('Already initialized, skipping');
      return;
    }
    hasInitialized.current = true;

    console.log('Initializing collaboration client');
    const client = new CollaborationClient('ws://localhost:3001');
    clientRef.current = client;

    client.onConnected = (message) => {
      console.log('Connected to collaboration server');
      setIsConnected(true);
      setConnectionError(null);
      setParticipantCount(message.totalParticipants || 1);

      // Create editor state with document from server
      const initialDoc = Node.fromJSON(schema, message.doc);
      const editorState = createEditorState(initialDoc);
      setState(editorState);
    };

    client.onParticipantUpdate = (message) => {
      console.log('Participant count updated:', message.totalParticipants);
      setParticipantCount(message.totalParticipants);
    };

    client.onConnectionError = (error) => {
      console.error('Connection error:', error);
      setConnectionError('Backend server not running - using offline mode');
      setIsConnected(false);
      setParticipantCount(1); // Only this user in offline mode

      // Fallback to local document only if we don't have a state yet
      if (!state) {
        const editorState = createEditorState(doc);
        setState(editorState);
      }
    };

    // Try to connect
    client.connect().catch(error => {
      console.error('Failed to connect to collaboration server:', error);
      setConnectionError('Backend server not running - using offline mode');
      setIsConnected(false);
      setParticipantCount(1); // Only this user in offline mode

      // Fallback to local document
      const editorState = createEditorState(doc);
      setState(editorState);
    });

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up collaboration client');
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      hasInitialized.current = false;
    };
  }, []); // Empty dependency array to ensure this only runs once

  const dispatchTransaction = useCallback(function (tr) {
    setState((prev) => prev.apply(tr));
  }, []);

  if (!state) {
    return (
      <div className="App">
        <div className="loading">
          {connectionError ? (
            <div className="error-message">
              <div>⚠️ {connectionError}</div>
              <div style={{ fontSize: '14px', marginTop: '10px', color: '#666' }}>
                Make sure the backend server is running: <code>cd backend && npm start</code>
              </div>
            </div>
          ) : (
            'Loading editor...'
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="editor-container">
        <div className="connection-status">
          <div className="status-info">
            {isConnected ? (
              <span className="connected">🟢 Connected</span>
            ) : (
              <span className="offline">📴 Offline Mode</span>
            )}
          </div>
          <div className="participant-count">
            <span className="participants-icon">👥</span>
            <span className="participants-number">{participantCount}</span>
            <span className="participants-label">
              participant{participantCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <ProseMirror
          state={state}
          dispatchTransaction={dispatchTransaction}
          nodeViews={nodeViews}
        >
          <Toolbar />
          <PaginatedEditor />
        </ProseMirror>
      </div>
    </div>
  );
}

export default App;