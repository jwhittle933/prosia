const { Schema, DOMParser, Node } = require("prosemirror-model");
const { EditorState } = require("prosemirror-state");
const { schema } = require('./schema');
const { JSDOM } = require('jsdom');

// Define the ProseMirror document structure
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

// Function to create a new EditorState
function createEditorState(doc = initialDoc) {
  return EditorState.create({
    doc,
    schema,
  });
}

function createDocument() {
  // Create a completely empty document with just a single empty paragraph
  return schema.node('doc', null, [
    schema.node('paragraph', null, [])
  ]);
}

// Export the initial document and the function to create editor state
module.exports = {
  initialDoc,
  createEditorState,
  createDocument,
};