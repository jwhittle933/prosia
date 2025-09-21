const { Schema, DOMParser, Node } = require("prosemirror-model");
const { EditorState } = require("prosemirror-state");
const { schema } = require("prosemirror-schema-basic");
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

function createDocument() {
  const htmlContent = `
    <p class="screenplay-scene">INT. HAWKINS POLICE STATION - MORNING</p>
    <p class="screenplay-action">The small-town police station is quiet in the early morning light. Coffee brewing in the background. CHIEF JIM HOPPER sits at his desk, steam rising from his mug.</p>
    <p class="screenplay-character">HOPPER</p>
    <p class="screenplay-dialogue">You know what I always say...</p>
    <p class="screenplay-parenthetical">(taking a slow sip)</p>
    <p class="screenplay-dialogue">Mornings are for coffee and contemplation.</p>
    <p class="screenplay-action">He leans back in his chair, looking out the window at the quiet town of Hawkins. Something feels different today.</p>
    <p class="screenplay-character">FLO</p>
    <p class="screenplay-parenthetical">(from the front desk)</p>
    <p class="screenplay-dialogue">Chief, we got a call about some missing kid.</p>
    <p class="screenplay-action">Hopper's peaceful moment is broken. He sets down his coffee and stands.</p>
    <p class="screenplay-character">HOPPER</p>
    <p class="screenplay-dialogue">Well, so much for contemplation.</p>
    <p class="screenplay-transition">CUT TO:</p>
    `;

  const dom = new JSDOM(htmlContent);
  const tempDiv = dom.window.document.createElement("div");
  tempDiv.innerHTML = htmlContent;

  return DOMParser.fromSchema(schema).parse(tempDiv);
}

// Export the initial document and the function to create editor state
module.exports = {
  initialDoc,
  createEditorState,
  createDocument,
};