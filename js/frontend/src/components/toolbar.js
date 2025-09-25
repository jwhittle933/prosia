import React, { useState } from "react";
import { toggleMark } from "prosemirror-commands";
import { useEditorEventCallback, useEditorEffect } from "@handlewithcare/react-prosemirror";

function ToolbarButton({ onClick, active, children }) {
    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    };

    const handleMouseDown = (e) => {
        e.preventDefault();
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

    useEditorEffect((view) => {
        const { state } = view;
        const { selection } = state;
        const { $from } = selection;

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
        view.focus();
    });

    const toggleItalic = useEditorEventCallback((view) => {
        const command = toggleMark(view.state.schema.marks.em);
        command(view.state, view.dispatch, view);
        view.focus();
    });

    const applyScreenplayFormat = (view, formatClass) => {
        const { state, dispatch } = view;
        const { selection } = state;
        const { from } = selection;

        const $from = state.doc.resolve(from);
        const paragraph = $from.node($from.depth);
        const position = $from.depth === 0 ? 0 : $from.before($from.depth);
        const { attrs } = paragraph;

        if (attrs.class && attrs.class === formatClass) {
            const tr = state.tr.setNodeMarkup(position, null, {
                ...attrs,
                class: null
            });
            dispatch(tr);
        } else {
            const tr = state.tr.setNodeMarkup(position, null, {
                ...attrs,
                class: formatClass
            });
            dispatch(tr);
        }

        view.focus();
    };

    const clearFormat = useEditorEventCallback((view) => {
        const { state, dispatch } = view;
        const { selection } = state;
        const $from = state.doc.resolve(selection.from);
        const paragraph = $from.node($from.depth);
        const position = $from.depth === 0 ? 0 : $from.before($from.depth);

        const tr = state.tr.setNodeMarkup(position, null, {
            ...paragraph.attrs,
            class: null
        });
        dispatch(tr);
        view.focus();
    });

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

export { ToolbarButton, Toolbar };