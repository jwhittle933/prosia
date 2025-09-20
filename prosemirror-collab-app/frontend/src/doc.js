import { DOMParser } from "prosemirror-model";
import { schema } from "./editor/schema.js";

const content = `
<h1>Welcome to the Screenplay Editor</h1>
<p>This is a collaborative ProseMirror editor with screenplay formatting.</p>
<p>You can use the toolbar to apply various screenplay elements like scene headings, character names, and dialogue.</p>
`;

// Use the browser's built-in DOMParser
const htmlParser = new window.DOMParser();
const htmlDoc = htmlParser.parseFromString(content, "text/html");

// Use ProseMirror's DOMParser with our schema
export const doc = DOMParser.fromSchema(schema).parse(htmlDoc.body);