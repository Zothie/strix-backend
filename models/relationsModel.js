import { Schema, model } from "mongoose";
const linkSchema = new Schema({
  source: String,
  target: String,
  sourceContent: String,
  targetContent: String,
  left: Boolean,
  right: Boolean,
});

const nodeSchema = new Schema({
  nodeID: String,
  nodeType: String,
});

const relationSchema = new Schema({
  relationID: String,
  name: String,
  nodes: [nodeSchema],
  links: [linkSchema],
  comment: String,
});

const contextNodeSchema = new Schema({
  nodeID: String,
  nodeType: String,
  emotion: String,
  instinct: String,
});
const contextSchema = new Schema({
  contextID: String,
  name: String,
  comment: String,
  nodes: [contextNodeSchema],
});

const branchSchema = new Schema({
  branch: {
    type: String,
    enum: ["development", "staging", "production"],
    required: true,
  },
  relations: [relationSchema],
  contexts: [contextSchema],
});

const relationsSchema = new Schema({
  gameID: {
    type: String,
    required: true,
  },
  branches: [branchSchema],
});

export const Relations = model("Relation", relationsSchema, "relations");
