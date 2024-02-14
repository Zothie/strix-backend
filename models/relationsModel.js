const mongoose = require('mongoose');

const linkSchema = new mongoose.Schema({
  source: String,
  target: String,
  sourceContent: String,
  targetContent: String,
  left: Boolean,
  right: Boolean,
});

const nodeSchema = new mongoose.Schema({
  nodeID: String,
  nodeType: String,
});

const relationSchema = new mongoose.Schema({
  relationID: String,
  name: String,
  nodes: [nodeSchema],
  links: [linkSchema],
  comment: String,
});

const contextNodeSchema = new mongoose.Schema({
    nodeID: String,
    nodeType: String,
    emotion: String,
    instinct: String,
});
const contextSchema = new mongoose.Schema({
    contextID: String,
    name: String,
    comment: String,
    nodes: [contextNodeSchema],
});

const branchSchema = new mongoose.Schema({
  branch: {
    type: String,
    enum: ['development', 'stage', 'production'],
    required: true,
  },
  relations: [relationSchema],
  contexts: [contextSchema],
});

const relationsSchema = new mongoose.Schema({
  gameID: {
    type: String,
    required: true,
  },
  branches: [branchSchema],
});

const Relations = mongoose.model('Relation', relationsSchema, 'relations');

module.exports = Relations;