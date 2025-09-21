const { Schema } = require("prosemirror-model");
const { nodes: basicNodes, marks: basicMarks } = require("prosemirror-schema-basic");

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
const schema = new Schema({
    nodes: customNodes,
    marks: basicMarks
});

module.exports = { schema };