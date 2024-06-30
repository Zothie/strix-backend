import { Schema, model } from "mongoose";
const planningTreeSubnodeSchema = new Schema({
  nodeID: {
    type: String,
    required: true,
  },
  isGameplay: Boolean,
  gameplayName: String,
  isCategory: Boolean,
  positionX: String,
  positionY: String,
  relations: [String],
  subnodes: [],
});

planningTreeSubnodeSchema.add({
  subnodes: [planningTreeSubnodeSchema],
});

const planningTreePlanningTypeSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: [
      "entity",
      "gameplay",
      "events",
      "locations",
      "userinterface",
      "gameoverview",
    ],
  },
  nodes: [planningTreeSubnodeSchema],
});

const planningTreeBranchSchema = new Schema({
  branch: {
    type: String,
    enum: ["development", "staging", "production"],
    required: true,
  },
  planningTypes: [planningTreePlanningTypeSchema],
});

const planningTreeSchema = new Schema({
  gameID: {
    type: String,
    required: true,
  },
  branches: [planningTreeBranchSchema],
});

export const PlanningTreeModel = model("Planning", planningTreeSchema);
