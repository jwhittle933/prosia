const { Schema, DOMParser, Node } = require("prosemirror-model");
const { EditorState } = require("prosemirror-state");
const { schema } = require('./schema');
const { JSDOM } = require('jsdom');

const initialDoc = Node.fromJSON(schema, {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Welcome to the party",
        },
      ],
    },
  ],
});

function createEditorState(doc = initialDoc) {
  return EditorState.create({
    doc,
    schema,
  });
}

function createDocument() {
  return schema.node('doc', null, [
    schema.node('paragraph', null, [])
  ]);
}

module.exports = {
  initialDoc,
  createEditorState,
  createDocument,
};