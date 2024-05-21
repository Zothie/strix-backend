import { Schema, model } from 'mongoose';
const dashboardSchema = new Schema({
  id: String,
  name: String,
  linkName: String,
  charts: String
});

const branchSchema = new Schema({
  branch: String,
  dashboards: [dashboardSchema],
  profileCompositionPresets: String,
});

const gameSchema = new Schema({
  gameID: String,
  branches: [branchSchema],
});

export const charts = model('charts', gameSchema);

