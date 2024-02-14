const mongoose = require('mongoose');

const planningTreeSubnodeSchema = new mongoose.Schema({
  nodeID: {
    type: String,
    required: true,
  },
  isGameplay: Boolean,
  gameplayName: String,
  positionX: String,
  positionY: String,
  relations: [String],
  subnodes: [],
});

planningTreeSubnodeSchema.add({
  subnodes: [planningTreeSubnodeSchema],
});

const planningTreePlanningTypeSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['entity', 'gameplay', 'events', 'locations', 'userinterface', 'gameoverview'],
  },
  nodes: [planningTreeSubnodeSchema],
});

const planningTreeBranchSchema = new mongoose.Schema({
  branch: {
    type: String,
    enum: ['development', 'stage', 'production'],
    required: true,
  },
  planningTypes: [planningTreePlanningTypeSchema],
});

const planningTreeSchema = new mongoose.Schema({
  gameID: {
    type: String,
    required: true,
  },
  branches: [planningTreeBranchSchema],
});

const PlanningTreeModel = mongoose.model('Planning', planningTreeSchema);

module.exports = PlanningTreeModel;