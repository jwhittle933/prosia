import { Schema } from "prosemirror-model";
import { nodes as basicNodes, marks as basicMarks } from "prosemirror-schema-basic";

// Create a simple schema without lists and tables for now
export const schema = new Schema({
    nodes: basicNodes,
    marks: basicMarks
});