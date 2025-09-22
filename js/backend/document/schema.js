const { Schema } = require("prosemirror-model");
const { nodes: basicNodes, marks: basicMarks } = require("prosemirror-schema-basic");

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

const schema = new Schema({
    nodes: customNodes,
    marks: basicMarks
});

module.exports = { schema };