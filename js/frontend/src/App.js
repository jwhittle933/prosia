import React, { useCallback, useState, useEffect, useRef, use } from "react";
import { Step } from 'prosemirror-transform'
import { EditorState } from "prosemirror-state";
import { baseKeymap, toggleMark, splitBlock } from "prosemirror-commands";
import { gapCursor } from "prosemirror-gapcursor";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { Node } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";
import { collab, receiveTransaction, sendableSteps, getVersion } from "prosemirror-collab"

import { ProseMirror, useEditorEffect } from "@handlewithcare/react-prosemirror";

import { Toolbar } from './components/toolbar.js';
import PaginatedEditor, { paginationPlugin } from './components/paginatedEditor.js';
import DocumentClient, { getDocument, getDocumentSteps, postDocumentSteps } from './document/client.js';

import { doc as initialDoc } from "./doc.js";
import { schema } from "./editor/schema.js";

import './App.css';
import "prosemirror-view/style/prosemirror.css";
import "prosemirror-gapcursor/style/gapcursor.css";

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

class EditorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Editor error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#e74c3c' }}>
          <h3>Editor Error</h3>
          <p>Something went wrong with the editor. Please refresh the page.</p>
          <details style={{ marginTop: '10px', textAlign: 'left' }}>
            <summary>Error Details</summary>
            <pre style={{ fontSize: '12px', background: '#f8f9fa', padding: '10px', borderRadius: '4px' }}>
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

function ViewCapture({ onViewReady }) {
  const viewRef = useRef(null);

  useEditorEffect((view) => {
    if (view && view !== viewRef.current) {
      viewRef.current = view;
      if (onViewReady) {
        onViewReady(view);
      }
    }
  }, [onViewReady]);

  return null;
}

function EditorWithCollaboration({ state, dispatchTransaction, onViewReady }) {
  return (
    <ProseMirror
      state={state}
      dispatchTransaction={dispatchTransaction}
      nodeViews={nodeViews}
    >
      <ViewCapture onViewReady={onViewReady} />
      <Toolbar />
      <PaginatedEditor />
    </ProseMirror>
  );
}

