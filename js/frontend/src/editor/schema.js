import { Schema } from "prosemirror-model";
import { nodes as basicNodes, marks as basicMarks } from "prosemirror-schema-basic";

// Extend the paragraph node to support class attributes
const customNodes = {
    ...basicNodes,
    paragraph: {
        ...basicNodes.paragraph,
        attrs: {
            class: { default: null }
        },
        toDOM(node) {
            const attrs = {};
            if (node.attrs.class) {
                attrs.class = node.attrs.class;
            }
            return ["p", attrs, 0];
        },
        parseDOM: [
            {
                tag: "p",
                getAttrs(dom) {
                    return {
                        class: dom.getAttribute("class") || null
                    };
                }
            }
        ]
    }
};

// Create a simple schema without lists and tables for now
export const schema = new Schema({
    nodes: customNodes,
    marks: basicMarks
});