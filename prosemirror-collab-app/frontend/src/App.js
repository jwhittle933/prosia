import React, { StrictMode, useCallback, useState } from "react";
import { EditorState, Plugin } from "prosemirror-state";
import { baseKeymap, toggleMark, splitBlock } from "prosemirror-commands";
import { gapCursor } from "prosemirror-gapcursor";
import "prosemirror-gapcursor/style/gapcursor.css";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import "prosemirror-view/style/prosemirror.css";
import { createRoot } from "react-dom/client";

import { ProseMirror, ProseMirrorDoc, reactKeys, useEditorEventCallback, useEditorEffect } from "@handlewithcare/react-prosemirror";

import { LinkTooltip } from "./LinkTooltip.js";
import Menu from "./Menu.js";
import { doc } from "./doc.js";
import './App.css';
import { schema } from "./editor/schema.js";

// Custom Enter command to preserve screenplay formatting
const preserveScreenplayFormatting = (state, dispatch) => {
  const { selection } = state;
  const { $from } = selection;

  // Get the current paragraph
  let currentClass = null;

  // Walk up to find a paragraph with screenplay formatting
  for (let i = $from.depth; i >= 1; i--) {
    const node = $from.node(i);
    if (node.type.name === 'paragraph' && node.attrs.class && node.attrs.class.startsWith('screenplay-')) {
      currentClass = node.attrs.class;
      break;
    }
  }

  if (currentClass) {
    // Do everything in a single transaction
    const tr = state.tr;

    // Split the paragraph
    tr.split(selection.from);

    // Get the position right after the split
    const newPos = selection.from + 1;

    // Apply formatting to the new paragraph
    if (newPos < tr.doc.content.size) {
      const $newPos = tr.doc.resolve(newPos);

      // Find the new paragraph
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

  // No screenplay formatting, use default behavior
  return splitBlock(state, dispatch);
};

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
    "Enter": preserveScreenplayFormatting,
  }),
  gapCursor(),
];

const nodeViews = {};

function ToolbarButton({ onClick, active, children }) {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  const handleMouseDown = (e) => {
    e.preventDefault(); // Prevent focus loss
  };

  return (
    <button
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      className={`toolbar-button ${active ? 'active' : ''}`}
    >
      {children}
    </button>
  );
}

function Toolbar() {
  const [currentFormat, setCurrentFormat] = useState(null);

  // Track current formatting based on cursor position
  useEditorEffect((view) => {
    const { state } = view;
    const { selection } = state;
    const { $from } = selection;

    // Find current screenplay formatting
    let formatClass = null;
    for (let i = $from.depth; i >= 1; i--) {
      const node = $from.node(i);
      if (node.type.name === 'paragraph' && node.attrs.class && node.attrs.class.startsWith('screenplay-')) {
        formatClass = node.attrs.class;
        break;
      }
    }

    setCurrentFormat(formatClass);
  });

  const toggleBold = useEditorEventCallback((view) => {
    const command = toggleMark(view.state.schema.marks.strong);
    command(view.state, view.dispatch, view);
    view.focus(); // Ensure editor maintains focus
  });

  const toggleItalic = useEditorEventCallback((view) => {
    const command = toggleMark(view.state.schema.marks.em);
    command(view.state, view.dispatch, view);
    view.focus(); // Ensure editor maintains focus
  });

  // Helper function to apply screenplay formatting to the current line/paragraph
  const applyScreenplayFormat = (view, formatClass) => {
    const { state, dispatch } = view;
    const { selection } = state;
    const { from } = selection;

    // Find the current paragraph
    const $from = state.doc.resolve(from);
    const paragraph = $from.node($from.depth);
    const paragraphPos = $from.before($from.depth);

    // Apply the class to the current paragraph
    const tr = state.tr.setNodeMarkup(paragraphPos, null, {
      ...paragraph.attrs,
      class: formatClass
    });

    dispatch(tr);
    view.focus(); // Ensure editor maintains focus
  };

  // Create specific handlers for each screenplay format
  const applySceneFormat = useEditorEventCallback((view) => {
    applyScreenplayFormat(view, 'screenplay-scene');
  });

  const applyCharacterFormat = useEditorEventCallback((view) => {
    applyScreenplayFormat(view, 'screenplay-character');
  });

  const applyDialogueFormat = useEditorEventCallback((view) => {
    applyScreenplayFormat(view, 'screenplay-dialogue');
  });

  const applyParentheticalFormat = useEditorEventCallback((view) => {
    applyScreenplayFormat(view, 'screenplay-parenthetical');
  });

  const applyActionFormat = useEditorEventCallback((view) => {
    applyScreenplayFormat(view, 'screenplay-action');
  });

  const applyTransitionFormat = useEditorEventCallback((view) => {
    applyScreenplayFormat(view, 'screenplay-transition');
  });

  // Clear formatting
  const clearFormat = useEditorEventCallback((view) => {
    const { state, dispatch } = view;
    const { selection } = state;
    const $from = state.doc.resolve(selection.from);
    const paragraph = $from.node($from.depth);
    const paragraphPos = $from.before($from.depth);

    const tr = state.tr.setNodeMarkup(paragraphPos, null, {
      ...paragraph.attrs,
      class: null
    });
    dispatch(tr);
    view.focus(); // Ensure editor maintains focus
  });

  return (
    <div className="toolbar-sticky">
      <div className="toolbar">
        <div className="toolbar-section">
          <strong>Format:</strong>
          <ToolbarButton onClick={toggleBold}>B</ToolbarButton>
          <ToolbarButton onClick={toggleItalic}>I</ToolbarButton>
          <ToolbarButton onClick={clearFormat} active={!currentFormat}>Clear</ToolbarButton>
        </div>

        <div className="toolbar-section">
          <strong>Screenplay:</strong>
          <ToolbarButton onClick={applySceneFormat} active={currentFormat === 'screenplay-scene'}>
            Scene
          </ToolbarButton>
          <ToolbarButton onClick={applyCharacterFormat} active={currentFormat === 'screenplay-character'}>
            Character
          </ToolbarButton>
          <ToolbarButton onClick={applyDialogueFormat} active={currentFormat === 'screenplay-dialogue'}>
            Dialogue
          </ToolbarButton>
          <ToolbarButton onClick={applyParentheticalFormat} active={currentFormat === 'screenplay-parenthetical'}>
            Parenthetical
          </ToolbarButton>
          <ToolbarButton onClick={applyActionFormat} active={currentFormat === 'screenplay-action'}>
            Action
          </ToolbarButton>
          <ToolbarButton onClick={applyTransitionFormat} active={currentFormat === 'screenplay-transition'}>
            Transition
          </ToolbarButton>
        </div>
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
      <div className="editor-container">
        <ProseMirror
          state={state}
          dispatchTransaction={dispatchTransaction}
          nodeViews={nodeViews}
          plugins={plugins}
        >
          <Toolbar />
          <div className="editor-document">
            <ProseMirrorDoc spellCheck={false} />
          </div>
          <LinkTooltip />
        </ProseMirror>
      </div>
    </div>
  );
}

export default App;