function App() {
  const [state, setState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [participantCount, setParticipantCount] = useState(1);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const [doc, setDoc] = useState(initialDoc);
  const [docVersion, setDocVersion] = useState(1);

  const clientRef = useRef(null);
  const hasInitialized = useRef(false);
  const editorViewRef = useRef(null);
  const isReceivingUpdate = useRef(false);
  const shouldFocusEditor = useRef(true);
  const syncStarted = useRef(false);
  const lastCursorPosition = useRef(null);

  const createEditorState = useCallback((docNode, version = 0) => {
    try {
      return EditorState.create({
        schema,
        doc: docNode,
        plugins: [
          history(),
          collab({ version }),
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
    } catch (error) {
      console.error('Error creating editor state:', error);
      throw error;
    }
  }, []);

  const dispatchTransaction = useCallback((tr) => {
    console.log('Dispatching...');
    try {
      if (!state) {
        console.warn('No state available for transaction');
        return;
      }

      if (editorViewRef.current && tr.selection) {
        lastCursorPosition.current = tr.selection.from;
      }

      if (isReceivingUpdate.current) {
        console.log('Skipping state update - receiving server update');
        return;
      }

      const newState = state.apply(tr);
      setState(newState);
    } catch (error) {
      console.error('Error in dispatchTransaction:', error);
    }
  }, [state]);

  useEffect(() => {
    getDocument().then(({ data }) => {
      if (data) {
        console.log('Fetched initial document from server:', data);
        const serverDoc = schema.nodeFromJSON(data.doc);
        setDoc(serverDoc);
        setDocVersion(data.version || 1);

        const editorState = createEditorState(serverDoc, data.version);
        setState(editorState);
      }
    })
  }, [])

  useEffect(() => {
    // poll the server for changes
    // and dispatch the changes to the local
    // copy of the document.
    let id = setInterval(() => {
      getDocumentSteps(docVersion).then(response => {
        if (response && response.data) {
          const steps = response.data.steps.map(step => Step.fromJSON(schema, step));
          console.log(steps)
          const tr = receiveTransaction(
            state,
            steps,
            []
          );

          dispatchTransaction(tr)
        }
      });
    }, 2000);

    return () => clearInterval(id);
  }, [docVersion, state]);


  const startSyncIfReady = useCallback(() => {
    if (syncStarted.current || !clientRef.current || clientRef.current.isDestroyed || !editorViewRef.current) {
      return false;
    }

    try {
      clientRef.current.startSync(() => editorViewRef.current);
      syncStarted.current = true;
      return true;
    } catch (error) {
      console.error('Error starting sync:', error);
      return false;
    }
  }, []);

  const handleViewReady = useCallback((view) => {
    console.log('View ready callback called');
    editorViewRef.current = view;

    setTimeout(() => {
      startSyncIfReady();
    }, 100);

    if (shouldFocusEditor.current) {
      setTimeout(() => {
        try {
          view.focus();
          const { doc } = view.state;
          const endPos = doc.content.size;
          const selection = TextSelection.create(doc, endPos);
          const tr = view.state.tr.setSelection(selection);
          view.dispatch(tr);
          shouldFocusEditor.current = false;
          console.log('Editor focused and cursor positioned');
        } catch (error) {
          console.error('Error focusing editor:', error);
        }
      }, 200);
    }
  }, [startSyncIfReady]);


  // useEffect(() => {
  //   if (hasInitialized.current) {
  //     return;
  //   }
  //   hasInitialized.current = true;

  //   console.log('Initializing collaboration client');
  //   const client = new DocumentClient('ws://localhost:3001');
  //   clientRef.current = client;

  //   client.onConnected = (message) => {
  //     console.log('Connected to collaboration server');
  //     setIsConnected(true);
  //     setConnectionError(null);
  //     setParticipantCount(message.totalParticipants || 1);

  //     try {
  //       const initialDoc = Node.fromJSON(schema, message.doc);
  //       const editorState = createEditorState(initialDoc, message.version);
  //       setState(editorState);
  //     } catch (error) {
  //       console.error('Error handling connection:', error);
  //       setConnectionError('Error initializing editor');
  //     }
  //   };

  //   client.onStepsReceived = (stepData) => {
  //     console.log('Received steps from server:', stepData.steps.length, 'version:', stepData.version);

  //     if (!editorViewRef.current) {
  //       console.warn('No editor view available to apply steps');
  //       return;
  //     }

  //     if (isReceivingUpdate.current) {
  //       console.log('Already processing an update, skipping steps');
  //       return;
  //     }

  //     isReceivingUpdate.current = true;

  //     try {
  //       const currentState = editorViewRef.current.state;
  //       const currentVersion = getVersion(currentState);

  //       console.log('Current version:', currentVersion, 'Received version:', stepData.version);

  //       const tr = receiveTransaction(
  //         currentState,
  //         stepData.steps,
  //         stepData.clientIDs
  //       );

  //       if (tr) {
  //         console.log('Applying received transaction with', stepData.steps.length, 'steps');

  //         editorViewRef.current.dispatch(tr);

  //         const newState = editorViewRef.current.state;
  //         setState(newState);

  //         console.log('Applied steps, new version:', getVersion(newState));
  //         setLastSyncTime(new Date().toLocaleTimeString());
  //       }
  //     } catch (error) {
  //       console.error('Error applying received steps:', error);
  //     } finally {
  //       setTimeout(() => {
  //         isReceivingUpdate.current = false;
  //       }, 50);
  //     }
  //   };

  //   client.onStepAck = (message) => {
  //     console.log('Received step acknowledgment:', message);

  //     if (!message.success) {
  //       console.warn('Step was rejected by server:', message.error);
  //       return;
  //     }

  //     console.log('Step acknowledged successfully');
  //   };

  //   client.onParticipantUpdate = (message) => {
  //     console.log('Participant count updated:', message.totalParticipants);
  //     setParticipantCount(message.totalParticipants);
  //   };

  //   client.onDocumentUpdate = (message) => {
  //     console.log('Received document update from server - applying carefully to preserve cursor');

  //     if (isReceivingUpdate.current) {
  //       console.log('Already processing an update, skipping');
  //       return;
  //     }

  //     isReceivingUpdate.current = true;

  //     try {
  //       const currentView = editorViewRef.current;
  //       if (!currentView) {
  //         console.warn('No editor view for document update');
  //         return;
  //       }

  //       const currentSelection = currentView.state.selection;
  //       const currentCursor = currentSelection.from;

  //       console.log('Storing cursor position:', currentCursor);

  //       const updatedDoc = Node.fromJSON(schema, message.doc);
  //       const newState = createEditorState(updatedDoc, message.version);

  //       setState(newState);

  //       currentView.updateState(newState);

  //       setTimeout(() => {
  //         try {
  //           if (currentView && currentView.state) {
  //             const maxPos = currentView.state.doc.content.size;
  //             const restorePos = Math.min(currentCursor, maxPos);

  //             console.log('Restoring cursor to position:', restorePos, 'max:', maxPos);

  //             const newSelection = TextSelection.create(currentView.state.doc, restorePos);
  //             const tr = currentView.state.tr.setSelection(newSelection);
  //             currentView.dispatch(tr);

  //             currentView.focus();
  //           }
  //         } catch (error) {
  //           console.error('Error restoring cursor position:', error);
  //         }
  //       }, 10);

  //       setLastSyncTime(new Date().toLocaleTimeString());
  //       console.log('Document updated from server with cursor preservation');
  //     } catch (error) {
  //       console.error('Error applying document update:', error);
  //     } finally {
  //       setTimeout(() => {
  //         isReceivingUpdate.current = false;
  //       }, 100);
  //     }
  //   };

  //   client.onConnectionError = (error) => {
  //     console.error('Connection error:', error);
  //     setConnectionError('Backend server not running - using offline mode');
  //     setIsConnected(false);
  //     setParticipantCount(1);

  //     try {
  //       const fallbackState = createEditorState(doc);
  //       setState(fallbackState);
  //     } catch (createError) {
  //       console.error('Error creating fallback state:', createError);
  //       setConnectionError('Critical error: Cannot initialize editor');
  //     }
  //   };

  //   client.connect().catch(error => {
  //     console.error('Failed to connect to server:', error);
  //     setConnectionError('Backend server not running - using offline mode');
  //     setIsConnected(false);
  //     setParticipantCount(1);

  //     try {
  //       const fallbackState = createEditorState(doc);
  //       setState(fallbackState);
  //     } catch (createError) {
  //       console.error('Error creating fallback state:', createError);
  //       setConnectionError('Critical error: Cannot initialize editor');
  //     }
  //   });

  //   return () => {
  //     console.log('Cleaning up collaboration client');
  //     if (clientRef.current) {
  //       clientRef.current.disconnect();
  //       clientRef.current = null;
  //     }
  //     hasInitialized.current = false;
  //     syncStarted.current = false;
  //   };
  // }, [createEditorState]);

  if (!state) {
    return (
      <div className="App">
        <div className="loading">
          {connectionError ? (
            <div className="error-message">
              <div>{connectionError}</div>
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
        <EditorErrorBoundary>
          <EditorWithCollaboration
            state={state}
            dispatchTransaction={dispatchTransaction}
            onViewReady={handleViewReady}
          />
        </EditorErrorBoundary>
      </div>
    </div>
  );
}

export default App;