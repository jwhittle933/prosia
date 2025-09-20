const { Schema, DOMParser, Node } = require("prosemirror-model");
const { EditorState } = require("prosemirror-state");
const { schema } = require("prosemirror-schema-basic");

// Define the ProseMirror document structure
const initialDoc = Node.fromJSON(schema, {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Welcome to the ProseMirror collaborative editing example!",
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

// Export the initial document and the function to create editor state
module.exports = {
  initialDoc,
  createEditorState,
};