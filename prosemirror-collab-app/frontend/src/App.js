import React, { useCallback, useState, useEffect, useRef } from "react";
import { EditorState } from "prosemirror-state";
import { baseKeymap, toggleMark, splitBlock } from "prosemirror-commands";
import { gapCursor } from "prosemirror-gapcursor";
import "prosemirror-gapcursor/style/gapcursor.css";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import "prosemirror-view/style/prosemirror.css";
import { Node } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";

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
  const [participantCount, setParticipantCount] = useState(1);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const clientRef = useRef(null);
  const hasInitialized = useRef(false);
  const editorViewRef = useRef(null);
  const isReceivingUpdate = useRef(false);
  const shouldFocusEditor = useRef(true);

  // Create editor state - stable function that doesn't change
  const createEditorState = useCallback((docNode) => {
    return EditorState.create({
      schema,
      doc: docNode,
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

  // Auto-focus the editor when it's ready
  const focusEditor = useCallback(() => {
    if (!editorViewRef.current || !shouldFocusEditor.current) {
      return;
    }

    try {
      console.log('Focusing editor');

      // Focus the editor first
      editorViewRef.current.focus();

      // Set selection to the end of the document
      const { doc } = editorViewRef.current.state;
      const endPos = doc.content.size;

      // Create a text selection at the end
      const selection = TextSelection.create(doc, endPos);
      const tr = editorViewRef.current.state.tr.setSelection(selection);
      editorViewRef.current.dispatch(tr);

      shouldFocusEditor.current = false; // Only auto-focus once
      console.log('Editor focused and cursor positioned');
    } catch (error) {
      console.error('Error focusing editor:', error);
    }
  }, []);

  // Initialize collaboration - this effect should only run once
  useEffect(() => {
    // Prevent duplicate initialization
    if (hasInitialized.current) {
      console.log('Already initialized, skipping');
      return;
    }
    hasInitialized.current = true;

    console.log('Initializing collaboration client');
    const client = new CollaborationClient('ws://localhost:3001');
    clientRef.current = client;

    // Setup event handlers
    client.onConnected = (message) => {
      console.log('Connected to collaboration server');
      setIsConnected(true);
      setConnectionError(null);
      setParticipantCount(message.totalParticipants || 1);

      // Create editor state with document from server
      const initialDoc = Node.fromJSON(schema, message.doc);
      const editorState = createEditorState(initialDoc);
      setState(editorState);

      // Start document syncing after editor is ready
      setTimeout(() => {
        if (clientRef.current && !clientRef.current.isDestroyed) {
          client.startSync(() => {
            // Get current document state
            return clientRef.current.getCurrentDocumentState?.();
          });
        }
      }, 1000);
    };

    client.onParticipantUpdate = (message) => {
      console.log('Participant count updated:', message.totalParticipants);
      setParticipantCount(message.totalParticipants);
    };

    client.onDocumentUpdate = (message) => {
      console.log('Received document update from server');

      // Prevent infinite loops when receiving updates
      if (isReceivingUpdate.current) {
        console.log('Already processing an update, skipping');
        return;
      }

      isReceivingUpdate.current = true;

      try {
        const updatedDoc = Node.fromJSON(schema, message.doc);
        const newState = createEditorState(updatedDoc);
        setState(newState);
        setLastSyncTime(new Date().toLocaleTimeString());
        console.log('Document updated from server');
      } catch (error) {
        console.error('Error applying document update:', error);
      } finally {
        // Reset flag after a short delay
        setTimeout(() => {
          isReceivingUpdate.current = false;
        }, 100);
      }
    };

    client.onConnectionError = (error) => {
      console.error('Connection error:', error);
      setConnectionError('Backend server not running - using offline mode');
      setIsConnected(false);
      setParticipantCount(1);

      // Create fallback state if we don't have one
      const fallbackState = createEditorState(doc);
      setState(fallbackState);
    };

    // Try to connect
    client.connect().catch(error => {
      console.error('Failed to connect to collaboration server:', error);
      setConnectionError('Backend server not running - using offline mode');
      setIsConnected(false);
      setParticipantCount(1);

      // Create fallback state
      const fallbackState = createEditorState(doc);
      setState(fallbackState);
    });

    // Cleanup function
    return () => {
      console.log('Cleaning up collaboration client');
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      hasInitialized.current = false;
    };
  }, []); // FIXED: Empty dependency array - only run once!

  // Set up document getter for the client when state changes
  useEffect(() => {
    if (clientRef.current && state) {
      clientRef.current.getCurrentDocumentState = () => state.doc;
    }
  }, [state]);

  const dispatchTransaction = useCallback(function (tr) {
    setState((prev) => prev.apply(tr));
  }, []);

  const handleEditorMount = useCallback((view) => {
    console.log('Editor view mounted');
    editorViewRef.current = view;

    // Wait for next tick to ensure view is fully ready
    requestAnimationFrame(() => {
      if (shouldFocusEditor.current) {
        focusEditor();
      }
    });
  }, [focusEditor]);

  // Also try to focus when state updates (in case mount happens before state is set)
  useEffect(() => {
    if (editorViewRef.current && state && shouldFocusEditor.current) {
      requestAnimationFrame(() => {
        focusEditor();
      });
    }
  }, [state, focusEditor]);

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
          {lastSyncTime && (
            <div className="sync-status">
              <span className="sync-label">Last sync: {lastSyncTime}</span>
            </div>
          )}
        </div>
        <ProseMirror
          state={state}
          dispatchTransaction={dispatchTransaction}
          nodeViews={nodeViews}
          mount={handleEditorMount}
        >
          <Toolbar />
          <PaginatedEditor />
        </ProseMirror>
      </div>
    </div>
  );
}

export default App;