import { EditorState } from "prosemirror-state";
import { schema } from "prosemirror-schema-basic";
import { history, redo, undo } from "prosemirror-history";
import {
    ProseMirror,
    ProseMirrorDoc,
    reactKeys,
} from "@handlewithcare/react-prosemirror";
import { collab, receiveTransaction, sendableSteps, getVersion } from "prosemirror-collab"

import { useState } from "react";
import './App.css';
import "prosemirror-view/style/prosemirror.css";
import "prosemirror-gapcursor/style/gapcursor.css";

export function ProseMirrorEditor() {
    const [editorState, setEditorState] = useState(
        EditorState.create({
            schema,
            plugins: [
                history(),
                reactKeys(),
                collab(),
            ]
        })
    );

    return (
        <ProseMirror
            state={editorState}
            dispatchTransaction={(tr) => {
                setEditorState((s) => s.apply(tr));
            }}
        >
            <ProseMirrorDoc />
        </ProseMirror>
    );
}

export default ProseMirrorEditor;