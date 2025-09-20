import React from 'react';
import { useEditorEventCallback } from '@handlewithcare/react-prosemirror';
import { toggleMark } from 'prosemirror-commands';

function Menu() {
    const toggleBold = useEditorEventCallback((view) => {
        const command = toggleMark(view.state.schema.marks.strong);
        command(view.state, view.dispatch, view);
    });

    const toggleItalic = useEditorEventCallback((view) => {
        const command = toggleMark(view.state.schema.marks.em);
        command(view.state, view.dispatch, view);
    });

    return (
        <div style={{ padding: '10px', borderBottom: '1px solid #ccc', background: '#f0f0f0' }}>
            <button onClick={toggleBold} style={{ marginRight: '5px' }}>Bold</button>
            <button onClick={toggleItalic}>Italic</button>
        </div>
    );
}

export default Menu;