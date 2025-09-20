import React, { StrictMode, useCallback, useState } from "react";
import { EditorState } from "prosemirror-state";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import { gapCursor } from "prosemirror-gapcursor";
import "prosemirror-gapcursor/style/gapcursor.css";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import "prosemirror-view/style/prosemirror.css";
import { createRoot } from "react-dom/client";

import { ProseMirror, ProseMirrorDoc, reactKeys, useEditorEventCallback } from "@handlewithcare/react-prosemirror";

import { LinkTooltip } from "./LinkTooltip.js";
import Menu from "./Menu.js";
import { doc } from "./doc.js";
import './App.css';
import { schema } from "./editor/schema.js";

const editorState = EditorState.create({
  schema,
  doc,
  plugins: [
    history(),
    reactKeys(),
  ],
});

const plugins = [
  keymap({
    ...baseKeymap,
    "Mod-i": toggleMark(schema.marks.em),
    "Mod-b": toggleMark(schema.marks.strong),
    "Mod-Shift-c": toggleMark(schema.marks.code),
    "Mod-z": undo,
    "Mod-Shift-z": redo,
    "Mod-y": redo,
  }),
  gapCursor(),
];

const nodeViews = {};

// Hollywood screenplay formatting styles
const screenplayStyles = {
  scene: { marginTop: '24px', marginBottom: '12px', fontWeight: 'bold', textTransform: 'uppercase' },
  character: { marginTop: '24px', marginLeft: '220px', fontWeight: 'bold', textTransform: 'uppercase' },
  dialogue: { marginLeft: '120px', marginRight: '120px' },
  parenthetical: { marginLeft: '160px', fontStyle: 'italic' },
  action: { marginTop: '12px', marginBottom: '12px' },
  transition: { marginTop: '24px', textAlign: 'right', fontWeight: 'bold', textTransform: 'uppercase' }
};

function ToolbarButton({ onClick, active, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 12px',
        margin: '2px',
        border: '1px solid #ccc',
        background: active ? '#007acc' : 'white',
        color: active ? 'white' : 'black',
        cursor: 'pointer',
        borderRadius: '4px'
      }}
    >
      {children}
    </button>
  );
}

function Toolbar() {
  const toggleBold = useEditorEventCallback((view) => {
    const command = toggleMark(view.state.schema.marks.strong);
    command(view.state, view.dispatch, view);
  });

  const toggleItalic = useEditorEventCallback((view) => {
    const command = toggleMark(view.state.schema.marks.em);
    command(view.state, view.dispatch, view);
  });

  const applyScreenplayFormat = useEditorEventCallback((view, formatType) => {
    const { state, dispatch } = view;
    const { selection } = state;
    const tr = state.tr;

    const sampleText = {
      scene: 'INT. OFFICE - DAY',
      character: 'JOHN',
      dialogue: 'This is dialogue text.',
      parenthetical: '(beat)',
      action: 'John walks to the window.',
      transition: 'CUT TO:'
    };

    tr.insertText(sampleText[formatType] || formatType.toUpperCase(), selection.from, selection.to);
    dispatch(tr);
  });

  return (
    <div style={{ padding: '10px', borderBottom: '1px solid #ccc', background: '#f5f5f5' }}>
      <div style={{ marginBottom: '8px' }}>
        <strong>Text Formatting:</strong>
        <ToolbarButton onClick={toggleBold}>Bold</ToolbarButton>
        <ToolbarButton onClick={toggleItalic}>Italic</ToolbarButton>
      </div>

      <div>
        <strong>Screenplay Elements:</strong>
        <ToolbarButton onClick={() => applyScreenplayFormat(null, 'scene')}>
          Scene Heading
        </ToolbarButton>
        <ToolbarButton onClick={() => applyScreenplayFormat(null, 'character')}>
          Character
        </ToolbarButton>
        <ToolbarButton onClick={() => applyScreenplayFormat(null, 'dialogue')}>
          Dialogue
        </ToolbarButton>
        <ToolbarButton onClick={() => applyScreenplayFormat(null, 'parenthetical')}>
          Parenthetical
        </ToolbarButton>
        <ToolbarButton onClick={() => applyScreenplayFormat(null, 'action')}>
          Action
        </ToolbarButton>
        <ToolbarButton onClick={() => applyScreenplayFormat(null, 'transition')}>
          Transition
        </ToolbarButton>
      </div>
    </div>
  );
}

function App() {
  const [state, setState] = useState(editorState);

  const dispatchTransaction = useCallback(function (tr) {
    setState((prev) => {
      return prev.apply(tr);
    });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1 className="App-title">ProseMirror Screenplay Editor</h1>
      </header>

      <div className="editor-container">
        <ProseMirror
          state={state}
          dispatchTransaction={dispatchTransaction}
          nodeViews={nodeViews}
          plugins={plugins}
        >
          <Toolbar />
          <div style={{ minHeight: '400px', border: '1px solid #ccc', margin: '10px 0' }}>
            <ProseMirrorDoc spellCheck={false} />
          </div>
          <LinkTooltip />
        </ProseMirror>
      </div>
    </div>
  );
}

export default App;