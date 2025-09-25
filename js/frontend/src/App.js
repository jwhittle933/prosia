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
  const editorViewRef = useRef(null);
  const isReceivingUpdate = useRef(false);
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
          if (steps.length === 0) {
            return;
          }

          const tr = receiveTransaction(
            state,
            steps,
            []
          );
          console.log(tr)

          if (state) {
            const newState = state.apply(tr);
            setState(newState);
          }
        }
      });
    }, 2000);

    return () => clearInterval(id);
  }, [docVersion, state]);

  useEffect(() => {
    console.log('State updated:', state);
    if (!state) return

    let st = sendableSteps(state);
    console.log('Sendable steps:', st);

    if (!st || !st.steps) return;

    let v = getVersion(state);
    postDocumentSteps(v, st.steps).then(result => {
      console.log(result)
      setDocVersion(result.data.version);
    });


  }, [state])


  const handleViewReady = useCallback((view) => {
    editorViewRef.current = view;
    view.focus();
  }, []);

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