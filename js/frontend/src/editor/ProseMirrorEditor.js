import { EditorState } from "prosemirror-state";
import { schema } from "prosemirror-schema-basic";
import {
    ProseMirror,
    ProseMirrorDoc,
    reactKeys,
} from "@handlewithcare/react-prosemirror";
import { useState } from "react";

import "prosemirror-view/style/prosemirror.css";

export function ProseMirrorEditor() {
    const [editorState, setEditorState] = useState(
        EditorState.create({ schema, plugins: [reactKeys()] })
    );

    return (

        <ProseMirror
            defaultState={editorState}
            dispatchTransaction={(tr) => {
                setEditorState((s) => s.apply(tr));
            }}
        >
            <ProseMirrorDoc />
        </ProseMirror>
    );
}

export default ProseMirrorEditor;