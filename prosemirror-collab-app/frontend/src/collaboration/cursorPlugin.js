import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const cursorPluginKey = new PluginKey('collaborativeCursors');

export function createCursorPlugin() {
    return new Plugin({
        key: cursorPluginKey,
        state: {
            init() {
                return {
                    cursors: new Map(),
                    decorations: DecorationSet.empty
                };
            },
            apply(tr, pluginState) {
                let { cursors, decorations } = pluginState;

                // Map decorations through the transaction
                decorations = decorations.map(tr.mapping, tr.doc);

                const cursorUpdate = tr.getMeta(cursorPluginKey);
                if (cursorUpdate) {
                    cursors = new Map(cursors);

                    if (cursorUpdate.type === 'update') {
                        cursors.set(cursorUpdate.clientId, {
                            cursor: cursorUpdate.cursor,
                            color: cursorUpdate.color
                        });
                    } else if (cursorUpdate.type === 'remove') {
                        cursors.delete(cursorUpdate.clientId);
                    }

                    decorations = createCursorDecorations(cursors, tr.doc);
                }

                return { cursors, decorations };
            }
        },
        props: {
            decorations(state) {
                return this.getState(state).decorations;
            }
        }
    });
}

function createCursorDecorations(cursors, doc) {
    const decorations = [];

    cursors.forEach(({ cursor, color }, clientId) => {
        if (!cursor || typeof cursor.from !== 'number') {
            return;
        }

        const pos = Math.min(Math.max(0, cursor.from), doc.content.size);

        try {
            // Create a simple cursor line
            const cursorWidget = Decoration.widget(pos, () => {
                const element = document.createElement('span');
                element.style.cssText = `
          display: inline-block;
          position: relative;
          width: 0;
          height: 0;
        `;

                const cursor = document.createElement('div');
                cursor.style.cssText = `
          position: absolute;
          left: 0;
          top: 0;
          width: 2px;
          height: 1.2em;
          background-color: ${color};
          pointer-events: none;
          z-index: 100;
          animation: collaborativeCursorBlink 1s infinite;
        `;

                const label = document.createElement('div');
                label.style.cssText = `
          position: absolute;
          left: 4px;
          top: -20px;
          background-color: ${color};
          color: white;
          padding: 2px 4px;
          border-radius: 2px;
          font-size: 10px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 101;
        `;
                label.textContent = clientId.substring(0, 6);

                element.appendChild(cursor);
                element.appendChild(label);

                return element;
            }, {
                side: 1,
                marks: [],
                key: `cursor-${clientId}`
            });

            decorations.push(cursorWidget);

            // Add selection decoration if needed
            if (cursor.to && cursor.to !== cursor.from && cursor.to > cursor.from) {
                const from = Math.min(Math.max(0, cursor.from), doc.content.size);
                const to = Math.min(Math.max(0, cursor.to), doc.content.size);

                if (from < to) {
                    const selectionDecoration = Decoration.inline(from, to, {
                        style: `background-color: ${color}30;`
                    });
                    decorations.push(selectionDecoration);
                }
            }
        } catch (error) {
            console.error('Error creating cursor decoration:', error);
        }
    });

    return DecorationSet.create(doc, decorations);
}

export function updateCursor(clientId, cursor, color) {
    return (state, dispatch) => {
        const tr = state.tr.setMeta(cursorPluginKey, {
            type: 'update',
            clientId,
            cursor,
            color
        });

        if (dispatch) {
            dispatch(tr);
        }

        return true;
    };
}

export function removeCursor(clientId) {
    return (state, dispatch) => {
        const tr = state.tr.setMeta(cursorPluginKey, {
            type: 'remove',
            clientId
        });

        if (dispatch) {
            dispatch(tr);
        }

        return true;
    };
}